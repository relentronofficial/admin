import { FastifyRequest, FastifyReply } from 'fastify';
import { SendMessageBody } from './schema.js';

export async function sendMessageHandler(
  request: FastifyRequest<{ Body: SendMessageBody }>,
  reply: FastifyReply
) {
  const { memberId, subject, body } = request.body;

  // Resolve the admin record from the Clerk user attached by fastify.authenticate
  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true },
  });
  if (!admin) {
    return reply.status(401).send({ success: false, data: null, error: 'Admin account not found' });
  }

  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) {
    return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  }

  const message = await request.server.prisma.directMessage.create({
    data: {
      memberId,
      senderId:   admin.id,
      senderType: 'admin',
      subject,
      body,
    },
  });

  request.server.io.to(`user:${memberId}`).emit('message:new', {
    messageId: message.id,
  });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}
