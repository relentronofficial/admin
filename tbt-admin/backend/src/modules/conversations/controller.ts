import { FastifyRequest, FastifyReply } from 'fastify';

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
    if (m.senderType === 'admin') {
      const a = adminMap[m.senderId];
      return {
        id:             m.id,
        senderType:     'admin' as const,
        senderId:       m.senderId,
        senderName:     a?.fullName ?? 'TBT Team',
        senderAvatarUrl: a?.profilePhotoUrl ?? null,
        body:           m.body,
        createdAt:      m.createdAt,
      };
    }
    return {
      id:             m.id,
      senderType:     'member' as const,
      senderId:       m.senderId,
      senderName:     memberName,
      senderAvatarUrl: member?.profilePhotoUrl ?? null,
      body:           m.body,
      createdAt:      m.createdAt,
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
  const { body } = request.body as { body: string };

  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true, fullName: true, profilePhotoUrl: true },
  });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, status: 'open' } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found or closed' });

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: { conversationId: id, memberId: convo.memberId, senderId: admin.id, senderType: 'admin', body },
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
      body,
      createdAt:       message.createdAt,
    },
  };

  // Deliver to anyone viewing this conversation
  request.server.io.to(`conversation:${id}`).emit('chat:message', payload);
  // Also ping member's room for Navbar badge update
  request.server.io.to(`user:${convo.memberId}`).emit('message:new', { messageId: message.id });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
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
