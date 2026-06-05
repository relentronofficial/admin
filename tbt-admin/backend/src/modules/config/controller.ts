import type { FastifyRequest, FastifyReply } from 'fastify';

// ── SITE CONFIG ───────────────────────────────────────────────────────

export async function getSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({
      data: { siteName: 'TBT', footerText: '© Tamil Business Tribe' },
    });
  }
  return reply.send({ success: true, data: config, error: null });
}

export async function updateSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({ data: body });
  } else {
    config = await req.server.prisma.siteConfig.update({ where: { id: config.id }, data: body });
  }
  return reply.send({ success: true, data: config, error: null });
}

// ── UI STRINGS ────────────────────────────────────────────────────────

export async function getUiStringsHandler(req: FastifyRequest, reply: FastifyReply) {
  let strings = await req.server.prisma.uiStrings.findFirst();
  if (!strings) {
    strings = await req.server.prisma.uiStrings.create({ data: {} });
  }
  return reply.send({ success: true, data: strings, error: null });
}

export async function updateUiStringsHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  let strings = await req.server.prisma.uiStrings.findFirst();
  if (!strings) {
    strings = await req.server.prisma.uiStrings.create({ data: body });
  } else {
    strings = await req.server.prisma.uiStrings.update({ where: { id: strings.id }, data: body });
  }
  return reply.send({ success: true, data: strings, error: null });
}

// ── NAV ITEMS ─────────────────────────────────────────────────────────

export async function listNavItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const items = await req.server.prisma.navItem.findMany({ orderBy: { order: 'asc' } });
  return reply.send({ success: true, data: items, error: null });
}

export async function createNavItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const count = await req.server.prisma.navItem.count();
  const item = await req.server.prisma.navItem.create({
    data: { label: body.label, href: body.href, order: body.order ?? count, isVisible: body.isVisible ?? true },
  });
  return reply.status(201).send({ success: true, data: item, error: null });
}

export async function updateNavItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const item = await req.server.prisma.navItem.update({ where: { id }, data: req.body as any });
  return reply.send({ success: true, data: item, error: null });
}

export async function deleteNavItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.navItem.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderNavItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.navItem.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}

// ── PRODUCTS PAGE CONFIG ──────────────────────────────────────────────

export async function getProductsPageConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  let config = await req.server.prisma.productsPageConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.productsPageConfig.create({ data: {} });
  }
  return reply.send({ success: true, data: config, error: null });
}

export async function updateProductsPageConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  let config = await req.server.prisma.productsPageConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.productsPageConfig.create({ data: body });
  } else {
    config = await req.server.prisma.productsPageConfig.update({ where: { id: config.id }, data: body });
  }
  return reply.send({ success: true, data: config, error: null });
}

// ── RESOURCES PAGE CONFIG ─────────────────────────────────────────────

export async function getResourcesPageConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  let config = await req.server.prisma.resourcesPageConfig.findFirst();
  if (!config) config = await req.server.prisma.resourcesPageConfig.create({ data: {} });
  return reply.send({ success: true, data: config, error: null });
}

export async function updateResourcesPageConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  let config = await req.server.prisma.resourcesPageConfig.findFirst();
  if (!config) config = await req.server.prisma.resourcesPageConfig.create({ data: body });
  else config = await req.server.prisma.resourcesPageConfig.update({ where: { id: config.id }, data: body });
  return reply.send({ success: true, data: config, error: null });
}
