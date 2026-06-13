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

export async function listProductInquiriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { status, page = 1, limit = 50 } = req.query as any;
  const where: any = {};
  if (status) where.status = status;

  const [inquiries, total] = await Promise.all([
    (req.server.prisma as any).productInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        member: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        product: { select: { id: true, title: true, thumbnailUrl: true, price: true, currency: true } },
      },
    }),
    (req.server.prisma as any).productInquiry.count({ where }),
  ]);

  return reply.send({ success: true, data: inquiries, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function updateInquiryStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { status } = req.body as { status: string };

  if (!['pending', 'contacted', 'resolved'].includes(status)) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
  }

  const inquiry = await (req.server.prisma as any).productInquiry.update({
    where: { id },
    data: { status },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, phone: true } },
      product: { select: { id: true, title: true } },
    },
  });

  return reply.send({ success: true, data: inquiry, error: null });
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
