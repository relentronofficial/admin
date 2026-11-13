import type { FastifyReply, FastifyRequest } from 'fastify';

// DM message actions beyond the existing edit/delete/react/forward:
//   POST   /api/user/conversations/:id/messages/:messageId/star   toggle star
//   GET    /api/user/messages/starred                              list all DM starred messages
//   POST   /api/user/conversations/:id/messages/:messageId/pin    pin a message
//   DELETE /api/user/conversations/:id/messages/:messageId/pin    unpin a message
//   GET    /api/user/conversations/:id/pinned                     get current pinned message
//   GET    /api/user/conversations/:id/messages/:messageId/info   message timestamps

function ok(reply: FastifyReply, data: unknown) {
  return reply.send({ success: true, data, error: null });
}
function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Verify member owns this conversation. */
async function assertOwnsConversation(req: FastifyRequest, conversationId: string): Promise<boolean> {
  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM conversations WHERE id = $1::uuid AND member_id = $2::uuid`,
    conversationId,
    req.memberId!,
  );
  return rows.length > 0;
}

type Params = { id: string; messageId: string };

// ── Star ──────────────────────────────────────────────────────────────────────

export async function starConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  const memberId = req.memberId!;
  const prisma = req.server.prisma;

  try {
    if (!await assertOwnsConversation(req, id)) return fail(reply, 404, 'Conversation not found');

    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM direct_message_stars WHERE member_id = $1::uuid AND message_id = $2::uuid`,
      memberId,
      messageId,
    );
    let starred: boolean;
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM direct_message_stars WHERE member_id = $1::uuid AND message_id = $2::uuid`,
        memberId,
        messageId,
      );
      starred = false;
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO direct_message_stars (member_id, message_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
        memberId,
        messageId,
      );
      starred = true;
    }
    return ok(reply, { messageId, starred });
  } catch (err) {
    req.log.error({ err }, 'star dm message failed');
    return fail(reply, 503, 'Could not update star. Please try again.');
  }
}

export async function listDmStarredMessagesHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const prisma = req.server.prisma;

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      message_id: string;
      starred_at: Date;
      body: string | null;
      media_url: string | null;
      media_type: string | null;
      created_at: Date;
      conversation_id: string;
      sender_type: string;
      sender_id: string;
      sender_first_name: string | null;
      sender_last_name: string | null;
      sender_photo: string | null;
      other_first: string | null;
      other_last: string | null;
    }>>(
      `SELECT
          s.id::text            AS id,
          s.message_id::text    AS message_id,
          s.starred_at,
          dm.body,
          dm.media_url,
          dm.media_type,
          dm.created_at,
          dm.conversation_id::text AS conversation_id,
          dm.sender_type,
          dm.sender_id::text    AS sender_id,
          CASE WHEN dm.sender_type = 'member' THEN sm.first_name       ELSE NULL END AS sender_first_name,
          CASE WHEN dm.sender_type = 'member' THEN sm.last_name        ELSE NULL END AS sender_last_name,
          CASE WHEN dm.sender_type = 'member' THEN sm.profile_photo_url ELSE NULL END AS sender_photo,
          om.first_name         AS other_first,
          om.last_name          AS other_last
         FROM direct_message_stars s
         JOIN direct_messages dm      ON dm.id = s.message_id AND dm.deleted_for_everyone = false
         JOIN conversations c          ON c.id = dm.conversation_id AND c.member_id = $1::uuid
         LEFT JOIN members sm          ON sm.id = dm.sender_id AND dm.sender_type = 'member'
         LEFT JOIN members om          ON om.id = $1::uuid
        WHERE s.member_id = $1::uuid
        ORDER BY s.starred_at DESC
        LIMIT 200`,
      memberId,
    );

    const data = rows.map((r) => ({
      id: r.message_id,
      starredAt: r.starred_at,
      body: r.body,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      createdAt: r.created_at,
      conversationId: r.conversation_id,
      senderType: r.sender_type,
      sender: {
        firstName: r.sender_first_name,
        lastName: r.sender_last_name,
        profilePhotoUrl: r.sender_photo,
      },
      otherPartyName: [r.other_first, r.other_last].filter(Boolean).join(' ') || 'TBT Team',
    }));
    return ok(reply, data);
  } catch (err) {
    req.log.error({ err }, 'list dm starred messages failed');
    return fail(reply, 503, 'Could not load starred messages. Please try again.');
  }
}

// ── Pin ───────────────────────────────────────────────────────────────────────

export async function pinConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  const memberId = req.memberId!;
  const prisma = req.server.prisma;

  try {
    if (!await assertOwnsConversation(req, id)) return fail(reply, 404, 'Conversation not found');

    const msg = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM direct_messages WHERE id = $1::uuid AND conversation_id = $2::uuid AND deleted_for_everyone = false`,
      messageId, id,
    );
    if (!msg.length) return fail(reply, 404, 'Message not found');

    // Unpin any existing pinned message first, then pin the target.
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE direct_messages SET is_pinned = false, pinned_at = NULL, pinned_by = NULL WHERE conversation_id = $1::uuid AND is_pinned = true`,
        id,
      ),
      prisma.$executeRawUnsafe(
        `UPDATE direct_messages SET is_pinned = true, pinned_at = NOW(), pinned_by = $3::uuid WHERE id = $1::uuid AND conversation_id = $2::uuid`,
        messageId, id, memberId,
      ),
    ]);

    (req.server as any).io?.to(`conversation:${id}`).emit('chat:pinned', { conversationId: id, messageId, pinned: true });
    return ok(reply, { conversationId: id, messageId, pinned: true });
  } catch (err) {
    req.log.error({ err }, 'pin dm message failed');
    return fail(reply, 503, 'Could not pin the message. Please try again.');
  }
}

export async function unpinConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');

  try {
    if (!await assertOwnsConversation(req, id)) return fail(reply, 404, 'Conversation not found');

    await req.server.prisma.$executeRawUnsafe(
      `UPDATE direct_messages SET is_pinned = false, pinned_at = NULL, pinned_by = NULL WHERE id = $1::uuid AND conversation_id = $2::uuid`,
      messageId, id,
    );

    (req.server as any).io?.to(`conversation:${id}`).emit('chat:pinned', { conversationId: id, messageId, pinned: false });
    return ok(reply, { conversationId: id, messageId, pinned: false });
  } catch (err) {
    req.log.error({ err }, 'unpin dm message failed');
    return fail(reply, 503, 'Could not unpin the message. Please try again.');
  }
}

export async function getPinnedConversationMessageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  if (!isUuid(id)) return fail(reply, 404, 'Conversation not found');

  try {
    if (!await assertOwnsConversation(req, id)) return fail(reply, 404, 'Conversation not found');

    const rows = await req.server.prisma.$queryRawUnsafe<Array<{
      id: string;
      body: string | null;
      media_url: string | null;
      media_type: string | null;
      created_at: Date;
      pinned_at: Date | null;
      sender_type: string;
    }>>(
      `SELECT id::text AS id, body, media_url, media_type, created_at, pinned_at, sender_type
         FROM direct_messages
        WHERE conversation_id = $1::uuid AND is_pinned = true AND deleted_for_everyone = false
        LIMIT 1`,
      id,
    );
    if (!rows.length) return ok(reply, null);

    const r = rows[0];
    return ok(reply, {
      id: r.id,
      body: r.body,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      createdAt: r.created_at,
      pinnedAt: r.pinned_at,
      senderType: r.sender_type,
    });
  } catch (err) {
    req.log.error({ err }, 'get pinned dm message failed');
    return fail(reply, 503, 'Could not load pinned message. Please try again.');
  }
}

// ── Message Info ──────────────────────────────────────────────────────────────

export async function getDmMessageInfoHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = req.params as Params;
  if (!isUuid(id) || !isUuid(messageId)) return fail(reply, 404, 'Message not found');
  const memberId = req.memberId!;

  try {
    if (!await assertOwnsConversation(req, id)) return fail(reply, 404, 'Conversation not found');

    const rows = await req.server.prisma.$queryRawUnsafe<Array<{
      id: string;
      created_at: Date;
      read_by_member_at: Date | null;
      read_by_admin_at: Date | null;
      sender_type: string;
      sender_id: string;
    }>>(
      `SELECT id::text AS id, created_at, read_by_member_at, read_by_admin_at, sender_type, sender_id::text AS sender_id
         FROM direct_messages
        WHERE id = $1::uuid AND conversation_id = $2::uuid`,
      messageId, id,
    );
    if (!rows.length) return fail(reply, 404, 'Message not found');

    const r = rows[0];
    const isSentByMe = r.sender_type === 'member' && r.sender_id === memberId;

    // For the member's perspective: if they sent it, the "read" timestamp is when
    // the admin opened it; if the admin sent it, it was "read" when the member opened it.
    const readAt = isSentByMe ? r.read_by_admin_at : r.read_by_member_at;

    return ok(reply, {
      messageId,
      sentAt: r.created_at,
      readAt: readAt ?? null,
      sentByMe: isSentByMe,
    });
  } catch (err) {
    req.log.error({ err }, 'get dm message info failed');
    return fail(reply, 503, 'Could not load message info. Please try again.');
  }
}
