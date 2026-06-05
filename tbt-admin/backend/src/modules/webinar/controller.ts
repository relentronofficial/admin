import type { FastifyReply, FastifyRequest } from 'fastify';
import { createWebinarSchema, updateWebinarSchema } from './schema.js';

export async function listWebinarsHandler(request: FastifyRequest, reply: FastifyReply) {
  const webinars = await request.server.prisma.webinar.findMany({
    include: { host: true }
  });
  return reply.send({ success: true, data: webinars, error: null });
}

export async function createWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createWebinarSchema.parse(request.body);
  const webinarId = `TBT-WEB-${Math.floor(1000 + Math.random() * 9000)}`;

  const webinar = await request.server.prisma.webinar.create({
    data: {
      ...body,
      webinarId,
      scheduledAt: new Date(body.scheduledAt),
    },
  });

  return reply.status(201).send({ success: true, data: webinar, error: null });
}

export async function getWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const webinar = await request.server.prisma.webinar.findUnique({
    where: { id },
    include: { host: true }
  });
  if (!webinar) return reply.status(404).send({ success: false, data: null, error: 'Webinar not found' });
  return reply.send({ success: true, data: webinar, error: null });
}

export async function updateWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateWebinarSchema.parse(request.body);
  const webinar = await request.server.prisma.webinar.update({
    where: { id },
    data: {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    }
  });
  return reply.send({ success: true, data: webinar, error: null });
}

export async function deleteWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.webinar.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function startWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const webinar = await request.server.prisma.webinar.update({
    where: { id },
    data: { status: 'live' as any },
    include: { registrations: { select: { memberId: true } } },
  });

  request.server.io.to(`live:${id}`).emit('live:started', {
    webinarId: id,
    streamUrl: webinar.meetingUrl ?? null,
    startedAt: new Date().toISOString(),
  });

  webinar.registrations.forEach(({ memberId }) => {
    request.server.io.to(`user:${memberId}`).emit('live:reminder', {
      webinarId: id,
      title: webinar.title,
    });
  });

  return reply.send({ success: true, data: webinar, error: null });
}

export async function endWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const webinar = await request.server.prisma.webinar.update({
    where: { id },
    data: { status: 'ended' as any },
  });

  request.server.io.to(`live:${id}`).emit('live:ended', {
    webinarId: id,
    recordingUrl: webinar.recordingUrl ?? null,
  });

  return reply.send({ success: true, data: webinar, error: null });
}

export async function listAttendeesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  // Logic to fetch attendees from a separate relation or external service
  return reply.send({ success: true, data: [], error: null });
}
