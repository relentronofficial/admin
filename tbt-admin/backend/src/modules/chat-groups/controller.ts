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
import { getPresenceBulk } from '../../plugins/socket.js';
import { notifyMembers, filterUnmutedMembers } from '../../lib/notifications.js';

type RawGroupRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  is_deleted: boolean;
  announcement_only?: boolean;
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
  mentioned_member_ids: string[] | null;
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

/**
 * Compact preview of a reply-to parent — enough to render the quoted
 * strip above a child message without a second fetch. Body is truncated
 * to ~120 chars server-side to keep payloads small; the client can
 * always open the full parent by tapping.
 */
interface ReplyPreview {
  id: string;
  body: string | null;
  mediaType: string | null;
  senderName: string | null;
  deletedForEveryone: boolean;
}

type HydratedMessage = RawMessageRow & {
  sender: RawMemberRow | null;
  reactions: Array<{ emoji: string; memberId: string }>;
  readByCount: number;
  readByMemberIds: string[];
  replyToPreview: ReplyPreview | null;
};

async function hydrateSenders(
  req: FastifyRequest,
  rows: RawMessageRow[],
): Promise<HydratedMessage[]> {
  if (rows.length === 0) return [];
  const messageIds = rows.map((r) => r.id);
  const replyParentIds = Array.from(
    new Set(rows.map((r) => r.reply_to_id).filter((v): v is string => !!v)),
  );
  const senderIds = new Set<string>();
  for (const r of rows) if (r.sender_member_id) senderIds.add(r.sender_member_id);

  // Fetch reply parents in one round trip and add their sender ids to the
  // member fetch so we can attach senderName to every quote in one pass.
  const parentRows = replyParentIds.length > 0
    ? await req.server.prisma.$queryRawUnsafe<
        Array<Pick<RawMessageRow, 'id' | 'sender_member_id' | 'body' | 'media_type' | 'deleted_for_everyone'>>
      >(
        `SELECT id, sender_member_id, body, media_type, deleted_for_everyone
         FROM chat_group_messages
         WHERE id = ANY($1::uuid[])`,
        replyParentIds,
      )
    : [];
  for (const p of parentRows) if (p.sender_member_id) senderIds.add(p.sender_member_id);

  const senderIdArr = Array.from(senderIds);
  const senders = senderIdArr.length > 0
    ? await req.server.prisma.$queryRawUnsafe<RawMemberRow[]>(
        `SELECT id, first_name, last_name, profile_photo_url, business_name
         FROM members
         WHERE id = ANY($1::uuid[])`,
        senderIdArr,
      )
    : [];
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const parentMap = new Map<string, ReplyPreview>();
  for (const p of parentRows) {
    const sender = p.sender_member_id ? senderMap.get(p.sender_member_id) : undefined;
    const senderName = sender
      ? [sender.first_name, sender.last_name].filter(Boolean).join(' ') || null
      : null;
    const body = p.deleted_for_everyone
      ? null
      : p.body && p.body.length > 120
        ? `${p.body.slice(0, 120)}…`
        : p.body;
    parentMap.set(p.id, {
      id: p.id,
      body,
      mediaType: p.deleted_for_everyone ? null : p.media_type,
      senderName,
      deletedForEveryone: p.deleted_for_everyone,
    });
  }

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

  // Read receipts — return each reader's id so the client can compute
  // WhatsApp-style tick state (single grey = sent, double blue = read by
  // every other group member).
  const reads = await req.server.prisma.$queryRawUnsafe<
    Array<{ message_id: string; member_id: string }>
  >(
    `SELECT message_id, member_id
     FROM chat_group_message_reads
     WHERE message_id = ANY($1::uuid[])`,
    messageIds,
  );
  const readMap = new Map<string, string[]>();
  for (const r of reads) {
    const arr = readMap.get(r.message_id) ?? [];
    arr.push(r.member_id);
    readMap.set(r.message_id, arr);
  }

  return rows.map((row) => {
    const readByMemberIds = readMap.get(row.id) ?? [];
    return {
      ...row,
      sender: row.sender_member_id ? senderMap.get(row.sender_member_id) ?? null : null,
      reactions: reactionMap.get(row.id) ?? [],
      readByCount: readByMemberIds.length,
      readByMemberIds,
      replyToPreview: row.reply_to_id ? parentMap.get(row.reply_to_id) ?? null : null,
    };
  });
}

function messageJson(m: HydratedMessage) {
  return {
    id: m.id,
    groupId: m.group_id,
    senderMemberId: m.sender_member_id,
    senderAdminId: m.sender_admin_id,
    body: m.deleted_for_everyone ? null : m.body,
    mediaUrl: m.deleted_for_everyone ? null : m.media_url,
    mediaType: m.deleted_for_everyone ? null : m.media_type,
    replyToId: m.reply_to_id,
    replyTo: m.replyToPreview,
    isSystem: m.is_system,
    mentionedMemberIds: m.deleted_for_everyone ? [] : (m.mentioned_member_ids ?? []),
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
    readByMemberIds: m.readByMemberIds,
  };
}

async function requireMemberOfGroup(req: FastifyRequest, groupId: string): Promise<boolean> {
  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string; role: string }>>(
    `SELECT id, role FROM chat_group_members
     WHERE group_id = $1::uuid AND member_id = $2::uuid AND left_at IS NULL
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
     SELECT $1::uuid, UNNEST($2::uuid[])
     ON CONFLICT (group_id, member_id) DO NOTHING`,
    groupId,
    memberIds,
  );

  const group = await prisma.$queryRawUnsafe<RawGroupRow[]>(`SELECT * FROM chat_groups WHERE id = $1::uuid`, groupId);
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

/**
 * Admin-scope: fetch a single group + its full member roster.
 * Used by the admin panel's edit-group modal to render the "Members"
 * tab and to seed the "already added" filter of the add-members picker.
 * No admin bypass required — Clerk auth already gate-keeps the route.
 */
export async function adminGetGroupHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const groups = await req.server.prisma.$queryRawUnsafe<RawGroupRow[]>(
    `SELECT * FROM chat_groups WHERE id = $1::uuid AND is_deleted = false`,
    id,
  );
  if (groups.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');

  const members = await req.server.prisma.$queryRawUnsafe<
    Array<RawMemberRow & { role: string; joined_at: Date }>
  >(
    `SELECT m.id, m.first_name, m.last_name, m.profile_photo_url, m.business_name,
            cgm.role, cgm.joined_at
     FROM chat_group_members cgm
     JOIN members m ON m.id = cgm.member_id
     WHERE cgm.group_id = $1::uuid AND cgm.left_at IS NULL
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
     WHERE id = $1::uuid AND is_deleted = false`,
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
    `UPDATE chat_groups SET is_deleted = true, updated_at = NOW() WHERE id = $1::uuid`,
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
     SELECT $1::uuid, UNNEST($2::uuid[])
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
     WHERE group_id = $1::uuid AND member_id = $2::uuid AND left_at IS NULL`,
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
    WHERE m.member_id = $1::uuid AND m.left_at IS NULL AND g.is_deleted = false
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
    `SELECT * FROM chat_groups WHERE id = $1::uuid AND is_deleted = false`,
    id,
  );
  if (groups.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');

  const members = await req.server.prisma.$queryRawUnsafe<Array<RawMemberRow & { role: string; joined_at: Date }>>(
    `SELECT m.id, m.first_name, m.last_name, m.profile_photo_url, m.business_name,
            cgm.role, cgm.joined_at
     FROM chat_group_members cgm
     JOIN members m ON m.id = cgm.member_id
     WHERE cgm.group_id = $1::uuid AND cgm.left_at IS NULL
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
     WHERE group_id = $1::uuid
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
  mentionedMemberIds?: string[];
}

export async function memberSendMessageHandler(req: FastifyRequest<{ Params: { id: string }; Body: SendMessageBody }>, reply: FastifyReply) {
  const { id } = req.params;
  const { body, mediaUrl, mediaType, replyToId, mentionedMemberIds } = req.body;
  const memberId = (req as any).memberId as string;

  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");
  if (!body?.trim() && !mediaUrl) return fail(reply, 400, 'BAD_REQUEST', 'Message body or media required.');
  if (body && body.length > 5000) return fail(reply, 400, 'BAD_REQUEST', 'Message body too long.');

  const prisma = req.server.prisma;

  // Announcement-only enforcement: if the group is flagged
  // `announcement_only`, only members with role='admin' can send. Members
  // can still react + read; this is broadcast-style groups.
  const groupMeta = await prisma.$queryRawUnsafe<Array<{ announcement_only: boolean; role: string }>>(
    `SELECT g.announcement_only, cgm.role
     FROM chat_groups g
     JOIN chat_group_members cgm ON cgm.group_id = g.id AND cgm.member_id = $2::uuid AND cgm.left_at IS NULL
     WHERE g.id = $1::uuid`,
    id,
    memberId,
  );
  if (groupMeta.length > 0 && groupMeta[0].announcement_only && groupMeta[0].role !== 'admin') {
    return fail(reply, 403, 'ANNOUNCEMENT_ONLY', 'Only admins can post in this group.');
  }

  // Filter mentioned ids to those who are actually current group members
  // (defence-in-depth — client sends whatever it wants).
  let validatedMentions: string[] = [];
  if (Array.isArray(mentionedMemberIds) && mentionedMemberIds.length > 0) {
    const rows = await prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
      `SELECT member_id FROM chat_group_members
       WHERE group_id = $1::uuid AND left_at IS NULL AND member_id = ANY($2::uuid[])`,
      id,
      mentionedMemberIds,
    );
    validatedMentions = rows.map((r) => r.member_id);
  }

  const inserted = await prisma.$queryRawUnsafe<RawMessageRow[]>(
    `INSERT INTO chat_group_messages
       (group_id, sender_member_id, body, media_url, media_type, reply_to_id, mentioned_member_ids)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::uuid[])
     RETURNING *`,
    id,
    memberId,
    body?.trim() || null,
    mediaUrl || null,
    mediaType || null,
    replyToId || null,
    validatedMentions,
  );

  // Bump last_message_at + unread counts for everyone except the sender.
  await prisma.$executeRawUnsafe(
    `UPDATE chat_groups SET last_message_at = NOW() WHERE id = $1::uuid`,
    id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE chat_group_members
     SET unread_count = unread_count + 1
     WHERE group_id = $1::uuid AND member_id <> $2::uuid AND left_at IS NULL`,
    id,
    memberId,
  );

  const hydrated = await hydrateSenders(req, inserted);
  const messageJsonPayload = messageJson(hydrated[0]);

  const io = (req.server as any).io;
  if (io) {
    io.to(`group:${id}`).emit('group:message:new', messageJsonPayload);
    // Send stronger mention pings to every explicitly-@'d member so their
    // client can distinguish "someone talked in a group" from "someone
    // called me out by name". Fires per user room even if they're not
    // currently in the group room.
    for (const mid of validatedMentions) {
      if (mid === memberId) continue; // never ping self
      io.to(`user:${mid}`).emit('group:mention', {
        groupId: id,
        messageId: messageJsonPayload.id,
        sender: messageJsonPayload.sender,
        body: messageJsonPayload.body,
      });
    }
    // Also alert offline members via their user room so their group list updates.
    const otherMembers = await prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
      `SELECT member_id FROM chat_group_members WHERE group_id = $1::uuid AND member_id <> $2::uuid AND left_at IS NULL`,
      id,
      memberId,
    );
    for (const om of otherMembers) io.to(`user:${om.member_id}`).emit('group:bumped', { groupId: id });
  }

  // Push + in-app notifications for every non-sender group member. Skip
  // muted members from FCM (they still see the socket badge in real time
  // but no lockscreen ping). @mentions get a stronger "You were mentioned"
  // notification instead of the plain "new message" one.
  const senderName = hydrated[0].sender
    ? [hydrated[0].sender.first_name, hydrated[0].sender.last_name].filter(Boolean).join(' ') || 'Someone'
    : 'Someone';
  const groupNameRow = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM chat_groups WHERE id = $1::uuid`,
    id,
  );
  const groupName = groupNameRow[0]?.name ?? 'Group';

  const preview =
    body?.trim()
      ? body.trim().length > 120
        ? `${body.trim().slice(0, 120)}…`
        : body.trim()
      : mediaType
        ? `📎 ${mediaType}`
        : 'sent a message';

  const otherMemberRows = await prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
    `SELECT member_id FROM chat_group_members
     WHERE group_id = $1::uuid AND member_id <> $2::uuid AND left_at IS NULL`,
    id,
    memberId,
  );
  const otherMemberIds = otherMemberRows.map((r) => r.member_id);
  const mentionedIds = validatedMentions.filter((m) => m !== memberId);
  const nonMentionedIds = otherMemberIds.filter((m) => !mentionedIds.includes(m));

  const unmutedMentioned = await filterUnmutedMembers(req.server, id, mentionedIds);
  const unmutedOthers = await filterUnmutedMembers(req.server, id, nonMentionedIds);

  if (unmutedMentioned.length > 0) {
    void notifyMembers(req.server, {
      memberIds: unmutedMentioned,
      title: `${senderName} mentioned you in ${groupName}`,
      body: preview,
      type: 'group_mention',
      actionUrl: `/messages/group/${id}`,
      data: { groupId: id, messageId: messageJsonPayload.id },
    });
  }
  if (unmutedOthers.length > 0) {
    void notifyMembers(req.server, {
      memberIds: unmutedOthers,
      title: `${senderName} in ${groupName}`,
      body: preview,
      type: 'group_message',
      actionUrl: `/messages/group/${id}`,
      data: { groupId: id, messageId: messageJsonPayload.id },
    });
  }

  return ok(reply, messageJsonPayload);
}

export async function memberEditMessageHandler(req: FastifyRequest<{ Params: { id: string; messageId: string }; Body: { body: string } }>, reply: FastifyReply) {
  const { id, messageId } = req.params;
  const { body } = req.body;
  const memberId = (req as any).memberId as string;

  if (!body?.trim()) return fail(reply, 400, 'BAD_REQUEST', 'Body required.');

  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ sender_member_id: string | null; created_at: Date; deleted_at: Date | null }>>(
    `SELECT sender_member_id, created_at, deleted_at FROM chat_group_messages WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId,
    id,
  );
  if (rows.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');
  if (rows[0].sender_member_id !== memberId) return fail(reply, 403, 'FORBIDDEN', 'Only the sender can edit.');
  if (rows[0].deleted_at) return fail(reply, 400, 'BAD_REQUEST', 'Cannot edit a deleted message.');
  const ageMs = Date.now() - new Date(rows[0].created_at).getTime();
  if (ageMs > 15 * 60 * 1000) return fail(reply, 400, 'TOO_LATE', 'Messages can only be edited within 15 minutes.');

  const updated = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `UPDATE chat_group_messages SET body = $1, edited_at = NOW() WHERE id = $2::uuid RETURNING *`,
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

  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ sender_member_id: string | null }>>(
    `SELECT sender_member_id FROM chat_group_messages WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId,
    id,
  );
  if (rows.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');
  if (forEveryone && rows[0].sender_member_id !== memberId) return fail(reply, 403, 'FORBIDDEN', 'Only the sender can delete for everyone.');

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages
     SET deleted_at = NOW(),
         deleted_for_everyone = $3
     WHERE id = $1::uuid AND group_id = $2::uuid`,
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
     WHERE message_id = $1::uuid AND member_id = $2::uuid AND emoji = $3`,
    messageId,
    memberId,
    emoji,
  );

  let added: boolean;
  if (existing.length > 0) {
    await req.server.prisma.$executeRawUnsafe(
      `DELETE FROM chat_group_reactions WHERE id = $1::uuid`,
      existing[0].id,
    );
    added = false;
  } else {
    await req.server.prisma.$executeRawUnsafe(
      `INSERT INTO chat_group_reactions (message_id, member_id, emoji) VALUES ($1::uuid, $2::uuid, $3)`,
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

  // Fetch the target message's createdAt so we can mark every prior
  // message as read too. Matches WhatsApp semantics — opening a chat
  // reads everything up to (and including) the latest visible message.
  const target = await req.server.prisma.$queryRawUnsafe<Array<{ created_at: Date }>>(
    `SELECT created_at FROM chat_group_messages WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId,
    id,
  );
  if (target.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');

  // Insert reads for every message in this group up to and including
  // the target that the member hasn't already read AND that they didn't
  // send themselves.
  const inserted = await req.server.prisma.$queryRawUnsafe<Array<{ message_id: string }>>(
    `INSERT INTO chat_group_message_reads (message_id, member_id)
     SELECT m.id, $2::uuid
     FROM chat_group_messages m
     WHERE m.group_id = $1::uuid
       AND m.created_at <= $3::timestamptz
       AND (m.sender_member_id IS NULL OR m.sender_member_id <> $2::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM chat_group_message_reads r
         WHERE r.message_id = m.id AND r.member_id = $2::uuid
       )
     RETURNING message_id`,
    id,
    memberId,
    target[0].created_at,
  );

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_members
     SET unread_count = 0,
         last_read_message_id = $3::uuid,
         last_read_at = NOW()
     WHERE group_id = $1::uuid AND member_id = $2::uuid`,
    id,
    memberId,
    messageId,
  );

  const io = (req.server as any).io;
  if (io) {
    // Emit one event per newly-read message so every sender's client can
    // update per-message tick state. Batching to a single array keeps
    // the payload compact even when catching up from a large unread.
    io.to(`group:${id}`).emit('group:read', {
      groupId: id,
      memberId,
      messageIds: inserted.map((r) => r.message_id),
      upToMessageId: messageId,
    });
  }

  return ok(reply, { marked: true, count: inserted.length });
}

export async function memberSearchMessagesHandler(req: FastifyRequest<{ Params: { id: string }; Querystring: { q?: string; limit?: string } }>, reply: FastifyReply) {
  const { id } = req.params;
  const q = req.query.q?.trim();
  if (!q) return ok(reply, []);
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const rows = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `SELECT * FROM chat_group_messages
     WHERE group_id = $1::uuid
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
     WHERE group_id = $1::uuid AND member_id = $2::uuid AND left_at IS NULL`,
    id,
    memberId,
  );

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:member_removed', { groupId: id, memberId });

  return ok(reply, { left: true });
}

/**
 * Presence snapshot for every active member of a group. Data comes from
 * the in-memory Map in plugins/socket.ts (kept fresh by Socket.IO
 * lifecycle events). Real-time updates flow via the presence:update
 * socket broadcast — this endpoint is the initial hydration.
 */
export async function memberGetGroupPresenceHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const memberRows = await req.server.prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
    `SELECT member_id FROM chat_group_members WHERE group_id = $1::uuid AND left_at IS NULL`,
    id,
  );
  const memberIds = memberRows.map((r) => r.member_id);
  return ok(reply, getPresenceBulk(memberIds));
}

// ── Forward, pin, star, mute (WhatsApp-parity Phase 5, 2026-08-06) ─────────

interface ForwardMessageBody {
  toGroupIds: string[];
}

export async function memberForwardMessageHandler(
  req: FastifyRequest<{ Params: { id: string; messageId: string }; Body: ForwardMessageBody }>,
  reply: FastifyReply,
) {
  const { id, messageId } = req.params;
  const { toGroupIds } = req.body;
  const memberId = (req as any).memberId as string;

  if (!Array.isArray(toGroupIds) || toGroupIds.length === 0) {
    return fail(reply, 400, 'BAD_REQUEST', 'toGroupIds required.');
  }
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const prisma = req.server.prisma;

  // Load the source message. If it's deleted-for-everyone, refuse — no
  // resurrecting deleted content by forwarding.
  const source = await prisma.$queryRawUnsafe<
    Array<Pick<RawMessageRow, 'id' | 'body' | 'media_url' | 'media_type' | 'deleted_for_everyone'>>
  >(
    `SELECT id, body, media_url, media_type, deleted_for_everyone
     FROM chat_group_messages
     WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId,
    id,
  );
  if (source.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Source message not found.');
  if (source[0].deleted_for_everyone) return fail(reply, 400, 'DELETED', 'Cannot forward a deleted message.');
  const src = source[0];

  // Filter targets to groups the caller is actually a member of. Silently
  // drops anything they don't have access to — matches WhatsApp behaviour
  // (you can't forward to a group you aren't in).
  const validTargets = await prisma.$queryRawUnsafe<Array<{ group_id: string; announcement_only: boolean; role: string }>>(
    `SELECT cgm.group_id, g.announcement_only, cgm.role
     FROM chat_group_members cgm
     JOIN chat_groups g ON g.id = cgm.group_id AND g.is_deleted = false
     WHERE cgm.member_id = $1::uuid AND cgm.left_at IS NULL
       AND cgm.group_id = ANY($2::uuid[])`,
    memberId,
    toGroupIds,
  );
  // In announcement-only groups, only role='admin' can forward INTO them.
  const eligible = validTargets.filter((t) => !t.announcement_only || t.role === 'admin');
  if (eligible.length === 0) return fail(reply, 403, 'FORBIDDEN', 'No eligible target groups.');

  const insertedIds: Array<{ groupId: string; messageId: string }> = [];
  for (const t of eligible) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO chat_group_messages
         (group_id, sender_member_id, body, media_url, media_type, forwarded_from_message_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
       RETURNING id`,
      t.group_id,
      memberId,
      src.body,
      src.media_url,
      src.media_type,
      src.id,
    );
    if (rows[0]) {
      insertedIds.push({ groupId: t.group_id, messageId: rows[0].id });
      await prisma.$executeRawUnsafe(
        `UPDATE chat_groups SET last_message_at = NOW() WHERE id = $1::uuid`,
        t.group_id,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_members
         SET unread_count = unread_count + 1
         WHERE group_id = $1::uuid AND member_id <> $2::uuid AND left_at IS NULL`,
        t.group_id,
        memberId,
      );
    }
  }

  const io = (req.server as any).io;
  if (io) {
    // Fan-out socket ping so target group members refresh their list.
    for (const inserted of insertedIds) {
      io.to(`group:${inserted.groupId}`).emit('group:message:new', { forwardedMessageId: inserted.messageId });
      // Non-sender members in each target group get a group:bumped ping.
      const others = await prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
        `SELECT member_id FROM chat_group_members WHERE group_id = $1::uuid AND member_id <> $2::uuid AND left_at IS NULL`,
        inserted.groupId,
        memberId,
      );
      for (const om of others) io.to(`user:${om.member_id}`).emit('group:bumped', { groupId: inserted.groupId });
    }
  }

  return ok(reply, { forwardedTo: insertedIds.map((i) => i.groupId), count: insertedIds.length });
}

interface MuteGroupBody {
  /** ISO timestamp. Null / undefined = unmute. */
  until: string | null;
}

export async function memberMuteGroupHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: MuteGroupBody }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const memberId = (req as any).memberId as string;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const until = req.body.until ? new Date(req.body.until) : null;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_members
     SET muted_until = $3::timestamptz
     WHERE group_id = $1::uuid AND member_id = $2::uuid`,
    id,
    memberId,
    until,
  );
  return ok(reply, { mutedUntil: until });
}

export async function memberStarMessageHandler(
  req: FastifyRequest<{ Params: { id: string; messageId: string } }>,
  reply: FastifyReply,
) {
  const { id, messageId } = req.params;
  const memberId = (req as any).memberId as string;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO chat_group_starred_messages (member_id, message_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (member_id, message_id) DO NOTHING`,
    memberId,
    messageId,
  );
  return ok(reply, { starred: true });
}

export async function memberUnstarMessageHandler(
  req: FastifyRequest<{ Params: { id: string; messageId: string } }>,
  reply: FastifyReply,
) {
  const { id, messageId } = req.params;
  const memberId = (req as any).memberId as string;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM chat_group_starred_messages
     WHERE member_id = $1::uuid AND message_id = $2::uuid`,
    memberId,
    messageId,
  );
  return ok(reply, { starred: false });
}

/**
 * Global "Starred messages" across all groups the member is in. Mirrors
 * WhatsApp's "Starred messages" screen (Settings → Starred). Newest first.
 */
export async function memberListStarredHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = (req as any).memberId as string;
  const rows = await req.server.prisma.$queryRawUnsafe<
    Array<RawMessageRow & { starred_at: Date; group_name: string; group_id_out: string }>
  >(
    `SELECT m.*, s.starred_at, g.name AS group_name, g.id AS group_id_out
     FROM chat_group_starred_messages s
     JOIN chat_group_messages m ON m.id = s.message_id
     JOIN chat_groups g ON g.id = m.group_id
     WHERE s.member_id = $1::uuid
       AND m.deleted_for_everyone = false
       AND g.is_deleted = false
       AND EXISTS (
         SELECT 1 FROM chat_group_members cgm
         WHERE cgm.group_id = g.id AND cgm.member_id = $1::uuid AND cgm.left_at IS NULL
       )
     ORDER BY s.starred_at DESC
     LIMIT 200`,
    memberId,
  );

  const hydrated = await hydrateSenders(req, rows);
  return ok(
    reply,
    hydrated.map((h, i) => ({
      ...messageJson(h),
      starredAt: rows[i].starred_at,
      groupName: rows[i].group_name,
      groupId: rows[i].group_id_out,
    })),
  );
}

export async function adminPinMessageHandler(
  req: FastifyRequest<{ Params: { id: string; messageId: string } }>,
  reply: FastifyReply,
) {
  const { id, messageId } = req.params;
  const admin = await req.server.prisma.admin.findFirst({
    where: { clerkId: (req as any).user },
    select: { id: true },
  });

  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE chat_group_messages
     SET is_pinned = true,
         pinned_at = NOW(),
         pinned_by_admin_id = $3::uuid
     WHERE id = $1::uuid AND group_id = $2::uuid AND deleted_for_everyone = false
     RETURNING id`,
    messageId,
    id,
    admin?.id ?? null,
  );
  if (rows.length === 0) return fail(reply, 404, 'NOT_FOUND', 'Message not found.');

  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:pinned', { groupId: id, messageId, pinned: true });
  return ok(reply, { pinned: true });
}

export async function adminUnpinMessageHandler(
  req: FastifyRequest<{ Params: { id: string; messageId: string } }>,
  reply: FastifyReply,
) {
  const { id, messageId } = req.params;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages
     SET is_pinned = false,
         pinned_at = NULL,
         pinned_by_admin_id = NULL
     WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId,
    id,
  );
  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:pinned', { groupId: id, messageId, pinned: false });
  return ok(reply, { pinned: false });
}

/**
 * Members-visible list of currently-pinned messages for a group. Newest
 * pin first — matches WhatsApp's "1 pinned" strip.
 */
export async function memberListPinnedHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  if (!(await requireMemberOfGroup(req, id))) return fail(reply, 403, 'FORBIDDEN', "You aren't in this group.");

  const rows = await req.server.prisma.$queryRawUnsafe<RawMessageRow[]>(
    `SELECT * FROM chat_group_messages
     WHERE group_id = $1::uuid AND is_pinned = true AND deleted_for_everyone = false
     ORDER BY pinned_at DESC
     LIMIT 20`,
    id,
  );
  const hydrated = await hydrateSenders(req, rows);
  return ok(reply, hydrated.map(messageJson));
}

interface SetAnnouncementOnlyBody {
  announcementOnly: boolean;
}

export async function adminSetAnnouncementOnlyHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: SetAnnouncementOnlyBody }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const { announcementOnly } = req.body;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_groups SET announcement_only = $2, updated_at = NOW() WHERE id = $1::uuid`,
    id,
    !!announcementOnly,
  );
  const io = (req.server as any).io;
  if (io) io.to(`group:${id}`).emit('group:updated', { groupId: id, announcementOnly: !!announcementOnly });
  return ok(reply, { announcementOnly: !!announcementOnly });
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
    announcementOnly: (g as any).announcement_only ?? false,
  };
}
