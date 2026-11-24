/**
 * Admin Assistant — `/api/admin-assistant` (Clerk). Answers questions about
 * TBT's data with the read-only tools in lib/assistant.
 *
 * POST /chat { message, conversationId? } streams Server-Sent Events:
 *   {"t":"tool","name":"getBatchSummary"}   — a lookup started
 *   {"t":"answer","text","conversationId","title","tools"} — finished
 *   {"t":"error","message"}
 *
 * The conversation is kept on the server and belongs to one admin; the client
 * never supplies earlier turns. Off when OPENROUTER_API_KEY is not set.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { adminTools, type AdminToolCtx } from '../../lib/assistant/adminTools.js';
import { HISTORY_TURNS, QUESTION_MAX, adminSystemPrompt, conversationTitle, runChatLoop } from '../../lib/assistant/chatLoop.js';
import { AssistantServiceError, openRouterComplete } from '../../lib/assistant/openRouter.js';
import { runTool, toolDefinitions } from '../../lib/assistant/registry.js';

const BURST_LIMIT = 15; // questions per 10 minutes, per admin
const DAILY_LIMIT = 150; // per admin per IST day
const TEAM_DAILY_LIMIT = 600; // everyone together, so a runaway client cannot drain the credit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enabled = () => !!env.OPENROUTER_API_KEY;

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ success: false, data: null, error: message });
}

async function actingAdmin(req: FastifyRequest, reply: FastifyReply) {
  const a = await req.server.prisma.admin.findUnique({
    where: { clerkId: req.user as string },
    select: { id: true, fullName: true, role: true, status: true, deletedAt: true },
  });
  if (!a || a.deletedAt || a.status !== 'active') {
    fail(reply, 403, 'Admin account not found or not active.');
    return null;
  }
  return a;
}

async function overLimit(req: FastifyRequest, adminId: string): Promise<string | null> {
  const [r] = await req.server.prisma.$queryRawUnsafe<Array<{ burst: number; mine: number; team: number }>>(
    `SELECT COUNT(*) FILTER (WHERE c.admin_id = $1::uuid AND m.created_at > NOW() - INTERVAL '10 minutes')::int AS burst,
            COUNT(*) FILTER (WHERE c.admin_id = $1::uuid)::int AS mine,
            COUNT(*)::int AS team
       FROM admin_assistant_messages m JOIN admin_assistant_conversations c ON c.id = m.conversation_id
      WHERE m.role = 'user' AND m.created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`,
    adminId,
  );
  if (r.burst >= BURST_LIMIT) return 'You are asking very quickly. Please wait a few minutes.';
  if (r.mine >= DAILY_LIMIT) return "You have reached today's question limit. It resets at midnight IST.";
  if (r.team >= TEAM_DAILY_LIMIT) return "The team has reached today's question limit. It resets at midnight IST.";
  return null;
}

export async function statusHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const ctx: AdminToolCtx = { prisma: req.server.prisma as any, now: new Date(), admin };
  return reply.send({ success: true, data: { enabled: enabled(), tools: toolDefinitions(adminTools, ctx).map((t) => t.function.name) }, error: null });
}

export async function listConversationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const data = await req.server.prisma.$queryRawUnsafe(
    `SELECT id::text, title, updated_at AS "updatedAt" FROM admin_assistant_conversations
      WHERE admin_id = $1::uuid ORDER BY updated_at DESC LIMIT 50`, admin.id);
  return reply.send({ success: true, data, error: null });
}

export async function getConversationHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Conversation not found.');
  const [own] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, req.params.id, admin.id);
  if (!own) return fail(reply, 404, 'Conversation not found.');
  const messages = await req.server.prisma.$queryRawUnsafe(
    `SELECT * FROM (
       SELECT id::text, role, content, tools, created_at AS "createdAt" FROM admin_assistant_messages
        WHERE conversation_id = $1::uuid ORDER BY created_at DESC LIMIT 200) m ORDER BY m."createdAt"`, req.params.id);
  return reply.send({ success: true, data: { id: req.params.id, messages }, error: null });
}

export async function deleteConversationHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Conversation not found.');
  const n = await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, req.params.id, admin.id);
  if (!n) return fail(reply, 404, 'Conversation not found.');
  return reply.send({ success: true, data: { deleted: true }, error: null });
}

export async function chatHandler(
  req: FastifyRequest<{ Body: { message?: unknown; conversationId?: unknown } }>,
  reply: FastifyReply,
) {
  if (!enabled()) return fail(reply, 503, 'The assistant is not set up yet.');
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;

  const question = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!question) return fail(reply, 400, 'Ask a question first.');
  if (question.length > QUESTION_MAX) return fail(reply, 400, `Please keep your question under ${QUESTION_MAX} characters.`);

  const prisma = req.server.prisma;
  let conversationId = req.body?.conversationId;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let title = conversationTitle(question);
  if (conversationId != null) {
    const [own] = typeof conversationId === 'string' && UUID_RE.test(conversationId)
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT title FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, conversationId, admin.id)
      : [];
    if (!own) return fail(reply, 404, 'Conversation not found.');
    title = own.title;
    history = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT role, content FROM admin_assistant_messages WHERE conversation_id = $1::uuid ORDER BY created_at DESC LIMIT ${HISTORY_TURNS}`, conversationId)).reverse();
  }
  const limited = await overLimit(req, admin.id);
  if (limited) return fail(reply, 429, limited);

  if (conversationId == null) {
    const [c] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO admin_assistant_conversations (admin_id, title) VALUES ($1::uuid, $2) RETURNING id::text`, admin.id, title);
    conversationId = c.id;
  }
  // Saved first, so a question that fails still counts towards the limits.
  await prisma.$executeRawUnsafe(
    `INSERT INTO admin_assistant_messages (conversation_id, role, content) VALUES ($1::uuid, 'user', $2)`, conversationId, question);

  reply.hijack();
  reply.raw.writeHead(200, {
    ...(reply.getHeaders() as Record<string, string>),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (ev: Record<string, unknown>) => {
    if (!reply.raw.writableEnded) reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  send({ t: 'start', conversationId });
  const abort = new AbortController();
  reply.raw.on('close', () => abort.abort());

  try {
    const now = new Date();
    const ctx: AdminToolCtx = { prisma: prisma as any, now, admin };
    const r = await runChatLoop({
      complete: openRouterComplete(env.OPENROUTER_API_KEY!, (info) => req.log.error(info as object, '[admin-assistant] OpenRouter call failed')),
      system: adminSystemPrompt({ adminName: admin.fullName, role: admin.role, today: new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10) }),
      history,
      question,
      tools: toolDefinitions(adminTools, ctx),
      runTool: (name, args) => runTool(adminTools, ctx, name, args, { onError: (err) => req.log.error({ err, tool: name }, '[admin-assistant] tool failed') }),
      onTool: (name) => send({ t: 'tool', name }),
      signal: abort.signal,
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO admin_assistant_messages (conversation_id, role, content, tools, cost_usd) VALUES ($1::uuid, 'assistant', $2, $3::jsonb, $4::numeric)`,
      conversationId, r.text, JSON.stringify(r.toolsUsed), String(r.costUsd));
    await prisma.$executeRawUnsafe(`UPDATE admin_assistant_conversations SET updated_at = NOW() WHERE id = $1::uuid`, conversationId);
    send({ t: 'answer', text: r.text, conversationId, title, tools: r.toolsUsed });
  } catch (err) {
    if (!abort.signal.aborted) {
      if (!(err instanceof AssistantServiceError)) req.log.error({ err }, '[admin-assistant] chat failed');
      send({ t: 'error', message: err instanceof AssistantServiceError ? err.message : 'Sorry, I could not answer just now. Please try again.' });
    }
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end();
  }
}
