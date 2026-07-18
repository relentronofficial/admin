/**
 * Podcasts module — admin CRUD + member listening.
 *
 * Split into two auth zones (see routes.ts):
 *   * `/api/podcasts/admin/*` — Clerk auth. Full CRUD for categories,
 *     series, episodes. Sees ALL rows regardless of status.
 *   * `/api/podcasts/*` — JWT-cookie auth. Members only see
 *     `status='active'` rows. Progress + continue-listening are
 *     scoped to `req.memberId`.
 *
 * Ported from co-worker's Express `admin-app/server.js`. Adaptations:
 *   * Auth (they had none; we require Clerk / JWT).
 *   * `member_id UUID` FK (they used `user_id TEXT` anon UUID).
 *   * Progress table renamed to `podcast_episode_progress` (legacy
 *     `podcast_progress` table + Prisma model still exist, unused).
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createCategorySchema,
  updateCategorySchema,
  createSeriesSchema,
  updateSeriesSchema,
  createEpisodeSchema,
  updateEpisodeSchema,
  submitProgressSchema,
  markCompletedSchema,
} from './schema.js';

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

// ────────────────────────────────────────────────────────────────
// CATEGORIES — admin
// ────────────────────────────────────────────────────────────────
export async function adminListCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.podcastCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.podcastCategory.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminUpdateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.podcastCategory.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Category not found.');
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminDeleteCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.podcastCategory.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Category not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// SERIES — admin
// ────────────────────────────────────────────────────────────────
export async function adminListSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.podcastSeries.findMany({
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createSeriesSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.podcastSeries.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminUpdateSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateSeriesSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.podcastSeries.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Series not found.');
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminDeleteSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.podcastSeries.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Series not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// EPISODES — admin
// ────────────────────────────────────────────────────────────────
const episodeInclude = {
  category: { select: { id: true, name: true, slug: true } },
  series: { select: { id: true, title: true, slug: true } },
};

export async function adminListEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '50', search = '', categoryId, seriesId, status } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 50));

  const where: any = {};
  if (search.trim()) where.title = { contains: search.trim(), mode: 'insensitive' };
  if (categoryId) where.categoryId = categoryId;
  if (seriesId) where.seriesId = seriesId;
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    req.server.prisma.podcastEpisode.findMany({
      where,
      include: episodeInclude,
      orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.podcastEpisode.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function adminCreateEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createEpisodeSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { publishDate, ...rest } = parsed.data;
  try {
    const created = await req.server.prisma.podcastEpisode.create({
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
      },
      include: episodeInclude,
    });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminUpdateEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateEpisodeSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { publishDate, ...rest } = parsed.data;
  try {
    const updated = await req.server.prisma.podcastEpisode.update({
      where: { id },
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
      },
      include: episodeInclude,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Episode not found.');
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminToggleEpisodeStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const current = await req.server.prisma.podcastEpisode.findUnique({ where: { id } });
  if (!current) return fail(reply, 404, 'not_found', 'Episode not found.');
  const next = current.status === 'active' ? 'inactive' : 'active';
  const updated = await req.server.prisma.podcastEpisode.update({
    where: { id },
    data: { status: next },
    include: episodeInclude,
  });
  return ok(reply, updated);
}

export async function adminDeleteEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.podcastEpisode.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Episode not found.');
    throw err;
  }
}

export async function adminDashboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const [totalEpisodes, activeEpisodes, categories, series, totalListens] = await Promise.all([
    req.server.prisma.podcastEpisode.count(),
    req.server.prisma.podcastEpisode.count({ where: { status: 'active' } }),
    req.server.prisma.podcastCategory.count(),
    req.server.prisma.podcastSeries.count(),
    req.server.prisma.podcastEpisodeProgress.count(),
  ]);
  return ok(reply, {
    totalEpisodes,
    activeEpisodes,
    inactiveEpisodes: totalEpisodes - activeEpisodes,
    categories,
    series,
    totalListens,
  });
}

// ────────────────────────────────────────────────────────────────
// MEMBER-FACING endpoints
// ────────────────────────────────────────────────────────────────
export async function listActiveCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.podcastCategory.findMany({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(reply, rows);
}

export async function listEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const {
    page = '1',
    limit = '20',
    category,
    seriesId,
    search,
    featured,
  } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const where: any = { status: 'active' };
  if (category && category !== 'all' && category !== 'All') {
    // The mobile client passes the slug; look up the id first so the
    // main query stays index-friendly.
    const cat = await req.server.prisma.podcastCategory.findUnique({
      where: { slug: category },
    });
    if (!cat) {
      return reply.send({
        success: true,
        data: [],
        meta: { total: 0, page: p, limit: l },
        error: null,
      });
    }
    where.categoryId = cat.id;
  }
  if (seriesId) where.seriesId = seriesId;
  if (search && search.trim()) {
    where.title = { contains: search.trim(), mode: 'insensitive' };
  }
  if (featured === 'true') where.isFeatured = true;

  const [rows, total] = await Promise.all([
    req.server.prisma.podcastEpisode.findMany({
      where,
      include: episodeInclude,
      orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.podcastEpisode.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function getEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const episode = await req.server.prisma.podcastEpisode.findFirst({
    where: { id, status: 'active' },
    include: episodeInclude,
  });
  if (!episode) return fail(reply, 404, 'not_found', 'Episode not found.');

  // Attach the caller's progress if any — saves a follow-up request
  // from the mobile player when the user reopens an episode.
  const progress = await req.server.prisma.podcastEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: req.memberId!, episodeId: id } },
  });
  return ok(reply, { ...episode, progress: progress ?? null });
}

export async function listFeaturedSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.podcastSeries.findMany({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });
  // Attach live episode counts — cheap since podcast_episodes has an
  // index on series_id.
  const withCounts = await Promise.all(
    rows.map(async (s) => {
      const count = await req.server.prisma.podcastEpisode.count({
        where: { seriesId: s.id, status: 'active' },
      });
      return { ...s, episodesCount: count };
    }),
  );
  return ok(reply, withCounts);
}

export async function getSeriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const series = await req.server.prisma.podcastSeries.findUnique({ where: { id } });
  if (!series) return fail(reply, 404, 'not_found', 'Series not found.');
  const episodes = await req.server.prisma.podcastEpisode.findMany({
    where: { seriesId: id, status: 'active' },
    include: episodeInclude,
    orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
  });
  return ok(reply, { ...series, episodes });
}

export async function continueListeningHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.podcastEpisodeProgress.findMany({
    where: {
      memberId: req.memberId!,
      completed: false,
      currentPositionSeconds: { gt: 0 },
      episode: { status: 'active' },
    },
    include: { episode: { include: episodeInclude } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  return ok(reply, rows);
}

export async function submitProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitProgressSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { episodeId, currentPositionSeconds, totalDurationSeconds, completed } = parsed.data;

  // Confirm the episode exists & is active — don't record progress
  // against removed/inactive content.
  const ep = await req.server.prisma.podcastEpisode.findFirst({
    where: { id: episodeId, status: 'active' },
    select: { id: true },
  });
  if (!ep) return fail(reply, 404, 'not_found', 'Episode not found.');

  const upserted = await req.server.prisma.podcastEpisodeProgress.upsert({
    where: {
      memberId_episodeId: { memberId: req.memberId!, episodeId },
    },
    create: {
      memberId: req.memberId!,
      episodeId,
      currentPositionSeconds,
      totalDurationSeconds,
      completed: completed ?? false,
    },
    update: {
      currentPositionSeconds,
      totalDurationSeconds,
      completed: completed ?? undefined,
    },
  });
  return ok(reply, upserted);
}

export async function markCompletedHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = markCompletedSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { episodeId, totalDurationSeconds } = parsed.data;
  const ep = await req.server.prisma.podcastEpisode.findFirst({
    where: { id: episodeId, status: 'active' },
    select: { id: true, durationSeconds: true },
  });
  if (!ep) return fail(reply, 404, 'not_found', 'Episode not found.');
  const duration = totalDurationSeconds ?? ep.durationSeconds ?? 0;
  const upserted = await req.server.prisma.podcastEpisodeProgress.upsert({
    where: {
      memberId_episodeId: { memberId: req.memberId!, episodeId },
    },
    create: {
      memberId: req.memberId!,
      episodeId,
      currentPositionSeconds: duration,
      totalDurationSeconds: duration,
      completed: true,
    },
    update: {
      currentPositionSeconds: duration,
      totalDurationSeconds: duration,
      completed: true,
    },
  });
  return ok(reply, upserted);
}
