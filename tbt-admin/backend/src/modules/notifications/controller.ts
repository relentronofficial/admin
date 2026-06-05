import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendNotificationSchema, broadcastNotificationSchema } from './schema.js';

export async function listNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const notifications = await request.server.prisma.notification.findMany();
  return reply.send({ success: true, data: notifications, error: null });
}

export async function sendNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = sendNotificationSchema.parse(request.body);

  const notification = await request.server.prisma.notification.create({
    data: {
      memberId: body.memberId,
      title: body.title,
      body: body.body,
      type: body.type as any,
      data: body.metadata ?? null,
    },
  });

  // Emit to the member's personal room
  const room = `user:${notification.memberId}`;
  request.server.io.to(room).emit('notification', {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    isRead: false,
    createdAt: notification.sentAt,
  });

  return reply.status(201).send({ success: true, data: notification, error: null });
}

export async function markAsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const notification = await request.server.prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  return reply.send({ success: true, data: notification, error: null });
}

export async function broadcastNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = broadcastNotificationSchema.parse(request.body);

  const members = await request.server.prisma.member.findMany({ select: { id: true } });

  const notifications = await request.server.prisma.notification.createMany({
    data: members.map(m => ({
      memberId: m.id,
      title: body.title,
      body: body.body,
      type: body.type as any,
      data: body.metadata ?? null,
    })),
  });

  request.server.io.emit('notification:broadcast', {
    title: body.title,
    body: body.body,
    type: body.type,
  });

  return reply.send({ success: true, data: notifications, error: null });
}
