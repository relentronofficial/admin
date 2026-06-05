import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listNotificationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20 } = req.query as any;
  const [notifications, total] = await Promise.all([
    req.server.prisma.appNotification.findMany({
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { recipients: true } } },
    }),
    req.server.prisma.appNotification.count(),
  ]);
  return reply.send({ success: true, data: notifications, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createNotificationHandler(req: FastifyRequest, reply: FastifyReply) {
  const { title, message, type, recipientType, memberIds, workshopId, batchId } = req.body as any;
  let targetMemberIds: string[] = [];

  if (recipientType === 'all') {
    const members = await req.server.prisma.member.findMany({ select: { id: true } });
    targetMemberIds = members.map(m => m.id);
  } else if (recipientType === 'specific' && memberIds?.length) {
    targetMemberIds = memberIds;
  } else if (recipientType === 'workshop' && workshopId) {
    const enrollments = await req.server.prisma.workshopEnrollment.findMany({
      where: { workshopId },
      select: { memberId: true },
    });
    targetMemberIds = enrollments.map(e => e.memberId);
  } else if (recipientType === 'batch' && batchId) {
    const members = await req.server.prisma.member.findMany({
      where: { batchId },
      select: { id: true },
    });
    targetMemberIds = members.map(m => m.id);
  }

  const notification = await req.server.prisma.appNotification.create({
    data: {
      title,
      message,
      type: type || 'info',
      recipients: {
        create: targetMemberIds.length > 0
          ? targetMemberIds.map(id => ({ memberId: id }))
          : [{ memberId: null }],
      },
    },
    include: { _count: { select: { recipients: true } } },
  });

  // Emit real-time socket events
  const payload = { title, body: message, type: type || 'info' };
  if (recipientType === 'all' || targetMemberIds.length === 0) {
    req.server.io.emit('notification:broadcast', payload);
  } else {
    for (const memberId of targetMemberIds) {
      req.server.io.to(`user:${memberId}`).emit('notification', payload);
    }
  }

  return reply.status(201).send({ success: true, data: notification, error: null });
}

export async function deleteNotificationHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.appNotification.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function getNotificationStatsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const [total, read] = await Promise.all([
    req.server.prisma.appNotificationRecipient.count({ where: { notificationId: id } }),
    req.server.prisma.appNotificationRecipient.count({ where: { notificationId: id, readAt: { not: null } } }),
  ]);
  return reply.send({ success: true, data: { total, read, unread: total - read }, error: null });
}
