import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  notifyCourseAccessGranted,
  notifyBadgeAwarded,
} from '../../lib/courseNotifications.js';
import { invalidateCache } from '../../lib/cache.js';

// Any course/episode edit can change what the home sections render
// (thumbnail, title, episode count, visibility). Busting home:* is
// cheap — a handful of keys — and cheaper than serving stale hero /
// section data for up to 5 min.
function bustHome(req: FastifyRequest): void {
  void invalidateCache(req.server.redis ?? null, 'home:*');
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
  return reply.send({ success: true, data: courses, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
      price: body.price != null ? body.price : null,
      accessDurationDays: body.accessDurationDays ?? null,
      maxEnrollments: body.maxEnrollments ?? null,
      xpPerEpisode: body.xpPerEpisode ?? 10,
      passingScorePercent: body.passingScorePercent ?? 70,
      paymentLinkUrl: body.paymentLinkUrl ?? null,
      requireSequential: body.requireSequential ?? true,
      completionThresholdPercent: body.completionThresholdPercent ?? 95,
    },
  });
  bustHome(req);
  return reply.status(201).send({ success: true, data: course, error: null });
}

export async function getCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const course = await req.server.prisma.course.findUnique({
    where: { id },
    include: { courseEpisodes: { orderBy: { order: 'asc' } } },
  });
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Not found' });
  return reply.send({ success: true, data: course, error: null });
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
    // Sequential-unlock feature (2026-07-16) — admin can toggle the
    // gate off for a specific course (e.g. a free preview course
    // where any lesson should be watchable) and tune the completion
    // threshold (a shorter promo course might use 80%; a strict
    // certification course might use 100%).
    'requireSequential', 'completionThresholdPercent',
  ].forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  // Clamp threshold to a sane range so an admin can't set it to 0
  // (auto-completes on open) or > 100 (unreachable → nothing ever
  // unlocks).
  if (typeof data.completionThresholdPercent === 'number') {
    data.completionThresholdPercent = Math.min(100, Math.max(50, Math.round(data.completionThresholdPercent)));
  }
  if (body.order !== undefined) data.sortOrder = body.order;
  const course = await req.server.prisma.course.update({ where: { id }, data });
  bustHome(req);
  return reply.send({ success: true, data: course, error: null });
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
  bustHome(req);
  return reply.send({ success: true });
}

// ── COURSE EPISODES ───────────────────────────────────────────────────

export async function listCourseEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT e.*, e.section_id, e.timer_seconds,
       s.title AS section_title, s.sort_order AS section_sort_order
     FROM course_episodes e
     LEFT JOIN course_sections s ON s.id = e.section_id
     WHERE e.course_id = $1::uuid
     ORDER BY e."order" ASC`,
    id,
  );
  const episodes = rows.map(e => ({
    id: e.id, courseId: e.course_id, title: e.title,
    thumbnailUrl: e.thumbnail_url, videoUrl: e.video_url,
    bunnyVideoId: e.bunny_video_id, durationSeconds: Number(e.duration_seconds ?? 0),
    order: Number(e.order ?? 0), isVisible: e.is_visible,
    quizData: e.quiz_data, quizUnlockPercent: Number(e.quiz_unlock_percent ?? 80),
    drmEnabled: e.drm_enabled, bunnyDrmToken: e.bunny_drm_token,
    timerSeconds: e.timer_seconds != null ? Number(e.timer_seconds) : null,
    sectionId: e.section_id ?? null, sectionTitle: e.section_title ?? null,
    sectionSortOrder: e.section_sort_order != null ? Number(e.section_sort_order) : null,
    createdAt: e.created_at, updatedAt: e.updated_at,
  }));
  return reply.send({ success: true, data: episodes, error: null });
}

export async function createCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
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
  const sectionId = body.sectionId || null;
  await Promise.all([
    timerSecs !== null ? req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET timer_seconds = $1 WHERE id = $2::uuid', timerSecs, episode.id
    ) : Promise.resolve(),
    sectionId ? req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET section_id = $1::uuid WHERE id = $2::uuid', sectionId, episode.id
    ) : Promise.resolve(),
  ]);
  bustHome(req);
  return reply.status(201).send({ success: true, data: { ...episode, timerSeconds: timerSecs, sectionId }, error: null });
}

export async function updateCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['title', 'description', 'thumbnailUrl', 'videoUrl', 'bunnyVideoId', 'isVisible', 'quizData', 'bunnyDrmToken'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.durationSeconds !== undefined) data.durationSeconds = Number(body.durationSeconds) || 0;
  if (body.order !== undefined) data.order = body.order;
  if (body.quizUnlockPercent !== undefined) data.quizUnlockPercent = Number(body.quizUnlockPercent);
  if (body.drmEnabled !== undefined) data.drmEnabled = Boolean(body.drmEnabled);
  const timerSecs = 'timerSeconds' in body ? (body.timerSeconds != null ? Number(body.timerSeconds) : null) : undefined;
  const sectionId = 'sectionId' in body ? (body.sectionId || null) : undefined;
  const episode = await req.server.prisma.courseEpisode.update({ where: { id: eid }, data });
  const rawUpdates: Promise<any>[] = [];
  if (timerSecs !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET timer_seconds = $1 WHERE id = $2::uuid', timerSecs, episode.id
    ));
  }
  if (sectionId !== undefined) {
    rawUpdates.push(req.server.prisma.$executeRawUnsafe(
      'UPDATE course_episodes SET section_id = $1 WHERE id = $2::uuid', sectionId, episode.id
    ));
  }
  if (rawUpdates.length) await Promise.all(rawUpdates);
  bustHome(req);
  return reply.send({ success: true, data: { ...episode, timerSeconds: timerSecs ?? null, sectionId: sectionId ?? null }, error: null });
}

export async function deleteCourseEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  await req.server.prisma.courseEpisode.delete({ where: { id: eid } });
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderCourseEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.courseEpisode.update({ where: { id }, data: { order: i } })
    )
  );
  bustHome(req);
  return reply.send({ success: true, data: null, error: null });
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
  const { page = 1, limit = 20, courseId, status } = req.query as any;
  const where: any = {};
  if (courseId) where.courseId = courseId;
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
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
  ]);

  return reply.send({ success: true, data: payments, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
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

  const course = await req.server.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) return reply.status(404).send({ success: false, data: null, error: 'Course not found' });

  let paymentId: string | undefined;

  if (amount && Number(amount) > 0) {
    const payment = await (req.server.prisma as any).coursePayment.create({
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
        grantedBy: (req as any).adminId ?? null,
      },
    });
    paymentId = payment.id;
  }

  const access = await (req.server.prisma as any).courseAccess.upsert({
    where: { memberId_courseId: { memberId, courseId } },
    create: {
      memberId,
      courseId,
      accessType,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      paymentId: paymentId ?? null,
    },
    update: {
      accessType,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      revokedAt: null,
      revokedBy: null,
      paymentId: paymentId ?? undefined,
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

  return reply.status(201).send({ success: true, data: access, error: null });
}

export async function revokeCourseAccessHandler(req: FastifyRequest, reply: FastifyReply) {
  const { accessId } = req.params as any;
  const access = await (req.server.prisma as any).courseAccess.update({
    where: { id: accessId },
    data: { isActive: false, revokedAt: new Date(), revokedBy: (req as any).adminId ?? null },
  });
  return reply.send({ success: true, data: access, error: null });
}

export async function approveCoursePaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: courseId, paymentId } = req.params as any;

  const payment = await (req.server.prisma as any).coursePayment.findUnique({
    where: { id: paymentId },
    select: { id: true, courseId: true, memberId: true, status: true, amount: true },
  });
  if (!payment || payment.courseId !== courseId) {
    return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
  }
  if (payment.status !== 'pending') {
    return reply.status(409).send({ success: false, data: null, error: 'Payment is not pending' });
  }

  await (req.server.prisma as any).coursePayment.update({
    where: { id: paymentId },
    data: { status: 'completed', paidAt: new Date(), grantedBy: (req as any).adminId ?? null },
  });

  await (req.server.prisma as any).courseAccess.upsert({
    where: { memberId_courseId: { memberId: payment.memberId, courseId } },
    create: { memberId: payment.memberId, courseId, accessType: 'lifetime', isActive: true, paymentId },
    update: { accessType: 'lifetime', isActive: true, revokedAt: null, revokedBy: null, paymentId },
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

  return reply.send({ success: true, data: { approved: true }, error: null });
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
  const ids = await req.server.prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM app_resources WHERE course_episode_id = $1::uuid ORDER BY "order" ASC`,
    eid
  ).catch(() => []);
  if (!ids.length) return reply.send({ success: true, data: [], error: null });
  const resources = await req.server.prisma.appResource.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    orderBy: { order: 'asc' },
  });
  return reply.send({ success: true, data: resources, error: null });
}

export async function createEpisodeResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = req.body as any;
  const countRows = await req.server.prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM app_resources WHERE course_episode_id = $1::uuid`, eid
  ).catch(() => [{ count: '0' }]);
  const order = parseInt(countRows[0]?.count ?? '0');
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
    },
  });
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE app_resources SET course_episode_id = $1::uuid WHERE id = $2::uuid`, eid, resource.id
  );
  return reply.status(201).send({ success: true, data: { ...resource, courseEpisodeId: eid }, error: null });
}

export async function updateEpisodeResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { rid } = req.params as any;
  const body = req.body as any;
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

export async function listEpisodeTasksHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const rawRows = await req.server.prisma.$queryRawUnsafe<{ id: string; timer_seconds: number | null }[]>(
    `SELECT id, timer_seconds FROM tasks WHERE course_episode_id = $1::uuid ORDER BY sort_order ASC`,
    eid
  ).catch(() => []);
  if (!rawRows.length) return reply.send({ success: true, data: [], error: null });
  const tasks = await req.server.prisma.task.findMany({
    where: { id: { in: rawRows.map((r) => r.id) } },
    orderBy: { sortOrder: 'asc' },
  });
  const timerMap = Object.fromEntries(rawRows.map((r) => [r.id, r.timer_seconds]));
  return reply.send({
    success: true,
    data: tasks.map((t) => ({ ...t, timerSeconds: timerMap[t.id] ?? null })),
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
  return reply.status(201).send({ success: true, data: { ...task, timerSeconds: timerSecs, courseEpisodeId: eid }, error: null });
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
  return reply.send({ success: true, data: { ...task, timerSeconds: timerSecs ?? null }, error: null });
}

export async function deleteEpisodeTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  await req.server.prisma.task.delete({ where: { id: tid } });
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
  const body = req.body as any;
  const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user } });
  const updated = await req.server.prisma.taskSubmission.update({
    where: { id: sid },
    data: {
      status: body.status as any,
      feedback: body.feedback ?? null,
      reviewedBy: admin?.id ?? null,
      reviewedAt: new Date(),
    },
  });
  return reply.send({ success: true, data: updated, error: null });
}
