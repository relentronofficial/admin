import type { FastifyRequest, FastifyReply } from 'fastify';
import { cacheGet, cacheSet, invalidateCache } from '../../lib/cache.js';

const CACHE_KEY = 'badge:list';
const TTL = 300;

export async function listBadgesHandler(req: FastifyRequest, reply: FastifyReply) {
  const redis = req.server.redis ?? null;
  const cached = await cacheGet<unknown[]>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });
  const badges = await req.server.prisma.displayBadge.findMany({
    orderBy: { label: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  await cacheSet(redis, CACHE_KEY, badges, TTL);
  return reply.send({ success: true, data: badges, error: null });
}

export async function createBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const badge = await req.server.prisma.displayBadge.create({
    data: { label: body.label, color: body.color || '#ffffff', bgColor: body.bgColor || '#a855f7', isActive: body.isActive ?? true },
  });
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.status(201).send({ success: true, data: badge, error: null });
}

export async function updateBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['label', 'color', 'bgColor', 'isActive'].forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  const badge = await req.server.prisma.displayBadge.update({ where: { id }, data });
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.send({ success: true, data: badge, error: null });
}

export async function deleteBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.displayBadge.delete({ where: { id } });
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
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
  // _count.members shifts on assign/remove, so bust the list cache too.
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.status(201).send({ success: true, data: assignment, error: null });
}

export async function removeBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { memberId, badgeId } = req.params as any;
  await req.server.prisma.memberDisplayBadge.deleteMany({ where: { memberId, badgeId } });
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.send({ success: true, data: null, error: null });
}
