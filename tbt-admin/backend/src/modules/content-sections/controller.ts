import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listSectionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const sections = await req.server.prisma.contentSection.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  return reply.send({ success: true, data: sections, error: null });
}

export async function createSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const count = await req.server.prisma.contentSection.count();
  const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const section = await req.server.prisma.contentSection.create({
    data: { ...body, slug, order: body.order ?? count },
  });
  return reply.status(201).send({ success: true, data: section, error: null });
}

export async function updateSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const section = await req.server.prisma.contentSection.update({ where: { id }, data: req.body as any });
  return reply.send({ success: true, data: section, error: null });
}

export async function deleteSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.contentSection.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderSectionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.contentSection.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}

export async function listItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const items = await req.server.prisma.contentItem.findMany({
    where: { sectionId: id },
    orderBy: { order: 'asc' },
    include: {
      course: { select: { id: true, title: true, thumbnailUrl: true, slug: true } },
      workshop: { select: { id: true, title: true, thumbnailUrl: true, slug: true } },
    },
  });
  return reply.send({ success: true, data: items, error: null });
}

export async function createItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const count = await req.server.prisma.contentItem.count({ where: { sectionId: id } });
  const item = await req.server.prisma.contentItem.create({
    data: { ...body, sectionId: id, order: body.order ?? count },
  });
  return reply.status(201).send({ success: true, data: item, error: null });
}

export async function updateItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  const item = await req.server.prisma.contentItem.update({ where: { id: itemId }, data: req.body as any });
  return reply.send({ success: true, data: item, error: null });
}

export async function deleteItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  await req.server.prisma.contentItem.delete({ where: { id: itemId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.contentItem.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}
