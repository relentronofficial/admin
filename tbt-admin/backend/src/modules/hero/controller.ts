import type { FastifyRequest, FastifyReply } from 'fastify';
import { invalidateCache } from '../../lib/cache.js';

function bustHome(req: FastifyRequest): void {
  void invalidateCache(req.server.redis ?? null, 'home:*');
}

export async function listSlidesHandler(req: FastifyRequest, reply: FastifyReply) {
  const slides = await req.server.prisma.heroSlide.findMany({ orderBy: { order: 'asc' } });
  return reply.send({ success: true, data: slides, error: null });
}

export async function createSlideHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const count = await req.server.prisma.heroSlide.count();
  const slide = await req.server.prisma.heroSlide.create({
    data: { ...body, order: body.order ?? count },
  });
  bustHome(req);
  return reply.status(201).send({ success: true, data: slide, error: null });
}

export async function updateSlideHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const slide = await req.server.prisma.heroSlide.update({ where: { id }, data: req.body as any });
  bustHome(req);
  return reply.send({ success: true, data: slide, error: null });
}

export async function deleteSlideHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.heroSlide.delete({ where: { id } });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderSlidesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.heroSlide.update({ where: { id }, data: { order: i } })
    )
  );
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}
