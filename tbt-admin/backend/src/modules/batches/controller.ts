import type { FastifyRequest, FastifyReply } from 'fastify';
import { createBatchSchema, updateBatchSchema } from './schema.js';

export async function listBatchesHandler(req: FastifyRequest, reply: FastifyReply) {
  const batches = await req.server.prisma.batch.findMany({
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return reply.send({ success: true, data: batches, error: null });
}

export async function getBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const batch = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          memberId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profilePhotoUrl: true,
          status: true,
          membershipPlan: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  });
  if (!batch) return reply.status(404).send({ success: false, data: null, error: 'Batch not found' });
  return reply.send({ success: true, data: batch, error: null });
}

export async function createBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, ...rest } = parsed.data;
  const batch = await req.server.prisma.batch.create({
    data: {
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return reply.status(201).send({ success: true, data: batch, error: null });
}

export async function updateBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, ...rest } = parsed.data;
  const batch = await req.server.prisma.batch.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return reply.send({ success: true, data: batch, error: null });
}

export async function deleteBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  // Unlink members before deleting
  await req.server.prisma.member.updateMany({
    where: { batchId: req.params.id },
    data: { batchId: null },
  });
  await req.server.prisma.batch.delete({ where: { id: req.params.id } });
  return reply.send({ success: true, data: null, error: null });
}
