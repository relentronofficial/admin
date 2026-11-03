import { FastifyRequest, FastifyReply } from 'fastify';
import { notifyMembers } from '../../lib/notifications.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { notifyMember } from '../../lib/memberNotifications.js';

// ── GET /api/conversations ────────────────────────────────────────────────────
export async function listAdminConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const conversations = await request.server.prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, senderType: true, createdAt: true },
      },
    },
  });

  return reply.send({
    success: true,
    data: conversations.map((c) => ({
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
    })),
    error: null,
  });
}

// ── GET /api/conversations/:id/messages ───────────────────────────────────────
export async function getAdminConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.findUnique({ where: { id } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found' });

  // Reset admin unread count when admin opens the conversation
  await request.server.prisma.conversation.update({ where: { id }, data: { adminUnreadCount: 0 } });

  const messages = await request.server.prisma.directMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });

  // Batch-resolve admin senders
  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

  const member = await request.server.prisma.member.findUnique({
    where: { id: convo.memberId },
    select: { firstName: true, lastName: true, profilePhotoUrl: true },
  });
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member';

  const data = messages.map((m) => {
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
