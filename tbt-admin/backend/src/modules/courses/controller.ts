import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  notifyCourseAccessGranted,
  notifyBadgeAwarded,
} from '../../lib/courseNotifications.js';
import { invalidateCache } from '../../lib/cache.js';
import { notifyMembers } from '../../lib/notifications.js';
import { validateCoursePrice } from '../../lib/coursePriceValidation.js';
import { planEpisodeOrder, sectionPositions, parseEpisodePosition, type OrderChange } from '../../lib/episodeOrdering.js';

// Any course/episode edit can change what the home sections and the /courses
// catalog render (thumbnail, title, price, publish state, episode count and
// durations, visibility). Busting home:* and courses:catalog:* is cheap — a
// handful of keys — and cheaper than serving stale data for up to 5 min.
/**
 * Renumber a course's episodes ("order" = 0..n-1) in canonical order — sections by
 * sort_order, then unsectioned; see lib/episodeOrdering.ts — applying an optional
 * change. One transaction with the course's episode rows locked, so concurrent
 * edits can't interleave; only rows whose position changed are written. Episode
 * ids and section membership are never touched.
 */
async function applyEpisodeOrder(prisma: any, courseId: string, change: OrderChange = {}): Promise<number> {
  return prisma.$transaction(async (tx: any) => {
    const eps: any[] = await tx.$queryRawUnsafe(
      `SELECT id::text AS id, section_id::text AS section_id, "order", created_at
         FROM course_episodes WHERE course_id = $1::uuid ORDER BY id FOR UPDATE`,
      courseId,
    );
    const secs: any[] = await tx.$queryRawUnsafe(
      `SELECT id::text AS id, sort_order, created_at FROM course_sections WHERE course_id = $1::uuid`,
      courseId,
    );
    const plan = planEpisodeOrder(
      eps.map((e) => ({ id: e.id, sectionId: e.section_id ?? null, order: e.order == null ? null : Number(e.order), createdAt: e.created_at })),
      secs.map((x) => ({ id: x.id, sortOrder: x.sort_order == null ? null : Number(x.sort_order), createdAt: x.created_at })),
      change,
    );
    const current = new Map(eps.map((e) => [e.id, e.order == null ? null : Number(e.order)]));
    const changed = plan.filter((p) => current.get(p.id) !== p.order);
    if (changed.length) {
      await tx.$executeRawUnsafe(
        `UPDATE course_episodes e SET "order" = v.ord
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS ord) v
          WHERE e.id = v.id AND e.course_id = $3::uuid`,
        changed.map((c) => c.id),
        changed.map((c) => c.order),
        courseId,
      );
    }
    return changed.length;
  });
}

function bustHome(req: FastifyRequest): void {
  void invalidateCache(req.server.redis ?? null, 'home:*');
  void invalidateCache(req.server.redis ?? null, 'courses:catalog:*');
}

// Admin controllers only get the Clerk subject string on req.user (there is
// no req.admin) — look up the admin's own DB row to attribute an action.
async function resolveAdminId(req: FastifyRequest): Promise<string | null> {
  if (!req.user) return null;
  const admin = await req.server.prisma.admin
    .findFirst({ where: { clerkId: req.user as string }, select: { id: true } })
    .catch(() => null);
  return admin?.id ?? null;
}

// ── COURSES ───────────────────────────────────────────────────────────

export async function listCoursesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, search } = req.query as any;
  const where: any = search ? { title: { contains: search, mode: 'insensitive' } } : {};
  const [courses, total] = await Promise.all([
    req.server.prisma.course.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { courseEpisodes: true } } },
    }),
    req.server.prisma.course.count({ where }),
  ]);
  const ids = courses.map((c) => c.id);
  const moduleRows = ids.length
    ? await req.server.prisma.$queryRawUnsafe<{ id: string; module: string | null; applicable_business_types: string[] | null; batch_visibility_ids: string[] | null }[]>(
        `SELECT id, module, applicable_business_types, batch_visibility_ids FROM courses WHERE id = ANY($1::uuid[])`, ids,
      ).catch(() => [])
    : [];
  const moduleMap = new Map(moduleRows.map((r) => [r.id, {
    module: r.module,
    applicableBusinessTypes: r.applicable_business_types ?? null,
    batchVisibilityIds: (r.batch_visibility_ids as string[] | null) ?? null,
  }]));
  const data = courses.map((c) => ({
    ...c,
    module: moduleMap.get(c.id)?.module ?? null,
    applicableBusinessTypes: moduleMap.get(c.id)?.applicableBusinessTypes ?? null,
    batchVisibilityIds: moduleMap.get(c.id)?.batchVisibilityIds ?? null,
  }));
  return reply.send({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let price: string | null = null;
  if (body.price !== undefined && body.price !== null) {
    const priceCheck = validateCoursePrice(body.price);
    if (!priceCheck.valid) {
      return reply.status(400).send({ success: false, data: null, error: priceCheck.error });
    }
    price = priceCheck.value;
  }

  try {
    const count = await req.server.prisma.course.count();
    const course = await req.server.prisma.course.create({
      data: {
        title: body.title,
        slug,
        description: body.description,
        thumbnailUrl: body.thumbnailUrl,
        requiredTier: Number(body.requiredTier) || 1,
        isActive: body.isActive ?? true,
        isPublished: body.isPublished ?? true,
        sortOrder: body.order ?? count,
        price,
        accessDurationDays: body.accessDurationDays ?? null,
        maxEnrollments: body.maxEnrollments ?? null,
        xpPerEpisode: body.xpPerEpisode ?? 10,
        passingScorePercent: body.passingScorePercent ?? 70,
        paymentLinkUrl: body.paymentLinkUrl ?? null,
        requireSequential: body.requireSequential ?? true,
        completionThresholdPercent: body.completionThresholdPercent ?? 95,
      },
    });
    const module = body.module ?? null;
    const applicableBusinessTypes: string[] | null = Array.isArray(body.applicableBusinessTypes) ? body.applicableBusinessTypes : null;
    const batchVisibilityIds: string[] | null = Array.isArray(body.batchVisibilityIds) ? body.batchVisibilityIds : null;
    const rawSets: string[] = [];
    const rawVals: any[] = [];
    if (module) { rawSets.push(`module = $${rawVals.length + 1}`); rawVals.push(module); }
    if (applicableBusinessTypes !== null) { rawSets.push(`applicable_business_types = $${rawVals.length + 1}`); rawVals.push(applicableBusinessTypes); }
    if (batchVisibilityIds !== null) { rawSets.push(`batch_visibility_ids = $${rawVals.length + 1}::jsonb`); rawVals.push(JSON.stringify(batchVisibilityIds)); }
    if (rawSets.length) {
      rawVals.push(course.id);
      await req.server.prisma.$executeRawUnsafe(
        `UPDATE courses SET ${rawSets.join(', ')} WHERE id = $${rawVals.length}::uuid`, ...rawVals,
      );
    }
    bustHome(req);
    return reply.status(201).send({ success: true, data: { ...course, module, applicableBusinessTypes, batchVisibilityIds }, error: null });
  } catch (err: any) {
    req.log.error({ err }, 'createCourseHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message ?? 'Failed to create course' });
  }
}

export async function getCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const [course, moduleRows] = await Promise.all([
    req.server.prisma.course.findUnique({
      where: { id },
      include: { courseEpisodes: { orderBy: { order: 'asc' } } },
    }),
    req.server.prisma.$queryRawUnsafe<{ module: string | null; applicable_business_types: string[] | null; batch_visibility_ids: string[] | null }[]>(
      `SELECT module, applicable_business_types, batch_visibility_ids FROM courses WHERE id = $1::uuid`, id,
    ).catch(() => []),
  ]);
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Not found' });
  return reply.send({ success: true, data: {
    ...course,
    module: moduleRows[0]?.module ?? null,
    applicableBusinessTypes: moduleRows[0]?.applicable_business_types ?? null,
    batchVisibilityIds: (moduleRows[0]?.batch_visibility_ids as string[] | null) ?? null,
  }, error: null });
}

export async function updateCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  [
    'title', 'slug', 'description', 'thumbnailUrl', 'requiredTier', 'isActive', 'isPublished',
    'price', 'level', 'accessDurationDays', 'maxEnrollments',
    'xpPerEpisode', 'passingScorePercent', 'upsellCourseIds', 'crossSellCourseIds',
    'paymentLinkUrl',
    'requireSequential', 'completionThresholdPercent',
  ].forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  if (typeof data.completionThresholdPercent === 'number') {
    data.completionThresholdPercent = Math.min(100, Math.max(50, Math.round(data.completionThresholdPercent)));
  }
  if (body.order !== undefined) data.sortOrder = body.order;
  // Coerce price to a Decimal-compatible string, and reject anything that
  // isn't a valid non-negative number, before it ever reaches Prisma.
  if (data.price !== undefined && data.price !== null) {
    const priceCheck = validateCoursePrice(data.price);
    if (!priceCheck.valid) {
      return reply.status(400).send({ success: false, data: null, error: priceCheck.error });
    }
    data.price = priceCheck.value;
  }
  try {
    const course = await req.server.prisma.course.update({ where: { id }, data });
    let module: string | null = null;
    let applicableBusinessTypes: string[] | null = null;
    let batchVisibilityIds: string[] | null = null;
    const rawSets: string[] = [];
    const rawVals: any[] = [];
    if ('module' in body) {
      module = body.module ?? null;
      rawSets.push(`module = $${rawVals.length + 1}`);
      rawVals.push(module);
    }
    if ('applicableBusinessTypes' in body) {
      applicableBusinessTypes = Array.isArray(body.applicableBusinessTypes) ? body.applicableBusinessTypes : null;
      rawSets.push(`applicable_business_types = $${rawVals.length + 1}`);
      rawVals.push(applicableBusinessTypes);
    }
    if ('batchVisibilityIds' in body) {
      batchVisibilityIds = Array.isArray(body.batchVisibilityIds) ? body.batchVisibilityIds : null;
      rawSets.push(`batch_visibility_ids = $${rawVals.length + 1}::jsonb`);
      rawVals.push(JSON.stringify(batchVisibilityIds ?? []));
    }
    if (rawSets.length) {
      rawVals.push(id);
      await req.server.prisma.$executeRawUnsafe(
        `UPDATE courses SET ${rawSets.join(', ')} WHERE id = $${rawVals.length}::uuid`, ...rawVals,
      );
    }
    // Always read back raw columns for the response
    const rawRows = await req.server.prisma.$queryRawUnsafe<{ module: string | null; applicable_business_types: string[] | null; batch_visibility_ids: string[] | null }[]>(
      `SELECT module, applicable_business_types, batch_visibility_ids FROM courses WHERE id = $1::uuid`, id,
    ).catch(() => []);
    module = rawRows[0]?.module ?? null;
    applicableBusinessTypes = rawRows[0]?.applicable_business_types ?? null;
    batchVisibilityIds = (rawRows[0]?.batch_visibility_ids as string[] | null) ?? null;
    bustHome(req);
    return reply.send({ success: true, data: { ...course, module, applicableBusinessTypes, batchVisibilityIds }, error: null });
  } catch (err: any) {
    req.log.error({ err, courseId: id }, 'updateCourseHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message ?? 'Failed to update course' });
  }
}

export async function deleteCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.course.delete({ where: { id } });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

// ── COURSE SECTIONS ───────────────────────────────────────────────────

export async function listCourseSectionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const sections = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, course_id, title, description, sort_order, timer_seconds, created_at
     FROM course_sections WHERE course_id = $1::uuid ORDER BY sort_order ASC`,
    id,
  );
  return reply.send({ success: true, data: sections.map(s => ({
    id: s.id, courseId: s.course_id, title: s.title,
    description: s.description, sortOrder: Number(s.sort_order),
    timerSeconds: s.timer_seconds != null ? Number(s.timer_seconds) : null,
    createdAt: s.created_at,
  })) });
}

export async function createCourseSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { title, description, timerSeconds } = req.body as any;
  if (!title?.trim()) return reply.status(400).send({ success: false, error: 'title is required' });
  const timerSecs = timerSeconds != null && timerSeconds !== '' ? Number(timerSeconds) : null;
  const [countRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS cnt FROM course_sections WHERE course_id = $1::uuid`, id,
  );
  const sortOrder = Number(countRow?.cnt ?? 0);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO course_sections (course_id, title, description, sort_order, timer_seconds)
     VALUES ($1::uuid, $2, $3, $4, $5) RETURNING *`,
    id, title.trim(), description?.trim() ?? null, sortOrder, timerSecs,
  );
  bustHome(req);
  return reply.status(201).send({ success: true, data: {
    id: row.id, courseId: row.course_id, title: row.title,
    description: row.description, sortOrder: Number(row.sort_order),
    timerSeconds: row.timer_seconds != null ? Number(row.timer_seconds) : null,
    createdAt: row.created_at,
  }});
}

export async function updateCourseSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { sectionId } = req.params as any;
  const { title, description, timerSeconds } = req.body as any;
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title.trim()); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description?.trim() ?? null); }
  if (timerSeconds !== undefined) {
    const timerSecs = timerSeconds !== '' && timerSeconds !== null ? Number(timerSeconds) : null;
    sets.push(`timer_seconds = $${idx++}`); vals.push(timerSecs);
  }
  if (!sets.length) return reply.status(400).send({ success: false, error: 'Nothing to update' });
  vals.push(sectionId);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE course_sections SET ${sets.join(', ')} WHERE id = $${idx}::uuid RETURNING *`, ...vals,
  );
  if (!row) return reply.status(404).send({ success: false, error: 'Section not found' });
  bustHome(req);
  return reply.send({ success: true, data: {
    id: row.id, courseId: row.course_id, title: row.title,
    description: row.description, sortOrder: Number(row.sort_order),
    timerSeconds: row.timer_seconds != null ? Number(row.timer_seconds) : null,
    createdAt: row.created_at,
  }});
}

export async function deleteCourseSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { sectionId } = req.params as any;
  // Nullify section_id on orphaned episodes before deleting
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_episodes SET section_id = NULL WHERE section_id = $1::uuid`, sectionId,
  );
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM course_sections WHERE id = $1::uuid`, sectionId,
  );
  const { id: courseId } = req.params as any;
  try {
    await applyEpisodeOrder(req.server.prisma, courseId);
  } catch (err) {
    req.log.error({ err }, 'episode order renumber after section delete failed');
  }
  bustHome(req);
  return reply.send({ success: true });
}

export async function reorderCourseSectionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  if (!Array.isArray(ids)) return reply.status(400).send({ success: false, error: 'ids must be an array' });
  await Promise.all(
    ids.map((id: string, i: number) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE course_sections SET sort_order = $1 WHERE id = $2::uuid`, i, id,
      ),
    ),
  );
  const { id: courseId } = req.params as any;
  try {
    await applyEpisodeOrder(req.server.prisma, courseId);
  } catch (err) {
    req.log.error({ err }, 'episode order renumber after section reorder failed');
  }
  bustHome(req);
  return reply.send({ success: true });
}

// ── COURSE EPISODES ───────────────────────────────────────────────────

export async function listCourseEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const [rows, moduleRows, sectionRows] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.*, e.section_id, e.timer_seconds, e.streak_points,
         e.lifeline_enabled, e.lifeline_count, e.lifeline_coin_cost, e.max_purchased_lifelines,
         e.episode_side_content, e.episode_form_config,
         s.title AS section_title, s.sort_order AS section_sort_order
       FROM course_episodes e
       LEFT JOIN course_sections s ON s.id = e.section_id
       WHERE e.course_id = $1::uuid
       ORDER BY e."order" ASC`,
      id,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT cem.episode_id, cem.module_id FROM course_episode_modules cem
       JOIN course_modules cm ON cm.id = cem.module_id WHERE cm.course_id = $1::uuid`,
      id,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text AS id, sort_order, created_at FROM course_sections WHERE course_id = $1::uuid`,
      id,
    ),
  ]);
  // Same canonical order members see (sections, then unsectioned) — also correct
  // for legacy rows whose stored "order" values are stale or duplicated.
  const orderInput = rows.map((e: any) => ({ id: e.id, sectionId: e.section_id ?? null, order: e.order == null ? null : Number(e.order), createdAt: e.created_at }));
  const sectionInput = sectionRows.map((x: any) => ({ id: x.id, sortOrder: x.sort_order == null ? null : Number(x.sort_order), createdAt: x.created_at }));
  const canonicalIdx = new Map(planEpisodeOrder(orderInput, sectionInput).map((p, i) => [p.id, i]));
  const positions = sectionPositions(orderInput, sectionInput);
  rows.sort((a: any, b: any) => (canonicalIdx.get(a.id) ?? 0) - (canonicalIdx.get(b.id) ?? 0));
  const modulesByEpisode = new Map<string, string[]>();
  for (const r of moduleRows) {
    if (!modulesByEpisode.has(r.episode_id)) modulesByEpisode.set(r.episode_id, []);
    modulesByEpisode.get(r.episode_id)!.push(r.module_id);
  }
  const episodes = rows.map(e => ({
    id: e.id, courseId: e.course_id, title: e.title,
    thumbnailUrl: e.thumbnail_url, videoUrl: e.video_url,
    bunnyVideoId: e.bunny_video_id, durationSeconds: Number(e.duration_seconds ?? 0),
    order: Number(e.order ?? 0), position: positions.get(e.id) ?? null, isVisible: e.is_visible,
    quizData: e.quiz_data, quizUnlockPercent: Number(e.quiz_unlock_percent ?? 80),
    drmEnabled: e.drm_enabled, bunnyDrmToken: e.bunny_drm_token,
    timerSeconds: e.timer_seconds != null ? Number(e.timer_seconds) : null,
    streakPoints: Number(e.streak_points ?? 0),
    lifelineEnabled: e.lifeline_enabled !== false,
    lifelineCount: Number(e.lifeline_count ?? 3),
    lifelineCoinCost: Number(e.lifeline_coin_cost ?? 50),
    maxPurchasedLifelines: Number(e.max_purchased_lifelines ?? 5),
    sectionId: e.section_id ?? null, sectionTitle: e.section_title ?? null,
    sectionSortOrder: e.section_sort_order != null ? Number(e.section_sort_order) : null,
    moduleIds: modulesByEpisode.get(e.id) ?? [],
    sideContent: e.episode_side_content ?? null,
    formConfig: e.episode_form_config ?? null,
    createdAt: e.created_at, updatedAt: e.updated_at,
  }));
  return reply.send({ success: true, data: episodes, error: null });
}

export async function createCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  // Assessment Check By is mandatory for every NEW episode (2026-09) — Self or
  // Admin Assessment only, no "none" option, so a course video can never be
  // created without an assessment owner. Existing episodes created before this
  // rule (no linked task at all) are explicitly grandfathered and untouched —
  // this check only runs on creation, never on updateCourseEpisodeHandler, so
  // old "No Assessment" episodes keep working and never get a task forced onto
  // them by an edit. Trusts nothing from the client beyond these two values.
  const assessmentType = body.assessmentType;
  if (assessmentType !== 'self' && assessmentType !== 'admin') {
    return reply.status(400).send({
      success: false, data: null,
      error: 'Assessment Check By is required: choose Self Assessment or Admin Assessment.',
    });
  }
  const assessmentTaskTitle = typeof body.assessmentTaskTitle === 'string' ? body.assessmentTaskTitle.trim() : '';
  if (!assessmentTaskTitle) {
    return reply.status(400).send({ success: false, data: null, error: 'Assessment title is required.' });
  }
  const count = await req.server.prisma.courseEpisode.count({ where: { courseId: id } });
  const episode = await req.server.prisma.courseEpisode.create({
    data: {
      courseId: id,
      title: body.title,
      description: body.description || null,
      thumbnailUrl: body.thumbnailUrl || null,
      videoUrl: body.videoUrl,
      bunnyVideoId: body.bunnyVideoId || null,
      durationSeconds: Number(body.durationSeconds) || 0,
      order: body.order ?? count,
      isVisible: body.isVisible ?? true,
      ...(body.quizData !== undefined && { quizData: body.quizData }),
      ...(body.quizUnlockPercent !== undefined && { quizUnlockPercent: Number(body.quizUnlockPercent) }),
      ...(body.drmEnabled !== undefined && { drmEnabled: Boolean(body.drmEnabled) }),
      ...(body.bunnyDrmToken !== undefined && { bunnyDrmToken: body.bunnyDrmToken || null }),
    },
  });
  const timerSecs = body.timerSeconds != null ? Number(body.timerSeconds) : null;
  const streakPoints = body.streakPoints != null ? Number(body.streakPoints) || 0 : 0;
  const sectionId = body.sectionId || null;
  const moduleIds: string[] = Array.isArray(body.moduleIds) ? body.moduleIds : [];
  const sideContent = body.sideContent !== undefined ? (body.sideContent === null ? null : body.sideContent) : null;
  const formConfig = body.formConfig !== undefined ? (body.formConfig === null ? null : body.formConfig) : null;
  const rawUpdates: Promise<any>[] = [];
  if (timerSecs !== null) rawUpdates.push(req.server.prisma.$executeRawUnsafe(
    'UPDATE course_episodes SET timer_seconds = $1 WHERE id = $2::uuid', timerSecs, episode.id
  ).catch(() => {}));
  rawUpdates.push(req.server.prisma.$executeRawUnsafe(
    'UPDATE course_episodes SET streak_points = $1 WHERE id = $2::uuid', streakPoints, episode.id
  ).catch(() => {}));
  if (sectionId) rawUpdates.push(req.server.prisma.$executeRawUnsafe(
    'UPDATE course_episodes SET section_id = $1::uuid WHERE id = $2::uuid', sectionId, episode.id
  ).catch(() => {}));
  if (moduleIds.length > 0) {
    const ph = moduleIds.map((_: any, i: number) => `($1::uuid, $${i + 2}::uuid)`).join(', ');
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      `INSERT INTO course_episode_modules (episode_id, module_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
      episode.id, ...moduleIds,
    ).catch(() => {}));
  }
  rawUpdates.push(req.server.prisma.$executeRawUnsafe(
    'UPDATE course_episodes SET episode_side_content = $1::jsonb, episode_form_config = $2::jsonb WHERE id = $3::uuid',
    sideContent != null ? JSON.stringify(sideContent) : null,
    formConfig != null ? JSON.stringify(formConfig) : null,
    episode.id,
  ).catch(() => {}));
  if (rawUpdates.length) await Promise.all(rawUpdates);
  try {
    await applyEpisodeOrder(req.server.prisma, id, { toSectionEnd: episode.id });
  } catch (err) {
    req.log.error({ err }, 'episode order renumber after create failed');
  }
  bustHome(req);
  return reply.status(201).send({ success: true, data: { ...episode, timerSeconds: timerSecs, streakPoints, sectionId, moduleIds, sideContent, formConfig }, error: null });
}

export async function updateCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = req.body as any;
  // "Episode Order": 1-based position inside the episode's section (validated up front,
  // so an invalid value saves nothing).
  let position: number | undefined;
  if (body.position !== undefined && body.position !== null && body.position !== '') {
    const p = parseEpisodePosition(body.position);
    if (!p.ok) return reply.status(400).send({ success: false, data: null, error: p.error });
    position = p.value;
  }
  const before = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT course_id::text AS course_id, section_id::text AS section_id FROM course_episodes WHERE id = $1::uuid`, eid,
  ).catch(() => [] as any[]);
  if (!before.length) return reply.status(404).send({ success: false, data: null, error: 'Episode not found' });
  const data: any = {};
  ['title', 'description', 'thumbnailUrl', 'videoUrl', 'bunnyVideoId', 'isVisible', 'quizData', 'bunnyDrmToken'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.durationSeconds !== undefined) data.durationSeconds = Number(body.durationSeconds) || 0;
  if (body.order !== undefined) data.order = body.order;
  if (body.quizUnlockPercent !== undefined) data.quizUnlockPercent = Number(body.quizUnlockPercent);
  if (body.drmEnabled !== undefined) data.drmEnabled = Boolean(body.drmEnabled);
  const timerSecs = 'timerSeconds' in body ? (body.timerSeconds != null ? Number(body.timerSeconds) : null) : undefined;
  const streakPoints = 'streakPoints' in body ? (Number(body.streakPoints) || 0) : undefined;
  const sectionId = 'sectionId' in body ? (body.sectionId || null) : undefined;
  const lifelineEnabled = 'lifelineEnabled' in body ? Boolean(body.lifelineEnabled) : undefined;
  const lifelineCount = 'lifelineCount' in body ? (Number(body.lifelineCount) || 3) : undefined;
  const lifelineCoinCost = 'lifelineCoinCost' in body ? (Number(body.lifelineCoinCost) || 50) : undefined;
  const maxPurchasedLifelines = 'maxPurchasedLifelines' in body ? (Number(body.maxPurchasedLifelines) || 5) : undefined;
  const moduleIds: string[] | undefined = 'moduleIds' in body && Array.isArray(body.moduleIds) ? body.moduleIds : undefined;
  const sideContent = 'sideContent' in body ? (body.sideContent === null ? null : body.sideContent) : undefined;
  const formConfig = 'formConfig' in body ? (body.formConfig === null ? null : body.formConfig) : undefined;
  const episode = await req.server.prisma.courseEpisode.update({ where: { id: eid }, data });
  const rawUpdates: Promise<any>[] = [];
  if (timerSecs !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET timer_seconds = $1 WHERE id = $2::uuid', timerSecs, episode.id
    ).catch(() => {}));
  }
  if (streakPoints !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET streak_points = $1 WHERE id = $2::uuid', streakPoints, episode.id
    ).catch(() => {}));
  }
  if (sectionId !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET section_id = $1::uuid WHERE id = $2::uuid', sectionId, episode.id
    ).catch(() => {}));
  }
  if (moduleIds !== undefined) {
    rawUpdates.push(
      req.server.prisma.$executeRawUnsafe(
        `DELETE FROM course_episode_modules WHERE episode_id = $1::uuid`, eid,
      ).then(() => {
        if (moduleIds.length === 0) return;
        const ph = moduleIds.map((_: any, i: number) => `($1::uuid, $${i + 2}::uuid)`).join(', ');
        return req.server.prisma.$executeRawUnsafe(
          `INSERT INTO course_episode_modules (episode_id, module_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
          eid, ...moduleIds,
        );
      }).catch(() => {}),
    );
  }
  if (lifelineEnabled !== undefined) rawUpdates.push(req.server.prisma.$executeRawUnsafe(
    `UPDATE course_episodes SET lifeline_enabled = $1, lifeline_count = $2, lifeline_coin_cost = $3, max_purchased_lifelines = $4 WHERE id = $5::uuid`,
    lifelineEnabled, lifelineCount ?? 3, lifelineCoinCost ?? 50, maxPurchasedLifelines ?? 5, eid,
  ).catch(() => {}));
  if (sideContent !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      `UPDATE course_episodes SET episode_side_content = $1::jsonb WHERE id = $2::uuid`,
      sideContent != null ? JSON.stringify(sideContent) : null, eid,
    ).catch(() => {}));
  }
  if (formConfig !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      `UPDATE course_episodes SET episode_form_config = $1::jsonb WHERE id = $2::uuid`,
      formConfig != null ? JSON.stringify(formConfig) : null, eid,
    ).catch(() => {}));
  }
  if (rawUpdates.length) await Promise.all(rawUpdates);
  const movedSection = sectionId !== undefined && (sectionId ?? null) !== (before[0].section_id ?? null);
  if (position !== undefined || movedSection) {
    try {
      await applyEpisodeOrder(req.server.prisma, before[0].course_id,
        position !== undefined ? { move: { episodeId: eid, position } } : { toSectionEnd: eid });
    } catch (err) {
      req.log.error({ err }, 'episode order update failed');
      return reply.status(500).send({ success: false, data: null, error: 'The episode was saved, but its order could not be updated. Please try again.' });
    }
  }
  bustHome(req);
  return reply.send({ success: true, data: { ...episode, timerSeconds: timerSecs ?? null, streakPoints: streakPoints ?? undefined, sectionId: sectionId ?? null, moduleIds: moduleIds ?? [], lifelineEnabled: lifelineEnabled ?? true, lifelineCount: lifelineCount ?? 3, lifelineCoinCost: lifelineCoinCost ?? 50, maxPurchasedLifelines: maxPurchasedLifelines ?? 5, sideContent: sideContent ?? null, formConfig: formConfig ?? null }, error: null });
}

export async function deleteCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  await req.server.prisma.courseEpisode.delete({ where: { id: eid } });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderCourseEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { ids } = (req.body ?? {}) as any;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x: unknown) => typeof x === 'string')) {
    return reply.status(400).send({ success: false, data: null, error: 'ids must be a non-empty array of episode ids' });
  }
  const owned = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int AS n FROM course_episodes WHERE course_id = $1::uuid AND id = ANY($2::uuid[])`,
    id, ids,
  ).catch(() => [{ n: -1 }]);
  if (Number(owned[0]?.n) !== new Set(ids).size) {
    return reply.status(400).send({ success: false, data: null, error: 'Some episodes do not belong to this course' });
  }
  // The admin's sequence decides the order inside each section; sections stay intact.
  await applyEpisodeOrder(req.server.prisma, id, { sequence: ids });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

// ── Episode Form Submissions (admin) ────────────────────────────────────────

export async function listEpisodeFormSubmissionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const { page = 1, limit = 50 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const [rows, countRows] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s.episode_id, s.member_id, s.course_id, s.data, s.submitted_at,
              m.first_name, m.last_name, m.phone, m.email
       FROM episode_form_submissions s
       LEFT JOIN members m ON m.id = s.member_id
       WHERE s.episode_id = $1::uuid
       ORDER BY s.submitted_at DESC
       LIMIT $2 OFFSET $3`,
      eid, Number(limit), offset,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS total FROM episode_form_submissions WHERE episode_id = $1::uuid`, eid,
    ),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  const data = rows.map((r) => ({
    id: r.id, episodeId: r.episode_id, memberId: r.member_id, courseId: r.course_id,
    data: r.data, submittedAt: r.submitted_at,
    member: r.member_id ? { firstName: r.first_name, lastName: r.last_name, phone: r.phone, email: r.email } : null,
  }));
  return reply.send({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

// ── LEGACY STUBS (kept for existing TBT LMS hooks) ───────────────────

export async function publishCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const course = await req.server.prisma.course.update({ where: { id }, data: { isPublished: true } });
  bustHome(req);
  return reply.send({ success: true, data: course, error: null });
}

export async function listEnrollmentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const enrollments = await req.server.prisma.courseEnrollment.findMany({
    where: { courseId: id },
    include: { member: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return reply.send({ success: true, data: enrollments, error: null });
}

export async function updateCurriculumHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ success: true, data: null, error: null });
}

// ── COURSE PAYMENTS (admin) ───────────────────────────────────────────

export async function listCoursePaymentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, courseId, status, method } = req.query as any;
  const where: any = {};
  if (courseId) where.courseId = courseId;
  if (status) where.status = status;
  if (method) where.method = method;

  const [payments, total, revenueAgg] = await Promise.all([
    (req.server.prisma as any).coursePayment.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    }),
    (req.server.prisma as any).coursePayment.count({ where }),
    // Aggregate total revenue across ALL pages matching the current filters
    (req.server.prisma as any).coursePayment.aggregate({
      where: { ...where, status: 'completed' },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number((revenueAgg as any)._sum?.amount ?? 0);

  // Merge Razorpay columns (raw SQL — not in Prisma schema)
  const paymentIds: string[] = payments.map((p: any) => p.id);
  const rzpRows = paymentIds.length
    ? await req.server.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, razorpay_order_id, razorpay_payment_id FROM course_payments WHERE id = ANY($1::uuid[])`,
        paymentIds,
      ).catch(() => [] as any[])
    : [];
  const rzpByPaymentId = Object.fromEntries(rzpRows.map((r: any) => [r.id, r]));
  const data = payments.map((p: any) => ({
    ...p,
    razorpayOrderId: rzpByPaymentId[p.id]?.razorpay_order_id ?? null,
    razorpayPaymentId: rzpByPaymentId[p.id]?.razorpay_payment_id ?? null,
  }));

  return reply.send({ success: true, data, meta: { total, page: Number(page), limit: Number(limit), totalRevenue }, error: null });
}

// ── COURSE ACCESS (admin) ─────────────────────────────────────────────

export async function listCourseAccessHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const accesses = await (req.server.prisma as any).courseAccess.findMany({
    where: { courseId: id },
    include: { member: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { grantedAt: 'desc' },
  });
  return reply.send({ success: true, data: accesses, error: null });
}

export async function grantCourseAccessHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = req.params as any;
  const body = req.body as any;
  const { memberId, accessType = 'lifetime', expiresAt, amount, currency, method, reference, notes } = body;

  if (!memberId) return reply.status(400).send({ success: false, data: null, error: 'memberId is required' });

  const course = await req.server.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Course not found' });

  try {
    const adminId = await resolveAdminId(req);
    let paymentId: string | undefined;

    if (amount && Number(amount) > 0) {
      const payment = await req.server.prisma.coursePayment.create({
        data: {
          memberId,
          courseId,
          amount: Number(amount),
          currency: currency ?? 'INR',
          method: method ?? 'manual',
          status: 'completed',
          reference: reference ?? null,
          paidAt: new Date(),
          notes: notes ?? null,
          grantedBy: adminId,
        },
      });
      paymentId = payment.id;
    }

    const access = await req.server.prisma.courseAccess.upsert({
      where: { memberId_courseId: { memberId, courseId } },
      create: {
        memberId,
        courseId,
        accessType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        grantedBy: adminId,
        paymentId: paymentId ?? null,
        notes: notes ?? null,
      },
      update: {
        accessType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        grantedBy: adminId,
        revokedAt: null,
        revokedBy: null,
        paymentId: paymentId ?? undefined,
        notes: notes ?? undefined,
      },
    });

    // Ensure enrollment row exists so the course shows up in user's list
    await req.server.prisma.courseEnrollment.upsert({
      where: { memberId_courseId: { memberId, courseId } },
      create: { memberId, courseId, progressPercentage: 0 },
      update: {},
    });

    void notifyCourseAccessGranted({
      prisma: req.server.prisma as any,
      io: req.server.io,
      memberId,
      courseId,
      courseTitle: course.title,
    }).catch(() => {});

    void invalidateCache(req.server.redis ?? null, `courses:access:${memberId}`);
    return reply.status(201).send({ success: true, data: access, error: null });
  } catch (err: any) {
    req.log.error({ err, courseId, memberId }, 'grantCourseAccessHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message ?? 'Failed to grant access' });
  }
}

export async function revokeCourseAccessHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { accessId } = req.params as any;
    const adminId = await resolveAdminId(req);
    const access = await req.server.prisma.courseAccess.update({
      where: { id: accessId },
      data: { isActive: false, revokedAt: new Date(), revokedBy: adminId },
    });
    void invalidateCache(req.server.redis ?? null, `courses:access:${access.memberId}`);
    return reply.send({ success: true, data: access, error: null });
  } catch (err: any) {
    req.log.error({ err }, 'revokeCourseAccessHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message ?? 'Failed to revoke access' });
  }
}

export async function approveCoursePaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId, paymentId } = req.params as any;

  try {
    const payment = await req.server.prisma.coursePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, courseId: true, memberId: true, status: true, amount: true },
    });
    if (!payment || payment.courseId !== courseId) {
      return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
    }
    if (payment.status !== 'pending') {
      return reply.status(409).send({ success: false, data: null, error: 'Payment is not pending' });
    }

    const adminId = await resolveAdminId(req);

    // Auto-detect method: if razorpay_payment_id is set, the payment went through
    // Razorpay even if it was originally created as manual/external.
    const [rzpRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT method, razorpay_payment_id FROM course_payments WHERE id = $1::uuid`, paymentId,
    ).catch(() => [] as any[]);
    const effectiveMethod = rzpRow?.razorpay_payment_id ? 'razorpay' : (rzpRow?.method ?? 'manual');

    await req.server.prisma.$executeRawUnsafe(
      `UPDATE course_payments SET status='completed', method=$1::\"CoursePaymentMethod\", paid_at=NOW(), granted_by=$2::uuid, updated_at=NOW() WHERE id=$3::uuid`,
      effectiveMethod, adminId, paymentId,
    );

    await req.server.prisma.courseAccess.upsert({
      where: { memberId_courseId: { memberId: payment.memberId, courseId } },
      create: { memberId: payment.memberId, courseId, accessType: 'lifetime', isActive: true, paymentId, grantedBy: adminId },
      update: { accessType: 'lifetime', isActive: true, revokedAt: null, revokedBy: null, paymentId, grantedBy: adminId },
    });

    await req.server.prisma.courseEnrollment.upsert({
      where: { memberId_courseId: { memberId: payment.memberId, courseId } },
      create: { memberId: payment.memberId, courseId, progressPercentage: 0 },
      update: {},
    });

    const course = await req.server.prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
    void notifyCourseAccessGranted({
      prisma: req.server.prisma as any,
      io: req.server.io,
      memberId: payment.memberId,
      courseId,
      courseTitle: course?.title ?? 'the course',
    }).catch(() => {});

    void invalidateCache(req.server.redis ?? null, `courses:access:${payment.memberId}`);
    return reply.send({ success: true, data: { approved: true }, error: null });
  } catch (err: any) {
    req.log.error({ err, courseId, paymentId }, 'approveCoursePaymentHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message ?? 'Failed to approve payment' });
  }
}

export async function refundCoursePaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId, paymentId } = req.params as any;

  const [payment] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, course_id, member_id, status, amount, method, razorpay_payment_id
     FROM course_payments WHERE id = $1::uuid`,
    paymentId,
  ).catch(() => [] as any[]);

  if (!payment || payment.course_id !== courseId) {
    return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
  }
  if (payment.status !== 'completed') {
    return reply.status(409).send({ success: false, data: null, error: 'Only completed payments can be refunded' });
  }

  // Attempt Razorpay refund if this was a Razorpay payment
  if (payment.method === 'razorpay' && payment.razorpay_payment_id) {
    const { getRazorpay } = await import('../../lib/razorpay.js');
    try {
      await getRazorpay().payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(Number(payment.amount) * 100),
        speed: 'normal',
        notes: { reason: 'Admin-initiated refund', courseId, paymentId },
      });
    } catch (e: any) {
      return reply.status(502).send({ success: false, data: null, error: `Razorpay refund failed: ${e?.error?.description ?? e?.message ?? 'unknown error'}` });
    }
  }

  // Mark refunded and revoke course access
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_payments SET status='refunded', updated_at=NOW() WHERE id=$1::uuid`,
    paymentId,
  );
  await (req.server.prisma as any).courseAccess.updateMany({
    where: { memberId: payment.member_id, courseId },
    data: { isActive: false, revokedAt: new Date() },
  }).catch(() => {});

  return reply.send({ success: true, data: { refunded: true }, error: null });
}

// ── COURSE ANALYTICS (admin) ──────────────────────────────────────────

export async function getCourseAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = req.params as any;

  const [totalEnrollments, completedEnrollments, totalXp, revenueRaw, episodeStats] = await Promise.all([
    req.server.prisma.courseEnrollment.count({ where: { courseId } }),
    req.server.prisma.courseEnrollment.count({ where: { courseId, completedAt: { not: null } } }),
    (req.server.prisma as any).memberXP.aggregate({ _sum: { amount: true }, where: { courseId } }),
    (req.server.prisma as any).coursePayment.aggregate({
      _sum: { amount: true },
      where: { courseId, status: 'completed' },
    }),
    req.server.prisma.courseEpisode.findMany({
      where: { courseId, isVisible: true },
      select: {
        id: true,
        title: true,
        order: true,
        _count: { select: { quizAttempts: true } },
      },
      orderBy: { order: 'asc' },
    }),
  ]);

  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  return reply.send({
    success: true,
    data: {
      totalEnrollments,
      completedEnrollments,
      completionRate,
      totalXpAwarded: (totalXp as any)._sum?.amount ?? 0,
      totalRevenue: Number((revenueRaw as any)._sum?.amount ?? 0),
      episodes: episodeStats.map((ep: any) => ({
        id: ep.id,
        title: ep.title,
        order: ep.order,
        quizAttempts: ep._count.quizAttempts,
      })),
    },
    error: null,
  });
}

// ── COURSE LEADERBOARD (admin) ────────────────────────────────────────

export async function getCourseLeaderboardAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = req.params as any;
  const { limit = 20 } = req.query as any;

  const rows = await (req.server.prisma as any).memberXP.groupBy({
    by: ['memberId'],
    _sum: { amount: true },
    where: { courseId },
    orderBy: { _sum: { amount: 'desc' } },
    take: Number(limit),
  });

  const memberIds = rows.map((r: any) => r.memberId);
  const members = await req.server.prisma.member.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const data = rows.map((r: any, i: number) => ({
    rank: i + 1,
    memberId: r.memberId,
    member: memberMap.get(r.memberId) ?? null,
    totalXp: r._sum?.amount ?? 0,
  }));

  return reply.send({ success: true, data, error: null });
}

// ── COURSE BADGES (admin) ─────────────────────────────────────────────

export async function listCourseBadgesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = req.params as any;
  const badges = await (req.server.prisma as any).courseBadge.findMany({
    where: { courseId },
    include: { _count: { select: { members: true } } },
    orderBy: { label: 'asc' },
  });
  return reply.send({ success: true, data: badges, error: null });
}

export async function createCourseBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = req.params as any;
  const { label, slug, iconUrl, criteria } = req.body as any;
  const badge = await (req.server.prisma as any).courseBadge.create({
    data: {
      courseId,
      label,
      slug: slug || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      iconUrl: iconUrl || null,
      criteria: criteria || {},
    },
  });
  return reply.status(201).send({ success: true, data: badge, error: null });
}

export async function updateCourseBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { badgeId } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['label', 'slug', 'iconUrl', 'criteria'].forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  const badge = await (req.server.prisma as any).courseBadge.update({ where: { id: badgeId }, data });
  return reply.send({ success: true, data: badge, error: null });
}

export async function deleteCourseBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { badgeId } = req.params as any;
  await (req.server.prisma as any).courseBadge.delete({ where: { id: badgeId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function awardCourseBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { badgeId } = req.params as any;
  const { memberId } = req.body as any;
  const [member, badge] = await Promise.all([
    req.server.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } }),
    (req.server.prisma as any).courseBadge.findUnique({ where: { id: badgeId }, select: { id: true, label: true } }),
  ]);
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  const award = await (req.server.prisma as any).memberCourseBadge.upsert({
    where: { memberId_badgeId: { memberId, badgeId } },
    create: { memberId, badgeId },
    update: {},
  });
  if (badge?.label) {
    void notifyBadgeAwarded({
      prisma: req.server.prisma as any,
      io: req.server.io,
      memberId,
      badgeId,
      badgeLabel: badge.label,
    }).catch(() => {});
  }
  return reply.status(201).send({ success: true, data: award, error: null });
}

// ── Per-member progression admin controls ────────────────────────────
// These endpoints let an admin manipulate a specific member's
// progression through a specific course. All are Clerk-authenticated
// via the parent module's preHandler (fastify.authenticate).
//
// The prompt calls out two operations by name — reset progress (start
// over from lesson 1) and unlock all lessons (bypass sequential gate).
// Implemented as two dedicated endpoints so audit logs / socket events
// can be added later without conflating the two semantics.

/**
 * POST /api/courses/:id/members/:memberId/reset-progress
 *
 * Wipes every CourseEpisodeProgress row for (member, course) so the
 * member restarts from lesson 1. Idempotent — running twice is a
 * no-op if progress was already reset.
 */
export async function resetMemberCourseProgressHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: courseId, memberId } = req.params as { id: string; memberId: string };

  // Verify both exist so we return 404 rather than a silent 0-rows
  // deletion that looks like success but did nothing.
  const [course, member] = await Promise.all([
    req.server.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    req.server.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } }),
  ]);
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Course not found' });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  // Fetch episode ids first so the delete predicate is scoped to this
  // course only (episodeId is unique across courses so a naive delete
  // by memberId would wipe every course's progress).
  const episodes = await req.server.prisma.courseEpisode.findMany({
    where: { courseId },
    select: { id: true },
  });
  const episodeIds = episodes.map((e) => e.id);

  const deleted = await (req.server.prisma as any).courseEpisodeProgress.deleteMany({
    where: { memberId, episodeId: { in: episodeIds } },
  });

  // Also clear the aggregate CourseEnrollment.progressPercentage so
  // the dashboard doesn't report stale "50% complete" against a reset
  // course. Non-fatal — this is a display aggregate; the truth lives
  // in CourseEpisodeProgress.
  await (req.server.prisma as any).courseEnrollment.updateMany({
    where: { memberId, courseId },
    data: { progressPercentage: 0, completedAt: null },
  }).catch(() => {});

  // Emit a user-side event so any open device flips the lesson list
  // back to "only lesson 1 unlocked" without waiting for a refresh.
  try {
    req.server.io?.to(`user:${memberId}`).emit('course:progress_reset', { courseId });
  } catch { /* non-fatal */ }

  return reply.send({
    success: true,
    data: { courseId, memberId, deletedRows: deleted.count },
    error: null,
  });
}

/**
 * POST /api/courses/:id/members/:memberId/unlock-all
 *
 * Inserts a completed=true CourseEpisodeProgress row for every episode
 * in the course, effectively giving the member "all lessons unlocked"
 * from now on regardless of the requireSequential setting. Existing
 * progress rows are updated to completed; new rows are created with
 * synthetic actualWatchedSecs so `computeLessonLockStates` also
 * reports them as unlocked/completed.
 */
export async function unlockAllLessonsForMemberHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: courseId, memberId } = req.params as { id: string; memberId: string };

  const [course, member] = await Promise.all([
    req.server.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    req.server.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } }),
  ]);
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Course not found' });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  const episodes = await req.server.prisma.courseEpisode.findMany({
    where: { courseId },
    select: { id: true, durationSeconds: true },
  });

  const now = new Date();
  // Sequential upserts (Prisma has no `createMany` with `onConflict` on
  // Postgres via the JS client — but the loop is bounded by course
  // size, and admin unlock operations aren't hot-path).
  for (const ep of episodes) {
    const dur = ep.durationSeconds ?? 0;
    await (req.server.prisma as any).courseEpisodeProgress.upsert({
      where: { memberId_episodeId: { memberId, episodeId: ep.id } },
      create: {
        memberId,
        episodeId: ep.id,
        completed: true,
        completedAt: now,
        lastWatchedSecs: dur,
        actualWatchedSecs: dur,
      },
      update: {
        completed: true,
        completedAt: now,
        // Bump actualWatchedSecs high enough that the threshold check
        // in computeLessonLockStates always evaluates true, without
        // clobbering an actual higher value from a real watch.
        actualWatchedSecs: dur > 0 ? { set: dur } : undefined,
      },
    });
  }

  try {
    req.server.io?.to(`user:${memberId}`).emit('course:lessons_unlocked', { courseId });
  } catch { /* non-fatal */ }

  return reply.send({
    success: true,
    data: { courseId, memberId, unlockedEpisodes: episodes.length },
    error: null,
  });
}

// ── Episode Resources ─────────────────────────────────────────────────────────

export async function listEpisodeResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const resources = await req.server.prisma.appResource.findMany({
    where: { courseEpisodeId: eid },
    orderBy: { order: 'asc' },
  });
  return reply.send({ success: true, data: resources, error: null });
}

export async function createEpisodeResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = (req.body ?? {}) as any;
  if (!body.title?.trim() || !body.fileUrl?.trim()) {
    return reply.status(400).send({ success: false, data: null, error: 'title and fileUrl are required' });
  }
  const episode = await req.server.prisma.courseEpisode.findUnique({ where: { id: eid }, select: { id: true } });
  if (!episode) return reply.status(404).send({ success: false, data: null, error: 'Episode not found' });
  const order = await req.server.prisma.appResource.count({ where: { courseEpisodeId: eid } })
    .catch(() => 0);
  const resource = await req.server.prisma.appResource.create({
    data: {
      title: body.title,
      author: body.author || null,
      fileUrl: body.fileUrl,
      previewUrl: body.previewUrl || null,
      fileType: body.fileType || 'pdf',
      fileTypeIconUrl: body.fileTypeIconUrl || null,
      fileCount: body.fileCount ?? 1,
      order,
      isVisible: body.isVisible ?? true,
      previewLabel: body.previewLabel || 'Preview',
      downloadLabel: body.downloadLabel || 'Download',
      description: body.description || null,
      courseEpisodeId: eid,
    },
  });
  return reply.status(201).send({ success: true, data: resource, error: null });
}

export async function updateEpisodeResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { rid } = req.params as any;
  const body = (req.body ?? {}) as any;
  const data: any = {};
  ['title', 'author', 'fileUrl', 'previewUrl', 'fileType', 'fileTypeIconUrl', 'fileCount',
    'isVisible', 'previewLabel', 'downloadLabel', 'description'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  const resource = await req.server.prisma.appResource.update({ where: { id: rid }, data });
  return reply.send({ success: true, data: resource, error: null });
}

export async function deleteEpisodeResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { rid } = req.params as any;
  await req.server.prisma.appResource.delete({ where: { id: rid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderEpisodeResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const ids: string[] = body.ids ?? [];
  await Promise.all(ids.map((id, i) =>
    req.server.prisma.appResource.update({ where: { id }, data: { order: i } })
  ));
  return reply.send({ success: true, data: null, error: null });
}

// ── Episode Tasks ─────────────────────────────────────────────────────────────

const COMPLETION_MODES = ['SELF_ASSESSMENT', 'ADMIN_CHECK'] as const;
type CompletionMode = (typeof COMPLETION_MODES)[number];
function normalizeCompletionMode(v: unknown): CompletionMode | undefined {
  return typeof v === 'string' && (COMPLETION_MODES as readonly string[]).includes(v) ? (v as CompletionMode) : undefined;
}

export async function listEpisodeTasksHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const rawRows = await req.server.prisma.$queryRawUnsafe<{ id: string; timer_seconds: number | null; completion_mode: string }[]>(
    `SELECT id, timer_seconds, completion_mode FROM tasks WHERE course_episode_id = $1::uuid ORDER BY sort_order ASC`,
    eid
  ).catch(() => []);
  if (!rawRows.length) return reply.send({ success: true, data: [], error: null });
  const tasks = await req.server.prisma.task.findMany({
    where: { id: { in: rawRows.map((r) => r.id) } },
    orderBy: { sortOrder: 'asc' },
  });
  const rawMap = new Map(rawRows.map((r) => [r.id, r]));
  return reply.send({
    success: true,
    data: tasks.map((t) => ({
      ...t,
      timerSeconds: rawMap.get(t.id)?.timer_seconds ?? null,
      completionMode: rawMap.get(t.id)?.completion_mode ?? 'ADMIN_CHECK',
    })),
    error: null,
  });
}

export async function createEpisodeTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = req.body as any;
  const countRows = await req.server.prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM tasks WHERE course_episode_id = $1::uuid`, eid
  ).catch(() => [{ count: '0' }]);
  const sortOrder = parseInt(countRows[0]?.count ?? '0');
  const task = await req.server.prisma.task.create({
    data: {
      dayNumber: 1,
      title: body.title,
      description: body.description ?? null,
      deliverables: body.deliverables ?? null,
      contentUrl: body.contentUrl ?? null,
      basePoints: body.basePoints ?? 100,
      bonusPoints: body.bonusPoints ?? 0,
      proofType: body.proofType ?? 'text',
      estimatedMinutes: body.estimatedMinutes ?? 15,
      isRequired: body.isRequired ?? true,
      isMilestone: body.isMilestone ?? false,
      milestoneLabel: body.milestoneLabel ?? null,
      sortOrder,
    },
  });
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE tasks SET course_episode_id = $1::uuid WHERE id = $2::uuid`, eid, task.id
  );
  const timerSecs = body.timerSeconds != null ? Number(body.timerSeconds) : null;
  if (timerSecs !== null) {
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE tasks SET timer_seconds = $1 WHERE id = $2::uuid`, timerSecs, task.id
    );
  }
  const completionMode = normalizeCompletionMode(body.completionMode) ?? 'ADMIN_CHECK';
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE tasks SET completion_mode = $1 WHERE id = $2::uuid`, completionMode, task.id
  );
  bustHome(req);
  return reply.status(201).send({ success: true, data: { ...task, timerSeconds: timerSecs, completionMode, courseEpisodeId: eid }, error: null });
}

export async function updateEpisodeTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['title', 'description', 'deliverables', 'contentUrl', 'basePoints', 'bonusPoints',
    'proofType', 'estimatedMinutes', 'isRequired', 'isActive', 'isMilestone', 'milestoneLabel'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  const task = await req.server.prisma.task.update({ where: { id: tid }, data });
  const timerSecs = 'timerSeconds' in body ? (body.timerSeconds != null ? Number(body.timerSeconds) : null) : undefined;
  if (timerSecs !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE tasks SET timer_seconds = $1 WHERE id = $2::uuid`, timerSecs, tid
    );
  }
  const completionMode = normalizeCompletionMode(body.completionMode);
  if (completionMode !== undefined) {
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE tasks SET completion_mode = $1 WHERE id = $2::uuid`, completionMode, tid
    );
  }
  bustHome(req);
  return reply.send({ success: true, data: { ...task, timerSeconds: timerSecs ?? null, completionMode: completionMode ?? undefined }, error: null });
}

export async function deleteEpisodeTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  await req.server.prisma.task.delete({ where: { id: tid } });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderEpisodeTasksHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const ids: string[] = body.ids ?? [];
  await Promise.all(ids.map((id, i) =>
    req.server.prisma.task.update({ where: { id }, data: { sortOrder: i } })
  ));
  return reply.send({ success: true, data: null, error: null });
}

export async function listEpisodeTaskSubmissionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  const submissions = await req.server.prisma.taskSubmission.findMany({
    where: { taskId: tid },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return reply.send({ success: true, data: submissions, error: null });
}

export async function reviewEpisodeTaskSubmissionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { sid } = req.params as any;
  const body = req.body as { status: 'approved' | 'rejected'; feedback?: string };
  if (body.status !== 'approved' && body.status !== 'rejected') {
    return reply.status(400).send({ success: false, data: null, error: 'status must be approved or rejected' });
  }
  const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user } });

  const existing = await req.server.prisma.taskSubmission.findUnique({
    where: { id: sid },
    include: { task: { select: { basePoints: true, bonusPoints: true, isMilestone: true, milestoneLabel: true } } },
  });
  if (!existing) return reply.status(404).send({ success: false, data: null, error: 'Submission not found' });
  const alreadyApproved = existing.status === 'approved';

  // Deep-link the member-facing notification straight back to the lesson
  // this task belongs to, instead of the generic course catalog. tasks.
  // course_episode_id is a raw-SQL column (not in the Prisma Task model —
  // see CLAUDE.md), so this needs its own query. Falls back to the
  // catalog page if the task/episode lookup ever comes back empty (e.g. a
  // batch/program task with no course_episode_id, or the episode was
  // since deleted).
  let taskActionUrl = '/learning';
  const [taskEpisodeRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT course_episode_id AS "courseEpisodeId" FROM tasks WHERE id = $1::uuid`,
    existing.taskId,
  );
  if (taskEpisodeRow?.courseEpisodeId) {
    const episode = await req.server.prisma.courseEpisode.findUnique({
      where: { id: taskEpisodeRow.courseEpisodeId },
      select: { courseId: true },
    });
    if (episode) {
      taskActionUrl = `/learning/${episode.courseId}?lesson=${taskEpisodeRow.courseEpisodeId}`;
    }
  }

  const updated = await req.server.prisma.taskSubmission.update({
    where: { id: sid },
    data: {
      status: body.status,
      feedback: body.feedback ?? null,
      reviewedBy: admin?.id ?? null,
      reviewedAt: new Date(),
    },
  });

  if (body.status === 'approved' && !alreadyApproved) {
    const task = (existing as any).task;
    // approve → reject → approve passes the status check again; the ledger is
    // the record of what was paid, so never pay base/milestone points twice.
    const [basePaid, milestonePaid] = await Promise.all([
      req.server.prisma.pointsLedger.findFirst({
        where: { memberId: existing.memberId, referenceType: 'task_submission', referenceId: sid },
        select: { id: true },
      }),
      req.server.prisma.pointsLedger.findFirst({
        where: { memberId: existing.memberId, referenceType: 'milestone', referenceId: existing.taskId },
        select: { id: true },
      }),
    ]);
    if (task?.basePoints > 0 && !basePaid) {
      await req.server.prisma.pointsLedger.create({
        data: {
          memberId: existing.memberId,
          points: task.basePoints,
          reason: 'Task approved',
          referenceType: 'task_submission',
          referenceId: sid,
        },
      }).catch(() => {});
    }
    if (task?.isMilestone && task.bonusPoints > 0 && !milestonePaid) {
      await req.server.prisma.pointsLedger.create({
        data: {
          memberId: existing.memberId,
          points: task.bonusPoints,
          reason: task.milestoneLabel ? `Milestone: ${task.milestoneLabel}` : 'Milestone bonus',
          referenceType: 'milestone',
          referenceId: existing.taskId,
        },
      }).catch(() => {});
    }
    void notifyMembers(req.server, {
      memberIds: [existing.memberId],
      title: 'Task Approved ✓',
      body: 'Your task submission has been approved.',
      type: 'task_approved',
      actionUrl: taskActionUrl,
    });
  } else if (body.status === 'rejected') {
    void notifyMembers(req.server, {
      memberIds: [existing.memberId],
      title: 'Task Needs Revision',
      body: body.feedback ?? 'Your task submission needs revision.',
      type: 'task_rejected',
      actionUrl: taskActionUrl,
    });
  }

  return reply.send({ success: true, data: updated, error: null });
}

// ── COURSE MODULES ────────────────────────────────────────────────────

function mapModule(m: any, episodeIds: string[]): any {
  return {
    id: m.id, courseId: m.course_id, title: m.title,
    description: m.description ?? null, sortOrder: Number(m.sort_order),
    thumbnailUrl: m.thumbnail_url ?? null,
    createdAt: m.created_at, episodeIds,
  };
}

export async function listCourseModulesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const [modules, junction] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, course_id, title, description, sort_order, thumbnail_url, created_at
       FROM course_modules WHERE course_id = $1::uuid ORDER BY sort_order ASC`,
      id,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT cem.module_id, cem.episode_id FROM course_episode_modules cem
       JOIN course_modules cm ON cm.id = cem.module_id WHERE cm.course_id = $1::uuid`,
      id,
    ),
  ]);
  const byModule = new Map<string, string[]>();
  for (const r of junction) {
    if (!byModule.has(r.module_id)) byModule.set(r.module_id, []);
    byModule.get(r.module_id)!.push(r.episode_id);
  }
  return reply.send({ success: true, data: modules.map(m => mapModule(m, byModule.get(m.id) ?? [])) });
}

export async function createCourseModuleHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { title, description, thumbnailUrl } = req.body as any;
  if (!title?.trim()) return reply.status(400).send({ success: false, error: 'title is required' });
  const [countRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS cnt FROM course_modules WHERE course_id = $1::uuid`, id,
  );
  const sortOrder = Number(countRow?.cnt ?? 0);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO course_modules (course_id, title, description, sort_order, thumbnail_url)
     VALUES ($1::uuid, $2, $3, $4, $5) RETURNING *`,
    id, title.trim(), description?.trim() ?? null, sortOrder, thumbnailUrl ?? null,
  );
  bustHome(req);
  return reply.status(201).send({ success: true, data: mapModule(row, []) });
}

export async function updateCourseModuleHandler(req: FastifyRequest, reply: FastifyReply) {
  const { moduleId } = req.params as any;
  const { title, description, thumbnailUrl, episodeIds } = req.body as any;
  const sets: string[] = []; const vals: any[] = []; let idx = 1;
  if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title.trim()); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description?.trim() ?? null); }
  if (thumbnailUrl !== undefined) { sets.push(`thumbnail_url = $${idx++}`); vals.push(thumbnailUrl ?? null); }
  if (sets.length) {
    vals.push(moduleId);
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE course_modules SET ${sets.join(', ')} WHERE id = $${idx}::uuid`, ...vals,
    );
  }
  if (Array.isArray(episodeIds)) {
    await req.server.prisma.$executeRawUnsafe(
      `DELETE FROM course_episode_modules WHERE module_id = $1::uuid`, moduleId,
    );
    if (episodeIds.length > 0) {
      const ph = episodeIds.map((_: any, i: number) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::uuid)`).join(', ');
      const params: any[] = [];
      for (const eid of episodeIds) { params.push(eid, moduleId); }
      await req.server.prisma.$executeRawUnsafe(
        `INSERT INTO course_episode_modules (episode_id, module_id) VALUES ${ph} ON CONFLICT DO NOTHING`,
        ...params,
      );
    }
  }
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM course_modules WHERE id = $1::uuid`, moduleId,
  );
  if (!row) return reply.status(404).send({ success: false, error: 'Module not found' });
  const epRows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT episode_id FROM course_episode_modules WHERE module_id = $1::uuid`, moduleId,
  );
  bustHome(req);
  return reply.send({ success: true, data: mapModule(row, epRows.map((r: any) => r.episode_id)) });
}

export async function deleteCourseModuleHandler(req: FastifyRequest, reply: FastifyReply) {
  const { moduleId } = req.params as any;
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM course_modules WHERE id = $1::uuid`, moduleId,
  );
  bustHome(req);
  return reply.send({ success: true });
}

export async function reorderCourseModulesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  if (!Array.isArray(ids)) return reply.status(400).send({ success: false, error: 'ids must be an array' });
  await Promise.all(
    ids.map((id: string, i: number) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE course_modules SET sort_order = $1 WHERE id = $2::uuid`, i, id,
      ),
    ),
  );
  bustHome(req);
  return reply.send({ success: true });
}

// ── Course Page FAQs ──────────────────────────────────────────────────
// Global FAQs shown on the /courses catalog page. Admin CRUD only;
// public read via GET /api/pub/course-faqs.

function mapFaq(r: any) {
  return {
    id: r.id,
    question: r.question,
    answerType: r.answer_type,
    answerText: r.answer_text ?? null,
    answerVideoUrl: r.answer_video_url ?? null,
    sortOrder: Number(r.sort_order),
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listCourseFaqsAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM course_page_faqs ORDER BY sort_order ASC, created_at ASC`,
  );
  return reply.send({ success: true, data: rows.map(mapFaq) });
}

export async function createCourseFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const { question, answerType = 'text', answerText, answerVideoUrl, isActive = true } = req.body as any;
  if (!question?.trim()) return reply.status(400).send({ success: false, error: 'question is required' });
  if (!['text', 'video'].includes(answerType)) return reply.status(400).send({ success: false, error: 'answerType must be text or video' });
  const [countRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS cnt FROM course_page_faqs`,
  );
  const sortOrder = Number(countRow?.cnt ?? 0);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO course_page_faqs (question, answer_type, answer_text, answer_video_url, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    question.trim(), answerType, answerText ?? null, answerVideoUrl ?? null, sortOrder, isActive,
  );
  return reply.status(201).send({ success: true, data: mapFaq(row) });
}

export async function updateCourseFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const { faqId } = req.params as any;
  const { question, answerType, answerText, answerVideoUrl, isActive } = req.body as any;
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (question !== undefined)       { sets.push(`question = $${idx++}`);          params.push(question); }
  if (answerType !== undefined)      { sets.push(`answer_type = $${idx++}`);       params.push(answerType); }
  if (answerText !== undefined)      { sets.push(`answer_text = $${idx++}`);       params.push(answerText); }
  if (answerVideoUrl !== undefined)  { sets.push(`answer_video_url = $${idx++}`);  params.push(answerVideoUrl); }
  if (isActive !== undefined)        { sets.push(`is_active = $${idx++}`);         params.push(isActive); }
  if (sets.length === 0) return reply.status(400).send({ success: false, error: 'Nothing to update' });
  sets.push(`updated_at = NOW()`);
  params.push(faqId);
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE course_page_faqs SET ${sets.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    ...params,
  );
  if (!row) return reply.status(404).send({ success: false, error: 'FAQ not found' });
  return reply.send({ success: true, data: mapFaq(row) });
}

export async function deleteCourseFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const { faqId } = req.params as any;
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM course_page_faqs WHERE id = $1::uuid`, faqId,
  );
  return reply.send({ success: true });
}

export async function reorderCourseFaqsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  if (!Array.isArray(ids)) return reply.status(400).send({ success: false, error: 'ids must be an array' });
  await Promise.all(
    ids.map((id: string, i: number) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE course_page_faqs SET sort_order = $1 WHERE id = $2::uuid`, i, id,
      ),
    ),
  );
  return reply.send({ success: true });
}
