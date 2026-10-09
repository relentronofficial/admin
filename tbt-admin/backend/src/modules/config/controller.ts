import type { FastifyRequest, FastifyReply } from 'fastify';
import { invalidateCache } from '../../lib/cache.js';

const PUB_SITE_CONFIG_CACHE_KEY = 'pub:site-config:v3';
const PUB_NAV_CACHE_KEY = 'pub:nav';

// ── SITE CONFIG ───────────────────────────────────────────────────────

export async function getSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({
      data: { siteName: 'TBT', footerText: '© Tamil Business Tribe' },
    });
  }
  const extraRows = await req.server.prisma.$queryRawUnsafe<Array<{ task_timer_seconds: number; free_lifelines_per_session: number; hidden_menu_keys: unknown; early_completion_bonus_xp: number; courses_banner_url: string | null }>>(
    'SELECT task_timer_seconds, free_lifelines_per_session, hidden_menu_keys, early_completion_bonus_xp, courses_banner_url FROM site_configs WHERE id = $1::uuid', config.id
  ).catch(() => []);
  const themeRows = await req.server.prisma.$queryRawUnsafe<Array<{ theme_mode: string | null }>>(
    'SELECT theme_mode FROM site_configs WHERE id = $1::uuid', config.id
  ).catch(() => []);
  const navOrderRows = await req.server.prisma.$queryRawUnsafe<Array<{ nav_order: unknown }>>(
    'SELECT nav_order FROM site_configs WHERE id = $1::uuid', config.id
  ).catch(() => []);
  return reply.send({
    success: true,
    data: {
      ...config,
      themeMode: themeRows[0]?.theme_mode === 'dark' ? 'dark' : 'light',
      navOrder: Array.isArray(navOrderRows[0]?.nav_order) ? (navOrderRows[0].nav_order as string[]) : null,
      taskTimerSeconds: extraRows[0]?.task_timer_seconds ?? 300,
      freeLifelinesPerSession: extraRows[0]?.free_lifelines_per_session ?? 3,
      hiddenMenuKeys: (Array.isArray(extraRows[0]?.hidden_menu_keys) ? extraRows[0].hidden_menu_keys : []) as string[],
      earlyCompletionBonusXp: extraRows[0]?.early_completion_bonus_xp ?? 5,
      coursesBannerUrl: extraRows[0]?.courses_banner_url ?? null,
    },
    error: null,
  });
}

export async function updateSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const { taskTimerSeconds, freeLifelinesPerSession, hiddenMenuKeys, earlyCompletionBonusXp, coursesBannerUrl, themeMode, ...prismaBody } = req.body as any;
  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({ data: prismaBody });
  } else {
    config = await req.server.prisma.siteConfig.update({ where: { id: config.id }, data: prismaBody });
  }
  if (taskTimerSeconds !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET task_timer_seconds = $1 WHERE id = $2::uuid',
      Number(taskTimerSeconds), config.id
    );
  }
  if (freeLifelinesPerSession !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET free_lifelines_per_session = $1 WHERE id = $2::uuid',
      Math.max(0, Math.min(20, Number(freeLifelinesPerSession))), config.id
    );
  }
  if (hiddenMenuKeys !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET hidden_menu_keys = $1::jsonb WHERE id = $2::uuid',
      JSON.stringify(hiddenMenuKeys), config.id
    );
  }
  if (earlyCompletionBonusXp !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET early_completion_bonus_xp = $1 WHERE id = $2::uuid',
      Math.max(0, Math.min(100, Number(earlyCompletionBonusXp))), config.id
    );
  }
  if (coursesBannerUrl !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET courses_banner_url = $1 WHERE id = $2::uuid',
      coursesBannerUrl || null, config.id
    );
  }
  if (themeMode === 'light' || themeMode === 'dark') {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET theme_mode = $1 WHERE id = $2::uuid',
      themeMode, config.id
    );
  }
  void invalidateCache(req.server.redis ?? null, PUB_SITE_CONFIG_CACHE_KEY);
  void invalidateCache(req.server.redis ?? null, PUB_NAV_CACHE_KEY);
  return reply.send({ success: true, data: { ...config, taskTimerSeconds: taskTimerSeconds ?? 300, freeLifelinesPerSession: freeLifelinesPerSession ?? 3, hiddenMenuKeys: hiddenMenuKeys ?? [], coursesBannerUrl: coursesBannerUrl ?? null, ...(themeMode === 'light' || themeMode === 'dark' ? { themeMode } : {}) }, error: null });
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
  // Nav items feed /api/pub/config/nav — without this a visibility/order change only
  // reaches members after the 5-minute pub:nav cache expires.
  void invalidateCache(req.server.redis ?? null, PUB_NAV_CACHE_KEY);
  return reply.status(201).send({ success: true, data: item, error: null });
}

export async function updateNavItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const item = await req.server.prisma.navItem.update({ where: { id }, data: req.body as any });
  void invalidateCache(req.server.redis ?? null, PUB_NAV_CACHE_KEY);
  return reply.send({ success: true, data: item, error: null });
}

export async function deleteNavItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.navItem.delete({ where: { id } });
  void invalidateCache(req.server.redis ?? null, PUB_NAV_CACHE_KEY);
  return reply.send({ success: true, data: null, error: null });
}

// Platform Sections that sit in the web nav bar and can be ordered among nav items.
// (Support / Streak are top-bar icons, not nav links, so they are not orderable.)
const ORDERABLE_NAV_SECTIONS = new Set(['section:community', 'section:ebooks', 'section:podcasts']);

// Body: { ids: string[] } — the admin's full drag order. Entries are nav_items ids, and
// may include "section:<key>" tokens for the orderable Platform Sections. nav_items.order
// is rewritten from the ids alone (mobile reads it); the combined list, sections
// included, is stored in site_configs.nav_order for the web nav bar.
export async function reorderNavItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return reply.status(400).send({ success: false, data: null, error: 'ids must be an array of strings' });
  }
  const tokens = (ids as string[]).filter((id) => !id.startsWith('section:') || ORDERABLE_NAV_SECTIONS.has(id));
  const itemIds = tokens.filter((id) => !id.startsWith('section:'));
  await req.server.prisma.$transaction(
    itemIds.map((id: string, i: number) =>
      req.server.prisma.navItem.update({ where: { id }, data: { order: i } })
    )
  );
  const config = await req.server.prisma.siteConfig.findFirst();
  if (config) {
    await req.server.prisma.$executeRawUnsafe(
      'UPDATE site_configs SET nav_order = $1::jsonb WHERE id = $2::uuid',
      JSON.stringify(tokens), config.id,
    );
  }
  void invalidateCache(req.server.redis ?? null, PUB_NAV_CACHE_KEY);
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

// ── MODULE CONFIG (CP-15) ─────────────────────────────────────────────

export async function listModuleConfigsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT module_name, display_name, tagline, description, banner_url, icon_url, accent_color, sort_order
     FROM module_config ORDER BY sort_order`
  ).catch(() => []);
  return reply.send({
    success: true,
    data: rows.map(r => ({
      moduleName: r.module_name,
      displayName: r.display_name ?? null,
      tagline: r.tagline ?? null,
      description: r.description ?? null,
      bannerUrl: r.banner_url ?? null,
      iconUrl: r.icon_url ?? null,
      accentColor: r.accent_color ?? null,
      sortOrder: Number(r.sort_order ?? 0),
    })),
    error: null,
  });
}

export async function updateModuleConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const { name } = req.params as { name: string };
  const { displayName, tagline, description, bannerUrl, iconUrl, accentColor, sortOrder } = req.body as any;
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO module_config (module_name, display_name, tagline, description, banner_url, icon_url, accent_color, sort_order, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (module_name) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       tagline = EXCLUDED.tagline,
       description = EXCLUDED.description,
       banner_url = EXCLUDED.banner_url,
       icon_url = EXCLUDED.icon_url,
       accent_color = EXCLUDED.accent_color,
       sort_order = EXCLUDED.sort_order,
       updated_at = now()`,
    name,
    displayName ?? null,
    tagline ?? null,
    description ?? null,
    bannerUrl ?? null,
    iconUrl ?? null,
    accentColor ?? null,
    Number(sortOrder ?? 0),
  );
  void invalidateCache(req.server.redis ?? null, 'courses:module-configs');
  return reply.send({ success: true, data: { moduleName: name }, error: null });
}
