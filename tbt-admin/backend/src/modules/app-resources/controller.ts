import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { search, page = 1, limit = 50 } = req.query as any;
  const where: any = search ? { title: { contains: search, mode: 'insensitive' } } : {};
  const [resources, total] = await Promise.all([
    req.server.prisma.appResource.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { order: 'asc' },
    }),
    req.server.prisma.appResource.count({ where }),
  ]);
  return reply.send({ success: true, data: resources, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const count = await req.server.prisma.appResource.count();
  const resource = await req.server.prisma.appResource.create({
    data: {
      title: body.title,
      author: body.author || null,
      date: body.date ? new Date(body.date) : null,
      fileUrl: body.fileUrl,
      previewUrl: body.previewUrl || null,
      fileType: body.fileType || 'pdf',
      fileCount: Number(body.fileCount) || 1,
      order: body.order ?? count,
      isVisible: body.isVisible ?? true,
    },
  });
  return reply.status(201).send({ success: true, data: resource, error: null });
}

export async function updateResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['title', 'author', 'fileUrl', 'previewUrl', 'fileType', 'isVisible'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
  if (body.fileCount !== undefined) data.fileCount = Number(body.fileCount);
  if (body.order !== undefined) data.order = Number(body.order);
  const resource = await req.server.prisma.appResource.update({ where: { id }, data });
  return reply.send({ success: true, data: resource, error: null });
}

export async function deleteResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.appResource.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.appResource.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}
