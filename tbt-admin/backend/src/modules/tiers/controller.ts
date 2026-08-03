import type { FastifyRequest, FastifyReply } from 'fastify';
import { cacheGet, cacheSet, invalidateCache } from '../../lib/cache.js';

// Tiers are effectively static reference data — read on nearly every
// authenticated page load to decide lock overlays, but mutated by
// admin only once in a blue moon. 5-minute TTL trades a bit of
// staleness on edits for a big drop in DB round-trips.
const CACHE_KEY = 'tier:list';
const TTL = 300;

export async function listTiersHandler(req: FastifyRequest, reply: FastifyReply) {
  const redis = req.server.redis ?? null;
  const cached = await cacheGet<unknown[]>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });
  const tiers = await req.server.prisma.tier.findMany({ orderBy: { tierNumber: 'asc' } });
  await cacheSet(redis, CACHE_KEY, tiers, TTL);
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
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
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
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.send({ success: true, data: tier, error: null });
}

export async function deleteTierHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.tier.delete({ where: { id } });
  void invalidateCache(req.server.redis ?? null, CACHE_KEY);
  return reply.send({ success: true, data: null, error: null });
}
