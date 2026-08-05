/**
 * Group chat controller — WhatsApp-inspired.
 *
 * Backing tables (raw SQL, NOT in schema.prisma):
 *   chat_groups                — group metadata (name, avatar, description)
 *   chat_group_members         — membership + per-member unread + last read
 *   chat_group_messages        — the actual messages (text/media/reply)
 *   chat_group_reactions       — emoji reactions per message
 *   chat_group_message_reads   — read receipts (WhatsApp blue tick)
 *
 * Auth:
 *   Admin scope (Clerk)  — create/update/delete groups, manage members
 *   Member scope (JWT)   — list groups, send messages, react, read
 *
 * Real-time:
 *   Every group has a Socket.IO room `group:{id}`. Members join it when
 *   the chat screen opens (`join:chat_group`) and leave on close.
 *   Emitted events: group:message:new · group:message:edited ·
 *   group:message:deleted · group:reaction · group:typing · group:read ·
 *   group:member_added · group:member_removed · group:updated
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

type RawGroupRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  is_deleted: boolean;
};

type RawMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
  business_name: string | null;
};

type RawMessageRow = {
  id: string;
  group_id: string;
  sender_member_id: string | null;
  sender_admin_id: string | null;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  is_system: boolean;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_for_everyone: boolean;
};

// ── Shared helpers ──────────────────────────────────────────────────────────

function ok<T>(reply: FastifyReply, data: T, meta?: unknown) {
  return reply.send({ success: true, data, error: null, ...(meta ? { meta } : {}) });
}

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

async function hydrateSenders(
  req: FastifyRequest,
  rows: RawMessageRow[],
): Promise<Array<RawMessageRow & { sender: RawMemberRow | null; reactions: Array<{ emoji: string; memberId: string }>; readByCount: number }>> {
  if (rows.length === 0) return [] as any;
  const senderIds = Array.from(new Set(rows.map((r) => r.sender_member_id).filter((v): v is string => !!v)));
  const messageIds = rows.map((r) => r.id);

  const senders = senderIds.length > 0
    ? await req.server.prisma.$queryRawUnsafe<RawMemberRow[]>(
        `SELECT id, first_name, last_name, profile_photo_url, business_name
         FROM members
         WHERE id = ANY($1::uuid[])`,
        senderIds,
      )
    : [];

  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const reactions = await req.server.prisma.$queryRawUnsafe<
    Array<{ message_id: string; emoji: string; member_id: string }>
  >(
    `SELECT message_id, emoji, member_id
     FROM chat_group_reactions
     WHERE message_id = ANY($1::uuid[])`,
    messageIds,
  );
  const reactionMap = new Map<string, Array<{ emoji: string; memberId: string }>>();
  for (const r of reactions) {
    const arr = reactionMap.get(r.message_id) ?? [];
    arr.push({ emoji: r.emoji, memberId: r.member_id });
    reactionMap.set(r.message_id, arr);
  }

  const readCounts = await req.server.prisma.$queryRawUnsafe<
    Array<{ message_id: string; count: bigint }>
  >(
    `SELECT message_id, COUNT(*)::bigint AS count
     FROM chat_group_message_reads
     WHERE message_id = ANY($1::uuid[])
     GROUP BY message_id`,
    messageIds,
  );
  const readMap = new Map(readCounts.map((r) => [r.message_id, Number(r.count)]));

  return rows.map((row) => ({
    ...row,
    sender: row.sender_member_id ? senderMap.get(row.sender_member_id) ?? null : null,
    reactions: reactionMap.get(row.id) ?? [],
    readByCount: readMap.get(row.id) ?? 0,
  })) as any;
}

function messageJson(m: RawMessageRow & { sender: RawMemberRow | null; reactions: Array<{ emoji: string; memberId: string }>; readByCount: number }) {
  return {
    id: m.id,
    groupId: m.group_id,
    senderMemberId: m.sender_member_id,
    senderAdminId: m.sender_admin_id,
    body: m.deleted_for_everyone ? null : m.body,
    mediaUrl: m.deleted_for_everyone ? null : m.media_url,
    mediaType: m.deleted_for_everyone ? null : m.media_type,
    replyToId: m.reply_to_id,
    isSystem: m.is_system,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
    deletedForEveryone: m.deleted_for_everyone,
    sender: m.sender
      ? {
          id: m.sender.id,
          firstName: m.sender.first_name,
          lastName: m.sender.last_name,
          profilePhotoUrl: m.sender.profile_photo_url,
        }
      : null,
    reactions: m.reactions,
    readByCount: m.readByCount,
  };
}

async function requireMemberOfGroup(req: FastifyRequest, groupId: string): Promise<boolean> {
  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string; role: string }>>(
    `SELECT id, role FROM chat_group_members
     WHERE group_id = $1 AND member_id = $2 AND left_at IS NULL
     LIMIT 1`,
    groupId,
    (req as any).memberId,
  );
  return rows.length > 0;
}

// ── Admin: create/manage groups ─────────────────────────────────────────────

interface CreateGroupBody {
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  memberIds: string[];
}

export async function adminCreateGroupHandler(req: FastifyRequest<{ Body: CreateGroupBody }>, reply: FastifyReply) {
  const { name, avatarUrl, description, memberIds } = req.body;
  if (!name || name.trim().length < 2) return fail(reply, 400, 'BAD_REQUEST', 'Group name is required.');
  if (!Array.isArray(memberIds) || memberIds.length === 0) return fail(reply, 400, 'BAD_REQUEST', 'At least one member is required.');

  const prisma = req.server.prisma;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO chat_groups (name, avatar_url, description)
     VALUES ($1, $2, $3)
     RETURNING id`,
    name.trim(),
    avatarUrl?.trim() || null,
    description?.trim() || null,
  );
  const groupId = rows[0].id;

  // Bulk-insert members. Cast to uuid[] to satisfy the FK type.
  await prisma.$executeRawUnsafe(
    `INSERT INTO chat_group_members (group_id, member_id)
     SELECT $1, UNNEST($2::uuid[])
     ON CONFLICT (group_id, member_id) DO NOTHING`,
    groupId,
    memberIds,
  );

  const group = await prisma.$queryRawUnsafe<RawGroupRow[]>(`SELECT * FROM chat_groups WHERE id = $1`, groupId);
  const io = (req.server as any).io;
  if (io) {
    // Notify every member so their group list refreshes.
    for (const mid of memberIds) io.to(`user:${mid}`).emit('group:added', { groupId });
  }
  return ok(reply, groupToJson(group[0]));
}

export async function adminListGroupsHandler(req: FastifyRequest, reply: FastifyReply) {
  const groups = await req.server.prisma.$queryRawUnsafe<Array<RawGroupRow & { member_count: bigint; message_count: bigint }>>(`
    SELECT g.*,
           (SELECT COUNT(*)::bigint FROM chat_group_members m WHERE m.group_id = g.id AND m.left_at IS NULL) AS member_count,
           (SELECT COUNT(*)::bigint FROM chat_group_messages msg WHERE msg.group_id = g.id AND msg.deleted_for_everyone = false) AS message_count
    FROM chat_groups g
    WHERE g.is_deleted = false
    ORDER BY g.last_message_at DESC
  `);
  return ok(
    reply,
    groups.map((g) => ({
      ...groupToJson(g),
      memberCount: Number(g.member_count),
      messageCount: Number(g.message_count),
    })),
  );
}

interface UpdateGroupBody {
  name?: string;
  avatarUrl?: string | null;
  description?: string | null;
}

export async function adminUpdateGroupHandler(req: FastifyRequest<{ Params: { id: string }; Body: UpdateGroupBody }>, reply: FastifyReply) {
  const { id } = req.params;
  const { name, avatarUrl, description } = req.body;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_groups
     SET name        = COALESCE($2, name),
         avatar_url  = COALESCE($3, avatar_url),
         description = COALESCE($4, description),
         updated_at  = NOW()
     WHERE id = $1 AND is_deleted = false`,
    id,
    name ?? null,
    avatarUrl ?? null,
    description ?? null,
  );
  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:updated', { groupId: id });
  return ok(reply, { updated: true });
}

export async function adminDeleteGroupHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_groups SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
    req.params.id,
  );
  const io = (req.server as any).io;
  if (io) io.to(`group:${req.params.id}`).emit('group:deleted', { groupId: req.params.id });
  return ok(reply, { deleted: true });
}

interface AddMembersBody {
  memberIds: string[];
}

export async function adminAddMembersHandler(req: FastifyRequest<{ Params: { id: string }; Body: AddMembersBody }>, reply: FastifyReply) {
  const { id } = req.params;
  const { memberIds } = req.body;
  if (!Array.isArray(memberIds) || memberIds.length === 0) return fail(reply, 400, 'BAD_REQUEST', 'memberIds required.');
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO chat_group_members (group_id, member_id)
     SELECT $1, UNNEST($2::uuid[])
     ON CONFLICT (group_id, member_id) DO UPDATE SET left_at = NULL`,
    id,
    memberIds,
  );
  const io = (req.server as any).io;
  if (io) {
    for (const mid of memberIds) io.to(`user:${mid}`).emit('group:added', { groupId: id });
    io.to(`group:${id}`).emit('group:member_added', { groupId: id, memberIds });
  }
  return ok(reply, { added: memberIds.length });
}

export async function adminRemoveMemberHandler(req: FastifyRequest<{ Params: { id: string; memberId: string } }>, reply: FastifyReply) {
  const { id, memberId } = req.params;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_members SET left_at = NOW()
     WHERE group_id = $1 AND member_id = $2 AND left_at IS NULL`,
    id,
    memberId,
  );
  const io = (req.server as any).io;
  if (io) {
    io.to(`user:${memberId}`).emit('group:removed', { groupId: id });
    io.to(`group:${id}`).emit('group:member_removed', { groupId: id, memberId });
  }
  return ok(reply, { removed: true });
}

// ── Member scope ────────────────────────────────────────────────────────────

export async function memberListMyGroupsHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = (req as any).memberId as string;
  const rows = await req.server.prisma.$queryRawUnsafe<
    Array<RawGroupRow & { unread_count: number; last_message_body: string | null; last_message_at_actual: Date | null; last_sender_first_name: string | null; last_sender_last_name: string | null }>
  >(`
    SELECT g.*,
           m.unread_count,
           lm.body AS last_message_body,
           lm.created_at AS last_message_at_actual,
           ms.first_name AS last_sender_first_name,
           ms.last_name AS last_sender_last_name
    FROM chat_group_members m
    JOIN chat_groups g ON g.id = m.group_id
    LEFT JOIN LATERAL (
      SELECT body, created_at, sender_member_id
      FROM chat_group_messages
      WHERE group_id = g.id AND deleted_for_everyone = false
      ORDER BY created_at DESC
      LIMIT 1
    ) lm ON true
    LEFT JOIN members ms ON ms.id = lm.sender_member_id
    WHERE m.member_id = $1 AND m.left_at IS NULL AND g.is_deleted = false
    ORDER BY g.last_message_at DESC
  `, memberId);

  return ok(
    reply,
    rows.map((r) => ({
      ...groupToJson(r),
      unreadCount: r.unread_count,
      lastMessage: r.last_message_body
        ? {
            body: r.last_message_body,
            createdAt: r.last_message_at_actual,
            senderName: [r.last_sender_first_name, r.last_sender_last_name].filter(Boolean).join(' ') || null,
          }
        : null,
    })),
  );
}

export async function memberGetGroupHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const groups = await req.server.prisma.$queryRawUnsafe<RawGroupRow[]>(
    `SELECT * FROM chat_groups WHERE id = $1 AND is_deleted = false`,
    id,
  );
  if (groups.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');

  const members = await req.server.prisma.$queryRawUnsafe<Array<RawMemberRow & { role: string; joined_at: Date }>>(
    `SELECT m.id, m.first_name, m.last_name, m.profile_photo_url, m.business_name,
            cgm.role, cgm.joined_at
     FROM chat_group_members cgm
     JOIN members m ON m.id = cgm.member_id
     WHERE cgm.group_id = $1 AND cgm.left_at IS NULL
     ORDER BY cgm.joined_at ASC`,
    id,
  );

  return ok(reply, {
    ...groupToJson(groups[0]),
    members: members.map((m) => ({
      id: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      profilePhotoUrl: m.profile_photo_url,
      businessName: m.business_name,
      role: m.role,
      joinedAt: m.joined_at,
    })),
  });
}

export async function memberListMessagesHandler(req: FastifyRequest<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const before = req.query.before ? new Date(req.query.before) : null;

  const rows = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `SELECT * FROM chat_group_messages
     WHERE group_id = $1
       AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
     ORDER BY created_at DESC
     LIMIT $3`,
    id,
    before,
    limit,
  );

  const hydrated = await hydrateSenders(req, rows.reverse());
  return ok(reply, hydrated.map(messageJson));
}

interface SendMessageBody {
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  replyToId?: string;
}

export async function memberSendMessageHandler(req: FastifyRequest<{ Params: { id: string }; Body: SendMessageBody }>, reply: FastifyReply) {
  const { id } = req.params;
  const { body, mediaUrl, mediaType, replyToId } = req.body;
  const memberId = (req as any).memberId as string;

  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");
  if (!body?.trim() && !mediaUrl) return fail(reply, 400, 'BAD_REQUEST', 'Message body or media required.');
  if (body && body.length > 5000) return fail(reply, 400, 'BAD_REQUEST', 'Message body too long.');

  const prisma = req.server.prisma;

  const inserted = await prisma.$queryRawUnsafe<RawMessageRow[]>(
    `INSERT INTO chat_group_messages
       (group_id, sender_member_id, body, media_url, media_type, reply_to_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    id,
    memberId,
    body?.trim() || null,
    mediaUrl || null,
    mediaType || null,
    replyToId || null,
  );

  // Bump last_message_at + unread counts for everyone except the sender.
  await prisma.$executeRawUnsafe(
    `UPDATE chat_groups SET last_message_at = NOW() WHERE id = $1`,
    id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE chat_group_members
     SET unread_count = unread_count + 1
     WHERE group_id = $1 AND member_id <> $2 AND left_at IS NULL`,
    id,
    memberId,
  );

  const hydrated = await hydrateSenders(req, inserted);
  const messageJsonPayload = messageJson(hydrated[0]);

  const io = (req.server as any).io;
  if (io) {
    io.to(`group:${id}`).emit('group:message:new', messageJsonPayload);
    // Also alert offline members via their user room so their group list updates.
    const otherMembers = await prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
      `SELECT member_id FROM chat_group_members WHERE group_id = $1 AND member_id <> $2 AND left_at IS NULL`,
      id,
      memberId,
    );
    for (const om of otherMembers) io.to(`user:${om.member_id}`).emit('group:bumped', { groupId: id });
  }

  return ok(reply, messageJsonPayload);
}

export async function memberEditMessageHandler(req: FastifyRequest<{ Params: { id: string; messageId: string }; Body: { body: string } }>, reply: FastifyReply) {
  const { id, messageId } = req.params;
  const { body } = req.body;
  const memberId = (req as any).memberId as string;

  if (!body?.trim()) return fail(reply, 400, 'BAD_REQUEST', 'Body required.');

  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ sender_member_id: string | null; created_at: Date; deleted_at: Date | null }>>(
    `SELECT sender_member_id, created_at, deleted_at FROM chat_group_messages WHERE id = $1 AND group_id = $2`,
    messageId,
    id,
  );
  if (rows.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');
  if (rows[0].sender_member_id !== memberId) return fail(reply, 403, 'FORBIDDEN', 'Only the sender can edit.');
  if (rows[0].deleted_at) return fail(reply, 400, 'BAD_REQUEST', 'Cannot edit a deleted message.');
  const ageMs = Date.now() - new Date(rows[0].created_at).getTime();
  if (ageMs > 15 * 60 * 1000) return fail(reply, 400, 'TOO_LATE', 'Messages can only be edited within 15 minutes.');

  const updated = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `UPDATE chat_group_messages SET body = $1, edited_at = NOW() WHERE id = $2 RETURNING *`,
    body.trim(),
    messageId,
  );

  const hydrated = await hydrateSenders(req, updated);
  const payload = messageJson(hydrated[0]);

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:message:edited', payload);

  return ok(reply, payload);
}

export async function memberDeleteMessageHandler(req: FastifyRequest<{ Params: { id: string; messageId: string }; Querystring: { forEveryone?: string } }>, reply: FastifyReply) {
  const { id, messageId } = req.params;
  const forEveryone = req.query.forEveryone === 'true';
  const memberId = (req as any).memberId as string;

  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ sender_member_id: string | null }>>(
    `SELECT sender_member_id FROM chat_group_messages WHERE id = $1 AND group_id = $2`,
    messageId,
    id,
  );
  if (rows.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');
  if (forEveryone && rows[0].sender_member_id !== memberId) return fail(reply, 403, 'FORBIDDEN', 'Only the sender can delete for everyone.');

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages
     SET deleted_at = NOW(),
         deleted_for_everyone = $3
     WHERE id = $1 AND group_id = $2`,
    messageId,
    id,
    forEveryone,
  );

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:message:deleted', { messageId, forEveryone });

  return ok(reply, { deleted: true, forEveryone });
}

export async function memberToggleReactionHandler(req: FastifyRequest<{ Params: { id: string; messageId: string }; Body: { emoji: string } }>, reply: FastifyReply) {
  const { id, messageId } = req.params;
  const { emoji } = req.body;
  const memberId = (req as any).memberId as string;

  if (!emoji || emoji.length > 8) return fail(reply, 400, 'BAD_REQUEST', 'Invalid emoji.');
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  // Toggle: if the reaction exists, remove it; else add it.
  const existing = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM chat_group_reactions
     WHERE message_id = $1 AND member_id = $2 AND emoji = $3`,
    messageId,
    memberId,
    emoji,
  );

  let added: boolean;
  if (existing.length > 0) {
    await req.server.prisma.$executeRawUnsafe(
      `DELETE FROM chat_group_reactions WHERE id = $1`,
      existing[0].id,
    );
    added = false;
  } else {
    await req.server.prisma.$executeRawUnsafe(
      `INSERT INTO chat_group_reactions (message_id, member_id, emoji) VALUES ($1, $2, $3)`,
      messageId,
      memberId,
      emoji,
    );
    added = true;
  }

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:reaction', { messageId, memberId, emoji, added });

  return ok(reply, { added, emoji });
}

export async function memberMarkReadHandler(req: FastifyRequest<{ Params: { id: string }; Body: { messageId: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  const { messageId } = req.body;
  const memberId = (req as any).memberId as string;

  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO chat_group_message_reads (message_id, member_id)
     VALUES ($1, $2)
     ON CONFLICT (message_id, member_id) DO NOTHING`,
    messageId,
    memberId,
  );

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_members
     SET unread_count = 0,
         last_read_message_id = $3,
         last_read_at = NOW()
     WHERE group_id = $1 AND member_id = $2`,
    id,
    memberId,
    messageId,
  );

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:read', { memberId, messageId });

  return ok(reply, { marked: true });
}

export async function memberSearchMessagesHandler(req: FastifyRequest<{ Params: { id: string }; Querystring: { q?: string; limit?: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  const q = req.query.q?.trim();
  if (!q) return ok(reply, []);
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const rows = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `SELECT * FROM chat_group_messages
     WHERE group_id = $1
       AND deleted_for_everyone = false
       AND body ILIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    id,
    `%${q}%`,
    limit,
  );

  const hydrated = await hydrateSenders(req, rows);
  return ok(reply, hydrated.map(messageJson));
}

export async function memberLeaveGroupHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  const memberId = (req as any).memberId as string;

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_members SET left_at = NOW()
     WHERE group_id = $1 AND member_id = $2 AND left_at IS NULL`,
    id,
    memberId,
  );

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:member_removed', { groupId: id, memberId });

  return ok(reply, { left: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupToJson(g: RawGroupRow) {
  return {
    id: g.id,
    name: g.name,
    avatarUrl: g.avatar_url,
    description: g.description,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    lastMessageAt: g.last_message_at,
  };
}
