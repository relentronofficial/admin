import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ok(reply: FastifyReply, data: unknown, meta?: object) {
  return reply.send({ success: true, data, error: null, ...(meta && { meta }) });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

async function logActivity(prisma: any, memberId: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
  await prisma.activityLog.create({
    data: { userId: memberId, userType: 'member', action, metadata: metadata ?? null },
  }).catch(() => {});
}

async function recalculateMemberStats(prisma: any, memberId: string): Promise<void> {
  try {
    const [completedEpisodes, completedChallenges, submittedAssignments, totalEpisodes, member] = await Promise.all([
      prisma.memberEpisodeProgress.count({ where: { memberId, isCompleted: true } }),
      prisma.memberChallengeProgress.count({ where: { memberId, status: 'completed' } }),
      prisma.assignmentSubmission.count({ where: { memberId } }),
      prisma.memberEpisodeProgress.count({ where: { memberId } }),
      prisma.member.findUnique({ where: { id: memberId }, select: { currentStreak: true, lastActiveAt: true } }),
    ]);

    const totalPoints = completedEpisodes * 10 + completedChallenges * 25 + submittedAssignments * 15;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActive = member?.lastActiveAt ? new Date((member.lastActiveAt as Date).getTime()) : null;
    const lastActiveDay = lastActive ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()) : null;

    let currentStreak = member?.currentStreak ?? 0;
    if (!lastActiveDay) {
      currentStreak = 1;
    } else {
      const daysDiff = Math.floor((today.getTime() - lastActiveDay.getTime()) / 86_400_000);
      if (daysDiff === 0) { /* same day — no change */ }
      else if (daysDiff === 1) { currentStreak = currentStreak + 1; }
      else { currentStreak = 1; }
    }

    const daysSinceActive = lastActiveDay ? Math.floor((today.getTime() - lastActiveDay.getTime()) / 86_400_000) : 999;
    const recencyScore = daysSinceActive === 0 ? 40 : daysSinceActive <= 1 ? 35 : daysSinceActive <= 3 ? 25 : daysSinceActive <= 7 ? 15 : daysSinceActive <= 30 ? 5 : 0;
    const completionScore = totalEpisodes > 0 ? Math.round((completedEpisodes / totalEpisodes) * 40) : 0;
    const streakScore = Math.min(20, currentStreak);
    const healthScore = recencyScore + completionScore + streakScore;

    await prisma.member.update({
      where: { id: memberId },
      data: { totalPoints, currentStreak, healthScore, lastActiveAt: now },
    });
  } catch { /* fire-and-forget */ }
}

function parseUserAgent(ua: string | undefined | null): {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
} {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', deviceType: 'desktop' };

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) deviceType = 'tablet';
  else if (/mobile|iphone|ipod|android|blackberry|windows phone/i.test(ua)) deviceType = 'mobile';

  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  return { browser, os, deviceType };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const [member, allTiers, uiStrings] = await Promise.all([
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dob: true,
        profilePhotoUrl: true,
        avatarGradient: true,
        currentTier: true,
        membershipPlan: true,
        city: true,
        state: true,
        businessName: true,
        totalPoints: true,
        currentStreak: true,
        healthScore: true,
        notificationPrefs: true,
        displayBadges: {
          select: {
            badge: { select: { id: true, label: true, color: true, bgColor: true } },
          },
        },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { endsAt: 'desc' },
          take: 1,
          select: { status: true, startsAt: true, endsAt: true },
        },
      },
    }),
    request.server.prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { tierNumber: 'asc' },
      select: { tierNumber: true, label: true, unlockConditionText: true },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!member) return fail(reply, 404, 'Member not found');

  const activeSub = member.subscriptions[0] ?? null;
  const memberTier = member.currentTier ?? 1;

  const tiers = allTiers.map((t) => ({
    tierNumber: t.tierNumber,
    label: t.label,
    status: t.tierNumber <= memberTier ? 'unlocked' : 'locked',
    unlockConditionText: t.tierNumber <= memberTier ? null : (t.unlockConditionText ?? null),
  }));

  const personalLabel = uiStrings?.profilePersonalLabel ?? 'Personal Details';
  const subscriptionLabel = uiStrings?.profileSubscriptionLabel ?? 'Subscription';
  const tiersLabel = uiStrings?.profileTiersLabel ?? 'Tier Access';

  const sections = [
    {
      id: 'personal',
      label: personalLabel,
      fields: ['firstName', 'lastName', 'email', 'phone', 'dob', 'city', 'state', 'businessName'],
      fieldLabels: {
        firstName: uiStrings?.profileFirstNameLabel ?? 'First Name',
        lastName: uiStrings?.profileLastNameLabel ?? 'Last Name',
        email: uiStrings?.profileEmailLabel ?? 'Email',
        phone: uiStrings?.profilePhoneLabel ?? 'Phone',
        dob: uiStrings?.profileDobLabel ?? 'Date of Birth',
        city: 'City',
        state: 'State',
        businessName: 'Business Name',
      },
    },
    {
      id: 'subscription',
      label: subscriptionLabel,
      fields: ['startDate', 'endDate'],
      fieldLabels: {
        startDate: uiStrings?.profileSubStartLabel ?? 'Start Date',
        endDate: uiStrings?.profileSubEndLabel ?? 'End Date',
      },
    },
    { id: 'tiers', label: tiersLabel, fields: [] as string[], fieldLabels: {} },
  ];

  // Fire-and-forget: update device session + detect multiple concurrent devices
  const sessionDeviceId = request.headers['x-device-id'] as string | undefined;
  if (sessionDeviceId) {
    const prisma = request.server.prisma;
    const mId = request.memberId!;
    const ip = request.ip;
    const ua = request.headers['user-agent'] as string | undefined;
    void (async () => {
      const existing = await prisma.memberSession.findFirst({ where: { memberId: mId, deviceId: sessionDeviceId }, select: { id: true } }).catch(() => null);
      if (existing) {
        await prisma.memberSession.update({ where: { id: existing.id }, data: { lastActiveAt: new Date(), ipAddress: ip, userAgent: ua } }).catch(() => {});
      } else {
        await (prisma.memberSession.create as any)({ data: { memberId: mId, deviceId: sessionDeviceId, ipAddress: ip, userAgent: ua } }).catch(() => {});
      }
      // Check for >2 concurrent devices in the last hour; log once per hour to avoid flooding
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentSessions, recentLog] = await Promise.all([
        prisma.memberSession.findMany({ where: { memberId: mId, lastActiveAt: { gt: oneHourAgo } }, select: { deviceId: true } }),
        prisma.securityLog.findFirst({ where: { memberId: mId, eventType: 'MULTIPLE_DEVICES', createdAt: { gt: oneHourAgo } }, select: { id: true } }),
      ]).catch(() => [[], null] as any);
      const uniqueDevices = new Set((recentSessions as any[]).map((s: any) => s.deviceId).filter(Boolean));
      if (!recentLog && uniqueDevices.size > 2) {
        await (prisma.securityLog.create as any)({
          data: { memberId: mId, eventType: 'MULTIPLE_DEVICES', metadata: { deviceCount: uniqueDevices.size, devices: Array.from(uniqueDevices), ipAddress: ip } },
        }).catch(() => {});
      }
    })().catch(() => {});
  }

  return ok(reply, {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName ?? null,
    email: member.email,
    phone: member.phone,
    dob: member.dob ? member.dob.toISOString().split('T')[0] : null,
    avatarUrl: member.profilePhotoUrl ?? null,
    avatarGradient: member.avatarGradient ?? null,
    currentTier: memberTier,
    membershipPlan: member.membershipPlan,
    city: member.city ?? null,
    state: member.state ?? null,
    businessName: member.businessName ?? null,
    totalPoints: member.totalPoints,
    currentStreak: member.currentStreak,
    healthScore: member.healthScore,
    notificationPrefs: (member.notificationPrefs as any) ?? { email: true, push: true, sms: true },
    badges: member.displayBadges.map((db) => db.badge),
    subscription: activeSub
      ? {
          startDate: activeSub.startsAt.toISOString().split('T')[0],
          endDate: activeSub.endsAt.toISOString().split('T')[0],
          status: activeSub.status,
        }
      : null,
    tiers,
    sections,
    saveLabel: uiStrings?.profileSaveLabel ?? 'Save Changes',
    signOutLabel: uiStrings?.profileSignOutLabel ?? 'Sign Out',
  });
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { firstName, lastName, phone, dob, city, state, businessName } = request.body as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dob?: string | null;
    city?: string | null;
    state?: string | null;
    businessName?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (firstName?.trim()) data.firstName = firstName.trim();
  if (lastName !== undefined) data.lastName = lastName?.trim() || null;
  if (phone?.trim()) data.phone = phone.trim();
  if (dob !== undefined) data.dob = dob ? new Date(dob) : null;
  if (city !== undefined) data.city = city?.trim() || null;
  if (state !== undefined) data.state = state?.trim() || null;
  if (businessName !== undefined) data.businessName = businessName?.trim() || null;

  if (Object.keys(data).length === 0) return fail(reply, 400, 'No fields to update');

  const member = await request.server.prisma.member.update({
    where: { id: request.memberId },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dob: true,
      profilePhotoUrl: true,
      avatarGradient: true,
    },
  });

  return ok(reply, {
    ...member,
    dob: member.dob ? member.dob.toISOString().split('T')[0] : null,
    avatarUrl: member.profilePhotoUrl ?? null,
  });
}

// ─── Courses (user-facing, published only) ────────────────────────────────────

export async function listUserCoursesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, search, level } = request.query as {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
  };

  const where: Record<string, unknown> = { isPublished: true };
  if (level) where.level = level;
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [courses, total] = await Promise.all([
    (request.server.prisma.course.findMany as any)({
      where: where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        level: true,
        durationHours: true,
        totalLessons: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        creator: {
          select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }) as Promise<any[]>,
    request.server.prisma.course.count({ where: where as any }),
  ]);

  const data = (courses as any[]).map((c: any) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    thumbnailUrl: c.thumbnailUrl,
    level: c.level,
    durationHours: c.durationHours ? Number(c.durationHours) : null,
    isPublished: c.isPublished,
    isFeatured: c.isFeatured,
    createdAt: c.createdAt,
    instructor: c.creator ?? null,
    _count: { lessons: c.totalLessons, enrollments: c._count?.enrollments ?? 0 },
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
      },
      courseEpisodes: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
        include: {
          progress: {
            where: { memberId: request.memberId },
            select: { lastWatchedSecs: true, actualWatchedSecs: true, completed: true }
          }
        }
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) return fail(reply, 404, 'Course not found');

  const lessons = course.courseEpisodes.map((ep) => {
    const prog = ep.progress?.[0];
    return {
      id: ep.id,
      title: ep.title,
      description: null as string | null,
      videoUrl: ep.videoUrl,
      duration: ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null,
      durationSeconds: ep.durationSeconds ?? null,
      order: ep.order,
      isFree: false,
      resumeAtSeconds: prog?.lastWatchedSecs ?? 0,
      actualWatchedSecs: prog?.actualWatchedSecs ?? 0,
      isCompleted: prog?.completed ?? false,
    };
  });

  return ok(reply, {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    level: course.level,
    durationHours: course.durationHours ? Number(course.durationHours) : null,
    isPublished: course.isPublished,
    isFeatured: course.isFeatured,
    createdAt: course.createdAt,
    instructor: course.creator ?? null,
    lessons,
    _count: { lessons: lessons.length, enrollments: course._count?.enrollments ?? 0 },
  });
}

export async function enrollCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) return fail(reply, 404, 'Course not found');

  const existing = await request.server.prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId: request.memberId, courseId } },
  });
  if (existing) return fail(reply, 409, 'Already enrolled in this course');

  const enrollment = await (request.server.prisma.courseEnrollment.create as any)({
    data: { memberId: request.memberId, courseId, progressPercentage: 0 },
    include: {
      course: {
        select: { id: true, title: true, thumbnailUrl: true, level: true, isFeatured: true, isPublished: true, slug: true, createdAt: true, durationHours: true },
      },
    },
  }) as any;

  return reply.status(201).send({
    success: true,
    data: {
      id: enrollment.id,
      courseId: enrollment.courseId,
      memberId: enrollment.memberId,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progressPercent: enrollment.progressPercentage,
      course: enrollment.course,
    },
    error: null,
  });
}

export async function getCertificateEligibilityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  if (!course) return fail(reply, 404, 'Course not found');

  const episodes = await request.server.prisma.courseEpisode.findMany({
    where: { courseId, isVisible: true },
    select: { id: true, durationSeconds: true },
  });

  const progress = await request.server.prisma.courseEpisodeProgress.findMany({
    where: { memberId: request.memberId, episode: { courseId, isVisible: true } },
    select: { episodeId: true, completed: true, actualWatchedSecs: true },
  });

  let validCompletions = 0;
  let totalRequiredSeconds = 0;
  let totalWatchedSeconds = 0;

  for (const ep of episodes) {
    const prog = progress.find((p) => p.episodeId === ep.id);
    const duration = ep.durationSeconds ?? 0;
    const threshold = duration ? duration * 0.85 : 90;
    
    totalRequiredSeconds += duration;
    totalWatchedSeconds += prog?.actualWatchedSecs ?? 0;

    if (prog?.completed && (prog.actualWatchedSecs ?? 0) >= threshold) {
      validCompletions++;
    }
  }

  const completionPercentage = totalRequiredSeconds > 0 
    ? Math.min(100, Math.round((totalWatchedSeconds / totalRequiredSeconds) * 100))
    : 0;

  const eligible = validCompletions === episodes.length && episodes.length > 0;
  const remainingLessons = episodes.length - validCompletions;

  // Check for security anomalies
  const securityLogs = await request.server.prisma.securityLog.findFirst({
    where: { memberId: request.memberId },
  });

  return ok(reply, {
    eligible,
    completionPercentage,
    remainingLessons,
    securityStatus: securityLogs ? 'flagged' : 'clear',
  });
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

export async function getEnrollmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const enrollments = await (request.server.prisma.courseEnrollment.findMany as any)({
    where: { memberId: request.memberId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          level: true,
          durationHours: true,
          totalLessons: true,
          isPublished: true,
          isFeatured: true,
          createdAt: true,
          creator: {
            select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
          },
          _count: { select: { enrollments: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  }) as any[];

  const data = enrollments.map((e: any) => ({
    id: e.id,
    courseId: e.courseId,
    memberId: e.memberId,
    enrolledAt: e.enrolledAt,
    completedAt: e.completedAt ?? null,
    progressPercent: e.progressPercentage,
    course: {
      ...e.course,
      durationHours: e.course?.durationHours ? Number(e.course.durationHours) : null,
      instructor: e.course?.creator ?? null,
      _count: {
        lessons: e.course?.totalLessons ?? 0,
        enrollments: e.course?._count?.enrollments ?? 0,
      },
    },
  }));

  return ok(reply, data);
}

export async function getLessonProgressHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };

  const progress = await (request.server.prisma as any).courseEpisodeProgress.findMany({
    where: { memberId: request.memberId, episode: { courseId } },
    select: { episodeId: true, completed: true, completedAt: true },
  });

  const data = (progress as any[]).map((p) => ({
    lessonId: p.episodeId,
    completed: p.completed,
    watchedSeconds: 0,
    completedAt: p.completedAt ?? null,
  }));

  return ok(reply, data);
}

export async function markLessonCompleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId, lessonId: episodeId } = request.params as { courseId: string; lessonId: string };
  const { watchedSeconds, deltaSeconds, isCompleted: requestedCompletion } = request.body as {
    watchedSeconds?: number;
    deltaSeconds?: number;
    isCompleted?: boolean;
  };

  const episode = await request.server.prisma.courseEpisode.findFirst({
    where: { id: episodeId, courseId },
    select: { id: true, durationSeconds: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found in this course');

  const now = new Date();
  
  // Safe increment of actualWatchedSecs (max 30s per heartbeat to prevent extreme skips)
  const safeDelta = Math.min(deltaSeconds ?? 0, 30);

  // Determine if the user is truly eligible for completion
  let finalIsCompleted = false;

  const deviceId = request.headers['x-device-id'] as string | undefined;

  const existingProgress = await (request.server.prisma as any).courseEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    select: { completed: true, actualWatchedSecs: true, lastWatchedSecs: true }
  });

  // Log excessive skipping if the playhead jumped forward significantly without actual watch time
  if (
    watchedSeconds !== undefined && 
    existingProgress?.lastWatchedSecs !== undefined && 
    watchedSeconds - existingProgress.lastWatchedSecs > (safeDelta + 300)
  ) {
    await request.server.prisma.securityLog.create({
      data: {
        memberId: request.memberId,
        eventType: 'EXCESSIVE_SKIPPING',
        metadata: {
          episodeId,
          courseId,
          fromSecs: existingProgress.lastWatchedSecs,
          toSecs: watchedSeconds,
          reportedDelta: deltaSeconds
        }
      } as any
    }).catch(() => {});
  }

  // Update session last active time
  if (deviceId) {
    await request.server.prisma.memberSession.updateMany({
      where: { memberId: request.memberId, deviceId },
      data: { lastActiveAt: new Date() }
    }).catch(() => {});
  }

  const cumulativeActualSecs = (existingProgress?.actualWatchedSecs ?? 0) + safeDelta;
  const threshold = episode.durationSeconds ? episode.durationSeconds * 0.85 : 90;

  if (existingProgress?.completed) {
    // Already completed previously
    finalIsCompleted = true;
  } else if (requestedCompletion && cumulativeActualSecs >= threshold) {
    // Reached threshold legitimately
    finalIsCompleted = true;
  }

  const progress = await (request.server.prisma as any).courseEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    create: { 
      memberId: request.memberId, 
      episodeId, 
      completed: finalIsCompleted, 
      completedAt: finalIsCompleted ? now : null,
      lastWatchedSecs: watchedSeconds ?? 0,
      actualWatchedSecs: safeDelta
    },
    update: { 
      completed: finalIsCompleted ? true : undefined, 
      completedAt: (finalIsCompleted && !existingProgress?.completed) ? now : undefined,
      lastWatchedSecs: watchedSeconds ?? undefined,
      actualWatchedSecs: { increment: safeDelta }
    },
  });

  if (finalIsCompleted && !existingProgress?.completed) {
    await recalculateCourseProgress(request, courseId);
  }

  return ok(reply, {
    lessonId: episodeId,
    completed: progress.completed,
    watchedSeconds: progress.lastWatchedSecs,
    actualWatchedSecs: progress.actualWatchedSecs,
    completedAt: progress.completedAt?.toISOString() ?? null,
  });
}

async function recalculateCourseProgress(request: FastifyRequest, courseId: string) {
  const [total, completed] = await Promise.all([
    request.server.prisma.courseEpisode.count({ where: { courseId } }),
    (request.server.prisma as any).courseEpisodeProgress.count({
      where: { memberId: request.memberId, episode: { courseId }, completed: true },
    }),
  ]);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  await request.server.prisma.courseEnrollment.updateMany({
    where: { memberId: request.memberId, courseId },
    data: {
      progressPercentage: pct,
      completedAt: pct === 100 ? new Date() : null,
    },
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const now = new Date();

  const [totalCourses, completedCourses, member, upcomingEvents, unreadNotifications] =
    await Promise.all([
      request.server.prisma.courseEnrollment.count({
        where: { memberId: request.memberId },
      }),
      request.server.prisma.courseEnrollment.count({
        where: { memberId: request.memberId, completedAt: { not: null } },
      }),
      request.server.prisma.member.findUnique({
        where: { id: request.memberId },
        select: { totalPoints: true, currentStreak: true },
      }),
      request.server.prisma.event.count({
        where: { eventDate: { gt: now }, status: 'scheduled' },
      }),
      request.server.prisma.notification.count({
        where: { memberId: request.memberId, isRead: false },
      }),
    ]);

  return ok(reply, {
    totalCourses,
    completedCourses,
    inProgressCourses: totalCourses - completedCourses,
    totalPoints: member?.totalPoints ?? 0,
    currentStreak: member?.currentStreak ?? 0,
    upcomingEvents,
    unreadNotifications,
  });
}

export async function getContinueLearningHandler(request: FastifyRequest, reply: FastifyReply) {
  // Fetch more than needed so deduplication still yields up to 6 unique items
  const [courseProgress, workshopProgress] = await Promise.all([
    request.server.prisma.courseEpisodeProgress.findMany({
      where: { memberId: request.memberId, completed: false },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            order: true,
            courseId: true,
            durationSeconds: true,
            course: {
              select: {
                title: true,
                thumbnailUrl: true,
                _count: { select: { courseEpisodes: true } },
              },
            },
          },
        },
      },
    }),
    request.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: request.memberId, isCompleted: false },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            order: true,
            durationSeconds: true,
            challenge: {
              select: {
                title: true,
                workshop: { select: { title: true, slug: true, thumbnailUrl: true } },
                _count: { select: { episodes: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Progress % based on playhead position (lastWatchedSecs) — shows where the user is in the video
  const pct = (lastWatched: number, duration: number | null | undefined) =>
    duration && duration > 0 ? Math.min(99, Math.round((lastWatched / duration) * 100)) : 0;

  // Deduplicate courses — keep only the most-recently-watched episode per course
  const seenCourseIds = new Set<string>();
  const dedupedCourses = courseProgress.filter(p => {
    const key = p.episode.courseId;
    if (seenCourseIds.has(key)) return false;
    seenCourseIds.add(key);
    return true;
  });

  // Deduplicate workshops — keep only the most-recently-watched episode per workshop
  const seenWorkshopSlugs = new Set<string>();
  const dedupedWorkshops = workshopProgress.filter(p => {
    const key = p.episode.challenge.workshop.slug;
    if (seenWorkshopSlugs.has(key)) return false;
    seenWorkshopSlugs.add(key);
    return true;
  });

  const combined = [
    ...dedupedCourses.map(p => ({
      type: 'course' as const,
      id: p.episode.courseId,
      lessonId: p.episodeId,
      title: p.episode.course.title,
      thumbnailUrl: p.episode.course.thumbnailUrl ?? null,
      lastLessonTitle: p.episode.title,
      challengeTitle: null as string | null,
      lastWatchedSecs: p.lastWatchedSecs,
      durationSeconds: p.episode.durationSeconds ?? null,
      remainingSecs: Math.max(0, (p.episode.durationSeconds ?? 0) - p.lastWatchedSecs),
      episodeOrder: p.episode.order,
      episodeCount: p.episode.course._count.courseEpisodes,
      progressPercent: pct(p.lastWatchedSecs, p.episode.durationSeconds),
      updatedAt: p.updatedAt.getTime(),
    })),
    ...dedupedWorkshops.map(p => ({
      type: 'workshop' as const,
      id: p.episode.challenge.workshop.slug,
      lessonId: p.episodeId,
      title: p.episode.challenge.workshop.title,
      thumbnailUrl: p.episode.challenge.workshop.thumbnailUrl ?? null,
      lastLessonTitle: p.episode.title,
      challengeTitle: p.episode.challenge.title,
      lastWatchedSecs: p.lastWatchedSecs,
      durationSeconds: p.episode.durationSeconds ?? null,
      remainingSecs: Math.max(0, (p.episode.durationSeconds ?? 0) - p.lastWatchedSecs),
      episodeOrder: p.episode.order,
      episodeCount: p.episode.challenge._count.episodes,
      progressPercent: pct(p.lastWatchedSecs, p.episode.durationSeconds),
      updatedAt: p.updatedAt.getTime(),
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

  return ok(reply, combined);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function listUserEventsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, search } = request.query as {
    page?: number;
    limit?: number;
    search?: string;
  };

  const where: Record<string, unknown> = {};
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [events, total] = await Promise.all([
    request.server.prisma.event.findMany({
      where: where as any,
      orderBy: { eventDate: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.event.count({ where: where as any }),
  ]);

  return ok(reply, events, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const event = await request.server.prisma.event.findUnique({ where: { id } });
  if (!event) return fail(reply, 404, 'Event not found');
  return ok(reply, event);
}

export async function registerForEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: eventId } = request.params as { id: string };

  const event = await request.server.prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event) return fail(reply, 404, 'Event not found');

  const existing = await request.server.prisma.eventRegistration.findFirst({
    where: { memberId: request.memberId, eventId },
  });
  if (existing) return ok(reply, { registered: true });

  await request.server.prisma.eventRegistration.create({
    data: { memberId: request.memberId, eventId },
  });

  return reply.status(201).send({ success: true, data: { registered: true }, error: null });
}

// ─── Webinars ─────────────────────────────────────────────────────────────────

export async function listUserWebinarsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, status } = request.query as {
    page?: number;
    limit?: number;
    status?: string;
  };

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [webinars, total] = await Promise.all([
    request.server.prisma.webinar.findMany({
      where: where as any,
      include: {
        host: {
          select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.webinar.count({ where: where as any }),
  ]);

  const data = webinars.map((w) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    scheduledAt: w.scheduledAt,
    durationMinutes: w.durationMinutes,
    status: w.status,
    streamUrl: w.meetingUrl ?? null,
    recordingUrl: w.recordingUrl ?? null,
    host: w.host ?? null,
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const webinar = await request.server.prisma.webinar.findUnique({
    where: { id },
    include: {
      host: {
        select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
      },
    },
  });
  if (!webinar) return fail(reply, 404, 'Webinar not found');

  return ok(reply, {
    id: webinar.id,
    title: webinar.title,
    description: webinar.description,
    scheduledAt: webinar.scheduledAt,
    durationMinutes: webinar.durationMinutes,
    status: webinar.status,
    streamUrl: webinar.meetingUrl ?? null,
    recordingUrl: webinar.recordingUrl ?? null,
    host: webinar.host ?? null,
  });
}

export async function getWebinarTokenHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: webinarId } = request.params as { id: string };

  const webinar = await request.server.prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { id: true, meetingUrl: true },
  });
  if (!webinar) return fail(reply, 404, 'Webinar not found');

  await request.server.prisma.webinarRegistration.upsert({
    where: { memberId_webinarId: { memberId: request.memberId, webinarId } },
    create: { memberId: request.memberId, webinarId, attended: true, joinTime: new Date() },
    update: { attended: true, joinTime: new Date() },
  });

  return ok(reply, { meetingUrl: webinar.meetingUrl ?? '' });
}

// ─── Workshop Live Calls (LiveKit) ────────────────────────────────────────────

export async function getLiveCallStatusUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };

  const lc = await request.server.prisma.liveCall.findUnique({
    where: { id: liveCallId },
    select: { id: true, startedAt: true, endedAt: true },
  });
  if (!lc) return fail(reply, 404, 'Live call not found');

  let participantCount = 0;
  if (env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_WS_URL && lc.startedAt && !lc.endedAt) {
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
      const svc = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      const participants = await svc.listParticipants(`workshop-live-${liveCallId}`);
      participantCount = participants.length;
    } catch {
      // Room not active yet
    }
  }

  const isLive = !!lc.startedAt && !lc.endedAt;
  return ok(reply, { isLive, participantCount, startedAt: lc.startedAt, endedAt: lc.endedAt });
}

export async function joinLiveCallHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };

  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return fail(reply, 503, 'Live call service not configured');
  }

  const liveCall = await request.server.prisma.liveCall.findUnique({
    where: { id: liveCallId },
    select: { id: true, title: true, scheduledAt: true, liveUrlUnlocksMinutesBefore: true, isWebinar: true, startedAt: true, isLocked: true, waitingRoomEnabled: true, passcode: true },
  });
  if (!liveCall) return fail(reply, 404, 'Live call not found');

  // Passcode check (if set and caller provides one)
  const { passcode: inputPasscode } = request.body as any ?? {};
  if (liveCall.passcode && liveCall.passcode !== inputPasscode) {
    return reply.status(403).send({ success: false, data: null, error: { code: 'PASSCODE_REQUIRED', message: 'Invalid passcode' } });
  }

  // Waiting room — return waiting status; admin must admit via socket
  if (liveCall.waitingRoomEnabled && liveCall.isLocked) {
    return ok(reply, { status: 'waiting', liveCallId });
  }

  const member = await request.server.prisma.member.findUnique({
    where: { id: request.memberId },
    select: { firstName: true, lastName: true },
  });

  const { AccessToken } = await import('livekit-server-sdk');

  const roomName = `workshop-live-${liveCallId}`;
  const displayName = [member?.firstName, member?.lastName].filter(Boolean).join(' ') || 'Participant';

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: request.memberId,
    name: displayName,
    ttl: '4h',
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: !liveCall.isWebinar,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return ok(reply, { status: 'joined', token, wsUrl: env.LIVEKIT_WS_URL, roomName, startedAt: liveCall.startedAt, isWebinar: liveCall.isWebinar });
}

// ─── Polls (user) ─────────────────────────────────────────────────────────────

export async function getUserPollsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const polls = await request.server.prisma.liveCallPoll.findMany({
    where: { liveCallId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      options: {
        include: {
          _count: { select: { votes: true } },
          votes: { where: { memberId: request.memberId }, select: { id: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  return ok(reply, polls);
}

export async function votePollHandler(request: FastifyRequest, reply: FastifyReply) {
  const { pollId } = request.params as { pollId: string };
  const { optionId } = request.body as { optionId: string };

  // Verify option belongs to a poll in a live call the member is enrolled in
  const option = await request.server.prisma.liveCallPollOption.findUnique({
    where: { id: optionId },
    include: { poll: { select: { id: true, isActive: true } } },
  });
  if (!option || option.pollId !== pollId) return fail(reply, 404, 'Option not found');
  if (!option.poll.isActive) return fail(reply, 409, 'Poll is closed');

  const vote = await request.server.prisma.liveCallPollVote.upsert({
    where: { optionId_identity: { optionId, identity: request.memberId } },
    update: {},
    create: { optionId, memberId: request.memberId, identity: request.memberId },
  });
  return ok(reply, vote);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function notifIconType(type: string): string {
  const map: Record<string, string> = {
    video: 'video', course: 'video',
    assignment: 'assignment',
    live_call: 'live_call', webinar: 'live_call',
    achievement: 'achievement', badge: 'achievement',
    announcement: 'announcement',
    system: 'system',
  };
  return map[type] ?? 'system';
}

export async function getNotificationUnreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const count = await request.server.prisma.appNotificationRecipient.count({
    where: { memberId: request.memberId, readAt: null },
  });
  return ok(reply, { count });
}

export async function getUserNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 50, unread } = request.query as {
    page?: number;
    limit?: number;
    unread?: string;
  };

  const where: Record<string, unknown> = { memberId: request.memberId };
  if (unread === 'true') where.readAt = null;

  const [recipients, total] = await Promise.all([
    request.server.prisma.appNotificationRecipient.findMany({
      where: where as any,
      orderBy: { notification: { createdAt: 'desc' } },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        notification: {
          select: { title: true, message: true, type: true, actionUrl: true, mediaType: true, mediaUrl: true, createdAt: true },
        },
      },
    }),
    request.server.prisma.appNotificationRecipient.count({ where: where as any }),
  ]);

  const data = recipients.map((r) => ({
    id: r.id,
    title: r.notification.title,
    body: r.notification.message,
    type: r.notification.type,
    iconType: notifIconType(r.notification.type),
    actionUrl: r.notification.actionUrl ?? null,
    mediaType: r.notification.mediaType ?? null,
    mediaUrl: r.notification.mediaUrl ?? null,
    data: null as null,
    isRead: r.readAt !== null,
    createdAt: r.notification.createdAt,
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function markNotificationReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const recipient = await request.server.prisma.appNotificationRecipient.findFirst({
    where: { id, memberId: request.memberId },
  });
  if (!recipient) return fail(reply, 404, 'Notification not found');

  const updated = await request.server.prisma.appNotificationRecipient.update({
    where: { id },
    data: { readAt: new Date() },
    include: { notification: { select: { title: true, message: true, type: true, actionUrl: true, mediaType: true, mediaUrl: true, createdAt: true } } },
  });

  return ok(reply, {
    id: updated.id,
    title: updated.notification.title,
    body: updated.notification.message,
    type: updated.notification.type,
    iconType: notifIconType(updated.notification.type),
    actionUrl: updated.notification.actionUrl ?? null,
    mediaType: updated.notification.mediaType ?? null,
    mediaUrl: updated.notification.mediaUrl ?? null,
    isRead: true,
    createdAt: updated.notification.createdAt,
  });
}

export async function markAllNotificationsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await request.server.prisma.appNotificationRecipient.updateMany({
    where: { memberId: request.memberId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(reply, { updated: result.count });
}

export async function dismissNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.appNotificationRecipient.deleteMany({
    where: { id, memberId: request.memberId },
  });
  return ok(reply, { dismissed: true });
}

export async function clearReadNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await request.server.prisma.appNotificationRecipient.deleteMany({
    where: { memberId: request.memberId, readAt: { not: null } },
  });
  return ok(reply, { cleared: result.count });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function getUserMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, unread } = request.query as {
    page?: number; limit?: number; unread?: boolean;
  };
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    memberId: request.memberId,
    ...(unread ? { isRead: false } : {}),
  };

  const [messages, total] = await Promise.all([
    request.server.prisma.directMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    request.server.prisma.directMessage.count({ where }),
  ]);

  // Batch-resolve admin senders to avoid N+1
  const adminIds = [...new Set(
    messages.filter(m => m.senderType === 'admin').map(m => m.senderId)
  )];
  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

  const data = messages.map(m => {
    const sender = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      subject:         m.subject,
      body:            m.body,
      senderName:      sender?.fullName ?? 'TBT Team',
      senderAvatarUrl: sender?.profilePhotoUrl ?? null,
      isRead:          m.isRead,
      createdAt:       m.createdAt,
    };
  });

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function markMessageReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.directMessage.updateMany({
    where: { id, memberId: request.memberId },
    data:  { isRead: true, readAt: new Date() },
  });
  return ok(reply, { id, isRead: true });
}

export async function markAllMessagesReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await request.server.prisma.directMessage.updateMany({
    where: { memberId: request.memberId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });
  return ok(reply, { updated: result.count });
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export async function getHomeHeroHandler(request: FastifyRequest, reply: FastifyReply) {
  const [slides, siteConfig] = await Promise.all([
    request.server.prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    request.server.prisma.siteConfig.findFirst({
      select: { heroAutoPlayIntervalMs: true },
    }),
  ]);

  return ok(reply, {
    slides: slides.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      description: s.description ?? null,
      bgVideoUrl: s.bgVideoUrl ?? null,
      bgImageUrl: s.bgImageUrl ?? null,
      bgMuteDefault: s.bgMuteDefault,
      ctaLabel: s.ctaLabel,
      ctaUrl: s.ctaUrl,
      ctaType: s.ctaType,
      badgeText: s.badgeText ?? null,
      isActive: s.isActive,
    })),
    autoPlayIntervalMs: siteConfig?.heroAutoPlayIntervalMs ?? 5000,
  });
}

export async function getHomeSectionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { memberTier } = request.query as { memberTier?: string };
  const tierNum = parseInt(memberTier || '1', 10);

  const sections = await request.server.prisma.contentSection.findMany({
    where: { isVisible: true },
    orderBy: { order: 'asc' },
    include: {
      items: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              _count: { select: { courseEpisodes: { where: { isVisible: true } } } },
              courseEpisodes: {
                where: { isVisible: true },
                orderBy: { order: 'asc' },
                take: 20,
                select: {
                  id: true,
                  order: true,
                  title: true,
                  thumbnailUrl: true,
                  durationSeconds: true,
                },
              },
            },
          },
          workshop: {
            select: {
              id: true,
              slug: true,
              challenges: {
                orderBy: { order: 'asc' },
                select: {
                  episodes: {
                    orderBy: { order: 'asc' },
                    take: 20,
                    select: {
                      id: true,
                      order: true,
                      title: true,
                      durationSeconds: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return ok(reply, {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      order: s.order,
      isVisible: s.isVisible,
      requiredTier: s.requiredTier,
      isLocked: tierNum < s.requiredTier,
      lockLabel: tierNum < s.requiredTier ? (s.lockBadgeText ?? null) : null,
      items: s.items.map((item) => {
        const workshopEpisodes = (item.workshop?.challenges ?? []).flatMap(
          (ch: any) => ch.episodes ?? []
        );
        const resolvedPlayUrl = item.workshop
          ? `/workshop/${item.workshop.slug}`
          : item.course
            ? `/learning/${item.course.id}`
            : (item.playUrl ?? null);

        return {
          id: item.id,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl ?? null,
          requiredTier: item.requiredTier,
          isLocked: tierNum < item.requiredTier,
          lockBadgeText: tierNum < item.requiredTier ? (item.lockBadgeText ?? null) : null,
          contentType: item.contentType,
          categoryTag: item.categoryTag ?? null,
          playUrl: resolvedPlayUrl,
          courseId: item.courseId ?? null,
          workshopId: item.workshopId ?? null,
          episodeCount: workshopEpisodes.length > 0
            ? workshopEpisodes.length
            : (item.course?._count?.courseEpisodes ?? null),
          episodes: workshopEpisodes.length > 0
            ? workshopEpisodes.map((ep: any) => ({
                id: ep.id,
                order: ep.order,
                title: ep.title,
                thumbnailUrl: null,
                durationSeconds: ep.durationSeconds ?? null,
              }))
            : (item.course?.courseEpisodes ?? []).map((ep) => ({
                id: ep.id,
                order: ep.order,
                title: ep.title,
                thumbnailUrl: ep.thumbnailUrl ?? null,
                durationSeconds: ep.durationSeconds,
              })),
        };
      }),
    })),
  });
}

// ─── Workshops (user-facing) ──────────────────────────────────────────────────

export async function listWorkshopsHandler(request: FastifyRequest, reply: FastifyReply) {
  const [workshops, enrollments] = await Promise.all([
    request.server.prisma.workshop.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        deliveryMode: true,
        requiredTier: true,
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    request.server.prisma.workshopEnrollment.findMany({
      where: { memberId: request.memberId },
      select: { workshopId: true, status: true },
    }),
  ]);

  const enrollmentMap = new Map(enrollments.map((e) => [e.workshopId, e.status]));

  const data = workshops.map((w) => {
    const enrollStatus = enrollmentMap.get(w.id) ?? null;
    return {
      id: w.id,
      title: w.title,
      slug: w.slug,
      description: w.description ?? null,
      thumbnailUrl: w.thumbnailUrl ?? null,
      deliveryMode: w.deliveryMode,
      deliveryModeLabel:
        w.deliveryMode === 'online' ? 'Online'
        : w.deliveryMode === 'offline' ? 'In-Person'
        : 'Hybrid',
      requiredTier: w.requiredTier,
      challengeCount: w._count.challenges,
      enrollmentStatus: enrollStatus,
      enrolledBadge: enrollStatus === 'active' ? { label: 'Enrolled', color: '#22c55e' } : null,
      completedBadgeIconType: enrollStatus === 'completed' ? 'checkmark' : null,
    };
  });

  return ok(reply, data);
}

export async function getMyWorkshopsHandler(request: FastifyRequest, reply: FastifyReply) {
  const enrollments = await request.server.prisma.workshopEnrollment.findMany({
    where: { memberId: request.memberId },
    include: {
      workshop: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          deliveryMode: true,
          isActive: true,
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const active = enrollments.filter((e) => e.status === 'active');
  const completed = enrollments.filter((e) => e.status === 'completed');

  const mapItem = (e: (typeof enrollments)[0]) => ({
    id: e.workshop.id,
    title: e.workshop.title,
    thumbnailUrl: e.workshop.thumbnailUrl ?? null,
    slug: e.workshop.slug,
    enrollmentStatus: e.status,
    enrolledBadge: e.status === 'active' ? { label: 'Enrolled', color: '#22c55e' } : null,
    completedBadgeIconType: e.status === 'completed' ? 'checkmark' : null,
    deliveryMode: e.workshop.deliveryMode,
    deliveryModeLabel:
      e.workshop.deliveryMode === 'online'
        ? 'Online'
        : e.workshop.deliveryMode === 'offline'
          ? 'In-Person'
          : 'Hybrid',
  });

  return ok(reply, {
    sections: [
      ...(active.length > 0
        ? [{ id: 'active', label: 'Workshops', items: active.map(mapItem) }]
        : []),
      ...(completed.length > 0
        ? [{ id: 'completed', label: 'Completed Workshops', items: completed.map(mapItem) }]
        : []),
    ],
  });
}

export async function getWorkshopDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      enrollments: {
        where: { memberId: request.memberId },
        select: { status: true },
      },
      challenges: {
        select: { id: true, type: true, episodes: { select: { id: true } } },
        orderBy: { order: 'asc' },
      },
      liveCalls: {
        where: { scheduledAt: { gt: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        select: { id: true, scheduledAt: true },
      },
    },
  });

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const enrollment = (workshop as any).enrollments?.[0];
  const allChallenges: any[] = (workshop as any).challenges ?? [];
  const allEpisodes = allChallenges.flatMap((c: any) => c.episodes ?? []);

  const [episodeProgress, challengeProgressRows] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e: any) => e.id) } },
      select: { episodeId: true, isCompleted: true },
    }),
    (request.server.prisma as any).memberChallengeProgress.findMany({
      where: { memberId: request.memberId, challengeId: { in: allChallenges.map((c: any) => c.id) } },
      select: { challengeId: true, status: true },
    }),
  ]);

  const completedCount = episodeProgress.filter((p: any) => p.isCompleted).length;
  const totalCount = allEpisodes.length;

  // Count every non-live_call challenge toward learning progress.
  // Watch challenges (the default) complete when all their episodes are done.
  // Interactive challenges (quiz/written/etc) complete via memberChallengeProgress.
  const completableChallenges = allChallenges.filter((c: any) => c.type !== 'live_call');
  const challengeProgressMap = new Map(
    (challengeProgressRows as any[]).map((r: any) => [r.challengeId, r.status])
  );
  const completedEpIds = new Set(episodeProgress.filter((p: any) => p.isCompleted).map((p: any) => p.episodeId));

  let completedChallengeCount = 0;
  for (const ch of completableChallenges) {
    const progressStatus = challengeProgressMap.get(ch.id);
    const epIds: string[] = (ch.episodes ?? []).map((e: any) => e.id);
    const allEpsDone = epIds.length > 0 && epIds.every((id: string) => completedEpIds.has(id));
    const isWatch = !ch.type || ch.type === 'watch';
    if (progressStatus === 'completed') {
      completedChallengeCount++;
    } else if (isWatch && allEpsDone) {
      completedChallengeCount++;
    }
  }

  const totalChallenges = completableChallenges.length;
  const videosCompletedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const challengesCompletedPct = totalChallenges > 0
    ? Math.round((completedChallengeCount / totalChallenges) * 100)
    : 100; // no challenges → challenges requirement trivially met

  const certEligible = videosCompletedPct === 100 && challengesCompletedPct === 100 && totalCount > 0;

  // Determine what the main area should show by default
  const hasUpcomingCall = ((workshop as any).liveCalls ?? []).length > 0;
  const defaultMainAreaType = hasUpcomingCall ? 'countdown' : null;

  return ok(reply, {
    id: workshop.id,
    title: workshop.title,
    backLabel: workshop.backLabel,
    backUrl: workshop.backUrl,
    sidebar: {
      tabs: [
        { id: 'challenges', label: workshop.tabChallengesLabel, order: 1 },
        { id: 'qa', label: workshop.tabQaLabel, order: 2 },
        { id: 'assignment', label: workshop.tabAssignmentLabel, order: 3 },
      ],
    },
    learningProgress: {
      label: workshop.progressWidgetLabel,
      percentage: challengesCompletedPct,
      completedCount: completedChallengeCount,
      totalCount: totalChallenges,
      milestones: Array.from({ length: workshop.progressMilestoneCount ?? 3 }, (_, i) => ({
        achieved: challengesCompletedPct >= Math.round(((i + 1) / (workshop.progressMilestoneCount ?? 3)) * 100),
      })),
    },
    certificate: {
      eligible: certEligible,
      videosCompletedPct,
      challengesCompletedPct,
      remainingVideos: totalCount - completedCount,
      remainingChallenges: totalChallenges - completedChallengeCount,
    },
    workshopFlowLabel: workshop.workshopFlowLabel,
    defaultMainAreaType,
    enrollmentStatus: enrollment?.status ?? null,
  });
}

export async function getWorkshopCertificateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      challenges: {
        select: { id: true, type: true, episodes: { select: { id: true } } },
      },
    },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const member = await request.server.prisma.member.findUnique({
    where: { id: request.memberId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!member) return fail(reply, 404, 'Member not found');

  const allChallenges: any[] = (workshop as any).challenges ?? [];
  const allEpisodes = allChallenges.flatMap((c: any) => c.episodes ?? []);

  const [episodeProgress, challengeProgressRows] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e: any) => e.id) } },
      select: { episodeId: true, isCompleted: true, updatedAt: true },
    }),
    (request.server.prisma as any).memberChallengeProgress.findMany({
      where: { memberId: request.memberId, challengeId: { in: allChallenges.map((c: any) => c.id) } },
      select: { challengeId: true, status: true, completedAt: true },
    }),
  ]);

  const completableChallenges = allChallenges.filter((c: any) => c.type !== 'live_call');
  const challengeProgressMap = new Map(
    (challengeProgressRows as any[]).map((r: any) => [r.challengeId, r])
  );
  const completedEpIdSet = new Set(episodeProgress.filter((p: any) => p.isCompleted).map((p: any) => p.episodeId));

  let allEpisodesDone = allEpisodes.length > 0 &&
    allEpisodes.every((e: any) => completedEpIdSet.has(e.id));

  let allChallengesDone = completableChallenges.every((ch: any) => {
    if (challengeProgressMap.get(ch.id)?.status === 'completed') return true;
    if (!ch.type || ch.type === 'watch') {
      const epIds: string[] = (ch.episodes ?? []).map((e: any) => e.id);
      return epIds.length > 0 && epIds.every((id: string) => completedEpIdSet.has(id));
    }
    return false;
  });

  if (!allEpisodesDone || !allChallengesDone) {
    return fail(reply, 403, 'Certificate not yet earned — complete all videos and challenges first');
  }

  // Completion date = latest completion timestamp across episodes and challenges
  const episodeDates = episodeProgress.map((p: any) => p.updatedAt?.getTime?.() ?? 0);
  const challengeDates = (challengeProgressRows as any[]).map((r: any) => r.completedAt?.getTime?.() ?? 0);
  const latestMs = Math.max(0, ...episodeDates, ...challengeDates);
  const completedAt = latestMs > 0 ? new Date(latestMs).toISOString() : new Date().toISOString();

  // Deterministic certificate ID — stable for the same member+workshop pair
  const certId = Buffer.from(`${member.id}:${workshop.id}`).toString('base64url').slice(0, 16).toUpperCase();

  return ok(reply, {
    certificateId: certId,
    memberName: `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`,
    workshopTitle: workshop.title,
    completedAt,
    issuedAt: new Date().toISOString(),
  });
}

export async function getWorkshopFlowHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      flowItems: {
        orderBy: { order: 'asc' },
        include: {
          challenge: {
            include: {
              episodes: {
                orderBy: { order: 'asc' },
                include: {
                  progress: {
                    where: { memberId: request.memberId },
                    select: { isCompleted: true },
                  },
                },
              },
            },
          },
          liveCall: true,
        },
      },
    },
  });

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const flowItems = await Promise.all(
    (workshop as any).flowItems.map(async (item: any) => {
      if (item.type === 'challenge' && item.challenge) {
        const ch = item.challenge;
        const totalEps = ch.episodes.length;
        const completedEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;

        return {
          id: item.id,
          order: item.order,
          type: item.type,
          challengeNumber: ch.challengeNumber ?? null,
          numberLabel: ch.numberLabel ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}:`,
          numberColor: ch.numberColor ?? '#00c4cc',
          title: ch.title,
          description: ch.description ?? null,
          progressPercent: totalEps > 0 ? Math.round((completedEps / totalEps) * 100) : 0,
          isExpanded: false,
          episodes: ch.episodes.map((ep: any) => ({
            id: ep.id,
            order: ep.order,
            title: ep.title,
            type: ep.type,
            typeLabel: ep.typeLabel,
            durationSeconds: ep.durationSeconds ?? null,
            durationLabel: ep.durationLabel ?? null,
            isCompleted: ep.progress?.[0]?.isCompleted ?? false,
            isLocked: false,
            lockIconType: ep.lockIconType,
            completedIconType: ep.completedIconType,
          })),
        };
      }

      if ((item.type === 'live_call' || item.type === 'custom') && item.liveCall) {
        const lc = item.liveCall;
        const now = new Date();
        const scheduledAt = new Date(lc.scheduledAt);
        // "past" only once the admin explicitly ends the meeting
        const status = lc.endedAt ? 'past' : 'upcoming';
        const unlockAt = lc.liveUrlUnlocksMinutesBefore
          ? new Date(scheduledAt.getTime() - lc.liveUrlUnlocksMinutesBefore * 60 * 1000)
          : null;
        const isUnlocked = !lc.endedAt && (unlockAt ? now >= unlockAt : true);

        return {
          id: item.id,
          order: item.order,
          type: 'live_call',
          liveCallId: lc.id,
          label: lc.label,
          labelColor: lc.labelColor,
          title: lc.title,
          scheduledAt: lc.scheduledAt,
          status,
          isUnlocked,
          recordingAvailable: status === 'past' && !!lc.recordingUrl,
          recordingLabel: lc.recordingUrl ? (lc.recordingLabel ?? 'Missed it? View the recording.') : null,
          prerequisiteNote: lc.prerequisiteNote ?? null,
          liveUrl: isUnlocked ? (lc.liveUrl ?? null) : null,
          liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
          facilitatorName: lc.facilitatorName ?? null,
          facilitatorTitle: lc.facilitatorTitle ?? null,
          facilitatorDescription: lc.facilitatorDescription ?? null,
          countdownConfig:
            status === 'upcoming'
              ? { stayTunedMessage: lc.stayTunedMessage, stayTunedColor: lc.stayTunedColor }
              : null,
          isCompleted: status === 'past',
        };
      }

      return {
        id: item.id,
        order: item.order,
        type: item.type,
        label: item.label ?? null,
        description: item.description ?? null,
        isCompleted: item.isCompleted,
        isExpanded: false,
      };
    })
  );

  return ok(reply, { flowItems });
}

export async function getWorkshopQaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const [posts, total] = await Promise.all([
    request.server.prisma.qAPost.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        member: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
        replies: {
          include: {
            member: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
            admin: { select: { fullName: true, profilePhotoUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    request.server.prisma.qAPost.count({ where: { workshopId: workshop.id } }),
  ]);

  const timeAgo = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h || 1}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  };

  return ok(reply, {
    heading: 'Do you have any questions?',
    promptText: 'Got something on your mind? Post your question and let\'s explore it together!',
    inputPlaceholder: 'Type your Question here...',
    submitLabel: 'Ask Now',
    communityHeading: 'Others Asked questions',
    communityHeadingHighlight: 'questions',
    posts: posts.map((p) => ({
      id: p.id,
      author: {
        name: [p.member.firstName, p.member.lastName].filter(Boolean).join(' '),
        avatarUrl: p.member.profilePhotoUrl ?? null,
      },
      timeAgo: timeAgo(p.createdAt),
      questionText: p.questionText,
      replyLabel: 'Reply',
      replies: p.replies.map((r) => ({
        id: r.id,
        author: r.admin
          ? { name: r.admin.fullName, avatarUrl: r.admin.profilePhotoUrl ?? null }
          : {
              name: [r.member?.firstName, r.member?.lastName].filter(Boolean).join(' '),
              avatarUrl: r.member?.profilePhotoUrl ?? null,
            },
        timeAgo: timeAgo(r.createdAt),
        replyText: r.replyText,
      })),
    })),
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
}

export async function postWorkshopQaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { questionText } = request.body as { questionText: string };

  if (!questionText?.trim()) return fail(reply, 400, 'Question text is required');

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const post = await request.server.prisma.qAPost.create({
    data: { workshopId: workshop.id, memberId: request.memberId, questionText: questionText.trim() },
    select: { id: true, questionText: true, createdAt: true, member: { select: { firstName: true, lastName: true } } },
  });

  const memberName = [post.member.firstName, post.member.lastName].filter(Boolean).join(' ');
  request.server.io.to(`workshop:${slug}`).emit('qa:new_question', {
    id: post.id,
    questionText: post.questionText,
    memberName,
    createdAt: post.createdAt,
    replies: [],
  });

  return reply.status(201).send({ success: true, data: post, error: null });
}

export async function postQaReplyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { postId } = request.params as { postId: string };
  const { replyText } = request.body as { replyText: string };

  if (!replyText?.trim()) return fail(reply, 400, 'Reply text is required');

  const post = await request.server.prisma.qAPost.findUnique({
    where: { id: postId },
    select: { id: true, workshop: { select: { slug: true } } },
  });
  if (!post) return fail(reply, 404, 'Post not found');

  const r = await request.server.prisma.qAReply.create({
    data: { postId, memberId: request.memberId, replyText: replyText.trim() },
    select: { id: true, replyText: true, createdAt: true },
  });

  request.server.io.to(`workshop:${post.workshop.slug}`).emit('qa:new_reply', {
    postId,
    reply: {
      id: r.id,
      replyText: r.replyText,
      createdAt: r.createdAt,
    },
  });

  return reply.status(201).send({ success: true, data: r, error: null });
}

export async function getWorkshopAssignmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const [workshop, uiStrings] = await Promise.all([
    request.server.prisma.workshop.findFirst({
      where: { slug },
      include: {
        challenges: {
          orderBy: { order: 'asc' },
          include: {
            assignments: {
              orderBy: { order: 'asc' },
              include: {
                submissions: {
                  where: { memberId: request.memberId },
                  select: {
                    id: true,
                    answerText: true,
                    submittedAt: true,
                    completedIconType: true,
                    yourAnswerLabel: true,
                    backLabel: true,
                  },
                },
              },
            },
          } as any,
        },
      },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const ctaLabel = uiStrings?.assignmentCtaLabel ?? 'Answer';
  const submitLabel = uiStrings?.assignmentSubmitLabel ?? 'Submit';
  const cancelLabel = uiStrings?.assignmentCancelLabel ?? 'Cancel';

  return ok(reply, {
    groups: (workshop as any).challenges.map((ch: any) => ({
      challengeLabel: ch.numberLabel?.replace(':', '') ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}`,
      challengeTitle: ch.title,
      assignments: ch.assignments.map((a: any) => {
        const sub = a.submissions?.[0] ?? null;
        return {
          id: a.id,
          title: a.title,
          typeLabel: a.typeLabel,
          iconType: a.iconType,
          ctaLabel,
          submitLabel,
          cancelLabel,
          submission: sub
            ? {
                isSubmitted: true,
                submittedAt: sub.submittedAt,
                answerText: sub.answerText,
                completedIcon: sub.completedIconType,
                yourAnswerLabel: sub.yourAnswerLabel,
                backLabel: sub.backLabel,
              }
            : { isSubmitted: false },
        };
      }),
    })),
  });
}

export async function submitAssignmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: assignmentId } = request.params as { id: string };
  const { answerText } = request.body as { answerText: string };

  if (!answerText?.trim()) return fail(reply, 400, 'Answer text is required');

  const assignment = await request.server.prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) return fail(reply, 404, 'Assignment not found');

  const submission = await request.server.prisma.assignmentSubmission.upsert({
    where: { assignmentId_memberId: { assignmentId, memberId: request.memberId } },
    create: { assignmentId, memberId: request.memberId, answerText: answerText.trim() },
    update: { answerText: answerText.trim(), submittedAt: new Date() },
    select: { id: true, answerText: true, submittedAt: true },
  });

  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!),
    logActivity(request.server.prisma, request.memberId!, 'assignment_submitted', { assignmentId }),
  ]).catch(() => {});

  return ok(reply, submission);
}

// ─── Episodes ─────────────────────────────────────────────────────────────────

export async function getEpisodePlaybackHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const [episode, uiStrings] = await Promise.all([
    request.server.prisma.workshopEpisode.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        bunnyVideoId: true,
        durationSeconds: true,
        progress: {
          where: { memberId: request.memberId },
          select: { lastWatchedSecs: true, isCompleted: true },
        },
      },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!episode) return fail(reply, 404, 'Episode not found');

  let duration = episode.durationSeconds;

  // Task 1: Verify video duration. Fetch from Bunny if missing.
  if ((!duration || duration <= 0) && episode.bunnyVideoId && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_LIBRARY_ID) {
    try {
      const bunnyRes = await fetch(
        `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${episode.bunnyVideoId}`,
        { headers: { AccessKey: env.BUNNY_STREAM_API_KEY } }
      );
      if (bunnyRes.ok) {
        const bunnyData = (await bunnyRes.json()) as { length: number };
        if (bunnyData.length > 0) {
          duration = bunnyData.length;
          // Update DB for future requests
          await request.server.prisma.workshopEpisode.update({
            where: { id: episode.id },
            data: { durationSeconds: duration },
          }).catch(() => {});
        }
      }
    } catch (err) {
      request.server.log.error(`Bunny duration fetch failed for ${episode.bunnyVideoId}: ${err}`);
    }
  }

  const prog = (episode as any).progress?.[0];

  return ok(reply, {
    id: episode.id,
    title: episode.title,
    description: episode.description ?? null,
    videoUrl: episode.videoUrl ?? null,
    videoType: 'iframe',
    durationSeconds: duration ?? null,
    resumeAtSeconds: prog?.lastWatchedSecs ?? 0,
    qualityOptions: ['auto'],
    defaultQuality: 'auto',
    speedOptions: ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'],
    defaultSpeed: '1x',
    playerLabels: {
      completeLabel: uiStrings?.episodeCompleteLabel ?? 'Mark Complete',
      backLabel: uiStrings?.watchBackLabel ?? 'Back',
      autoLabel: uiStrings?.playerAutoLabel ?? 'Auto',
      fullscreenLabel: 'Fullscreen',
    },
  });
}

export async function postEpisodeProgressHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: episodeId } = request.params as { id: string };
  const { watchedSeconds, deltaSeconds } = request.body as {
    watchedSeconds?: number;
    deltaSeconds?: number;
  };

  const safeDelta = Math.min(deltaSeconds ?? 0, 30);
  const deviceId = request.headers['x-device-id'] as string | undefined;

  const episode = await request.server.prisma.workshopEpisode.findUnique({
    where: { id: episodeId },
    select: { durationSeconds: true, bunnyVideoId: true }
  });
  if (!episode) return fail(reply, 404, 'Episode not found');

  const existingProgress = await request.server.prisma.memberEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    select: { lastWatchedSecs: true, actualWatchedSecs: true, isCompleted: true, updatedAt: true }
  });

  // Wall-clock-based delta validation: cap credit to actual time elapsed since last heartbeat.
  // This prevents rapid-fire API spam from accumulating watch time faster than real-time.
  // +1s tolerance handles normal network/timer jitter; first-ever heartbeat trusts the claimed delta.
  const now = new Date();
  const wallClockElapsed = existingProgress?.updatedAt
    ? Math.floor((now.getTime() - existingProgress.updatedAt.getTime()) / 1000)
    : null;
  const trueDelta = wallClockElapsed !== null
    ? Math.min(safeDelta, Math.max(0, wallClockElapsed + 1))
    : safeDelta;

  // Log excessive skipping if the playhead jumped forward significantly without actual watch time
  const isLargeSkip =
    watchedSeconds !== undefined &&
    existingProgress?.lastWatchedSecs !== undefined &&
    watchedSeconds - existingProgress.lastWatchedSecs > (trueDelta + 300);

  if (isLargeSkip) {
    await request.server.prisma.securityLog.create({
      data: {
        memberId: request.memberId,
        eventType: 'EXCESSIVE_SKIPPING',
        metadata: {
          episodeId,
          type: 'workshop',
          fromSecs: existingProgress!.lastWatchedSecs,
          toSecs: watchedSeconds,
          reportedDelta: deltaSeconds,
          trueDelta,
          wallClockElapsed,
        }
      } as any
    }).catch(() => {});
  }

  // Update session last active time
  if (deviceId) {
    await request.server.prisma.memberSession.updateMany({
      where: { memberId: request.memberId, deviceId },
      data: { lastActiveAt: new Date() }
    }).catch(() => {});
  }

  // Task 1: Verify video duration. Fetch from Bunny if missing in DB.
  let duration = episode.durationSeconds;
  if ((!duration || duration <= 0) && episode.bunnyVideoId && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_LIBRARY_ID) {
    try {
      const bunnyRes = await fetch(
        `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${episode.bunnyVideoId}`,
        { headers: { AccessKey: env.BUNNY_STREAM_API_KEY } }
      );
      if (bunnyRes.ok) {
        const bunnyData = (await bunnyRes.json()) as { length: number };
        if (bunnyData.length > 0) {
          duration = bunnyData.length;
          await request.server.prisma.workshopEpisode.update({
            where: { id: episodeId },
            data: { durationSeconds: duration }
          }).catch(() => {});
        }
      }
    } catch {}
  }

  // Task 3: Backend decides completion based on 85% rule using wall-clock-validated delta.
  const newActualWatched = (existingProgress?.actualWatchedSecs ?? 0) + trueDelta;
  let isCompleted = existingProgress?.isCompleted ?? false;

  if (!isCompleted && duration && duration > 0) {
    if (newActualWatched >= duration * 0.85) {
      isCompleted = true;
    }
  }

  await request.server.prisma.memberEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    create: {
      memberId: request.memberId,
      episodeId,
      lastWatchedSecs: watchedSeconds ?? 0,
      actualWatchedSecs: trueDelta,
      isCompleted: isCompleted,
      completedAt: isCompleted ? new Date() : null,
    },
    update: {
      lastWatchedSecs: watchedSeconds ?? undefined,
      actualWatchedSecs: { increment: trueDelta },
      isCompleted: isCompleted,
      completedAt: isCompleted && !existingProgress?.isCompleted ? new Date() : undefined,
    },
  });

  // Fire-and-forget anomaly detection (never blocks the response)
  void (async () => {
    const prisma = request.server.prisma;
    const mId = request.memberId!;

    // Detection: rapid episode switching — ≥5 distinct episodes updated in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await prisma.memberEpisodeProgress.count({
      where: { memberId: mId, updatedAt: { gt: fiveMinAgo } },
    }).catch(() => 0);
    if (recentCount >= 5) {
      await (prisma.securityLog.create as any)({
        data: {
          memberId: mId,
          eventType: 'RAPID_EPISODE_SWITCHING',
          metadata: { episodeCount: recentCount, windowMinutes: 5, episodeId, deviceId: deviceId ?? null },
        },
      }).catch(() => {});
    }

    // Detection: abnormal progress speed — claimed 15s credit but wall clock says <5s elapsed
    if (wallClockElapsed !== null && wallClockElapsed < 5 && safeDelta >= 15) {
      await (prisma.securityLog.create as any)({
        data: {
          memberId: mId,
          eventType: 'ABNORMAL_PROGRESS_SPEED',
          metadata: { episodeId, reportedDelta: deltaSeconds, safeDelta, trueDelta, wallClockElapsed, deviceId: deviceId ?? null },
        },
      }).catch(() => {});
    }
  })().catch(() => {});

  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!),
    logActivity(request.server.prisma, request.memberId!, isCompleted && !existingProgress?.isCompleted ? 'episode_completed' : 'episode_watched', { episodeId }),
  ]).catch(() => {});

  return ok(reply, { updated: true, isCompleted, actualWatchedSecs: newActualWatched });
}

// ─── Products & Resources ─────────────────────────────────────────────────────

export async function getUserProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const [pageConfig, products] = await Promise.all([
    request.server.prisma.productsPageConfig.findFirst(),
    request.server.prisma.product.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
      include: { ctas: { orderBy: { order: 'asc' } } },
    }),
  ]);

  return ok(reply, {
    pageTitle: pageConfig?.pageTitle ?? 'Products',
    pageBg: pageConfig?.pageBg ?? '',
    products: products.map((p) => ({
      id: p.id,
      order: p.order,
      title: p.title,
      description: p.description ?? null,
      thumbnailUrl: p.thumbnailUrl ?? null,
      isVisible: p.isVisible,
      ctas: p.ctas.map((c) => ({
        label: c.label,
        url: c.url,
        type: c.type,
        openInNewTab: c.openInNewTab,
      })),
    })),
  });
}

export async function getUserResourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { search, view = 'list', page = 1, limit = 20 } = request.query as {
    search?: string;
    view?: string;
    page?: number;
    limit?: number;
  };

  const [pageConfig, resources, total] = await Promise.all([
    request.server.prisma.resourcesPageConfig.findFirst(),
    request.server.prisma.appResource.findMany({
      where: {
        isVisible: true,
        ...(search?.trim()
          ? { title: { contains: search.trim(), mode: 'insensitive' } }
          : {}),
      },
      orderBy: { order: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.appResource.count({
      where: {
        isVisible: true,
        ...(search?.trim()
          ? { title: { contains: search.trim(), mode: 'insensitive' } }
          : {}),
      },
    }),
  ]);

  return ok(reply, {
    pageTitle: pageConfig?.pageTitle ?? 'Resources',
    searchPlaceholder: pageConfig?.searchPlaceholder ?? 'Search resources...',
    totalCount: total,
    totalLabel: 'resources',
    viewOptions: ['list', 'grid'],
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      author: r.author ?? null,
      date: r.date ? r.date.toISOString().split('T')[0] : null,
      fileUrl: r.fileUrl,
      previewUrl: r.previewUrl ?? null,
      fileType: r.fileType,
      fileTypeIconUrl: r.fileTypeIconUrl ?? null,
      fileCount: r.fileCount,
      order: r.order,
      isVisible: r.isVisible,
      hoverActions: [
        { type: 'preview', iconType: 'eye', label: r.previewLabel },
        { type: 'download', iconType: 'download', label: r.downloadLabel },
      ],
    })),
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
}

// ─── Conversations (live chat) ────────────────────────────────────────────────

export async function startConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { subject, body } = request.body as { subject: string; body: string };
  const memberId = request.memberId!;

  const conversation = await request.server.prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.create({
      data: { memberId, subject, adminUnreadCount: 1, lastMessageAt: new Date() },
    });
    await tx.directMessage.create({
      data: { conversationId: convo.id, memberId, senderId: memberId, senderType: 'member', body },
    });
    return convo;
  });

  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true },
  });
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'A member';

  request.server.io.to('admin').emit('chat:conversation_new', {
    conversationId: conversation.id,
    memberName,
    subject,
  });

  return reply.status(201).send({ success: true, data: { id: conversation.id }, error: null });
}

export async function getConversationUnreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const count = await request.server.prisma.conversation.count({
    where: { memberId, memberUnreadCount: { gt: 0 }, memberHidden: false },
  });
  return ok(reply, { count });
}

export async function listMemberConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;

  const conversations = await request.server.prisma.conversation.findMany({
    where: { memberId, memberHidden: false },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, senderType: true, createdAt: true },
      },
    },
  });

  return ok(reply, conversations.map((c) => ({
    id:                c.id,
    subject:           c.subject,
    status:            c.status,
    memberUnreadCount: c.memberUnreadCount,
    lastMessageAt:     c.lastMessageAt,
    lastMessage:       c.messages[0] ?? null,
  })));
}

export async function archiveConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };
  const { hidden } = request.body as { hidden: boolean };
  const convo = await request.server.prisma.conversation.findFirst({ where: { id, memberId } });
  if (!convo) return fail(reply, 404, 'Conversation not found');
  await request.server.prisma.conversation.update({ where: { id }, data: { memberHidden: hidden } });
  return ok(reply, { id, hidden });
}

export async function getMemberConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };
  const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, memberId } });
  if (!convo) return fail(reply, 404, 'Conversation not found');

  await request.server.prisma.conversation.update({ where: { id }, data: { memberUnreadCount: 0 } });

  const [total, messages] = await Promise.all([
    request.server.prisma.directMessage.count({ where: { conversationId: id } }),
    request.server.prisma.directMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);

  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const [admins, memberProfile] = await Promise.all([
    adminIds.length > 0
      ? request.server.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true, profilePhotoUrl: true },
        })
      : Promise.resolve([]),
    request.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { firstName: true, lastName: true, profilePhotoUrl: true },
    }),
  ]);
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));
  const memberName = `${memberProfile?.firstName ?? ''} ${memberProfile?.lastName ?? ''}`.trim() || 'You';

  const data = messages.map((m) => {
    const admin = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      senderType:      m.senderType,
      senderId:        m.senderId,
      senderName:      m.senderType === 'member' ? memberName : (admin?.fullName ?? 'TBT Team'),
      senderAvatarUrl: m.senderType === 'member'
        ? (memberProfile?.profilePhotoUrl ?? null)
        : (admin?.profilePhotoUrl ?? null),
      body:            m.body,
      createdAt:       m.createdAt,
    };
  });

  return ok(reply, data, { conversationId: id, status: convo.status, subject: convo.subject, total: Number(total), page: Number(page), limit: Number(limit) });
}

export async function sendMemberChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };
  const { body } = request.body as { body: string };

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, memberId } });
  if (!convo) return fail(reply, 404, 'Conversation not found');

  const wasReopened = convo.status === 'closed';

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: { conversationId: id, memberId, senderId: memberId, senderType: 'member', body },
    });
    await tx.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        adminUnreadCount: { increment: 1 },
        ...(wasReopened && { status: 'open' }),
      },
    });
    return msg;
  });

  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true },
  });
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member';

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id,
    message: {
      id:         message.id,
      senderId:   memberId,
      senderType: 'member',
      senderName: memberName,
      body,
      createdAt:  message.createdAt,
    },
  });

  if (wasReopened) {
    request.server.io.to(`conversation:${id}`).emit('chat:conversation_reopened', { conversationId: id });
    request.server.io.to('admin').emit('chat:conversation_new', { conversationId: id, memberName, subject: convo.subject, reopened: true });
  }

  request.server.io.to('admin').emit('chat:unread_ping', { conversationId: id });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}

// ─── Profile — Avatar + Device Revoke + Notification Prefs ───────────────────

export async function updateAvatarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { avatarUrl } = request.body as { avatarUrl: string };
  if (!avatarUrl) return fail(reply, 400, 'avatarUrl is required');
  await request.server.prisma.member.update({
    where: { id: request.memberId },
    data: { profilePhotoUrl: avatarUrl },
  });
  return ok(reply, { avatarUrl });
}

export async function avatarPresignHandler(request: FastifyRequest, reply: FastifyReply) {
  const { filename, contentType } = request.body as { filename: string; contentType: string };
  if (!filename || !contentType) return fail(reply, 400, 'filename and contentType are required');
  if (!contentType.startsWith('image/')) return fail(reply, 400, 'Only image uploads allowed');

  const key = `members/photos/${Date.now()}-${filename}`;

  if (!env.CLOUDFLARE_R2_ACCESS_KEY_ID || !env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    try {
      const { data, error } = await (request.server as any).supabase.storage.from('avatars').createSignedUploadUrl(key);
      if (error) throw error;
      const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/avatars/${key}`;
      return ok(reply, { uploadUrl: data.signedUrl, publicUrl });
    } catch (err: any) {
      return fail(reply, 500, err.message || 'Failed to generate upload URL');
    }
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID!, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY! },
  });
  const command = new PutObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET_NAME, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = `https://${env.BUNNY_CDN_URL}/${key}`;
  return ok(reply, { uploadUrl, publicUrl });
}

export async function revokeDeviceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const currentDeviceId = request.headers['x-device-id'] as string | undefined;
  const session = await request.server.prisma.memberSession.findFirst({ where: { id, memberId: request.memberId } });
  if (!session) return fail(reply, 404, 'Device session not found');
  if (currentDeviceId && session.deviceId === currentDeviceId) return fail(reply, 400, 'Cannot revoke current device');
  await request.server.prisma.memberSession.delete({ where: { id } });
  return ok(reply, { revoked: true });
}

export async function getNotificationPrefsHandler(request: FastifyRequest, reply: FastifyReply) {
  const member = await request.server.prisma.member.findUnique({
    where: { id: request.memberId },
    select: { notificationPrefs: true },
  });
  const prefs = (member?.notificationPrefs as any) ?? { email: true, push: true, sms: true };
  return ok(reply, prefs);
}

export async function updateNotificationPrefsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email, push, sms } = request.body as { email?: boolean; push?: boolean; sms?: boolean };
  const current = await request.server.prisma.member.findUnique({
    where: { id: request.memberId },
    select: { notificationPrefs: true },
  });
  const existing = (current?.notificationPrefs as any) ?? { email: true, push: true, sms: true };
  const prefs = { email: email ?? existing.email, push: push ?? existing.push, sms: sms ?? existing.sms };
  await request.server.prisma.member.update({ where: { id: request.memberId }, data: { notificationPrefs: prefs } });
  return ok(reply, prefs);
}

// ─── Workshop Challenges ──────────────────────────────────────────────────────

export async function getWorkshopChallengesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  // Use flow item order so admin drag-and-drop reordering is respected,
  // and live calls are interleaved at the admin-configured position.
  const flowItems = await request.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: workshop.id, type: { in: ['challenge_start', 'live_call'] } },
    orderBy: { order: 'asc' },
    include: {
      challenge: {
        include: {
          episodes: {
            orderBy: { order: 'asc' },
            include: {
              progress: { where: { memberId: request.memberId }, select: { isCompleted: true, lastWatchedSecs: true, actualWatchedSecs: true } },
            },
          },
          memberProgress: {
            where: { memberId: request.memberId },
            select: { status: true, completedAt: true, answersData: true },
          },
        },
      },
      liveCall: true,
    },
  });

  // Pre-compute statuses for challenge items only (live calls don't block progress)
  const challengeFlowItems = (flowItems as any[]).filter(fi => fi.type === 'challenge_start');
  const challengeStatuses: string[] = challengeFlowItems.map(fi => {
    const ch = fi.challenge;
    if (!ch) return 'not_started';
    if (!ch.type || ch.type === 'watch') {
      const total = ch.episodes.length;
      const done = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;
      if (total === 0) return 'not_started';
      if (done >= total) return 'completed';
      if (done > 0) return 'in_progress';
      return 'not_started';
    }
    return ch.memberProgress?.[0]?.status ?? 'not_started';
  });

  const now = new Date();
  let challengeIdx = 0;

  const result = (flowItems as any[]).map(fi => {
    if (fi.type === 'live_call') {
      const lc = fi.liveCall;
      if (!lc) return null;
      const scheduled = lc.scheduledAt ? new Date(lc.scheduledAt) : null;
      // "past" only once the admin explicitly ends the meeting
      const isPast = !!lc.endedAt;
      const unlockAt = scheduled && lc.liveUrlUnlocksMinutesBefore
        ? new Date(scheduled.getTime() - lc.liveUrlUnlocksMinutesBefore * 60 * 1000)
        : null;
      const isUnlocked = !isPast && (unlockAt ? now >= unlockAt : !!lc.liveUrl);
      return {
        id: fi.id,
        type: 'live_call',
        liveCallId: lc.id,
        label: lc.label ?? 'LIVE CALL:',
        labelColor: lc.labelColor ?? '#ff3d8b',
        title: lc.title,
        scheduledAt: lc.scheduledAt?.toISOString() ?? null,
        liveUrl: isUnlocked ? lc.liveUrl : null,
        liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
        facilitatorName: lc.facilitatorName ?? null,
        facilitatorTitle: lc.facilitatorTitle ?? null,
        stayTunedMessage: lc.stayTunedMessage ?? null,
        stayTunedColor: lc.stayTunedColor ?? '#2dd4bf',
        status: isPast ? 'past' : 'upcoming',
        isLocked: false,
        progressPercent: isPast ? 100 : 0,
        numberLabel: null,
        numberColor: null,
        description: null,
        quizData: null,
        episodes: [],
        submission: null,
      };
    }

    // challenge_start
    const ch = fi.challenge;
    if (!ch) return null;
    const idx = challengeIdx++;
    const allPrevCompleted = challengeStatuses.slice(0, idx).every(s => s === 'completed');
    const isLocked = idx > 0 && !allPrevCompleted;
    const rawStatus = challengeStatuses[idx];
    const status = isLocked ? 'locked' : rawStatus;
    const totalEps = ch.episodes.length;
    const doneEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;

    return {
      id: ch.id,
      order: ch.order,
      challengeNumber: ch.challengeNumber,
      numberLabel: ch.numberLabel,
      numberColor: ch.numberColor,
      title: ch.title,
      description: ch.description ?? null,
      type: ch.type ?? 'watch',
      quizData: ch.quizData ?? null,
      status,
      isLocked,
      progressPercent: (!ch.type || ch.type === 'watch')
        ? (totalEps > 0 ? Math.round((doneEps / totalEps) * 100) : 0)
        : rawStatus === 'completed' ? 100 : rawStatus === 'in_progress' ? 30 : 0,
      episodes: (!ch.type || ch.type === 'watch') ? ch.episodes.map((ep: any) => ({
        id: ep.id,
        order: ep.order,
        title: ep.title,
        description: ep.description ?? null,
        typeLabel: ep.typeLabel,
        videoUrl: ep.videoUrl ?? null,
        durationLabel: ep.durationLabel ?? null,
        durationSeconds: ep.durationSeconds ?? null,
        isCompleted: ep.progress?.[0]?.isCompleted ?? false,
        lastWatchedSecs: ep.progress?.[0]?.lastWatchedSecs ?? 0,
        actualWatchedSecs: ep.progress?.[0]?.actualWatchedSecs ?? 0,
      })) : [],
      submission: ch.memberProgress?.[0] ?? null,
    };
  }).filter(Boolean);

  return ok(reply, { challenges: result });
}

// Aggregated endpoint: returns detail + flow + challenges in a single round-trip.
// The workshop page previously made 3 separate requests; this replaces all of them.
export async function getWorkshopOverviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  // Run all three queries in parallel — same logic as the individual handlers.
  const [detailResult, flowResult, challengesResult] = await Promise.all([
    getWorkshopDetailData(request, slug),
    getWorkshopFlowData(request, slug),
    getWorkshopChallengesData(request, slug),
  ]);

  if (!detailResult) return fail(reply, 404, 'Workshop not found');

  return ok(reply, {
    detail: detailResult,
    flow: { flowItems: flowResult },
    challenges: { challenges: challengesResult },
  });
}

// ── Shared helpers for overview (extracted from individual handlers) ─────────

async function getWorkshopDetailData(request: FastifyRequest, slug: string) {
  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      enrollments: { where: { memberId: request.memberId }, select: { status: true } },
      challenges: { select: { id: true, type: true, episodes: { select: { id: true } } }, orderBy: { order: 'asc' } },
      liveCalls: { where: { scheduledAt: { gt: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 1, select: { id: true, scheduledAt: true } },
    },
  });
  if (!workshop) return null;

  const enrollment = (workshop as any).enrollments?.[0];
  const allChallenges: any[] = (workshop as any).challenges ?? [];
  const allEpisodes = allChallenges.flatMap((c: any) => c.episodes ?? []);

  const [episodeProgress, challengeProgressRows] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e: any) => e.id) } },
      select: { episodeId: true, isCompleted: true },
    }),
    (request.server.prisma as any).memberChallengeProgress.findMany({
      where: { memberId: request.memberId, challengeId: { in: allChallenges.map((c: any) => c.id) } },
      select: { challengeId: true, status: true },
    }),
  ]);

  const completedCount = episodeProgress.filter((p: any) => p.isCompleted).length;
  const totalCount = allEpisodes.length;
  const completableChallenges = allChallenges.filter((c: any) => c.type !== 'live_call');
  const challengeProgressMap = new Map((challengeProgressRows as any[]).map((r: any) => [r.challengeId, r.status]));
  const completedEpIds = new Set(episodeProgress.filter((p: any) => p.isCompleted).map((p: any) => p.episodeId));

  let completedChallengeCount = 0;
  for (const ch of completableChallenges) {
    const progressStatus = challengeProgressMap.get(ch.id);
    const epIds: string[] = (ch.episodes ?? []).map((e: any) => e.id);
    const allEpsDone = epIds.length > 0 && epIds.every((id: string) => completedEpIds.has(id));
    const isWatch = !ch.type || ch.type === 'watch';
    if (progressStatus === 'completed' || (isWatch && allEpsDone)) completedChallengeCount++;
  }

  const totalChallenges = completableChallenges.length;
  const videosCompletedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const challengesCompletedPct = totalChallenges > 0 ? Math.round((completedChallengeCount / totalChallenges) * 100) : 100;
  const certEligible = videosCompletedPct === 100 && challengesCompletedPct === 100 && totalCount > 0;
  const hasUpcomingCall = ((workshop as any).liveCalls ?? []).length > 0;

  return {
    id: workshop.id,
    title: workshop.title,
    backLabel: workshop.backLabel,
    backUrl: workshop.backUrl,
    sidebar: { tabs: [
      { id: 'challenges', label: workshop.tabChallengesLabel, order: 1 },
      { id: 'qa', label: workshop.tabQaLabel, order: 2 },
      { id: 'assignment', label: workshop.tabAssignmentLabel, order: 3 },
    ]},
    learningProgress: {
      label: workshop.progressWidgetLabel,
      percentage: challengesCompletedPct,
      completedCount: completedChallengeCount,
      totalCount: totalChallenges,
      milestones: Array.from({ length: workshop.progressMilestoneCount ?? 3 }, (_, i) => ({
        achieved: challengesCompletedPct >= Math.round(((i + 1) / (workshop.progressMilestoneCount ?? 3)) * 100),
      })),
    },
    certificate: { eligible: certEligible, videosCompletedPct, challengesCompletedPct, remainingVideos: totalCount - completedCount, remainingChallenges: totalChallenges - completedChallengeCount },
    workshopFlowLabel: workshop.workshopFlowLabel,
    defaultMainAreaType: hasUpcomingCall ? 'countdown' : null,
    enrollmentStatus: enrollment?.status ?? null,
  };
}

async function getWorkshopFlowData(request: FastifyRequest, slug: string): Promise<any[]> {
  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      flowItems: {
        orderBy: { order: 'asc' },
        include: {
          challenge: { include: { episodes: { orderBy: { order: 'asc' }, include: { progress: { where: { memberId: request.memberId }, select: { isCompleted: true } } } } } },
          liveCall: true,
        },
      },
    },
  });
  if (!workshop) return [];

  return Promise.all(
    (workshop as any).flowItems.map(async (item: any) => {
      if (item.type === 'challenge' && item.challenge) {
        const ch = item.challenge;
        const totalEps = ch.episodes.length;
        const completedEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;
        return {
          id: item.id, order: item.order, type: item.type,
          challengeNumber: ch.challengeNumber ?? null,
          numberLabel: ch.numberLabel ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}:`,
          numberColor: ch.numberColor ?? '#00c4cc', title: ch.title, description: ch.description ?? null,
          progressPercent: totalEps > 0 ? Math.round((completedEps / totalEps) * 100) : 0,
          isExpanded: false,
          episodes: ch.episodes.map((ep: any) => ({
            id: ep.id, order: ep.order, title: ep.title, type: ep.type, typeLabel: ep.typeLabel,
            durationSeconds: ep.durationSeconds ?? null, durationLabel: ep.durationLabel ?? null,
            isCompleted: ep.progress?.[0]?.isCompleted ?? false, isLocked: false,
            lockIconType: ep.lockIconType, completedIconType: ep.completedIconType,
          })),
        };
      }
      if ((item.type === 'live_call' || item.type === 'custom') && item.liveCall) {
        const lc = item.liveCall;
        const now = new Date();
        const scheduledAt = new Date(lc.scheduledAt);
        // "past" only once the admin explicitly ends the meeting
        const status = lc.endedAt ? 'past' : 'upcoming';
        return {
          id: item.id, order: item.order, type: 'live_call',
          label: lc.label, labelColor: lc.labelColor, title: lc.title, scheduledAt: lc.scheduledAt, status,
          recordingAvailable: status === 'past' && !!lc.recordingUrl,
          recordingLabel: lc.recordingUrl ? (lc.recordingLabel ?? 'Missed it? View the recording.') : null,
          prerequisiteNote: lc.prerequisiteNote ?? null,
          liveUrl: status === 'upcoming' ? (lc.liveUrl ?? null) : null,
          liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
          facilitatorName: lc.facilitatorName ?? null, facilitatorTitle: lc.facilitatorTitle ?? null,
          facilitatorDescription: lc.facilitatorDescription ?? null,
          countdownConfig: status === 'upcoming' ? { stayTunedMessage: lc.stayTunedMessage, stayTunedColor: lc.stayTunedColor } : null,
          isCompleted: status === 'past',
        };
      }
      return { id: item.id, order: item.order, type: item.type, label: item.label ?? null, description: item.description ?? null, isCompleted: item.isCompleted, isExpanded: false };
    })
  );
}

async function getWorkshopChallengesData(request: FastifyRequest, slug: string): Promise<any[]> {
  const workshop = await request.server.prisma.workshop.findFirst({ where: { slug }, select: { id: true } });
  if (!workshop) return [];

  const flowItems = await request.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: workshop.id, type: { in: ['challenge_start', 'live_call'] } },
    orderBy: { order: 'asc' },
    include: {
      challenge: {
        include: {
          episodes: { orderBy: { order: 'asc' }, include: { progress: { where: { memberId: request.memberId }, select: { isCompleted: true, lastWatchedSecs: true, actualWatchedSecs: true } } } },
          memberProgress: { where: { memberId: request.memberId }, select: { status: true, completedAt: true, answersData: true } },
        },
      },
      liveCall: true,
    },
  });

  const challengeFlowItems = (flowItems as any[]).filter(fi => fi.type === 'challenge_start');
  const challengeStatuses: string[] = challengeFlowItems.map(fi => {
    const ch = fi.challenge;
    if (!ch) return 'not_started';
    if (!ch.type || ch.type === 'watch') {
      const total = ch.episodes.length;
      const done = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;
      if (total === 0) return 'not_started';
      if (done >= total) return 'completed';
      if (done > 0) return 'in_progress';
      return 'not_started';
    }
    return ch.memberProgress?.[0]?.status ?? 'not_started';
  });

  const now = new Date();
  let challengeIdx = 0;

  return (flowItems as any[]).map(fi => {
    if (fi.type === 'live_call') {
      const lc = fi.liveCall;
      if (!lc) return null;
      const scheduled = lc.scheduledAt ? new Date(lc.scheduledAt) : null;
      // "past" only once the admin explicitly ends the meeting
      const isPast = !!lc.endedAt;
      const unlockAt = scheduled && lc.liveUrlUnlocksMinutesBefore ? new Date(scheduled.getTime() - lc.liveUrlUnlocksMinutesBefore * 60 * 1000) : null;
      const isUnlocked = !isPast && (unlockAt ? now >= unlockAt : !!lc.liveUrl);
      return {
        id: fi.id, type: 'live_call', liveCallId: lc.id,
        label: lc.label ?? 'LIVE CALL:', labelColor: lc.labelColor ?? '#ff3d8b', title: lc.title,
        scheduledAt: lc.scheduledAt?.toISOString() ?? null, liveUrl: isUnlocked ? lc.liveUrl : null,
        isUnlocked,
        liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
        facilitatorName: lc.facilitatorName ?? null, facilitatorTitle: lc.facilitatorTitle ?? null,
        facilitatorDescription: lc.facilitatorDescription ?? null,
        recordingUrl: isPast ? (lc.recordingUrl ?? null) : null,
        recordingLabel: isPast && lc.recordingUrl ? (lc.recordingLabel ?? 'Missed it? View the recording.') : null,
        stayTunedMessage: lc.stayTunedMessage ?? null, stayTunedColor: lc.stayTunedColor ?? '#2dd4bf',
        status: isPast ? 'past' : 'upcoming', isLocked: false,
        progressPercent: isPast ? 100 : 0, numberLabel: null,
      };
    }
    const ch = fi.challenge;
    if (!ch) return null;
    const idx = challengeIdx++;
    const allPrevCompleted = challengeStatuses.slice(0, idx).every(s => s === 'completed');
    const isLocked = idx > 0 && !allPrevCompleted;
    const rawStatus = challengeStatuses[idx];
    const status = isLocked ? 'locked' : rawStatus;
    const totalEps = ch.episodes.length;
    const doneEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;
    return {
      id: ch.id, order: ch.order, challengeNumber: ch.challengeNumber,
      numberLabel: ch.numberLabel, numberColor: ch.numberColor,
      title: ch.title, description: ch.description ?? null,
      type: ch.type ?? 'watch', quizData: ch.quizData ?? null,
      status, isLocked,
      progressPercent: (!ch.type || ch.type === 'watch') ? (totalEps > 0 ? Math.round((doneEps / totalEps) * 100) : 0) : rawStatus === 'completed' ? 100 : rawStatus === 'in_progress' ? 30 : 0,
      episodes: (!ch.type || ch.type === 'watch') ? ch.episodes.map((ep: any) => ({
        id: ep.id, order: ep.order, title: ep.title, type: ep.type, typeLabel: ep.typeLabel ?? null,
        durationSeconds: ep.durationSeconds ?? null, durationLabel: ep.durationLabel ?? null,
        isCompleted: ep.progress?.[0]?.isCompleted ?? false,
        lastWatchedSecs: ep.progress?.[0]?.lastWatchedSecs ?? 0,
        actualWatchedSecs: ep.progress?.[0]?.actualWatchedSecs ?? 0,
      })) : [],
      submission: ch.memberProgress?.[0] ?? null,
    };
  }).filter(Boolean);
}

export async function completeChallengeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { answersData } = (request.body as any) ?? {};

  const challenge = await request.server.prisma.challenge.findUnique({
    where: { id },
    select: { id: true, workshopId: true },
  });
  if (!challenge) return fail(reply, 404, 'Challenge not found');

  // Sequential lock check — use WorkshopFlowItem.order (the user-visible sequence)
  // rather than Challenge.order, which can diverge when the flow is manually reordered
  // or when live-call items sit between challenges.
  const currentFlowItem = await request.server.prisma.workshopFlowItem.findFirst({
    where: { challengeId: id },
    select: { order: true, workshopId: true },
  });

  if (currentFlowItem) {
    const prevFlowItems = await request.server.prisma.workshopFlowItem.findMany({
      where: {
        workshopId: currentFlowItem.workshopId,
        order: { lt: currentFlowItem.order },
        challengeId: { not: null },
      },
      select: { challengeId: true },
      orderBy: { order: 'asc' },
    });

    if (prevFlowItems.length > 0) {
      const prevChallengeIds = prevFlowItems.map(fi => fi.challengeId as string);
      const prevChallenges = await request.server.prisma.challenge.findMany({
        where: { id: { in: prevChallengeIds } },
        select: { id: true, type: true },
      });
      // Restore flow order (findMany result order is not guaranteed)
      const orderedPrev = prevFlowItems
        .map(fi => prevChallenges.find(c => c.id === fi.challengeId))
        .filter(Boolean) as { id: string; type: string }[];

      for (const prev of orderedPrev) {
        if (!prev.type || prev.type === 'watch') {
          const epIds = await request.server.prisma.workshopEpisode.findMany({ where: { challengeId: prev.id }, select: { id: true } });
          const doneCount = await request.server.prisma.memberEpisodeProgress.count({ where: { memberId: request.memberId, episodeId: { in: epIds.map(e => e.id) }, isCompleted: true } });
          if (doneCount < epIds.length) return fail(reply, 403, 'Complete previous challenges first');
        } else {
          const prevProgress = await (request.server.prisma as any).memberChallengeProgress.findFirst({
            where: { memberId: request.memberId, challengeId: prev.id, status: 'completed' },
          });
          if (!prevProgress) return fail(reply, 403, 'Complete previous challenges first');
        }
      }
    }
  }

  const now = new Date();
  await (request.server.prisma as any).memberChallengeProgress.upsert({
    where: { memberId_challengeId: { memberId: request.memberId, challengeId: id } },
    create: { memberId: request.memberId, challengeId: id, status: 'completed', completedAt: now, answersData: answersData ?? null },
    update: { status: 'completed', completedAt: now, answersData: answersData ?? null },
  });

  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!),
    logActivity(request.server.prisma, request.memberId!, 'challenge_completed', { challengeId: id }),
  ]).catch(() => {});

  return ok(reply, { status: 'completed', completedAt: now.toISOString() });
}

export async function completeWorkshopEpisodeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const episode = await request.server.prisma.workshopEpisode.findUnique({
    where: { id },
    select: { id: true, durationSeconds: true, bunnyVideoId: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found');

  const progress = await request.server.prisma.memberEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId: id } },
    select: { actualWatchedSecs: true, isCompleted: true }
  });

  if (progress?.isCompleted) {
    return ok(reply, { episodeId: id, isCompleted: true });
  }

  let duration = episode.durationSeconds;

  // Task 1: Fetch duration if missing for validation
  if ((!duration || duration <= 0) && episode.bunnyVideoId && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_LIBRARY_ID) {
    try {
      const bunnyRes = await fetch(
        `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${episode.bunnyVideoId}`,
        { headers: { AccessKey: env.BUNNY_STREAM_API_KEY } }
      );
      if (bunnyRes.ok) {
        const bunnyData = (await bunnyRes.json()) as { length: number };
        if (bunnyData.length > 0) {
          duration = bunnyData.length;
          await request.server.prisma.workshopEpisode.update({
            where: { id: episode.id },
            data: { durationSeconds: duration },
          }).catch(() => {});
        }
      }
    } catch {}
  }

  // Task 3: Backend decides completion based on 85% rule.
  if (duration && duration > 0) {
    const actual = progress?.actualWatchedSecs ?? 0;
    if (actual < duration * 0.85) {
      return fail(reply, 403, 'Watch at least 85% of the video to complete this lesson.');
    }
  }

  const now = new Date();
  await request.server.prisma.memberEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId: id } },
    create: { memberId: request.memberId, episodeId: id, isCompleted: true, completedAt: now, lastWatchedSecs: 0 },
    update: { isCompleted: true, completedAt: now },
  });

  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!),
    logActivity(request.server.prisma, request.memberId!, 'episode_completed', { episodeId: id }),
  ]).catch(() => {});

  return ok(reply, { episodeId: id, isCompleted: true });
}

// ─── Watch History ────────────────────────────────────────────────────────────

export async function getWatchHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, filter = 'all' } = request.query as {
    page?: number; limit?: number; filter?: 'all' | 'in_progress' | 'completed';
  };

  const where = {
    memberId: request.memberId,
    actualWatchedSecs: { gt: 0 },
    ...(filter === 'in_progress' ? { isCompleted: false } : {}),
    ...(filter === 'completed' ? { isCompleted: true } : {}),
  };

  const [history, total] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        actualWatchedSecs: true,
        isCompleted: true,
        completedAt: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            order: true,
            durationSeconds: true,
            challenge: {
              select: {
                title: true,
                _count: { select: { episodes: true } },
                workshop: { select: { title: true, slug: true, thumbnailUrl: true } },
              },
            },
          },
        },
      },
    }),
    request.server.prisma.memberEpisodeProgress.count({ where }),
  ]);

  const pct = (actual: number, duration: number | null | undefined) =>
    duration && duration > 0 ? Math.min(100, Math.round((actual / duration) * 100)) : 0;

  const items = history.map(p => ({
    type: 'workshop' as const,
    episodeId: p.episodeId,
    workshopSlug: p.episode.challenge.workshop.slug,
    workshopTitle: p.episode.challenge.workshop.title,
    challengeTitle: p.episode.challenge.title,
    episodeTitle: p.episode.title,
    thumbnailUrl: p.episode.challenge.workshop.thumbnailUrl ?? null,
    lastWatchedSecs: p.lastWatchedSecs,
    actualWatchedSecs: p.actualWatchedSecs,
    durationSeconds: p.episode.durationSeconds ?? 0,
    isCompleted: p.isCompleted,
    completedAt: p.completedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    progressPercent: pct(p.actualWatchedSecs, p.episode.durationSeconds),
    episodeOrder: p.episode.order,
    episodeCount: p.episode.challenge._count.episodes,
  }));

  return ok(reply, items, { total: Number(total), page: Number(page), limit: Number(limit) });
}

export async function removeFromHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { episodeId } = request.params as { episodeId: string };
  await request.server.prisma.memberEpisodeProgress.deleteMany({
    where: { memberId: request.memberId, episodeId },
  });
  return ok(reply, { removed: true });
}

// ─── Device Tracking ──────────────────────────────────────────────────────────

export async function getMyDevicesHandler(request: FastifyRequest, reply: FastifyReply) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const currentDeviceId = request.headers['x-device-id'] as string | undefined;

  const sessions = await request.server.prisma.memberSession.findMany({
    where: { memberId: request.memberId, lastActiveAt: { gt: thirtyDaysAgo } },
    orderBy: { lastActiveAt: 'desc' },
    select: { id: true, deviceId: true, ipAddress: true, userAgent: true, lastActiveAt: true, startedAt: true },
  });

  const devices = sessions.map((s) => {
    const { browser, os, deviceType } = parseUserAgent(s.userAgent);
    return {
      id: s.id,
      deviceId: s.deviceId ?? null,
      browser,
      os,
      deviceType,
      ipAddress: s.ipAddress ?? null,
      lastActiveAt: s.lastActiveAt.toISOString(),
      startedAt: s.startedAt.toISOString(),
      isCurrent: !!currentDeviceId && s.deviceId === currentDeviceId,
    };
  });

  return ok(reply, devices);
}
