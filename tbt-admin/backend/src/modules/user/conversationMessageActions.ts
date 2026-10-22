import type { FastifyReply, FastifyRequest } from 'fastify';
import { canEditMessage } from '../../lib/chatMessageActionRules.js';
import {
  DM_BODY_MAX,
  canDeleteDm,
  dmSenderMemberId,
  isValidDmReaction,
  nextDmReaction,
  validateForwardTargets,
} from '../../lib/dmMessageActionRules.js';

// Member actions on their direct (member ↔ TBT team) conversation messages:
//   PUT    /api/user/conversations/:id/messages/:messageId          edit own message
//   DELETE /api/user/conversations/:id/messages/:messageId          delete (?forEveryone=true)
//   POST   /api/user/conversations/:id/messages/:messageId/react    set / change / remove reaction
//   POST   /api/user/conversations/:id/messages/:messageId/forward  copy to other own conversations
// Every action is scoped to a conversation the member owns. Edits, deletes and
// reactions emit `chat:message_updated` to the conversation room; a forward is
// a new message and emits the same `chat:message` as a normal send.

function ok(reply: FastifyReply, data: unknown) {
  return reply.send({ success: true, data, error: null });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

interface DmRow {
  id: string;
  sender_type: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_for_everyone: boolean;
}

type Params = { id: string; messageId: string };

/** The message, only if it is in a conversation this member owns. */
async function loadOwnConversationMessage(req: FastifyRequest, conversationId: string, messageId: string): Promise<DmRow | null> {
  const rows = await req.server.prisma.$queryRawUnsafe<DmRow[]>(
    `SELECT dm.id::text AS id, dm.sender_type::text AS sender_type, dm.sender_id::text AS sender_id, dm.body, dm.media_url, dm.media_type,
            dm.created_at, dm.edited_at, dm.deleted_at, dm.deleted_for_everyone
       FROM direct_messages dm
       JOIN conversations c ON c.id = dm.conversation_id
      WHERE dm.id = $1::uuid AND dm.conversation_id = $2::uuid AND c.member_id = $3::uuid`,
    messageId,
    conversationId,
    req.memberId!,
  );
  return rows[0] ?? null;
}

function emitUpdated(req: FastifyRequest, conversationId: string, messageId: string, change: string) {
  (req.server as any).io?.to(`conversation:${conversationId}`).emit('chat:message_updated', { conversationId, messageId, change });
}

const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function editConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  const { body } = (req.body ?? {}) as { body?: unknown };
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) return fail(reply, 400, 'Message cannot be empty');
  if (text.length > DM_BODY_MAX) return fail(reply, 400, `Message must be ${DM_BODY_MAX} characters or fewer`);

  try {
    const m = await loadOwnConversationMessage(req, id, messageId);
    if (!m) return fail(reply, 404, 'Message not found');
    const check = canEditMessage({
      senderMemberId: dmSenderMemberId({ senderType: m.sender_type, senderId: m.sender_id }),
      requesterMemberId: req.memberId!,
      createdAt: new Date(m.created_at),
      deletedAt: m.deleted_at ? new Date(m.deleted_at) : null,
      now: new Date(),
    });
    if (!check.allowed) return fail(reply, check.code === 'FORBIDDEN' ? 403 : 400, check.message ?? 'Cannot edit this message');
    if (!m.body && m.media_url) return fail(reply, 400, 'Only text messages can be edited');

    const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string; body: string; edited_at: Date }>>(
      `UPDATE direct_messages SET body = $1, edited_at = NOW() WHERE id = $2::uuid RETURNING id::text AS id, body, edited_at`,
      text,
      messageId,
    );
    emitUpdated(req, id, messageId, 'edited');
    return ok(reply, { id: rows[0].id, body: rows[0].body, editedAt: rows[0].edited_at });
  } catch (err) {
    req.log.error({ err }, 'edit conversation message failed');
    return fail(reply, 503, 'Could not edit the message. Please try again.');
  }
}

export async function deleteConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  const forEveryone = (req.query as { forEveryone?: string })?.forEveryone === 'true';
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');

  try {
    const m = await loadOwnConversationMessage(req, id, messageId);
    if (!m) return fail(reply, 404, 'Message not found');
    const check = canDeleteDm({
      senderType: m.sender_type,
      senderId: m.sender_id,
      requesterMemberId: req.memberId!,
      forEveryone,
      deletedForEveryone: m.deleted_for_everyone,
    });
    if (!check.allowed) return fail(reply, check.code === 'FORBIDDEN' ? 403 : 400, check.message ?? 'Cannot delete this message');

    await req.server.prisma.$executeRawUnsafe(
      `UPDATE direct_messages SET deleted_at = NOW(), deleted_for_everyone = $2 WHERE id = $1::uuid`,
      messageId,
      forEveryone,
    );
    emitUpdated(req, id, messageId, forEveryone ? 'deleted_for_everyone' : 'deleted_for_me');
    return ok(reply, { id: messageId, deleted: true, forEveryone });
  } catch (err) {
    req.log.error({ err }, 'delete conversation message failed');
    return fail(reply, 503, 'Could not delete the message. Please try again.');
  }
}

export async function reactConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  const { emoji } = (req.body ?? {}) as { emoji?: unknown };
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  if (!isValidDmReaction(emoji)) return fail(reply, 400, 'Unsupported reaction');
  const memberId = req.memberId!;

  try {
    const m = await loadOwnConversationMessage(req, id, messageId);
    if (!m) return fail(reply, 404, 'Message not found');
    if (m.deleted_at) return fail(reply, 400, 'Cannot react to a deleted message');

    const mine = await req.server.prisma.$queryRawUnsafe<Array<{ emoji: string }>>(
      `SELECT emoji FROM direct_message_reactions WHERE message_id = $1::uuid AND sender_type = 'member' AND sender_id = $2::uuid`,
      messageId,
      memberId,
    );
    const next = nextDmReaction(mine[0]?.emoji ?? null, emoji);
    await req.server.prisma.$transaction([
      req.server.prisma.$executeRawUnsafe(
        `DELETE FROM direct_message_reactions WHERE message_id = $1::uuid AND sender_type = 'member' AND sender_id = $2::uuid`,
        messageId,
        memberId,
      ),
      ...(next
        ? [req.server.prisma.$executeRawUnsafe(
            `INSERT INTO direct_message_reactions (message_id, sender_type, sender_id, emoji) VALUES ($1::uuid, 'member', $2::uuid, $3)`,
            messageId,
            memberId,
            next,
          )]
        : []),
    ]);
    emitUpdated(req, id, messageId, 'reaction');
    return ok(reply, { id: messageId, emoji: next });
  } catch (err) {
    req.log.error({ err }, 'react to conversation message failed');
    return fail(reply, 503, 'Could not save the reaction. Please try again.');
  }
}

export async function forwardConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  const { toConversationIds } = (req.body ?? {}) as { toConversationIds?: unknown };
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  const targets = validateForwardTargets(toConversationIds);
  if (!targets.ok) return fail(reply, 400, targets.error);
  const memberId = req.memberId!;
  const prisma = req.server.prisma;

  try {
    const m = await loadOwnConversationMessage(req, id, messageId);
    if (!m) return fail(reply, 404, 'Message not found');
    if (m.deleted_at) return fail(reply, 400, 'Cannot forward a deleted message');
    if (!m.body && !m.media_url) return fail(reply, 400, 'Nothing to forward');

    const owned = await prisma.conversation.findMany({
      where: { id: { in: targets.value }, memberId },
      select: { id: true, status: true, subject: true },
    });
    if (owned.length !== targets.value.length) return fail(reply, 404, 'Conversation not found');

    const created = await prisma.$transaction(async (tx) => {
      const out: Array<{ conversationId: string; reopened: boolean; subject: string; message: any }> = [];
      for (const c of owned) {
        const reopened = c.status === 'closed';
        const message = await tx.directMessage.create({
          data: {
            conversationId: c.id,
            memberId,
            senderId: memberId,
            senderType: 'member',
            body: m.body,
            mediaUrl: m.media_url,
            mediaType: m.media_type,
            forwardedFromMessageId: messageId,
          },
        });
        await tx.conversation.update({
          where: { id: c.id },
          data: { lastMessageAt: new Date(), adminUnreadCount: { increment: 1 }, ...(reopened && { status: 'open' }) },
        });
        out.push({ conversationId: c.id, reopened, subject: c.subject, message });
      }
      return out;
    });

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } });
    const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member';
    const io = (req.server as any).io;
    for (const { conversationId, reopened, subject, message } of created) {
      io?.to(`conversation:${conversationId}`).emit('chat:message', {
        conversationId,
        message: {
          id: message.id,
          senderId: memberId,
          senderType: 'member',
          senderName: memberName,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          replyToId: null,
          createdAt: message.createdAt,
        },
      });
      if (reopened) {
        io?.to(`conversation:${conversationId}`).emit('chat:conversation_reopened', { conversationId });
        io?.to('admin').emit('chat:conversation_new', { conversationId, memberName, subject, reopened: true });
      }
      io?.to('admin').emit('chat:unread_ping', { conversationId });
    }
    return reply.status(201).send({
      success: true,
      data: { forwardedTo: created.map((c) => ({ conversationId: c.conversationId, messageId: c.message.id })) },
      error: null,
    });
  } catch (err) {
    req.log.error({ err }, 'forward conversation message failed');
    return fail(reply, 503, 'Could not forward the message. Please try again.');
  }
}
