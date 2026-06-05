import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listBatchesHandler(req: FastifyRequest, reply: FastifyReply) {
  const batches = await req.server.prisma.batch.findMany({
    orderBy: { startsAt: 'desc' },
    select: { id: true, name: true, isActive: true, startsAt: true, endsAt: true },
  });
  return reply.send({ success: true, data: batches, error: null });
}
