import { FastifyRequest, FastifyReply } from 'fastify';
import { notifyMembers } from '../../lib/notifications.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { notifyMember } from '../../lib/memberNotifications.js';

// ── GET /api/conversations ────────────────────────────────────────────────────
export async function listAdminConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { limit: rawLimit, cursor } = (request.query as Record<string, string | undefined>);
  const take = Math.min(Number(rawLimit) || 100, 200);

  const include = {
    member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
    messages: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: { body: true, senderType: true, createdAt: true },
    },
  };

  const conversations = cursor
    ? await request.server.prisma.conversation.findMany({
        take,
        skip: 1,
        cursor: { id: cursor },
        orderBy: { lastMessageAt: 'desc' },
        include,
      })
    : await request.server.prisma.conversation.findMany({
        take,
        orderBy: { lastMessageAt: 'desc' },
        include,
      });

  const mapped = conversations.map((c) => ({
    id:               c.id,
    subject:          c.subject,
    status:           c.status,
    adminUnreadCount: c.adminUnreadCount,
    lastMessageAt:    c.lastMessageAt,
    member: {
      id:        c.member.id,
      name:      `${c.member.firstName ?? ''} ${c.member.lastName ?? ''}`.trim() || 'Member',
      avatarUrl: c.member.profilePhotoUrl ?? null,
    },
    lastMessage: c.messages[0] ?? null,
  }));

  return reply.send({
    success: true,
    data: mapped,
    meta: {
      hasMore:    conversations.length === take,
      nextCursor: conversations.length === take ? conversations[conversations.length - 1].id : null,
      count:      conversations.length,
    },
    error: null,
  });
}

// ── GET /api/conversations/:id/messages ───────────────────────────────────────
export async function getAdminConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.findUnique({ where: { id } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found' });

  // Level 2 — parallelise: reset admin unread + load messages + load member profile.
  // All three are independent once we have the conversation row.
  const [, messages, member] = await Promise.all([
    request.server.prisma.conversation.update({ where: { id }, data: { adminUnreadCount: 0 } }),
    request.server.prisma.directMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    }),
    request.server.prisma.member.findUnique({
      where: { id: convo.memberId },
      select: { firstName: true, lastName: true, profilePhotoUrl: true },
    }),
  ]);
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member';

  // Level 3 — parallelise: resolve unique admin senders + identify requesting admin.
  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const [admins, reqAdmin] = await Promise.all([
    adminIds.length > 0
      ? request.server.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true, profilePhotoUrl: true },
        })
      : Promise.resolve([]),
    request.server.prisma.admin.findFirst({
      where: { clerkId: request.user },
      select: { id: true },
    }),
  ]);
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

  // ── Enrich with reactions, pin state, and admin stars ──────────────────────
  const msgIds = messages.map((m) => m.id);

  type RxRow  = { message_id: string; emoji: string; count: number; sender_ids: string[] };
  type PinRow = { id: string; is_pinned: boolean; pinned_at: Date | null };
  type StarRow = { message_id: string };

  const [rxRows, pinRows, starRows] = msgIds.length > 0
    ? await Promise.all([
        request.server.prisma.$queryRawUnsafe<RxRow[]>(
          `SELECT message_id::text, emoji, COUNT(*)::int AS count, array_agg(sender_id::text) AS sender_ids
           FROM direct_message_reactions WHERE message_id = ANY($1::uuid[])
           GROUP BY message_id, emoji`,
          msgIds,
        ).catch(() => [] as RxRow[]),

        request.server.prisma.$queryRawUnsafe<PinRow[]>(
          `SELECT id::text, is_pinned, pinned_at FROM direct_messages WHERE id = ANY($1::uuid[])`,
          msgIds,
        ).catch(() => [] as PinRow[]),

        reqAdmin
          ? request.server.prisma.$queryRawUnsafe<StarRow[]>(
              `SELECT message_id::text FROM dm_admin_stars WHERE admin_id = $1::uuid AND message_id = ANY($2::uuid[])`,
              reqAdmin.id, msgIds,
            ).catch(() => [] as StarRow[])
          : Promise.resolve([] as StarRow[]),
      ])
    : [[], [], []];

  // Build lookup maps
  const reactionMap = new Map<string, { emoji: string; count: number; senderIds: string[] }[]>();
  for (const rx of rxRows as RxRow[]) {
    if (!reactionMap.has(rx.message_id)) reactionMap.set(rx.message_id, []);
    reactionMap.get(rx.message_id)!.push({ emoji: rx.emoji, count: rx.count, senderIds: rx.sender_ids });
  }
  const pinMap = new Map<string, { isPinned: boolean; pinnedAt: Date | null }>();
  for (const p of pinRows as PinRow[]) pinMap.set(p.id, { isPinned: p.is_pinned, pinnedAt: p.pinned_at });
  const starredIds = new Set((starRows as StarRow[]).map((r) => r.message_id));

  const data = messages.map((m) => {
    const pinInfo = pinMap.get(m.id) ?? { isPinned: false, pinnedAt: null };
    const common = {
      id:                 m.id,
      body:               m.deletedForEveryone ? null : m.body,
      mediaUrl:           m.deletedForEveryone ? null : m.mediaUrl,
      mediaType:          m.deletedForEveryone ? null : m.mediaType,
      replyToId:          m.replyToId,
      editedAt:           m.editedAt,
      deletedAt:          m.deletedAt,
      deletedForEveryone: m.deletedForEveryone,
      readByAdminAt:      m.readByAdminAt,
      readByMemberAt:     m.readByMemberAt,
      createdAt:          m.createdAt,
      isForwarded:        !!m.forwardedFromMessageId,
      isPinned:           pinInfo.isPinned,
      pinnedAt:           pinInfo.pinnedAt ?? null,
      isStarredByAdmin:   starredIds.has(m.id),
      reactions:          reactionMap.get(m.id) ?? [],
    };
    if (m.senderType === 'admin') {
      const a = adminMap[m.senderId];
      return {
        ...common,
        senderType:      'admin' as const,
        senderId:        m.senderId,
        senderName:      a?.fullName ?? 'TBT Team',
        senderAvatarUrl: a?.profilePhotoUrl ?? null,
      };
    }
    return {
      ...common,
      senderType:      'member' as const,
      senderId:        m.senderId,
      senderName:      memberName,
      senderAvatarUrl: member?.profilePhotoUrl ?? null,
    };
  });

  return reply.send({
    success: true,
    data,
    meta: { conversationId: id, status: convo.status, subject: convo.subject },
    error: null,
  });
}

// ── POST /api/conversations/:id/messages ──────────────────────────────────────
export async function sendAdminChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { body, mediaUrl, mediaType, replyToId } = request.body as {
    body?: string;
    mediaUrl?: string;
    mediaType?: string;
    replyToId?: string;
  };

  if (!body?.trim() && !mediaUrl) {
    return reply.status(400).send({ success: false, data: null, error: 'body or mediaUrl required' });
  }

  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true, fullName: true, profilePhotoUrl: true },
  });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, status: 'open' } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found or closed' });

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: {
        conversationId: id,
        memberId:       convo.memberId,
        senderId:       admin.id,
        senderType:     'admin',
        body:           body ?? null,
        mediaUrl:       mediaUrl ?? null,
        mediaType:      mediaType ?? null,
        replyToId:      replyToId ?? null,
      },
    });
    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), memberUnreadCount: { increment: 1 } },
    });
    return msg;
  });

  const payload = {
    conversationId: id,
    message: {
      id:              message.id,
      senderType:      'admin',
      senderId:        admin.id,
      senderName:      admin.fullName,
      senderAvatarUrl: admin.profilePhotoUrl ?? null,
      body:            message.body,
      mediaUrl:        message.mediaUrl,
      mediaType:       message.mediaType,
      replyToId:       message.replyToId,
      createdAt:       message.createdAt,
    },
  };

  // Deliver to anyone viewing this conversation
  request.server.io.to(`conversation:${id}`).emit('chat:message', payload);
  // Ping member's room for Navbar badge + conversation list update
  request.server.io.to(`user:${convo.memberId}`).emit('message:new', { messageId: message.id });

  // Create in-app notification + FCM push. notifyMembers handles the fan-out
  // to AppNotification, socket, and Firebase in one call.
  const previewSource = body?.trim() || (mediaType ? `📎 ${mediaType}` : 'sent a message');
  const preview = previewSource.length > 120 ? previewSource.substring(0, 120) + '…' : previewSource;
  // /messages (not /messages/{id} — there is no such dynamic route) reads
  // `conversation` + `message` query params to open this exact conversation
  // and scroll/highlight this exact message.
  void notifyMembers(request.server, {
    memberIds: [convo.memberId],
    title: 'New message from TBT Team',
    body: preview,
    type: 'message',
    actionUrl: `/messages?conversation=${id}&message=${message.id}`,
    data: { conversationId: id, messageId: message.id },
  });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}

// ── PUT /api/conversations/:id/messages/:messageId ───────────────────────────
export async function editAdminChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };
  const { body } = request.body as { body: string };

  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const msg = await request.server.prisma.directMessage.findFirst({ where: { id: messageId, conversationId: id } });
  if (!msg) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });
  if (msg.senderType !== 'admin' || msg.senderId !== admin.id)
    return reply.status(403).send({ success: false, data: null, error: 'Not your message' });

  const updated = await request.server.prisma.directMessage.update({
    where: { id: messageId },
    data: { body: body.trim(), editedAt: new Date() },
  });

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id, messageId, action: 'edited', body: updated.body,
  });

  return reply.send({ success: true, data: { id: messageId }, error: null });
}

// ── DELETE /api/conversations/:id/messages/:messageId ────────────────────────
export async function deleteAdminChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };

  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const msg = await request.server.prisma.directMessage.findFirst({ where: { id: messageId, conversationId: id } });
  if (!msg) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });
  if (msg.senderType !== 'admin' || msg.senderId !== admin.id)
    return reply.status(403).send({ success: false, data: null, error: 'Not your message' });

  await request.server.prisma.directMessage.update({
    where: { id: messageId },
    data: { deletedForEveryone: true, deletedAt: new Date() },
  });

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id, messageId, action: 'deleted',
  });

  return reply.send({ success: true, data: { deleted: true }, error: null });
}

// ── POST /api/conversations/:id/messages/:messageId/raise-ticket ─────────────
export async function raiseTicketFromDmHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };
  const { subject, message: ticketMsg, priority = 'medium', resolveDeadline } = request.body as {
    subject?: string;
    message?: string;
    priority?: string;
    resolveDeadline?: string;
  };

  if (!subject?.trim() || !ticketMsg?.trim()) {
    return reply.status(400).send({ success: false, data: null, error: 'subject and message are required' });
  }
  if (subject.trim().length > 255) {
    return reply.status(400).send({ success: false, data: null, error: 'subject too long (max 255)' });
  }

  const msg = await request.server.prisma.directMessage.findFirst({
    where: { id: messageId, conversationId: id },
    select: { id: true, body: true, mediaType: true, deletedForEveryone: true },
  });
  if (!msg) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });
  if (msg.deletedForEveryone) {
    return reply.status(400).send({ success: false, data: null, error: 'Cannot raise a ticket for a deleted message' });
  }

  // Duplicate guard — skip if previous ticket for this message is already open/in-progress
  const existing = await request.server.prisma.helpdeskTicket.findFirst({
    where: { chatMessageId: messageId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  if (existing && !['resolved', 'closed'].includes(existing.status)) {
    return reply.status(409).send({ success: false, data: null, error: 'A ticket already exists for this message' });
  }

  const convo = await request.server.prisma.conversation.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found' });

  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true, fullName: true, email: true },
  });

  const member = convo.member;
  const memberName = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Member';
  const snapshot = msg.body ?? (msg.mediaType ? `[${msg.mediaType}]` : null);
  const validPriority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';

  let resolveBy: Date | null = null;
  if (resolveDeadline) {
    resolveBy = new Date(resolveDeadline);
    if (isNaN(resolveBy.getTime())) {
      return reply.status(400).send({ success: false, data: null, error: 'Invalid resolveDeadline' });
    }
  }

  const created = await request.server.prisma.helpdeskTicket.create({
    data: {
      memberId:           member.id,
      name:               memberName,
      email:              member.email,
      phone:              member.phone,
      subject:            subject.trim(),
      message:            ticketMsg.trim(),
      priority:           validPriority,
      chatMessageId:      messageId,
      chatMessageSenderId: member.id,
      chatMessageSnapshot: snapshot,
      raisedByAdminId:    admin?.id ?? null,
      resolveDeadline:    resolveBy,
      status:             'new',
    },
  });

  request.server.io.to('admin').emit('admin:helpdesk_ticket', {
    ticketId: created.id,
    subject: created.subject,
    submitterName: created.name,
    createdAt: created.createdAt,
    source: 'dm_conversation',
  });
  void createAdminNotification(request.server.prisma, {
    title: 'Ticket raised from DM',
    body: `${memberName}: ${subject.trim()}`,
    type: 'helpdesk_ticket',
    metadata: { ticketId: created.id },
  });
  void notifyMember(request.server.prisma, request.server.io, request.server.redis ?? null, {
    memberId: member.id,
    title: 'Support ticket created',
    message: `A support ticket "${subject.trim()}" has been raised on your behalf.`,
    type: 'helpdesk_status',
    actionUrl: `/support/tickets/${created.id}`,
  });

  return reply.status(201).send({ success: true, data: { id: created.id }, error: null });
}

// ── POST /api/conversations/:id/messages/:messageId/react ────────────────────
const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export async function toggleDmReactionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };
  const { emoji } = request.body as { emoji: string };

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return reply.status(400).send({ success: false, data: null, error: 'Invalid emoji' });
  }

  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const msg = await request.server.prisma.directMessage.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true, deletedForEveryone: true } });
  if (!msg || msg.deletedForEveryone) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });

  const existing = await request.server.prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM direct_message_reactions WHERE message_id=$1::uuid AND sender_type='admin' AND sender_id=$2::uuid AND emoji=$3`,
    messageId, admin.id, emoji,
  );

  let reacted: boolean;
  if (existing.length > 0) {
    await request.server.prisma.$executeRawUnsafe(
      `DELETE FROM direct_message_reactions WHERE message_id=$1::uuid AND sender_type='admin' AND sender_id=$2::uuid AND emoji=$3`,
      messageId, admin.id, emoji,
    );
    reacted = false;
  } else {
    await request.server.prisma.$executeRawUnsafe(
      `INSERT INTO direct_message_reactions (message_id, sender_type, sender_id, emoji) VALUES ($1::uuid, 'admin', $2::uuid, $3) ON CONFLICT DO NOTHING`,
      messageId, admin.id, emoji,
    );
    reacted = true;
  }

  const counts = await request.server.prisma.$queryRawUnsafe<{ emoji: string; count: number; sender_ids: string[] }[]>(
    `SELECT emoji, COUNT(*)::int AS count, array_agg(sender_id::text) AS sender_ids FROM direct_message_reactions WHERE message_id=$1::uuid GROUP BY emoji`,
    messageId,
  );

  request.server.io.to(`conversation:${id}`).emit('chat:reaction', {
    conversationId: id, messageId, emoji, senderType: 'admin', senderId: admin.id, reacted, counts,
  });

  return reply.send({ success: true, data: { reacted, counts }, error: null });
}

// ── POST /api/conversations/:id/messages/:messageId/forward ──────────────────
export async function forwardDmMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };
  const { conversationIds } = request.body as { conversationIds: string[] };

  if (!Array.isArray(conversationIds) || conversationIds.length === 0 || conversationIds.length > 10) {
    return reply.status(400).send({ success: false, data: null, error: 'conversationIds must be 1–10 items' });
  }

  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true, fullName: true, profilePhotoUrl: true },
  });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const original = await request.server.prisma.directMessage.findFirst({ where: { id: messageId, conversationId: id } });
  if (!original || original.deletedForEveryone) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });

  let forwarded = 0;
  for (const targetId of conversationIds) {
    const targetConvo = await request.server.prisma.conversation.findFirst({ where: { id: targetId, status: 'open' } });
    if (!targetConvo) continue;

    const newMsg = await request.server.prisma.$transaction(async (tx) => {
      const m = await tx.directMessage.create({
        data: {
          conversationId:        targetId,
          memberId:              targetConvo.memberId,
          senderId:              admin.id,
          senderType:            'admin',
          body:                  original.body ?? null,
          mediaUrl:              original.mediaUrl ?? null,
          mediaType:             original.mediaType ?? null,
          forwardedFromMessageId: messageId,
        },
      });
      await tx.conversation.update({
        where: { id: targetId },
        data: { lastMessageAt: new Date(), memberUnreadCount: { increment: 1 } },
      });
      return m;
    });

    request.server.io.to(`conversation:${targetId}`).emit('chat:message', {
      conversationId: targetId,
      message: {
        id:                    newMsg.id,
        senderType:            'admin',
        senderId:              admin.id,
        senderName:            admin.fullName,
        senderAvatarUrl:       admin.profilePhotoUrl ?? null,
        body:                  newMsg.body,
        mediaUrl:              newMsg.mediaUrl,
        mediaType:             newMsg.mediaType,
        isForwarded:           true,
        forwardedFromMessageId: messageId,
        createdAt:             newMsg.createdAt,
      },
    });
    forwarded++;
  }

  return reply.send({ success: true, data: { forwarded }, error: null });
}

// ── PATCH /api/conversations/:id/messages/:messageId/pin ─────────────────────
export async function toggleDmPinHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };

  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const rows = await request.server.prisma.$queryRawUnsafe<{ is_pinned: boolean }[]>(
    `SELECT is_pinned FROM direct_messages WHERE id=$1::uuid AND conversation_id=$2::uuid`,
    messageId, id,
  );
  if (!rows.length) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });

  const nowPinned = !rows[0].is_pinned;
  await request.server.prisma.$executeRawUnsafe(
    `UPDATE direct_messages SET is_pinned=$1, pinned_at=$2, pinned_by_admin_id=$3::uuid WHERE id=$4::uuid`,
    nowPinned,
    nowPinned ? new Date() : null,
    nowPinned ? admin.id : null,
    messageId,
  );

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id, messageId, action: nowPinned ? 'pinned' : 'unpinned',
  });

  return reply.send({ success: true, data: { pinned: nowPinned }, error: null });
}

// ── PATCH /api/conversations/:id/messages/:messageId/star ────────────────────
export async function toggleDmAdminStarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, messageId } = request.params as { id: string; messageId: string };

  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const msg = await request.server.prisma.directMessage.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true } });
  if (!msg) return reply.status(404).send({ success: false, data: null, error: 'Message not found' });

  const existing = await request.server.prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM dm_admin_stars WHERE admin_id=$1::uuid AND message_id=$2::uuid`,
    admin.id, messageId,
  );

  let starred: boolean;
  if (existing.length > 0) {
    await request.server.prisma.$executeRawUnsafe(
      `DELETE FROM dm_admin_stars WHERE admin_id=$1::uuid AND message_id=$2::uuid`,
      admin.id, messageId,
    );
    starred = false;
  } else {
    await request.server.prisma.$executeRawUnsafe(
      `INSERT INTO dm_admin_stars (admin_id, message_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
      admin.id, messageId,
    );
    starred = true;
  }

  return reply.send({ success: true, data: { starred }, error: null });
}

// ── GET /api/conversations/starred ───────────────────────────────────────────
export async function listAdminStarredMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const rows = await request.server.prisma.$queryRawUnsafe<{
    id: string; body: string | null; created_at: Date; conversation_id: string;
    conversation_subject: string; starred_at: Date;
  }[]>(`
    SELECT dm.id::text, dm.body, dm.created_at, dm.conversation_id::text,
           c.subject AS conversation_subject, s.starred_at
    FROM dm_admin_stars s
    JOIN direct_messages dm ON dm.id = s.message_id
    JOIN conversations c ON c.id = dm.conversation_id
    WHERE s.admin_id = $1::uuid AND dm.deleted_for_everyone = false
    ORDER BY s.starred_at DESC
    LIMIT 50
  `, admin.id).catch(() => [] as any[]);

  return reply.send({ success: true, data: rows, error: null });
}

// ── PATCH /api/conversations/:id/close ────────────────────────────────────────
export async function closeConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.update({
    where: { id },
    data: { status: 'closed' },
  });

  request.server.io.to(`conversation:${id}`).emit('chat:conversation_closed', { conversationId: id });
  request.server.io.to(`user:${convo.memberId}`).emit('chat:conversation_closed', { conversationId: id });

  return reply.send({ success: true, data: { id, status: 'closed' }, error: null });
}
