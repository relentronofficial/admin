import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listBadgesHandler(req: FastifyRequest, reply: FastifyReply) {
  const badges = await req.server.prisma.displayBadge.findMany({
    orderBy: { label: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return reply.send({ success: true, data: badges, error: null });
}

export async function createBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const badge = await req.server.prisma.displayBadge.create({
    data: { label: body.label, color: body.color || '#ffffff', bgColor: body.bgColor || '#a855f7', isActive: body.isActive ?? true },
  });
  return reply.status(201).send({ success: true, data: badge, error: null });
}

export async function updateBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['label', 'color', 'bgColor', 'isActive'].forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  const badge = await req.server.prisma.displayBadge.update({ where: { id }, data });
  return reply.send({ success: true, data: badge, error: null });
}

export async function deleteBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.displayBadge.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function assignBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { memberId } = req.params as any;
  const { badgeId } = req.body as any;
  const assignment = await req.server.prisma.memberDisplayBadge.upsert({
    where: { memberId_badgeId: { memberId, badgeId } },
    update: {},
    create: { memberId, badgeId },
  });
  return reply.status(201).send({ success: true, data: assignment, error: null });
}

export async function removeBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { memberId, badgeId } = req.params as any;
  await req.server.prisma.memberDisplayBadge.deleteMany({ where: { memberId, badgeId } });
  return reply.send({ success: true, data: null, error: null });
}
