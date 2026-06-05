import type { FastifyRequest, FastifyReply } from 'fastify';

export async function listProductsHandler(req: FastifyRequest, reply: FastifyReply) {
  const products = await req.server.prisma.product.findMany({
    orderBy: { order: 'asc' },
    include: { ctas: { orderBy: { order: 'asc' } } },
  });
  return reply.send({ success: true, data: products, error: null });
}

export async function createProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const count = await req.server.prisma.product.count();
  const { ctas, ...productData } = body;
  const product = await req.server.prisma.product.create({
    data: {
      ...productData,
      order: productData.order ?? count,
      ctas: ctas ? { create: ctas.map((c: any, i: number) => ({ ...c, order: i })) } : undefined,
    },
    include: { ctas: { orderBy: { order: 'asc' } } },
  });
  return reply.status(201).send({ success: true, data: product, error: null });
}

export async function updateProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const { ctas, ...productData } = body;
  if (ctas !== undefined) {
    await req.server.prisma.productCta.deleteMany({ where: { productId: id } });
    if (ctas.length > 0) {
      await req.server.prisma.productCta.createMany({
        data: ctas.map((c: any, i: number) => ({ ...c, productId: id, order: i })),
      });
    }
  }
  const product = await req.server.prisma.product.update({
    where: { id },
    data: productData,
    include: { ctas: { orderBy: { order: 'asc' } } },
  });
  return reply.send({ success: true, data: product, error: null });
}

export async function deleteProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.product.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderProductsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.product.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}
