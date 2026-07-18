/**
 * AI Content Buddy — Fastify handlers for `/api/ai/*` (user side) and
 * `/api/ai/admin/*` (admin moderation).
 *
 * Ported from the co-worker's Express `routes/ai.js`. Adaptations:
 *   * Auth: `fastify.authenticateUser` sets `req.memberId` (UUID FK to
 *     members), replacing the co-worker's per-device anon UUID.
 *   * Rate limits enforced via `usageGuard.ts` counter table.
 *   * Image upload: base64 in the JSON body (client resizes to <=2 MB
 *     before send). No multipart to keep the route JSON-only for the
 *     Fastify JSON schema; image bytes go straight to Claude, and a
 *     copy is uploaded to R2 for the message history.
 *   * Error shape: standard `{ success, data, error }` envelope used
 *     across every other module.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import {
  generateContentSchema,
  renameConversationSchema,
  saveContentSchema,
  updateSavedContentSchema,
} from './schema.js';
import { generateContent } from './claudeService.js';
import { DAILY_LIMIT, PER_MINUTE_LIMIT, bumpUsage, checkUsage } from './usageGuard.js';
import { uploadBufferToR2 } from '../../lib/r2.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB decoded

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string, extra?: any) {
  return reply.status(status).send({ success: false, data: null, error: { code, message }, ...extra });
}

/** Load a conversation only if it belongs to the caller — 404 otherwise. */
async function requireOwnedConversation(req: FastifyRequest, id: string) {
  const conv = await req.server.prisma.aIConversation.findFirst({
    where: { id, memberId: req.memberId! },
  });
  return conv;
}

// ────────────────────────────────────────────────────────────────
// POST /api/ai/content/create
// ────────────────────────────────────────────────────────────────
export async function generateHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = generateContentSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'empty_input', 'Malformed request payload.');
  const body = parsed.data;
  const memberId = req.memberId!;

  const hasText = body.message && body.message.trim().length > 0;
  const hasImage = body.imageBase64 && body.imageBase64.length > 0;
  if (!hasText && !hasImage) {
    return fail(reply, 400, 'empty_input', 'Please enter or say what content you want to create.');
  }

  // Rate-limit BEFORE spinning up a conversation row so a throttled
  // caller doesn't accumulate empty conversations. Matches the
  // co-worker's guard order.
  const throttle = await checkUsage(req.server.prisma, memberId);
  if (throttle) {
    return reply
      .status(429)
      .header('Retry-After', String(throttle.retryAfterSeconds))
      .send({
        success: false,
        data: null,
        error: {
          code: throttle.code,
          message:
            throttle.code === 'daily_limit_reached'
              ? `Daily limit of ${DAILY_LIMIT} messages reached. Try again tomorrow.`
              : `Please wait a moment — max ${PER_MINUTE_LIMIT} messages per minute.`,
        },
      });
  }

  // Optional image: decode + validate size, upload to R2, and hold a
  // base64 copy for the Claude call.
  let imageForClaude: { mimeType: string; base64: string } | null = null;
  let imageUrl: string | null = null;
  if (hasImage) {
    const mime = (body.imageMimeType ?? 'image/jpeg').toLowerCase();
    if (!/^image\/(jpe?g|png|webp)$/.test(mime)) {
      return fail(reply, 400, 'invalid_image_type', 'Image must be JPEG, PNG, or WebP.');
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(body.imageBase64!, 'base64');
    } catch {
      return fail(reply, 400, 'invalid_image_type', 'Image payload could not be decoded.');
    }
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return fail(reply, 400, 'image_too_large', `Image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`);
    }
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const key = `${memberId}/${crypto.randomUUID()}.${ext}`;
    try {
      imageUrl = await uploadBufferToR2({ bucket: 'ai-content', key, body: buf, contentType: mime });
    } catch (err: any) {
      req.server.log.warn({ err }, 'AI image R2 upload failed — proceeding without URL, image still sent to Claude');
    }
    imageForClaude = { mimeType: mime, base64: buf.toString('base64') };
  }

  // Resolve or create the conversation.
  let conversation = body.conversationId
    ? await requireOwnedConversation(req, body.conversationId)
    : null;
  if (body.conversationId && !conversation) {
    return fail(reply, 404, 'not_found', 'Conversation not found.');
  }
  if (!conversation) {
    conversation = await req.server.prisma.aIConversation.create({
      data: { memberId },
    });
  }

  const priorMessages = await req.server.prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  });
  const isFirstTurn = priorMessages.length === 0;
  const safeMessage = hasText ? body.message!.trim() : 'Describe this image.';
  const inputType = hasImage ? 'image' : body.inputType === 'voice' ? 'voice' : 'text';

  // Persist user turn.
  await req.server.prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      sender: 'user',
      message: safeMessage,
      inputType,
      imageUrl,
      contentType: body.contentType,
      language: body.language,
      tone: body.tone,
    },
  });

  // Claude call.
  let result: { title?: string; content: string };
  try {
    result = await generateContent({
      history: priorMessages.map((m) => ({ sender: m.sender as 'user' | 'assistant', message: m.message })),
      message: safeMessage,
      image: imageForClaude,
      isFirstTurn,
      context: {
        contentType: body.contentType,
        tone: body.tone,
        language: body.language,
        length: body.length,
      },
    });
  } catch (err: any) {
    // Typed error from claudeService — surface code + status.
    const status =
      {
        claude_not_configured: 500,
        claude_auth_error: 502,
        claude_forbidden: 502,
        claude_rate_limited: 429,
        claude_billing_error: 503,
        claude_server_error: 502,
        claude_timeout: 504,
        claude_parse_error: 502,
        claude_error: 502,
      }[err?.code as string] ?? 500;
    req.server.log.error({ err }, 'AI Claude call failed');
    return reply
      .status(status)
      .send({
        success: false,
        data: null,
        error: {
          code: err?.code ?? 'claude_error',
          message: err?.message ?? 'AI service unavailable. Please try again.',
        },
        conversationId: conversation.id,
      });
  }

  // Set title on first turn.
  if (isFirstTurn && result.title) {
    await req.server.prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { title: result.title },
    });
  }

  // Persist assistant turn.
  const assistantMsg = await req.server.prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      sender: 'assistant',
      message: result.content,
      inputType: 'text',
      contentType: body.contentType,
      language: body.language,
      tone: body.tone,
    },
  });

  // Successful — bump usage counters (async, do not block the response).
  void bumpUsage(req.server.prisma, memberId).catch((err) =>
    req.server.log.warn({ err }, 'AI usage counter bump failed'),
  );

  return ok(reply, {
    conversationId: conversation.id,
    messageId: assistantMsg.id,
    content: result.content,
    title: result.title ?? undefined,
    suggestions: ['Make it shorter', 'Add emojis', 'Make it more professional'],
  });
}

// ────────────────────────────────────────────────────────────────
// Conversations (list / messages / rename / delete)
// ────────────────────────────────────────────────────────────────
export async function listConversationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { search } = req.query as { search?: string };
  const where: any = { memberId: req.memberId! };
  if (search && search.trim()) {
    where.title = { contains: search.trim(), mode: 'insensitive' };
  }
  const rows = await req.server.prisma.aIConversation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return ok(reply, rows);
}

export async function getMessagesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const conv = await requireOwnedConversation(req, id);
  if (!conv) return fail(reply, 404, 'not_found', 'Conversation not found.');
  const msgs = await req.server.prisma.aIMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  return ok(reply, msgs);
}

export async function renameConversationHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = renameConversationSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'empty_input', 'Title required.');
  const conv = await requireOwnedConversation(req, id);
  if (!conv) return fail(reply, 404, 'not_found', 'Conversation not found.');
  const updated = await req.server.prisma.aIConversation.update({
    where: { id },
    data: { title: parsed.data.title.trim().slice(0, 120) },
  });
  return ok(reply, updated);
}

export async function deleteConversationHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const conv = await requireOwnedConversation(req, id);
  if (!conv) return fail(reply, 404, 'not_found', 'Conversation not found.');
  await req.server.prisma.aIConversation.delete({ where: { id } });
  return ok(reply, null);
}

// ────────────────────────────────────────────────────────────────
// Saved content (list / save / update / delete)
// ────────────────────────────────────────────────────────────────
export async function listSavedHandler(req: FastifyRequest, reply: FastifyReply) {
  const { category, search } = req.query as { category?: string; search?: string };
  const where: any = { memberId: req.memberId! };
  if (category && category.trim()) where.category = category.trim();
  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { content: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  const rows = await req.server.prisma.savedAIContent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return ok(reply, rows);
}

export async function saveContentHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = saveContentSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'empty_input', 'Title and content required.');
  const body = parsed.data;

  // If a conversationId is provided, verify ownership so members can't
  // reference other people's conversations.
  if (body.conversationId) {
    const conv = await requireOwnedConversation(req, body.conversationId);
    if (!conv) return fail(reply, 404, 'not_found', 'Referenced conversation not found.');
  }

  const created = await req.server.prisma.savedAIContent.create({
    data: {
      memberId: req.memberId!,
      conversationId: body.conversationId ?? null,
      title: body.title.trim(),
      content: body.content,
      category: body.category,
    },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function updateSavedHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateSavedContentSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'empty_input', 'Nothing to update.');

  const existing = await req.server.prisma.savedAIContent.findFirst({
    where: { id, memberId: req.memberId! },
  });
  if (!existing) return fail(reply, 404, 'not_found', 'Saved content not found.');

  const updated = await req.server.prisma.savedAIContent.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.content !== undefined && { content: parsed.data.content }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
    },
  });
  return ok(reply, updated);
}

export async function deleteSavedHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const existing = await req.server.prisma.savedAIContent.findFirst({
    where: { id, memberId: req.memberId! },
  });
  if (!existing) return fail(reply, 404, 'not_found', 'Saved content not found.');
  await req.server.prisma.savedAIContent.delete({ where: { id } });
  return ok(reply, null);
}

// ────────────────────────────────────────────────────────────────
// Admin moderation
// ────────────────────────────────────────────────────────────────
export async function adminListConversationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', search = '' } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));

  const where: any = {};
  if (search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { member: { firstName: { contains: search.trim(), mode: 'insensitive' } } },
      { member: { lastName: { contains: search.trim(), mode: 'insensitive' } } },
      { member: { email: { contains: search.trim(), mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    req.server.prisma.aIConversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    req.server.prisma.aIConversation.count({ where }),
  ]);
  return reply.send({ success: true, data: rows, meta: { total, page: p, limit: l }, error: null });
}

export async function adminGetMessagesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const conv = await req.server.prisma.aIConversation.findUnique({
    where: { id },
    include: { member: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!conv) return fail(reply, 404, 'not_found', 'Conversation not found.');
  const messages = await req.server.prisma.aIMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  return ok(reply, { conversation: conv, messages });
}

export async function adminDeleteConversationHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const conv = await req.server.prisma.aIConversation.findUnique({ where: { id } });
  if (!conv) return fail(reply, 404, 'not_found', 'Conversation not found.');
  await req.server.prisma.aIConversation.delete({ where: { id } });
  return ok(reply, null);
}

export async function adminStatsHandler(req: FastifyRequest, reply: FastifyReply) {
  const [conversations, messages, saved, activeMembers] = await Promise.all([
    req.server.prisma.aIConversation.count(),
    req.server.prisma.aIMessage.count(),
    req.server.prisma.savedAIContent.count(),
    req.server.prisma.aIConversation.findMany({
      distinct: ['memberId'],
      select: { memberId: true },
    }),
  ]);
  return ok(reply, {
    conversations,
    messages,
    savedContent: saved,
    activeMembers: activeMembers.length,
    limits: { dailyPerMember: DAILY_LIMIT, perMinutePerMember: PER_MINUTE_LIMIT },
  });
}
