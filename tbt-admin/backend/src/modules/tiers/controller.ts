import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listTiersHandler(req: FastifyRequest, reply: FastifyReply) {
  const tiers = await req.server.prisma.tier.findMany({ orderBy: { tierNumber: 'asc' } });
  return reply.send({ success: true, data: tiers, error: null });
}

export async function createTierHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const tier = await req.server.prisma.tier.create({
    data: {
      tierNumber: Number(body.tierNumber),
      label: body.label,
      description: body.description || null,
      unlockConditionText: body.unlockConditionText || null,
      isActive: body.isActive ?? true,
    },
  });
  return reply.status(201).send({ success: true, data: tier, error: null });
}

export async function updateTierHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['label', 'description', 'unlockConditionText', 'isActive'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.tierNumber !== undefined) data.tierNumber = Number(body.tierNumber);
  const tier = await req.server.prisma.tier.update({ where: { id }, data });
  return reply.send({ success: true, data: tier, error: null });
}

export async function deleteTierHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.tier.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}
