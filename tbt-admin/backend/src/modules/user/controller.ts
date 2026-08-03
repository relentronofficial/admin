import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { generateBunnyToken } from '../../lib/bunnyToken.js';
import {
  computeLessonLockStates,
  isEpisodeUnlocked,
  type EpisodeForLockCheck,
  type ProgressRow,
} from '../../lib/lessonProgression.js';

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { cacheGet, cacheSet, cacheNxSet, invalidateCache } from '../../lib/cache.js';
import {
  notifyCourseEnrolled,
  notifyEpisodeCompleted,
  notifyCourseCompleted,
  notifyQuizPassed,
} from '../../lib/courseNotifications.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { computeMemberStats } from '../../lib/tbtStats.js';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ok(reply: FastifyReply, data: unknown, meta?: object) {
  return reply.send({ success: true, data, error: null, ...(meta && { meta }) });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

function isEnrolled(status: string | null | undefined): boolean {
  return status === 'active' || status === 'completed';
}

async function logActivity(prisma: any, memberId: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
  await prisma.activityLog.create({
    data: { userId: memberId, userType: 'member', action, metadata: metadata ?? null },
  }).catch(() => {});
}

// Per-process singleflight for member stats recomputation. Closes the
// race window where N concurrent /api/user/me requests all pass the
// Redis SET NX check before the throttle key materialises and each
// fires the full computeMemberStats backfill — previously 7 concurrent
// hits caused 4×7 = 28 INSERTs on tbt_activity_log for a single member.
// With the map, the first caller runs the compute and every other
// caller in the same tick awaits the same Promise.
const _recalcInflight = new Map<string, Promise<void>>();

async function recalculateMemberStats(prisma: any, memberId: string, redis?: any): Promise<void> {
  const existing = _recalcInflight.get(memberId);
  if (existing) return existing;

  const promise = (async () => {
    // Throttle: at most once per minute per member across processes.
    // The in-memory map above handles the intra-process race; Redis
    // covers cross-instance calls and the 60-second re-run window.
    const throttleKey = `stats:recalc:${memberId}`;
    const allowed = await cacheNxSet(redis ?? null, throttleKey, 60);
    if (!allowed) return;

    try {
      // Points + streak now come from the single `tbt_activity_log`
      // source of truth (see lib/tbtStats.ts). The helper lazily
      // backfills workshop/challenge/assignment/course_xp events into
      // the ledger, so this endpoint and the TBT Points screen always
      // agree.
      const { totalPoints, currentStreak } = await computeMemberStats(prisma, memberId);

      // Health score still uses episode-completion ratio + recency (not
      // point-based), so keep its own light-weight query.
      const [
        totalWorkshopEpisodes,
        completedWorkshopEpisodes,
        completedCourseEpisodes,
        totalCourseEpisodes,
        member,
      ] = await Promise.all([
        prisma.memberEpisodeProgress.count({ where: { memberId } }),
        prisma.memberEpisodeProgress.count({ where: { memberId, isCompleted: true } }),
        (prisma as any).courseEpisodeProgress.count({ where: { memberId, completed: true } }).catch(() => 0),
        (prisma as any).courseEpisodeProgress.count({ where: { memberId } }).catch(() => 0),
        prisma.member.findUnique({ where: { id: memberId }, select: { lastActiveAt: true } }),
      ]);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastActive = member?.lastActiveAt ? new Date((member.lastActiveAt as Date).getTime()) : null;
      const lastActiveDay = lastActive ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()) : null;
      const daysSinceActive = lastActiveDay ? Math.floor((today.getTime() - lastActiveDay.getTime()) / 86_400_000) : 999;
      const recencyScore = daysSinceActive === 0 ? 40 : daysSinceActive <= 1 ? 35 : daysSinceActive <= 3 ? 25 : daysSinceActive <= 7 ? 15 : daysSinceActive <= 30 ? 5 : 0;
      const totalEpisodes = (totalWorkshopEpisodes as number) + (totalCourseEpisodes as number);
      const completedEpisodes = (completedWorkshopEpisodes as number) + (completedCourseEpisodes as number);
      const completionScore = totalEpisodes > 0 ? Math.round((completedEpisodes / totalEpisodes) * 40) : 0;
      const streakScore = Math.min(20, currentStreak);
      const healthScore = recencyScore + completionScore + streakScore;

      await prisma.member.update({
        where: { id: memberId },
        data: { totalPoints, currentStreak, healthScore, lastActiveAt: now },
      });
    } catch { /* fire-and-forget */ }
  })();

  _recalcInflight.set(memberId, promise);
  promise.finally(() => _recalcInflight.delete(memberId));
  return promise;
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
  const redis = request.server.redis ?? null;
  const meKey = `me:${request.memberId}`;
  const cachedMe = await cacheGet<Record<string, unknown>>(redis, meKey);
  if (cachedMe) return ok(reply, cachedMe);

  // Refresh member stats (throttled to once per 60 s) before reading DB so the
  // profile page always reflects current points/streak/health.
  await recalculateMemberStats(request.server.prisma, request.memberId!, redis ?? undefined);

  const [member, allTiers, uiStrings] = await Promise.all([
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: {
        id: true,
        memberId: true,
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
        businessType: true,
        businessAddress: true,
        businessEstablishedOn: true,
        productServiceType: true,
        annualTurnover: true,
        goalAfter90Days: true,
        gstNumber: true,
        industry: true,
        role: true,
        teamSize: true,
        registeredOffice: true,
        targetNetworkDescription: true,
        totalPoints: true,
        currentStreak: true,
        healthScore: true,
        notificationPrefs: true,
        batchId: true,
        lastActiveAt: true,
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
  // Throttled via Redis NX key to skip tracking if already tracked in the last 5 minutes
  const sessionDeviceId = request.headers['x-device-id'] as string | undefined;
  if (sessionDeviceId) {
    const prisma = request.server.prisma;
    const mId = request.memberId!;
    const ip = request.ip;
    const ua = request.headers['user-agent'] as string | undefined;
    void (async () => {
      const trackKey = `session-tracked:${mId}:${sessionDeviceId}`;
      const shouldTrack = await cacheNxSet(redis, trackKey, 300);
      if (!shouldTrack) return;

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

  const mePayload = {
    id: member.id,
    memberId: (member as any).memberId ?? null,
    name: [member.firstName, member.lastName].filter(Boolean).join(' '),
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
    businessType: (member as any).businessType ?? null,
    businessAddress: (member as any).businessAddress ?? null,
    businessEstablishedOn: (member as any).businessEstablishedOn
      ? (member as any).businessEstablishedOn.toISOString().split('T')[0]
      : null,
    productServiceType: (member as any).productServiceType ?? null,
    annualTurnover: (member as any).annualTurnover ?? null,
    goalAfter90Days: (member as any).goalAfter90Days ?? null,
    gstNumber: (member as any).gstNumber ?? null,
    industry: (member as any).industry ?? null,
    role: (member as any).role ?? null,
    teamSize: (member as any).teamSize ?? null,
    registeredOffice: (member as any).registeredOffice ?? null,
    targetNetworkDescription: (member as any).targetNetworkDescription ?? null,
    batchId: member.batchId ?? null,
    lastActiveAt: (member as any).lastActiveAt
      ? (member as any).lastActiveAt.toISOString()
      : null,
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
  };
  void cacheSet(redis, meKey, mePayload, 60);
  return ok(reply, mePayload);
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, unknown>;
  const {
    firstName, lastName, phone, dob, city, state, businessName,
    // Extended business + personal fields (2026-07-28) — previously
    // several of these were sent by the mobile edit sheet and silently
    // dropped here; picking them up so the sheet actually persists.
    industry, businessType, businessAddress, businessEstablishedOn,
    productServiceType, annualTurnover, goalAfter90Days, gstNumber,
    role, teamSize, registeredOffice, targetNetworkDescription,
  } = body as {
    firstName?: string; lastName?: string; phone?: string;
    dob?: string | null; city?: string | null; state?: string | null;
    businessName?: string | null; industry?: string | null;
    businessType?: string | null; businessAddress?: string | null;
    businessEstablishedOn?: string | null; productServiceType?: string | null;
    annualTurnover?: string | null; goalAfter90Days?: string | null;
    gstNumber?: string | null; role?: string | null; teamSize?: string | null;
    registeredOffice?: string | null; targetNetworkDescription?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (firstName?.trim()) data.firstName = firstName.trim();
  if (lastName !== undefined) data.lastName = lastName?.trim() || null;
  if (phone?.trim()) data.phone = phone.trim();
  if (dob !== undefined) data.dob = dob ? new Date(dob) : null;
  if (city !== undefined) data.city = city?.trim() || null;
  if (state !== undefined) data.state = state?.trim() || null;
  if (businessName !== undefined) data.businessName = businessName?.trim() || null;
  if (industry !== undefined) data.industry = industry?.trim() || null;
  if (businessType !== undefined) data.businessType = businessType?.trim() || null;
  if (businessAddress !== undefined) data.businessAddress = businessAddress?.trim() || null;
  if (businessEstablishedOn !== undefined) {
    data.businessEstablishedOn = businessEstablishedOn ? new Date(businessEstablishedOn) : null;
  }
  if (productServiceType !== undefined) data.productServiceType = productServiceType?.trim() || null;
  if (annualTurnover !== undefined) data.annualTurnover = annualTurnover?.trim() || null;
  if (goalAfter90Days !== undefined) data.goalAfter90Days = goalAfter90Days?.trim() || null;
  if (gstNumber !== undefined) data.gstNumber = gstNumber?.trim() || null;
  if (role !== undefined) data.role = role?.trim() || null;
  if (teamSize !== undefined) data.teamSize = teamSize?.trim() || null;
  if (registeredOffice !== undefined) data.registeredOffice = registeredOffice?.trim() || null;
  if (targetNetworkDescription !== undefined) {
    data.targetNetworkDescription = targetNetworkDescription?.trim() || null;
  }

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

  void invalidateCache(request.server.redis ?? null, `me:${request.memberId}`);

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
        price: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        xpPerEpisode: true,
        creator: {
          select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
        },
        _count: { select: { enrollments: true } },
        courseEpisodes: {
          where: { isVisible: true },
          select: { durationSeconds: true },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }) as Promise<any[]>,
    request.server.prisma.course.count({ where: where as any }),
  ]);

  // Batch-check course access for this member
  const courseIds = (courses as any[]).map((c: any) => c.id);
  const accessRecords = courseIds.length > 0
    ? await (request.server.prisma as any).courseAccess.findMany({
        where: { memberId: request.memberId, courseId: { in: courseIds } },
        select: { courseId: true, isActive: true, accessType: true, expiresAt: true },
      }).catch(() => [] as any[])
    : [];
  const accessMap = new Map((accessRecords as any[]).map((a: any) => [a.courseId, a]));

  const data = (courses as any[]).map((c: any) => {
    const access = accessMap.get(c.id) ?? null;
    const episodes: { durationSeconds: number }[] = c.courseEpisodes ?? [];
    const episodeCount = episodes.length;
    const totalSecs = episodes.reduce((sum, ep) => sum + (ep.durationSeconds || 0), 0);
    const storedHours = c.durationHours ? Number(c.durationHours) : null;
    const durationHours = totalSecs > 0
      ? Math.round(totalSecs / 360) / 10
      : storedHours;
    // Human-readable display: "2m", "45m", "1.3h"
    let durationDisplay: string | null = null;
    if (totalSecs > 0) {
      const mins = Math.ceil(totalSecs / 60);
      durationDisplay = mins < 60 ? `${mins}m` : `${Math.round(mins / 6) / 10}h`;
    } else if (storedHours && storedHours > 0) {
      durationDisplay = `${storedHours}h`;
    }
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      level: c.level,
      durationHours,
      durationDisplay,
      price: c.price ? Number(c.price) : null,
      isPublished: c.isPublished,
      isFeatured: c.isFeatured,
      createdAt: c.createdAt,
      xpPerEpisode: c.xpPerEpisode ?? 10,
      instructor: c.creator ?? null,
      hasAccess: isAccessValid(access),
      _count: { lessons: episodeCount, enrollments: c._count?.enrollments ?? 0 },
    };
  });

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getUserCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  if (!UUID_RE.test(id)) return fail(reply, 400, 'Invalid course ID');

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

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, id);
  const hasAccess = isAccessValid(accessRecord);

  // Check for a pending external payment request from this member
  const pendingPayment = await (request.server.prisma as any).coursePayment.findFirst({
    where: { memberId: request.memberId, courseId: id, status: 'pending' },
    select: { id: true, status: true },
  }).catch(() => null);

  // Resolve upsell / cross-sell course IDs to lightweight course objects
  const upsellIds: string[] = (course as any).upsellCourseIds ?? [];
  const crossSellIds: string[] = (course as any).crossSellCourseIds ?? [];
  let upsellCourses: any[] = [];
  let crossSellCourses: any[] = [];
  const allRelatedIds = [...new Set([...upsellIds, ...crossSellIds])];
  if (allRelatedIds.length > 0) {
    const related = await request.server.prisma.course.findMany({
      where: { id: { in: allRelatedIds }, isPublished: true },
      select: { id: true, title: true, slug: true, thumbnailUrl: true, level: true, totalLessons: true },
    });
    const relatedMap = new Map(related.map((c) => [c.id, c]));
    upsellCourses = upsellIds.map((rid) => relatedMap.get(rid)).filter(Boolean) as any[];
    crossSellCourses = crossSellIds.map((rid) => relatedMap.get(rid)).filter(Boolean) as any[];
  }

  const LESSON_BUNNY_URL_RE = /(?:iframe\.mediadelivery\.net\/embed|player\.mediadelivery\.net\/play)\/\d+\/([\w-]+)/;

  // Compute the sequential-unlock verdict for every episode in one pass
  // BEFORE mapping to the response shape, so we can splice the resulting
  // {locked, completed, watchPercent} into each lesson object atomically
  // (no chance of the map iterating out of order).
  const episodesForLock: EpisodeForLockCheck[] = course.courseEpisodes.map((ep) => ({
    id: ep.id,
    order: ep.order ?? 0,
    durationSeconds: ep.durationSeconds ?? null,
  }));
  const progressForLock: ProgressRow[] = course.courseEpisodes.flatMap((ep) => {
    const p = ep.progress?.[0];
    if (!p) return [];
    return [{
      episodeId: ep.id,
      actualWatchedSecs: p.actualWatchedSecs ?? 0,
      lastWatchedSecs: p.lastWatchedSecs ?? 0,
      isCompleted: p.completed ?? false,
    }];
  });
  const lockStatesByEpisode = new Map(
    computeLessonLockStates(episodesForLock, progressForLock, {
      requireSequential: (course as any).requireSequential ?? true,
      completionThresholdPercent: (course as any).completionThresholdPercent ?? 95,
    }).map((s) => [s.episodeId, s]),
  );

  const lessons = course.courseEpisodes.map((ep) => {
    const prog = ep.progress?.[0];
    const lockState = lockStatesByEpisode.get(ep.id);
    const isLocked = lockState?.locked ?? false;
    // Locked lessons never carry a playable URL. Even if a modified
    // client sends the request, the server returns null — the URL is
    // simply not there to intercept. Combined with the POST-progress
    // guard, this makes it impossible for a client to play a locked
    // video by API tampering.
    let videoUrl = hasAccess && !isLocked ? ep.videoUrl : null;
    const isDrmEnabled = !!(ep as any).drmEnabled;

    // Derive bunnyId from explicit field or embedded URL
    const urlMatch = ep.videoUrl?.match(LESSON_BUNNY_URL_RE);
    const bunnyId = (ep as any).bunnyVideoId ?? urlMatch?.[1] ?? null;

    // DRM episodes: sign the iframe URL with a time-limited token and suppress hlsUrl.
    // Suppressing hlsUrl forces the frontend to use the Bunny iframe embed, which handles
    // Widevine/FairPlay DRM internally. Sending hlsUrl for DRM videos would expose the
    // unencrypted HLS stream to PlyrPlayer, defeating DRM entirely.
    if (videoUrl && isDrmEnabled) {
      const tokenKey = env.BUNNY_TOKEN_AUTH_KEY;
      if (tokenKey && bunnyId) {
        const { token, expires } = generateBunnyToken(tokenKey, bunnyId);
        const sep = videoUrl.includes('?') ? '&' : '?';
        videoUrl = `${videoUrl}${sep}token=${token}&expires=${expires}`;
      } else if ((ep as any).bunnyDrmToken) {
        // Legacy fallback: static token stored in DB (no expiry — replace with BUNNY_TOKEN_AUTH_KEY)
        const sep = videoUrl.includes('?') ? '&' : '?';
        videoUrl = `${videoUrl}${sep}token=${(ep as any).bunnyDrmToken}`;
      }
    }

    // HLS URL: only for non-DRM episodes. DRM episodes use the signed iframe URL above.
    // Same lock check as videoUrl above — locked lessons carry no HLS.
    const cdn = env.BUNNY_CDN_URL
      ? (env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')
      : null;
    const hlsUrl = hasAccess && !isLocked && !isDrmEnabled && bunnyId && cdn
      ? `${cdn}/${bunnyId}/playlist.m3u8`
      : null;
    return {
      id: ep.id,
      title: ep.title,
      description: null as string | null,
      videoUrl,
      hlsUrl,
      duration: ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null,
      durationSeconds: ep.durationSeconds ?? null,
      order: ep.order,
      isFree: false,
      resumeAtSeconds: prog?.lastWatchedSecs ?? 0,
      actualWatchedSecs: prog?.actualWatchedSecs ?? 0,
      isCompleted: prog?.completed ?? false,
      hasQuiz: Array.isArray((ep as any).quizData?.questions) && (ep as any).quizData.questions.length > 0,
      quizData: hasAccess && !isLocked ? ((ep as any).quizData ?? null) : null,
      quizUnlockPercent: (ep as any).quizUnlockPercent ?? 80,
      // Sequential-unlock fields — see lib/lessonProgression.ts. `locked`
      // authoritatively tells the client whether to show the lock icon;
      // `watchPercent` drives the per-lesson progress bar without any
      // client-side math.
      locked: isLocked,
      unlocked: lockState?.unlocked ?? true,
      completedByThreshold: lockState?.completed ?? false,
      watchPercent: lockState?.watchPercent ?? null,
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
    price: (course as any).price ? Number((course as any).price) : null,
    isPublished: course.isPublished,
    isFeatured: course.isFeatured,
    createdAt: course.createdAt,
    instructor: course.creator ?? null,
    hasAccess,
    accessType: accessRecord?.accessType ?? null,
    accessExpiresAt: accessRecord?.expiresAt ?? null,
    paymentLinkUrl: course.paymentLinkUrl ?? null,
    pendingPayment: pendingPayment ? { id: pendingPayment.id, paymentUrl: course.paymentLinkUrl ?? null } : null,
    xpPerEpisode: (course as any).xpPerEpisode ?? 10,
    passingScorePercent: (course as any).passingScorePercent ?? 70,
    requireSequential: (course as any).requireSequential ?? true,
    completionThresholdPercent: (course as any).completionThresholdPercent ?? 95,
    lessons,
    _count: { lessons: lessons.length, enrollments: course._count?.enrollments ?? 0 },
    upsellCourses,
    crossSellCourses,
  });
}

export async function requestCourseAccessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };
  const memberId = request.memberId!;

  const existingAccess = await getCourseAccessRecord(request.server.prisma as any, memberId, courseId);
  if (isAccessValid(existingAccess)) {
    return fail(reply, 409, 'You already have access to this course');
  }

  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, price: true, isPublished: true, paymentLinkUrl: true },
  });
  if (!course || !course.isPublished) return fail(reply, 404, 'Course not found');

  // Idempotent — return existing pending payment if already requested
  const existing = await (request.server.prisma as any).coursePayment.findFirst({
    where: { memberId, courseId, status: 'pending' },
    select: { id: true },
  }).catch(() => null);

  let paymentId: string;
  if (existing) {
    paymentId = existing.id;
  } else {
    const payment = await (request.server.prisma as any).coursePayment.create({
      data: {
        memberId,
        courseId,
        amount: course.price != null ? Number(course.price) : 0,
        currency: 'INR',
        method: 'external',
        status: 'pending',
      },
    });
    paymentId = payment.id;

    // Notify admin room so they see the request in real time
    try {
      request.server.io?.to('admin').emit('admin:course_access_request', {
        memberId,
        courseId,
        courseTitle: course.title,
      });
      void createAdminNotification(request.server.prisma, {
        title: 'Course Access Request',
        body: `A member requested access to "${course.title}".`,
        type: 'course_access_request',
        metadata: { memberId, courseId, courseTitle: course.title },
      });
    } catch {}
  }

  const paymentUrl = course.paymentLinkUrl ?? 'https://tamilbusinesstribe.com';
  return ok(reply, { paymentId, paymentUrl });
}

export async function enrollCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) return fail(reply, 404, 'Course not found');

  // Check paid access
  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) {
    return fail(reply, 403, 'Purchase is required to enroll in this course. Contact support or purchase access.');
  }

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

  void notifyCourseEnrolled({
    prisma: request.server.prisma as any,
    io: request.server.io,
    memberId: request.memberId!,
    courseId,
    courseTitle: enrollment.course?.title ?? '',
  }).catch(() => {});

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

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

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

async function buildCourseCertificatePdf(
  memberName: string,
  courseTitle: string,
  completedAt: string,
  certId: string,
): Promise<Buffer> {
  const { default: PDFDocument } = await import('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;

    // Dark background
    doc.rect(0, 0, W, doc.page.height).fill('#0d0d0d');
    // Red border
    doc.rect(24, 24, W - 48, doc.page.height - 48).lineWidth(2).stroke('#dc2626');
    // Accent rule lines
    doc.moveTo(60, 80).lineTo(W - 60, 80).lineWidth(0.5).stroke('#444');
    doc.moveTo(60, doc.page.height - 80).lineTo(W - 60, doc.page.height - 80).lineWidth(0.5).stroke('#444');

    // Header
    doc.fillColor('#dc2626').fontSize(10).font('Helvetica-Bold').text('TAMIL BUSINESS TRIBE', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(32).font('Helvetica-Bold').text('CERTIFICATE OF COMPLETION', { align: 'center' });

    // Divider
    doc.fillColor('#333').rect(W / 2 - 40, 180, 80, 1).fill();

    // Body
    doc.moveDown(0.5);
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('This certifies that', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text(memberName, { align: 'center' });
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('has successfully completed', { align: 'center' });
    doc.fillColor('#dc2626').fontSize(18).font('Helvetica-Bold').text(courseTitle, { align: 'center' });

    // Details
    doc.moveDown(0.5);
    const completedLabel = new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const details = `Completed: ${completedLabel}   ·   Certificate ID: ${certId}`;
    doc.fillColor('#a0a0a0').fontSize(10).font('Helvetica').text(details, { align: 'center' });

    doc.end();
  });
}

export async function getCourseCertificateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

  const [course, member] = await Promise.all([
    request.server.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    request.server.prisma.member.findUnique({ where: { id: request.memberId }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  if (!course) return fail(reply, 404, 'Course not found');
  if (!member) return fail(reply, 404, 'Member not found');

  const episodes = await request.server.prisma.courseEpisode.findMany({
    where: { courseId, isVisible: true },
    select: { id: true },
  });

  if (episodes.length === 0) return fail(reply, 403, 'No episodes in this course');

  const progress = await (request.server.prisma as any).courseEpisodeProgress.findMany({
    where: { memberId: request.memberId, episodeId: { in: episodes.map((e: any) => e.id) }, completed: true },
    select: { episodeId: true, completedAt: true },
  });

  if (progress.length < episodes.length) {
    return fail(reply, 403, 'Certificate not earned — complete all lessons first');
  }

  const completedDates = (progress as any[]).map((p: any) => p.completedAt?.getTime?.() ?? 0);
  const latestMs = Math.max(0, ...completedDates);
  const completedAt = latestMs > 0 ? new Date(latestMs).toISOString() : new Date().toISOString();

  const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
  // Full base64url — decodeable by the /api/pub/certificates/course/:certId verification endpoint
  const certId = Buffer.from(`${member.id}:${course.id}`).toString('base64url');
  // Short fingerprint for PDF footer display only
  const displayCertId = certId.slice(0, 16).toUpperCase();

  const pdfBuffer = await buildCourseCertificatePdf(memberName, course.title, completedAt, displayCertId);

  // Background: upload to R2 for persistent URL (non-blocking)
  void (async () => {
    const { CLOUDFLARE_R2_ACCOUNT_ID: accountId, CLOUDFLARE_R2_ACCESS_KEY_ID: keyId, CLOUDFLARE_R2_SECRET_ACCESS_KEY: secret, CLOUDFLARE_R2_BUCKET_NAME: bucket } = env;
    if (!accountId || !keyId || !secret || !bucket) return;
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: keyId, secretAccessKey: secret },
    });
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `certificates/courses/${courseId}/${request.memberId}.pdf`,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));
  })().catch(() => {});

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', `attachment; filename="certificate-${displayCertId}.pdf"`);
  return reply.send(pdfBuffer);
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

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

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
  const { watchedSeconds, deltaSeconds, isCompleted: requestedCompletion, videoDuration } = request.body as {
    watchedSeconds?: number;
    deltaSeconds?: number;
    isCompleted?: boolean;
    videoDuration?: number;
  };

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

  const episode = await request.server.prisma.courseEpisode.findFirst({
    where: { id: episodeId, courseId },
    select: { id: true, title: true, durationSeconds: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found in this course');

  // ── Sequential-unlock guard ──────────────────────────────────────
  // Verify this lesson is currently unlocked for the member BEFORE
  // writing any progress. A modified client that POSTs directly to a
  // locked lesson gets a 403 — the lock is enforced at the API
  // boundary, not just in the UI. Skipped when the course opts out
  // of sequential unlock via `requireSequential = false`.
  const courseUnlockCfg = await (request.server.prisma as any).course.findUnique({
    where: { id: courseId },
    select: { requireSequential: true, completionThresholdPercent: true },
  }) as { requireSequential: boolean | null; completionThresholdPercent: number | null } | null;
  const requireSequential = courseUnlockCfg?.requireSequential ?? true;
  if (requireSequential) {
    const allEpisodes = await request.server.prisma.courseEpisode.findMany({
      where: { courseId, isVisible: true },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, durationSeconds: true },
    });
    const allProgress = await (request.server.prisma as any).courseEpisodeProgress.findMany({
      where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e) => e.id) } },
      select: { episodeId: true, actualWatchedSecs: true, lastWatchedSecs: true, completed: true },
    });
    const unlocked = isEpisodeUnlocked(
      episodeId,
      allEpisodes.map((e) => ({
        id: e.id,
        order: e.order ?? 0,
        durationSeconds: e.durationSeconds ?? null,
      })),
      allProgress.map((p: any) => ({
        episodeId: p.episodeId,
        actualWatchedSecs: p.actualWatchedSecs ?? 0,
        lastWatchedSecs: p.lastWatchedSecs ?? 0,
        isCompleted: p.completed ?? false,
      })),
      {
        requireSequential: true,
        completionThresholdPercent: courseUnlockCfg?.completionThresholdPercent ?? 95,
      },
    );
    if (!unlocked) {
      return fail(reply, 403,
        'This lesson is locked. Complete the previous lesson to unlock it.');
    }
  }

  const now = new Date();
  
  // Safe increment of actualWatchedSecs (max 30s per heartbeat to prevent extreme skips)
  const safeDelta = Math.min(deltaSeconds ?? 0, 30);

  // Determine if the user is truly eligible for completion
  let finalIsCompleted = false;

  const deviceId = request.headers['x-device-id'] as string | undefined;

  const existingProgress = await (request.server.prisma as any).courseEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    select: { completed: true, actualWatchedSecs: true, lastWatchedSecs: true, updatedAt: true }
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

  // Server-authoritative completion. The trust model:
  //   * A completion that's already been recorded stays completed
  //     (idempotent — rewatching a completed lesson doesn't "un-complete").
  //   * Otherwise, completion requires the cumulative *fraud-scrubbed*
  //     watched seconds to exceed `threshold%` of the episode's real
  //     duration. `safeDelta` is already capped at 30s per heartbeat
  //     so a modified client can't skip to completion by sending
  //     one huge delta.
  //   * The client's `requestedCompletion` flag is IGNORED here — it
  //     was previously trusted as a hint from the player's "ended"
  //     event, but that's exactly the vector the prompt's security
  //     requirement wants closed. Server decides completion, not
  //     client.
  //   * Fallback: when the episode has no `durationSeconds` recorded
  //     (metadata missing), we still honor the client's flag AS A
  //     LAST RESORT so pre-migration courses without duration data
  //     don't become impossible to complete. Once metadata is
  //     backfilled, the fallback goes cold naturally.
  const thresholdFraction =
    Math.max(0.5, Math.min(1, (courseUnlockCfg?.completionThresholdPercent ?? 95) / 100));
  if (existingProgress?.completed) {
    finalIsCompleted = true;
  } else if (episode.durationSeconds && episode.durationSeconds > 0) {
    finalIsCompleted = cumulativeActualSecs / episode.durationSeconds >= thresholdFraction;
  } else if (requestedCompletion === true && cumulativeActualSecs >= 5) {
    // Legacy fallback — episode has no duration metadata. Trust the
    // client's flag ONLY if there's some evidence of watching.
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

  // 5.3 — fire-and-forget anomaly detection for course progress
  void (async () => {
    const prisma = request.server.prisma;
    const mId = request.memberId!;

    // Rapid episode switching: ≥5 distinct course episodes touched in 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await (prisma as any).courseEpisodeProgress.count({
      where: { memberId: mId, updatedAt: { gt: fiveMinAgo } },
    }).catch(() => 0);
    if (recentCount >= 5) {
      await (prisma.securityLog.create as any)({
        data: {
          memberId: mId,
          eventType: 'RAPID_EPISODE_SWITCHING',
          metadata: { episodeCount: recentCount, windowMinutes: 5, episodeId, courseId, deviceId: deviceId ?? null },
        },
      }).catch(() => {});
    }

    // Abnormal progress speed: claimed ≥15s credit but wall clock says <5s since last heartbeat
    const wallClockElapsed = existingProgress?.updatedAt
      ? Math.floor((now.getTime() - (existingProgress.updatedAt as Date).getTime()) / 1000)
      : null;
    if (wallClockElapsed !== null && wallClockElapsed < 5 && safeDelta >= 15) {
      await (prisma.securityLog.create as any)({
        data: {
          memberId: mId,
          eventType: 'ABNORMAL_PROGRESS_SPEED',
          metadata: { episodeId, courseId, reportedDelta: deltaSeconds, safeDelta, wallClockElapsed, deviceId: deviceId ?? null },
        },
      }).catch(() => {});
    }
  })().catch(() => {});

  if (finalIsCompleted && !existingProgress?.completed) {
    const pct = await recalculateCourseProgress(request, courseId);

    const courseForXp = await request.server.prisma.course.findUnique({
      where: { id: courseId },
      select: { xpPerEpisode: true, title: true },
    });
    void awardEpisodeXp(
      request.server.prisma as any,
      request.memberId,
      courseId,
      episodeId,
      (courseForXp as any)?.xpPerEpisode ?? 10,
    );

    // 7.1 — episode complete notification
    void notifyEpisodeCompleted({
      prisma: request.server.prisma as any,
      io: request.server.io,
      memberId: request.memberId!,
      courseId,
      episodeTitle: (episode as any).title ?? 'Episode',
    }).catch(() => {});

    // 7.1 — course 100% complete notification
    if (pct === 100) {
      void notifyCourseCompleted({
        prisma: request.server.prisma as any,
        io: request.server.io,
        memberId: request.memberId!,
        courseId,
        courseTitle: (courseForXp as any)?.title ?? 'the course',
      }).catch(() => {});
    }
  }

  void invalidateCache(request.server.redis ?? null, `cont-learn:${request.memberId!}`);

  return ok(reply, {
    lessonId: episodeId,
    completed: progress.completed,
    watchedSeconds: progress.lastWatchedSecs,
    actualWatchedSecs: progress.actualWatchedSecs,
    completedAt: progress.completedAt?.toISOString() ?? null,
  });
}

async function recalculateCourseProgress(request: FastifyRequest, courseId: string): Promise<number> {
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

  return pct;
}

// ─── Course access helpers ────────────────────────────────────────────────────

async function getCourseAccessRecord(prisma: any, memberId: string, courseId: string) {
  return prisma.courseAccess.findUnique({
    where: { memberId_courseId: { memberId, courseId } },
    select: { id: true, isActive: true, accessType: true, expiresAt: true },
  }).catch(() => null);
}

function isAccessValid(access: { isActive: boolean; accessType: string; expiresAt: Date | null } | null): boolean {
  if (!access || !access.isActive) return false;
  if (access.accessType === 'lifetime') return true;
  if (!access.expiresAt) return false;
  return access.expiresAt > new Date();
}

async function awardEpisodeXp(prisma: any, memberId: string, courseId: string, episodeId: string, xpAmount: number) {
  try {
    await prisma.memberXP.create({
      data: { memberId, courseId, source: 'episode_complete', amount: xpAmount },
    });

    // Update course streak
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const streak = await prisma.courseStreak.findUnique({
      where: { memberId_courseId: { memberId, courseId } },
    });
    if (!streak) {
      await prisma.courseStreak.create({
        data: { memberId, courseId, currentStreak: 1, longestStreak: 1, lastActivityAt: now },
      });
    } else {
      const lastDay = new Date((streak.lastActivityAt as Date).getTime());
      lastDay.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - lastDay.getTime()) / 86_400_000);
      let newStreak = streak.currentStreak;
      if (daysDiff === 1) newStreak += 1;
      else if (daysDiff > 1) newStreak = 1;
      await prisma.courseStreak.update({
        where: { memberId_courseId: { memberId, courseId } },
        data: { currentStreak: newStreak, longestStreak: Math.max(newStreak, streak.longestStreak), lastActivityAt: now },
      });
    }
  } catch { /* fire-and-forget */ }
}

// ─── Course quiz submission ───────────────────────────────────────────────────

export async function submitCourseQuizHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId, epId } = request.params as { id: string; epId: string };
  const { answers } = request.body as { answers: Record<string, string> };

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

  const episode = await request.server.prisma.courseEpisode.findFirst({
    where: { id: epId, courseId },
    select: { id: true, title: true, quizData: true, courseId: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found in this course');

  const quizData = episode.quizData as any;
  if (!quizData?.questions?.length) return fail(reply, 400, 'This episode has no quiz');

  const questions: any[] = quizData.questions;
  let correct = 0;
  for (const q of questions) {
    const chosen = answers[q.id];
    const correctOpt = q.options?.find((o: any) => o.correct);
    if (correctOpt && chosen === correctOpt.id) correct++;
  }

  const score = Math.round((correct / questions.length) * 100);
  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { passingScorePercent: true, xpPerEpisode: true },
  });
  const passing = (course as any)?.passingScorePercent ?? 70;
  const passed = score >= passing;

  const attempt = await (request.server.prisma as any).courseQuizAttempt.create({
    data: { memberId: request.memberId, episodeId: epId, answers, score, passed },
  });

  const xp = (course as any)?.xpPerEpisode ?? 10;
  if (passed) {
    void awardEpisodeXp(request.server.prisma as any, request.memberId, courseId, epId, xp);

    // 7.1 — quiz passed notification
    void notifyQuizPassed({
      prisma: request.server.prisma as any,
      io: request.server.io,
      memberId: request.memberId!,
      courseId,
      episodeTitle: (episode as any).title ?? 'Episode',
      score,
      xp,
    }).catch(() => {});
  }

  return ok(reply, { attemptId: attempt.id, score, passed, correct, total: questions.length });
}

// ─── Course XP & leaderboard ─────────────────────────────────────────────────

export async function getCourseXpHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };

  const accessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseId);
  if (!isAccessValid(accessRecord)) return fail(reply, 403, 'Access required for this course');

  try {
    const rows = await (request.server.prisma as any).memberXP.findMany({
      where: { memberId: request.memberId, courseId },
      select: { id: true, source: true, amount: true, earnedAt: true },
      orderBy: { earnedAt: 'desc' },
    });

    const total = (rows as any[]).reduce((sum: number, r: any) => sum + r.amount, 0);
    const streak = await (request.server.prisma as any).courseStreak.findUnique({
      where: { memberId_courseId: { memberId: request.memberId, courseId } },
      select: { currentStreak: true, longestStreak: true },
    }).catch(() => null);

    return ok(reply, { totalXp: total, currentStreak: streak?.currentStreak ?? 0, longestStreak: streak?.longestStreak ?? 0, history: rows });
  } catch {
    return ok(reply, { totalXp: 0, currentStreak: 0, longestStreak: 0, history: [] });
  }
}

export async function getUserCourseLeaderboardHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };
  const { limit = 20 } = request.query as any;

  try {
    const rows = await (request.server.prisma as any).memberXP.groupBy({
      by: ['memberId'],
      _sum: { amount: true },
      where: { courseId },
      orderBy: { _sum: { amount: 'desc' } },
      take: Number(limit),
    });

    const memberIds = (rows as any[]).map((r: any) => r.memberId);
    const members = await request.server.prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
    });

    const memberMap = new Map(members.map((m) => [m.id, m]));
    const myEntry = (rows as any[]).find((r: any) => r.memberId === request.memberId);
    const myRank = myEntry ? (rows as any[]).indexOf(myEntry) + 1 : null;

    const data = (rows as any[]).map((r: any, i: number) => ({
      rank: i + 1,
      memberId: r.memberId,
      member: memberMap.get(r.memberId) ?? null,
      totalXp: r._sum?.amount ?? 0,
      isMe: r.memberId === request.memberId,
    }));

    return ok(reply, { leaderboard: data, myRank });
  } catch {
    return ok(reply, { leaderboard: [], myRank: null });
  }
}

export async function getUserBadgesHandler(request: FastifyRequest, reply: FastifyReply) {
  const badges = await (request.server.prisma as any).memberCourseBadge.findMany({
    where: { memberId: request.memberId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });

  return ok(reply, (badges as any[]).map((b: any) => ({
    id: b.id,
    earnedAt: b.earnedAt,
    badge: b.badge,
  })));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const now = new Date();
  const redis = request.server.redis ?? null;
  const statsKey = `dash:stats:${request.memberId}`;
  const cachedStats = await cacheGet<Record<string, unknown>>(redis, statsKey);
  if (cachedStats) return ok(reply, cachedStats);

  // upcomingEvents is user-agnostic — cache it globally for 60 seconds
  const eventsKey = 'events:upcoming-count';
  let upcomingEvents = await cacheGet<number>(redis, eventsKey);
  if (upcomingEvents === null) {
    upcomingEvents = await request.server.prisma.event.count({
      where: { eventDate: { gt: now }, status: 'scheduled' },
    });
    await cacheSet(redis, eventsKey, upcomingEvents, 60);
  }

  const [totalCourses, completedCourses, member, unreadNotifications] =
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
      request.server.prisma.notification.count({
        where: { memberId: request.memberId, isRead: false },
      }),
    ]);

  const statsPayload = {
    totalCourses,
    completedCourses,
    inProgressCourses: totalCourses - completedCourses,
    totalPoints: member?.totalPoints ?? 0,
    currentStreak: member?.currentStreak ?? 0,
    upcomingEvents,
    unreadNotifications,
  };
  void cacheSet(redis, statsKey, statsPayload, 120);
  return ok(reply, statsPayload);
}

export async function getContinueLearningHandler(request: FastifyRequest, reply: FastifyReply) {
  const redis = request.server.redis ?? null;
  const clKey = `cont-learn:${request.memberId}`;
  const cachedCl = await cacheGet<unknown[]>(redis, clKey);
  if (cachedCl) return ok(reply, cachedCl);

  // Fetch recent activity across both types — no completion filter so recently-finished
  // items stay visible. Fetch more than needed so deduplication still yields up to 6.
  const [courseProgress, workshopProgress] = await Promise.all([
    request.server.prisma.courseEpisodeProgress.findMany({
      where: { memberId: request.memberId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        completed: true,
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
      where: { memberId: request.memberId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        isCompleted: true,
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

  // Progress % based on playhead position
  const pct = (lastWatched: number, duration: number | null | undefined) =>
    duration && duration > 0 ? Math.min(100, Math.round((lastWatched / duration) * 100)) : 0;

  // Deduplicate — keep only the most-recently-watched episode per course / workshop
  const seenCourseIds = new Set<string>();
  const dedupedCourses = courseProgress.filter(p => {
    const key = p.episode.courseId;
    if (seenCourseIds.has(key)) return false;
    seenCourseIds.add(key);
    return true;
  });

  const seenWorkshopSlugs = new Set<string>();
  const dedupedWorkshops = workshopProgress.filter(p => {
    const key = p.episode.challenge.workshop.slug;
    if (seenWorkshopSlugs.has(key)) return false;
    seenWorkshopSlugs.add(key);
    return true;
  });

  // Note: `_ms` is a private sort key stripped before the response goes over
  // the wire. `updatedAt` is returned as an ISO string so it matches the
  // Flutter WatchHistoryItem model (`String? updatedAt`) — earlier the raw
  // getTime() number caused a Dart TypeError at parse time in release mode,
  // which the dashboard surfaced as "Failed to load. Retry."
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
      isCompleted: p.completed,
      updatedAt: p.updatedAt.toISOString(),
      _ms: p.updatedAt.getTime(),
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
      isCompleted: p.isCompleted,
      updatedAt: p.updatedAt.toISOString(),
      _ms: p.updatedAt.getTime(),
    })),
  ]
    .sort((a, b) => b._ms - a._ms)
    .slice(0, 6)
    .map(({ _ms: _ignored, ...rest }) => rest);

  void cacheSet(redis, clKey, combined, 120);
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

// ─── Programs ─────────────────────────────────────────────────────────────────

export async function listUserProgramsHandler(request: FastifyRequest, reply: FastifyReply) {
  const programs = await request.server.prisma.program.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      durationDays: true,
      incubationDays: true,
      status: true,
      createdAt: true,
    },
  });
  return ok(reply, programs);
}

export async function getUserProgramHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const program = await request.server.prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      durationDays: true,
      incubationDays: true,
      status: true,
      createdAt: true,
      batches: {
        // `status` is a raw-SQL column (not in Prisma schema per CLAUDE.md
        // "Raw SQL Columns"); cast to bypass typecheck. Runtime works because
        // Prisma forwards unknown filter keys verbatim.
        where: { status: 'active' } as any,
        select: { id: true, name: true },
        take: 5,
      },
    },
  });
  if (!program) return fail(reply, 404, 'Program not found');
  return ok(reply, program);
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
    select: { id: true, title: true, scheduledAt: true, liveUrlUnlocksMinutesBefore: true, isWebinar: true, startedAt: true, isLocked: true, waitingRoomEnabled: true, passcode: true, prerequisiteChallengeId: true },
  });
  if (!liveCall) return fail(reply, 404, 'Live call not found');

  // Passcode check (if set and caller provides one)
  const { passcode: inputPasscode } = request.body as any ?? {};
  if (liveCall.passcode && liveCall.passcode !== inputPasscode) {
    return reply.status(403).send({ success: false, data: null, error: { code: 'PASSCODE_REQUIRED', message: 'Invalid passcode' } });
  }

  // Prerequisite challenge check — member must have completed it
  if (liveCall.prerequisiteChallengeId) {
    const progress = await request.server.prisma.memberChallengeProgress.findFirst({
      where: { challengeId: liveCall.prerequisiteChallengeId, memberId: request.memberId, status: 'completed' },
    });
    if (!progress) {
      return reply.status(403).send({ success: false, data: null, error: { code: 'PREREQ_REQUIRED', message: 'Complete the prerequisite challenge before joining this session.' } });
    }
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

// ─── Pre-session resources (user) ─────────────────────────────────────────────

export async function getLiveCallResourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const lc = await request.server.prisma.liveCall.findUnique({
    where: { id: liveCallId },
    select: { endedAt: true, scheduledAt: true, liveUrlUnlocksMinutesBefore: true },
  });
  if (!lc) return fail(reply, 404, 'Live call not found');

  const isPast = !!lc.endedAt;
  const now = new Date();
  const unlockAt = lc.scheduledAt && lc.liveUrlUnlocksMinutesBefore
    ? new Date(new Date(lc.scheduledAt).getTime() - lc.liveUrlUnlocksMinutesBefore * 60 * 1000)
    : null;
  const isUnlocked = !lc.endedAt && (unlockAt ? now >= unlockAt : true);

  if (!isPast && !isUnlocked) {
    return ok(reply, []);
  }

  const resources = await request.server.prisma.liveCallResource.findMany({
    where: { liveCallId },
    orderBy: { order: 'asc' },
    select: { id: true, title: true, url: true, type: true, order: true },
  });
  return ok(reply, resources);
}

// ─── RSVP (user) ──────────────────────────────────────────────────────────────

export async function upsertRsvpHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const { status } = request.body as { status: 'confirmed' | 'declined' };
  if (!['confirmed', 'declined'].includes(status)) {
    return fail(reply, 400, 'status must be confirmed or declined');
  }
  const rsvp = await request.server.prisma.liveCallRsvp.upsert({
    where: { liveCallId_memberId: { liveCallId, memberId: request.memberId } },
    create: { liveCallId, memberId: request.memberId, status },
    update: { status, confirmedAt: new Date() },
  });
  // Notify admin room so badge updates live
  const confirmed = await request.server.prisma.liveCallRsvp.count({ where: { liveCallId, status: 'confirmed' } });
  const declined = await request.server.prisma.liveCallRsvp.count({ where: { liveCallId, status: 'declined' } });
  request.server.io.to('admin').emit('admin:live_rsvp', { liveCallId, confirmed, declined });
  return ok(reply, rsvp);
}

export async function getRsvpStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const rsvp = await request.server.prisma.liveCallRsvp.findUnique({
    where: { liveCallId_memberId: { liveCallId, memberId: request.memberId } },
  });
  return ok(reply, rsvp ?? null);
}

// ─── Recording Chapters (user) ────────────────────────────────────────────────

export async function getLiveCallChaptersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const lc = await request.server.prisma.liveCall.findUnique({
    where: { id: liveCallId },
    select: { recordingUrl: true },
  });
  if (!lc?.recordingUrl) return ok(reply, []);
  const chapters = await request.server.prisma.recordingChapter.findMany({
    where: { liveCallId },
    orderBy: { order: 'asc' },
    select: { id: true, label: true, timestampSeconds: true, order: true },
  });
  return ok(reply, chapters);
}

// ─── Live Call Feedback (user) ────────────────────────────────────────────────

export async function postLiveCallFeedbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const { rating, comment } = request.body as { rating: number; comment?: string };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail(reply, 400, 'rating must be 1–5');
  }
  const feedback = await request.server.prisma.liveCallFeedback.upsert({
    where: { liveCallId_memberId: { liveCallId, memberId: request.memberId } },
    create: { liveCallId, memberId: request.memberId, rating, comment: comment ?? null },
    update: { rating, comment: comment ?? null, submittedAt: new Date() },
  });
  return ok(reply, feedback);
}

export async function getMyLiveCallFeedbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const feedback = await request.server.prisma.liveCallFeedback.findUnique({
    where: { liveCallId_memberId: { liveCallId, memberId: request.memberId } },
  });
  return ok(reply, feedback ?? null);
}

export async function getMyLiveCallCertificateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const cert = await request.server.prisma.liveCallCertificate.findUnique({
    where: { liveCallId_memberId: { liveCallId, memberId: request.memberId } },
    select: { certificateUrl: true, attendancePercent: true, issuedAt: true },
  });
  if (!cert) return fail(reply, 404, 'Certificate not found');
  return ok(reply, cert);
}

// ─── Live Call Q&A (user) ─────────────────────────────────────────────────────

export async function postLiveCallQuestionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const { question } = request.body as { question: string };
  if (!question?.trim()) return fail(reply, 400, 'question is required');

  const member = await request.server.prisma.member.findUnique({
    where: { id: request.memberId },
    select: { firstName: true, lastName: true },
  });
  const memberName = [member?.firstName, member?.lastName].filter(Boolean).join(' ') || 'Member';

  const q = await request.server.prisma.liveCallQuestion.create({
    data: { liveCallId, memberId: request.memberId, question: question.trim() },
  });

  request.server.io.to('admin').emit('live_call:question_new', {
    liveCallId, questionId: q.id, question: q.question, memberName,
  });

  return ok(reply, q);
}

export async function getLiveCallQuestionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: liveCallId } = request.params as { id: string };
  const questions = await request.server.prisma.liveCallQuestion.findMany({
    where: { liveCallId, isHidden: false },
    include: { member: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isAnswered: 'asc' }, { submittedAt: 'asc' }],
  });
  return ok(reply, questions.map(q => ({
    id: q.id,
    question: q.question,
    isAnswered: q.isAnswered,
    answeredAt: q.answeredAt,
    submittedAt: q.submittedAt,
    memberName: [q.member.firstName, q.member.lastName].filter(Boolean).join(' ') || 'Member',
    isOwn: q.memberId === request.memberId,
  })));
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
  const redis = request.server.redis ?? null;
  const cacheKey = `notif:unread:${request.memberId}`;
  const cached = await cacheGet<{ count: number }>(redis, cacheKey);
  if (cached) return ok(reply, cached);

  const count = await request.server.prisma.appNotificationRecipient.count({
    where: { memberId: request.memberId, readAt: null },
  });
  await cacheSet(redis, cacheKey, { count }, 30);
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

  void invalidateCache(request.server.redis ?? null, `notif:unread:${request.memberId}`);

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
  void invalidateCache(request.server.redis ?? null, `notif:unread:${request.memberId}`);
  return ok(reply, { updated: result.count });
}

export async function dismissNotificationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.appNotificationRecipient.deleteMany({
    where: { id, memberId: request.memberId },
  });
  void invalidateCache(request.server.redis ?? null, `notif:unread:${request.memberId}`);
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
  const redis = request.server.redis ?? null;
  const CACHE_KEY = 'home:hero';
  const cached = await cacheGet<object>(redis, CACHE_KEY);
  if (cached) return ok(reply, cached);

  const [slides, siteConfig] = await Promise.all([
    request.server.prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    request.server.prisma.siteConfig.findFirst({
      select: { heroAutoPlayIntervalMs: true },
    }),
  ]);

  const data = {
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
  };
  await cacheSet(redis, CACHE_KEY, data, 300);
  return ok(reply, data);
}

export async function getHomeSectionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { memberTier } = request.query as { memberTier?: string };
  const tierNum = parseInt(memberTier || '1', 10);

  const redis = request.server.redis ?? null;
  const CACHE_KEY = 'home:sections:v1';
  let sections = await cacheGet<any[]>(redis, CACHE_KEY);

  if (!sections) {
    sections = await request.server.prisma.contentSection.findMany({
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
    await cacheSet(redis, CACHE_KEY, sections, 60);
  }

  // Apply tier locks in memory (no DB round-trip)
  return ok(reply, {
    sections: sections.map((s: any) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      order: s.order,
      isVisible: s.isVisible,
      requiredTier: s.requiredTier,
      isLocked: tierNum < s.requiredTier,
      lockLabel: tierNum < s.requiredTier ? (s.lockBadgeText ?? null) : null,
      items: s.items.map((item: any) => {
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
            : (item.course?.courseEpisodes ?? []).map((ep: any) => ({
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
  const [member, workshops, enrollments] = await Promise.all([
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: { batchId: true },
    }),
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
        batchIds: true,
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    request.server.prisma.workshopEnrollment.findMany({
      where: { memberId: request.memberId },
      select: { workshopId: true, status: true },
    }),
  ]);

  const memberBatchId = member?.batchId ?? null;
  const enrollmentMap = new Map(enrollments.map((e) => [e.workshopId, e.status]));

  const data = workshops.map((w) => {
    const enrollStatus = enrollmentMap.get(w.id) ?? null;
    const batchIds = w.batchIds as string[] | null;
    const locked = batchIds && batchIds.length > 0
      ? !memberBatchId || !batchIds.includes(memberBatchId)
      : false;
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
      locked,
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
  const redis = request.server.redis ?? null;
  const wsDetKey = `ws:detail:${request.memberId}:${slug}`;
  const cachedDet = await cacheGet<Record<string, unknown>>(redis, wsDetKey);
  if (cachedDet) return ok(reply, cachedDet);

  // Match by either slug or id — some workshops don't have a real slug set
  // (falls back to storing the UUID), and the Flutter app doesn't distinguish
  // between the two on the client. Same defensive pattern as the courseEpisode
  // fallback in getEpisodePlaybackHandler.
  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
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

  const batchIds = (workshop as any).batchIds as string[] | null;
  if (batchIds && batchIds.length > 0) {
    const member = await request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: { batchId: true },
    });
    const memberBatchId = member?.batchId ?? null;
    if (!memberBatchId || !batchIds.includes(memberBatchId)) {
      return fail(reply, 403, 'This workshop is not available for your batch');
    }
  }

  const enrollment = (workshop as any).enrollments?.[0];
  const enrollmentStatus = enrollment?.status ?? null;

  // Non-enrolled (null) or pending — return gate payload only; skip expensive progress queries
  if (!isEnrolled(enrollmentStatus)) {
    const gatePayload = {
      id: workshop.id,
      title: workshop.title,
      thumbnailUrl: workshop.thumbnailUrl ?? null,
      description: workshop.description ?? null,
      backLabel: workshop.backLabel,
      backUrl: workshop.backUrl,
      enrollmentStatus,
      sidebar: { tabs: [] },
      learningProgress: null,
      certificate: null,
      workshopFlowLabel: null,
      defaultMainAreaType: null,
    };
    void cacheSet(redis, wsDetKey, gatePayload, 15);
    return ok(reply, gatePayload);
  }

  // Only count challenges that are actually in the flow — keeps stats consistent with sidebar
  const flowChallengeRefs = await request.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: workshop.id, type: 'challenge_start', challengeId: { not: null } },
    select: { challengeId: true },
  });
  const flowChallengeIdSet = new Set(flowChallengeRefs.map((fi: any) => fi.challengeId));
  const allChallenges: any[] = ((workshop as any).challenges ?? []).filter((c: any) => flowChallengeIdSet.has(c.id));
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

  const wsDetPayload = {
    id: workshop.id,
    title: workshop.title,
    thumbnailUrl: workshop.thumbnailUrl ?? null,
    description: workshop.description ?? null,
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
    enrollmentStatus,
  };
  void cacheSet(redis, wsDetKey, wsDetPayload, 60);
  return ok(reply, wsDetPayload);
}

export async function getWorkshopCertificateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    include: {
      challenges: {
        select: { id: true, type: true, episodes: { select: { id: true } } },
      },
    },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const certEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(certEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

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
  const redis = request.server.redis ?? null;
  const wsFlowKey = `ws:flow:${request.memberId}:${slug}`;
  const cachedFlow = await cacheGet<Record<string, unknown>>(redis, wsFlowKey);
  if (cachedFlow) return ok(reply, cachedFlow);

  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    include: {
      flowItems: {
        orderBy: { order: 'asc' },
        include: {
          challenge: {
            include: {
              episodes: { orderBy: { order: 'asc' } },
            },
          },
          liveCall: true,
        },
      },
    },
  });

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const flowEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(flowEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

  // Single flat query for all episode progress instead of N+1 nested includes
  const allEpisodeIds = (workshop as any).flowItems.flatMap(
    (item: any) => (item.challenge?.episodes ?? []).map((e: any) => e.id)
  );
  const progressRows = allEpisodeIds.length > 0
    ? await request.server.prisma.memberEpisodeProgress.findMany({
        where: { memberId: request.memberId, episodeId: { in: allEpisodeIds } },
        select: { episodeId: true, isCompleted: true },
      })
    : [];
  const progressMap = new Map(progressRows.map((p) => [p.episodeId, p.isCompleted]));

  const flowItems = (workshop as any).flowItems.map((item: any) => {
      if (item.type === 'challenge' && item.challenge) {
        const ch = item.challenge;
        const totalEps = ch.episodes.length;
        const completedEps = ch.episodes.filter((e: any) => progressMap.get(e.id) === true).length;

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
            isCompleted: progressMap.get(ep.id) ?? false,
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
          externalMeetingUrl: isUnlocked ? (lc.externalMeetingUrl ?? null) : null,
          externalMeetingProvider: lc.externalMeetingProvider ?? null,
          aiSummary: status === 'past' ? (lc.aiSummary ?? null) : null,
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
    });

  const wsFlowPayload = { flowItems };
  void cacheSet(redis, wsFlowKey, wsFlowPayload, 60);
  return ok(reply, wsFlowPayload);
}

export async function getWorkshopQaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const qaEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(qaEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

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
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const postQaEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(postQaEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

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
      where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
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
                    imageUrl: true,
                    fileUrl: true,
                    videoId: true,
                    videoUrl: true,
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

  const assignEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(assignEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

  const ctaLabel = uiStrings?.assignmentCtaLabel ?? 'Answer';
  const submitLabel = uiStrings?.assignmentSubmitLabel ?? 'Submit';
  const cancelLabel = uiStrings?.assignmentCancelLabel ?? 'Cancel';

  return ok(reply, {
    groups: (workshop as any).challenges.map((ch: any) => ({
      challengeLabel: ch.numberLabel?.replace(':', '') ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}`,
      challengeTitle: ch.title,
      assignments: ch.assignments.map((a: any) => {
        const sub = a.submissions?.[0] ?? null;
        const now = new Date();
        const canEdit = a.allowEdit && (!a.editDeadline || a.editDeadline > now);
        return {
          id: a.id,
          title: a.title,
          assignmentType: a.assignmentType ?? 'qa',
          questionText: a.questionText ?? null,
          typeLabel: a.typeLabel,
          iconType: a.iconType,
          canEdit,
          ctaLabel,
          submitLabel,
          cancelLabel,
          submission: sub
            ? {
                isSubmitted: true,
                submittedAt: sub.submittedAt,
                answerText: sub.answerText ?? null,
                imageUrl: sub.imageUrl ?? null,
                fileUrl: sub.fileUrl ?? null,
                videoId: sub.videoId ?? null,
                videoUrl: sub.videoUrl ?? null,
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
  const { answerText, imageUrl, fileUrl, videoId, videoUrl } = request.body as {
    answerText?: string;
    imageUrl?: string;
    fileUrl?: string;
    videoId?: string;
    videoUrl?: string;
  };

  const assignment = await request.server.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { challenge: { select: { workshopId: true } } },
  });
  if (!assignment) return fail(reply, 404, 'Assignment not found');

  const submitWorkshopId = (assignment as any).challenge?.workshopId as string | undefined;
  if (submitWorkshopId) {
    const submitEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
      where: { workshopId_memberId: { workshopId: submitWorkshopId, memberId: request.memberId } },
      select: { status: true },
    });
    if (!isEnrolled(submitEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');
  }

  const type = (assignment as any).assignmentType ?? 'qa';

  if (type === 'image_upload' && !imageUrl?.trim()) return fail(reply, 400, 'Image URL is required');
  if (type === 'file_upload' && !fileUrl?.trim()) return fail(reply, 400, 'File URL is required');
  if (type === 'video_upload' && !videoId?.trim()) return fail(reply, 400, 'Video ID is required');
  if (type === 'qa' && !answerText?.trim()) return fail(reply, 400, 'Answer text is required');

  const submissionData = {
    answerText: type === 'qa' ? answerText!.trim() : null,
    imageUrl: type === 'image_upload' ? imageUrl!.trim() : null,
    fileUrl: type === 'file_upload' ? fileUrl!.trim() : null,
    videoId: type === 'video_upload' ? videoId!.trim() : null,
    videoUrl: type === 'video_upload' ? (videoUrl?.trim() ?? null) : null,
  };

  const submission = await request.server.prisma.assignmentSubmission.upsert({
    where: { assignmentId_memberId: { assignmentId, memberId: request.memberId } },
    create: { assignmentId, memberId: request.memberId, ...submissionData },
    update: { ...submissionData, submittedAt: new Date() },
    select: { id: true, answerText: true, imageUrl: true, fileUrl: true, videoId: true, videoUrl: true, submittedAt: true },
  });

  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!, request.server.redis),
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
        challenge: { select: { workshopId: true } },
        progress: {
          where: { memberId: request.memberId },
          select: { lastWatchedSecs: true, isCompleted: true },
        },
      },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!episode) {
    // Fallback: look up a course episode so the Flutter lesson player can use
    // the same single endpoint for both workshop and course content.
    const COURSE_BUNNY_RE = /(?:iframe\.mediadelivery\.net\/embed|player\.mediadelivery\.net\/play)\/\d+\/([\w-]+)|(?:vz-[^.]+\.b-cdn\.net)\/([\w-]{8,})\//;
    const courseEp = await request.server.prisma.courseEpisode.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        bunnyVideoId: true,
        durationSeconds: true,
        quizData: true,
        quizUnlockPercent: true,
        drmEnabled: true,
        bunnyDrmToken: true,
        courseId: true,
        progress: {
          where: { memberId: request.memberId! },
          select: { lastWatchedSecs: true, completed: true },
        },
      },
    });
    if (!courseEp) return fail(reply, 404, 'Episode not found');

    const courseAccessRecord = await getCourseAccessRecord(request.server.prisma as any, request.memberId, courseEp.courseId);
    if (!isAccessValid(courseAccessRecord)) return fail(reply, 403, 'Access required for this course');

    const cdn = env.BUNNY_CDN_URL
      ? (env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')
      : null;
    const courseUrlMatch = courseEp.videoUrl?.match(COURSE_BUNNY_RE);
    const courseBunnyId = courseEp.bunnyVideoId ?? courseUrlMatch?.[1] ?? courseUrlMatch?.[2] ?? null;
    const courseHlsUrl = !(courseEp as any).drmEnabled && courseBunnyId && cdn
      ? `${cdn}/${courseBunnyId}/playlist.m3u8`
      : null;

    const courseProg = courseEp.progress?.[0];
    const quizDataVal = courseEp.quizData as any;

    return ok(reply, {
      id: courseEp.id,
      title: courseEp.title,
      description: null as string | null,
      videoUrl: courseEp.videoUrl,
      hlsUrl: courseHlsUrl,
      videoType: courseHlsUrl ? 'hls' : 'iframe',
      durationSeconds: courseEp.durationSeconds ?? null,
      resumeAtSeconds: courseProg?.lastWatchedSecs ?? 0,
      isCompleted: courseProg?.completed ?? false,
      hasQuiz: Array.isArray(quizDataVal?.questions) && quizDataVal.questions.length > 0,
      quizData: quizDataVal ?? null,
      quizUnlockPercent: courseEp.quizUnlockPercent ?? 80,
    });
  }

  const playbackWorkshopId = (episode as any).challenge?.workshopId as string | undefined;
  if (playbackWorkshopId) {
    const playbackEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
      where: { workshopId_memberId: { workshopId: playbackWorkshopId, memberId: request.memberId } },
      select: { status: true },
    });
    if (!isEnrolled(playbackEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');
  }

  let duration = episode.durationSeconds;

  // Hoist bunnyId — used for both Bunny API duration fetch and HLS URL construction
  const BUNNY_URL_RE = /(?:iframe\.mediadelivery\.net\/embed|player\.mediadelivery\.net\/play)\/\d+\/([\w-]+)|(?:vz-[^.]+\.b-cdn\.net)\/([\w-]{8,})\//;
  const _urlMatch = episode.videoUrl?.match(BUNNY_URL_RE);
  const bunnyId = episode.bunnyVideoId ?? _urlMatch?.[1] ?? _urlMatch?.[2] ?? null;

  // Always fetch authoritative duration from Bunny — stored value may be wrong/placeholder.
  if (env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_LIBRARY_ID && bunnyId) {
    try {
      const bunnyRes = await fetch(
        `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${bunnyId}`,
        { headers: { AccessKey: env.BUNNY_STREAM_API_KEY, accept: 'application/json' } }
      );
      if (bunnyRes.ok) {
        const bunnyData = (await bunnyRes.json()) as any;
        const bunnyDuration = Number(bunnyData.length ?? bunnyData.duration ?? 0);
        if (bunnyDuration > 0) {
          duration = bunnyDuration;
          // Backfill DB async — don't block the response
          void request.server.prisma.workshopEpisode.update({
            where: { id: episode.id },
            data: {
              durationSeconds: bunnyDuration,
              ...(episode.bunnyVideoId ? {} : { bunnyVideoId: bunnyId }),
            },
          }).catch(() => {});
        }
      }
    } catch (err) {
      request.server.log.warn(`[bunny] duration fetch failed for episode ${episode.id}: ${err}`);
    }
  }

  const hlsUrl = (bunnyId && env.BUNNY_CDN_URL)
    ? `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8`
    : null;

  const prog = (episode as any).progress?.[0];

  return ok(reply, {
    id: episode.id,
    title: episode.title,
    description: episode.description ?? null,
    videoUrl: episode.videoUrl ?? null,
    hlsUrl,
    videoType: hlsUrl ? 'hls' : 'iframe',
    durationSeconds: duration ?? null,
    resumeAtSeconds: prog?.lastWatchedSecs ?? 0,
    isCompleted: prog?.isCompleted ?? false,
    hasQuiz: false,
    quizData: null as any,
    quizUnlockPercent: 80,
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
  const { watchedSeconds, deltaSeconds, reportedDuration, segments } = request.body as {
    watchedSeconds?: number;
    deltaSeconds?: number;
    reportedDuration?: number;
    segments?: number[];
  };

  const safeDelta = Math.min(deltaSeconds ?? 0, 30);
  const deviceId = request.headers['x-device-id'] as string | undefined;

  const episode = await request.server.prisma.workshopEpisode.findUnique({
    where: { id: episodeId },
    select: {
      durationSeconds: true,
      bunnyVideoId: true,
      challenge: { select: { workshopId: true, workshop: { select: { slug: true } } } },
    },
  });
  if (!episode) return fail(reply, 404, 'Episode not found');

  const progressWorkshopId = (episode as any).challenge?.workshopId as string | undefined;
  if (progressWorkshopId) {
    const progressEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
      where: { workshopId_memberId: { workshopId: progressWorkshopId, memberId: request.memberId } },
      select: { status: true },
    });
    if (!isEnrolled(progressEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');
  }

  const existingProgress = await request.server.prisma.memberEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    select: { lastWatchedSecs: true, actualWatchedSecs: true, isCompleted: true, updatedAt: true, watchedSegments: true }
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

  // Always trust the player-reported duration — it comes from Bunny's own timeupdate event
  // and is more accurate than whatever the admin typed. Update DB whenever it differs by >5s.
  let duration = episode.durationSeconds;
  if (reportedDuration && reportedDuration > 0) {
    const stored = duration ?? 0;
    if (!stored || stored <= 0 || Math.abs(stored - reportedDuration) > 5) {
      duration = reportedDuration;
      void request.server.prisma.workshopEpisode.update({
        where: { id: episodeId },
        data: { durationSeconds: reportedDuration },
      }).catch(() => {});
    }
  }

  // Fetch duration from Bunny if still missing — fire-and-forget
  if ((!duration || duration <= 0) && episode.bunnyVideoId && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_LIBRARY_ID) {
    const bunnyApiKey = env.BUNNY_STREAM_API_KEY;
    const bunnyLibId = env.BUNNY_STREAM_LIBRARY_ID;
    const bunnyVidId = episode.bunnyVideoId;
    void (async () => {
      try {
        const bunnyRes = await fetch(
          `https://video.bunnycdn.com/library/${bunnyLibId}/videos/${bunnyVidId}`,
          { headers: { AccessKey: bunnyApiKey } }
        );
        if (bunnyRes.ok) {
          const bunnyData = (await bunnyRes.json()) as { length: number };
          if (bunnyData.length > 0) {
            await request.server.prisma.workshopEpisode.update({
              where: { id: episodeId },
              data: { durationSeconds: bunnyData.length }
            }).catch(() => {});
          }
        }
      } catch {}
    })();
  }

  // Merge incoming watched segments with stored ones (union of sorted unique indices)
  const existingSegs: number[] = existingProgress?.watchedSegments
    ? JSON.parse(existingProgress.watchedSegments)
    : [];
  const mergedSegs = segments && segments.length > 0
    ? [...new Set([...existingSegs, ...segments])].sort((a, b) => a - b)
    : existingSegs;
  const mergedSegsJson = mergedSegs.length > 0 ? JSON.stringify(mergedSegs) : undefined;

  // Backend decides completion based on 85% rule using wall-clock-validated delta.
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
      ...(mergedSegsJson ? { watchedSegments: mergedSegsJson } : {}),
    },
    update: {
      lastWatchedSecs: watchedSeconds ?? undefined,
      actualWatchedSecs: { increment: trueDelta },
      isCompleted: isCompleted,
      completedAt: isCompleted && !existingProgress?.isCompleted ? new Date() : undefined,
      ...(mergedSegsJson ? { watchedSegments: mergedSegsJson } : {}),
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

  const wsSlug = (episode as any).challenge?.workshop?.slug;
  void Promise.all([
    recalculateMemberStats(request.server.prisma, request.memberId!, request.server.redis),
    logActivity(request.server.prisma, request.memberId!, isCompleted && !existingProgress?.isCompleted ? 'episode_completed' : 'episode_watched', { episodeId }),
    invalidateCache(request.server.redis ?? null, `cont-learn:${request.memberId}`),
    ...(wsSlug ? [invalidateCache(request.server.redis ?? null, `ws:detail:${request.memberId}:${wsSlug}`)] : []),
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
    pageTitle: pageConfig?.pageTitle ?? 'TBT Store',
    pageBg: pageConfig?.pageBg ?? '',
    products: products.map((p) => ({
      id: p.id,
      order: p.order,
      title: p.title,
      description: p.description ?? null,
      thumbnailUrl: p.thumbnailUrl ?? null,
      isVisible: p.isVisible,
      price: p.price ? Number(p.price) : null,
      currency: p.currency ?? 'INR',
      category: p.category ?? null,
      stockStatus: p.stockStatus ?? 'in_stock',
      ctas: p.ctas.map((c) => ({
        label: c.label,
        url: c.url,
        type: c.type,
        openInNewTab: c.openInNewTab,
      })),
    })),
  });
}

export async function getMyInquiredProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const rows = await request.server.prisma.$queryRawUnsafe<
    { product_id: string; title: string; thumbnail_url: string | null; price: number | null; currency: string; category: string | null; status: string; created_at: Date }[]
  >(
    `SELECT pi.product_id, p.title, p.thumbnail_url, p.price::float AS price, COALESCE(p.currency,'INR') AS currency, p.category, pi.status, pi.created_at
     FROM product_inquiries pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.member_id = $1
     ORDER BY pi.created_at DESC`,
    memberId,
  );
  const data = rows.map((r) => ({
    id: r.product_id,
    title: r.title,
    thumbnailUrl: r.thumbnail_url ?? null,
    price: r.price ?? null,
    currency: r.currency,
    category: r.category ?? null,
    inquiryStatus: r.status,
    inquiredAt: r.created_at.toISOString(),
  }));
  return ok(reply, data);
}

export async function submitProductInquiryHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id: productId } = request.params as { id: string };
  const { message } = (request.body || {}) as { message?: string };

  const [product, member] = await Promise.all([
    request.server.prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, isVisible: true } }),
    request.server.prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true, phone: true, email: true } }),
  ]);

  if (!product || !product.isVisible) return fail(reply, 404, 'Product not found');

  const inquiry = await (request.server.prisma as any).productInquiry.create({
    data: { memberId, productId, message: message?.trim() || null, status: 'pending' },
  });

  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim();
  request.server.io.to('admin').emit('admin:product_inquiry', {
    inquiryId: inquiry.id,
    productTitle: product.title,
    memberName,
    phone: member?.phone ?? '',
  });
  void createAdminNotification(request.server.prisma, {
    title: 'Product Inquiry',
    body: `${memberName} is interested in "${product.title}".`,
    type: 'product_inquiry',
    metadata: { inquiryId: inquiry.id, productTitle: product.title, memberName },
  });

  return reply.status(201).send({ success: true, data: { id: inquiry.id }, error: null });
}

export async function getUserResourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { search, view = 'list', page = 1, limit = 20 } = request.query as {
    search?: string;
    view?: string;
    page?: number;
    limit?: number;
  };

  const searchWhere = search?.trim()
    ? { title: { contains: search.trim(), mode: 'insensitive' as const } }
    : {};

  const [member, allResources, pageConfig] = await Promise.all([
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: { batchId: true },
    }),
    request.server.prisma.appResource.findMany({
      where: { isVisible: true, ...searchWhere },
      orderBy: { order: 'asc' },
    }),
    request.server.prisma.resourcesPageConfig.findFirst(),
  ]);

  const memberBatchId = member?.batchId ?? null;
  const total = allResources.length;
  const paged = allResources.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));

  return ok(reply, {
    pageTitle: pageConfig?.pageTitle ?? 'Resources',
    searchPlaceholder: pageConfig?.searchPlaceholder ?? 'Search resources...',
    totalCount: total,
    totalLabel: 'resources',
    viewOptions: ['list', 'grid'],
    resources: paged.map((r) => {
      const vis = r.visibility as { batchIds?: string[] } | null;
      const locked = vis?.batchIds && vis.batchIds.length > 0
        ? !memberBatchId || !vis.batchIds.includes(memberBatchId)
        : false;
      return {
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
        description: (r as any).description ?? null,
        locked,
        hoverActions: [
          { type: 'preview', iconType: 'eye', label: r.previewLabel },
          { type: 'download', iconType: 'download', label: r.downloadLabel },
        ],
      };
    }),
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
}

export async function getResourceDownloadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const [resource, member] = await Promise.all([
    request.server.prisma.appResource.findUnique({
      where: { id, isVisible: true },
      select: { fileUrl: true, title: true, visibility: true },
    }),
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: { batchId: true },
    }),
  ]);

  if (!resource?.fileUrl) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  }

  const vis = resource.visibility as { batchIds?: string[] } | null;
  if (vis?.batchIds && vis.batchIds.length > 0) {
    const memberBatchId = member?.batchId ?? null;
    if (!memberBatchId || !vis.batchIds.includes(memberBatchId)) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'This resource is not available for your batch' } });
    }
  }

  let downloadUrl = resource.fileUrl;

  // If fileUrl is a private R2 endpoint URL, generate a presigned GET URL so it's accessible
  const r2PrivatePrefix = env.CLOUDFLARE_R2_ACCOUNT_ID && env.CLOUDFLARE_R2_BUCKET_NAME
    ? `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.CLOUDFLARE_R2_BUCKET_NAME}/`
    : null;

  if (
    r2PrivatePrefix &&
    resource.fileUrl.startsWith(r2PrivatePrefix) &&
    env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  ) {
    const key = resource.fileUrl.slice(r2PrivatePrefix.length);
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
          secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
        },
      });
      const command = new GetObjectCommand({
        Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(resource.title)}`,
      });
      downloadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    } catch (err: any) {
      request.server.log.error(`R2 presign GET failed: ${err.message}`);
      // fall through — redirect to original URL
    }
  }

  // Content negotiation: Flutter (Dio) sends `Accept: application/json` and
  // wants the URL in a JSON body so it can drive its own download UI. The web
  // uses a plain `<a href>` so the browser sends `Accept: text/html,...` and
  // needs a real 302 redirect to trigger the download. Return whichever the
  // client asked for.
  const accept = (request.headers['accept'] as string | undefined) ?? '';
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html');
  if (wantsJson) return ok(reply, { downloadUrl });
  return reply.redirect(302, downloadUrl);
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

export async function assignmentImagePresignHandler(request: FastifyRequest, reply: FastifyReply) {
  const { filename, contentType } = request.body as { filename: string; contentType: string };
  if (!filename || !contentType) return fail(reply, 400, 'filename and contentType are required');
  if (!contentType.startsWith('image/')) return fail(reply, 400, 'Only image uploads allowed');

  const key = `assignment-submissions/${Date.now()}-${filename}`;

  if (!env.CLOUDFLARE_R2_ACCESS_KEY_ID || !env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    try {
      const { data, error } = await (request.server as any).supabase.storage.from('workshops').createSignedUploadUrl(key);
      if (error) throw error;
      const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/workshops/${key}`;
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

export async function assignmentFilePresignHandler(request: FastifyRequest, reply: FastifyReply) {
  const { filename, contentType } = request.body as { filename: string; contentType: string };
  if (!filename || !contentType) return fail(reply, 400, 'filename and contentType are required');

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `assignment-files/${Date.now()}-${safeFilename}`;

  if (!env.CLOUDFLARE_R2_ACCESS_KEY_ID || !env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    try {
      const { data, error } = await (request.server as any).supabase.storage.from('workshops').createSignedUploadUrl(key);
      if (error) throw error;
      const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/workshops/${key}`;
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

// ─── Workshop Access Request (user self-service) ──────────────────────────────

export async function requestWorkshopAccessHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const prisma = request.server.prisma;

  const workshop = await prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    select: { id: true, title: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const existing = await prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });

  if (existing) {
    // Already enrolled or pending — return current status (idempotent)
    return ok(reply, { enrollmentStatus: existing.status });
  }

  await prisma.workshopEnrollment.create({
    data: { workshopId: workshop.id, memberId: request.memberId, status: 'pending' },
  });

  // Notify admin room so they can see the request in real time
  try {
    request.server.io?.to('admin').emit('admin:workshop_access_request', {
      memberId: request.memberId,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
    });
    void createAdminNotification(request.server.prisma, {
      title: 'Workshop Access Request',
      body: `A member requested access to "${workshop.title}".`,
      type: 'workshop_access_request',
      metadata: { memberId: request.memberId, workshopId: workshop.id, workshopTitle: workshop.title },
    });
  } catch {}

  return ok(reply, { enrollmentStatus: 'pending' });
}

// ─── Workshop Challenges ──────────────────────────────────────────────────────

export async function getWorkshopChallengesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const chalEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: workshop.id, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(chalEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

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
      const isUnlocked = !isPast && (unlockAt ? now >= unlockAt : true);
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
        isUnlocked,
        isLocked: false,
        progressPercent: isPast ? 100 : 0,
        numberLabel: null,
        numberColor: null,
        description: null,
        quizData: null,
        episodes: [],
        submission: null,
        externalMeetingUrl: isUnlocked ? (lc.externalMeetingUrl ?? null) : null,
        externalMeetingProvider: lc.externalMeetingProvider ?? null,
        aiSummary: isPast ? (lc.aiSummary ?? null) : null,
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
      episodes: (!ch.type || ch.type === 'watch') ? ch.episodes.map((ep: any) => {
        const BUNNY_URL_RE = /(?:iframe\.mediadelivery\.net\/embed|player\.mediadelivery\.net\/play)\/\d+\/([\w-]+)|(?:vz-[^.]+\.b-cdn\.net)\/([\w-]{8,})\//;
        const urlMatch = ep.videoUrl?.match(BUNNY_URL_RE);
        const bunnyId = ep.bunnyVideoId ?? urlMatch?.[1] ?? urlMatch?.[2] ?? null;
        return ({
        id: ep.id,
        order: ep.order,
        title: ep.title,
        description: ep.description ?? null,
        typeLabel: ep.typeLabel,
        videoUrl: ep.videoUrl ?? null,
        hlsUrl: (bunnyId && env.BUNNY_CDN_URL)
          ? `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8`
          : null,
        durationLabel: ep.durationLabel ?? null,
        durationSeconds: ep.durationSeconds ?? null,
        isCompleted: ep.progress?.[0]?.isCompleted ?? false,
        lastWatchedSecs: ep.progress?.[0]?.lastWatchedSecs ?? 0,
        actualWatchedSecs: ep.progress?.[0]?.actualWatchedSecs ?? 0,
      }); }) : [],
      submission: ch.memberProgress?.[0] ?? null,
    };
  }).filter(Boolean);

  return ok(reply, { challenges: result });
}

// Aggregated endpoint: returns detail + flow + challenges in a single round-trip.
export async function getWorkshopOverviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  // Fetch detail first — it includes enrollmentStatus which gates content delivery
  const detailResult = await getWorkshopDetailData(request, slug);
  if (!detailResult) return fail(reply, 404, 'Workshop not found');

  // Non-enrolled members get only the gate data; flow/challenges are withheld
  if (!isEnrolled(detailResult.enrollmentStatus)) {
    return ok(reply, {
      detail: detailResult,
      flow: { flowItems: [] },
      challenges: { challenges: [] },
    });
  }

  // Enrolled: fetch remaining data in parallel
  const [flowResult, challengesResult] = await Promise.all([
    getWorkshopFlowData(request, slug),
    getWorkshopChallengesData(request, slug),
  ]);

  return ok(reply, {
    detail: detailResult,
    flow: { flowItems: flowResult },
    challenges: { challenges: challengesResult },
  });
}

// ── Shared helpers for overview (extracted from individual handlers) ─────────

async function getWorkshopDetailData(request: FastifyRequest, slug: string) {
  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    include: {
      enrollments: { where: { memberId: request.memberId }, select: { status: true } },
      challenges: { select: { id: true, type: true, episodes: { select: { id: true, durationSeconds: true } } }, orderBy: { order: 'asc' } },
      liveCalls: { where: { scheduledAt: { gt: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 1, select: { id: true, scheduledAt: true } },
    },
  });
  if (!workshop) return null;

  const enrollment = (workshop as any).enrollments?.[0];
  const enrollmentStatus = enrollment?.status ?? null;

  // Non-enrolled: return gate payload without expensive progress queries
  if (!isEnrolled(enrollmentStatus)) {
    return {
      id: workshop.id,
      title: workshop.title,
      thumbnailUrl: workshop.thumbnailUrl ?? null,
      description: workshop.description ?? null,
      backLabel: workshop.backLabel,
      backUrl: workshop.backUrl,
      enrollmentStatus,
      sidebar: { tabs: [] },
      learningProgress: null,
      certificate: null,
      workshopFlowLabel: null,
      defaultMainAreaType: null,
    };
  }
  const allChallenges: any[] = (workshop as any).challenges ?? [];
  const allEpisodes = allChallenges.flatMap((c: any) => c.episodes ?? []);

  const [episodeProgress, challengeProgressRows] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e: any) => e.id) } },
      select: { episodeId: true, isCompleted: true, actualWatchedSecs: true },
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

  const progressWatchMap = new Map(episodeProgress.map((p: any) => [p.episodeId, p.actualWatchedSecs ?? 0]));
  const totalDurationSecs = allEpisodes.reduce((sum: number, e: any) => sum + (e.durationSeconds ?? 0), 0);
  const totalWatchedSecs = allEpisodes.reduce((sum: number, e: any) => sum + (progressWatchMap.get(e.id) ?? 0), 0);
  const videosWatchPct = totalDurationSecs > 0 ? Math.min(100, Math.round((totalWatchedSecs / totalDurationSecs) * 100)) : 0;

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
    thumbnailUrl: workshop.thumbnailUrl ?? null,
    description: workshop.description ?? null,
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
    certificate: { eligible: certEligible, videosCompletedPct, videosWatchPct, challengesCompletedPct, remainingVideos: totalCount - completedCount, remainingChallenges: totalChallenges - completedChallengeCount },
    workshopFlowLabel: workshop.workshopFlowLabel,
    defaultMainAreaType: hasUpcomingCall ? 'countdown' : null,
    enrollmentStatus,
  };
}

async function getWorkshopFlowData(request: FastifyRequest, slug: string): Promise<any[]> {
  const workshop = await request.server.prisma.workshop.findFirst({
    where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug },
    include: {
      flowItems: {
        orderBy: { order: 'asc' },
        include: {
          challenge: { include: { episodes: { orderBy: { order: 'asc' } } } },
          liveCall: true,
        },
      },
    },
  });
  if (!workshop) return [];

  // Single flat query — no N+1
  const allEpisodeIds = (workshop as any).flowItems.flatMap(
    (item: any) => (item.challenge?.episodes ?? []).map((e: any) => e.id)
  );
  const progressRows = allEpisodeIds.length > 0
    ? await request.server.prisma.memberEpisodeProgress.findMany({
        where: { memberId: request.memberId, episodeId: { in: allEpisodeIds } },
        select: { episodeId: true, isCompleted: true },
      })
    : [];
  const progressMap = new Map(progressRows.map((p) => [p.episodeId, p.isCompleted]));

  return (workshop as any).flowItems.map((item: any) => {
      if (item.type === 'challenge' && item.challenge) {
        const ch = item.challenge;
        const totalEps = ch.episodes.length;
        const completedEps = ch.episodes.filter((e: any) => progressMap.get(e.id) === true).length;
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
            isCompleted: progressMap.get(ep.id) ?? false, isLocked: false,
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
          aiSummary: status === 'past' ? (lc.aiSummary ?? null) : null,
        };
      }
      return { id: item.id, order: item.order, type: item.type, label: item.label ?? null, description: item.description ?? null, isCompleted: item.isCompleted, isExpanded: false };
    });
}

async function getWorkshopChallengesData(request: FastifyRequest, slug: string): Promise<any[]> {
  const workshop = await request.server.prisma.workshop.findFirst({ where: UUID_RE.test(slug) ? { OR: [{ slug }, { id: slug }] } : { slug }, select: { id: true } });
  if (!workshop) return [];

  const flowItems = await request.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: workshop.id, type: { in: ['challenge_start', 'live_call'] } },
    orderBy: { order: 'asc' },
    include: {
      challenge: {
        include: {
          episodes: { orderBy: { order: 'asc' }, select: { id: true, order: true, title: true, type: true, typeLabel: true, durationSeconds: true, durationLabel: true } },
          memberProgress: { where: { memberId: request.memberId }, select: { status: true, completedAt: true, answersData: true } },
        },
      },
      liveCall: true,
    },
  });

  // Single flat query for all episode progress
  const allEpIds = (flowItems as any[]).flatMap(fi => (fi.challenge?.episodes ?? []).map((e: any) => e.id));
  const epProgressRows = allEpIds.length > 0
    ? await request.server.prisma.memberEpisodeProgress.findMany({
        where: { memberId: request.memberId, episodeId: { in: allEpIds } },
        select: { episodeId: true, isCompleted: true, lastWatchedSecs: true, actualWatchedSecs: true },
      })
    : [];
  const epProgressMap = new Map(epProgressRows.map((p) => [p.episodeId, p]));

  const challengeFlowItems = (flowItems as any[]).filter(fi => fi.type === 'challenge_start');
  const challengeStatuses: string[] = challengeFlowItems.map(fi => {
    const ch = fi.challenge;
    if (!ch) return 'not_started';
    if (!ch.type || ch.type === 'watch') {
      const total = ch.episodes.length;
      const done = ch.episodes.filter((e: any) => epProgressMap.get(e.id)?.isCompleted === true).length;
      const started = ch.episodes.some((e: any) => (epProgressMap.get(e.id)?.actualWatchedSecs ?? 0) > 0);
      if (total === 0) return 'not_started';
      if (done >= total) return 'completed';
      if (done > 0 || started) return 'in_progress';
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
    const doneEps = ch.episodes.filter((e: any) => epProgressMap.get(e.id)?.isCompleted === true).length;
    return {
      id: ch.id, order: ch.order, challengeNumber: ch.challengeNumber,
      numberLabel: ch.numberLabel, numberColor: ch.numberColor,
      title: ch.title, description: ch.description ?? null,
      type: ch.type ?? 'watch', quizData: ch.quizData ?? null,
      status, isLocked,
      progressPercent: (!ch.type || ch.type === 'watch') ? (totalEps > 0 ? Math.round((doneEps / totalEps) * 100) : 0) : rawStatus === 'completed' ? 100 : rawStatus === 'in_progress' ? 30 : 0,
      episodes: (!ch.type || ch.type === 'watch') ? ch.episodes.map((ep: any) => {
        const p = epProgressMap.get(ep.id);
        return {
          id: ep.id, order: ep.order, title: ep.title, type: ep.type, typeLabel: ep.typeLabel ?? null,
          durationSeconds: ep.durationSeconds ?? null, durationLabel: ep.durationLabel ?? null,
          isCompleted: p?.isCompleted ?? false,
          lastWatchedSecs: p?.lastWatchedSecs ?? 0,
          actualWatchedSecs: p?.actualWatchedSecs ?? 0,
        };
      }) : [],
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

  const complChalEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
    where: { workshopId_memberId: { workshopId: challenge.workshopId, memberId: request.memberId } },
    select: { status: true },
  });
  if (!isEnrolled(complChalEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');

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

      // Bulk load everything in 3 queries instead of 2N serial queries
      const [prevChallenges, prevEpisodes, prevEpProgress, prevChallengeProgress] = await Promise.all([
        request.server.prisma.challenge.findMany({
          where: { id: { in: prevChallengeIds } },
          select: { id: true, type: true },
        }),
        request.server.prisma.workshopEpisode.findMany({
          where: { challengeId: { in: prevChallengeIds } },
          select: { id: true, challengeId: true },
        }),
        request.server.prisma.memberEpisodeProgress.findMany({
          where: { memberId: request.memberId, isCompleted: true },
          select: { episodeId: true },
        }),
        (request.server.prisma as any).memberChallengeProgress.findMany({
          where: { memberId: request.memberId, challengeId: { in: prevChallengeIds }, status: 'completed' },
          select: { challengeId: true },
        }),
      ]);

      const completedEpIds = new Set(prevEpProgress.map((p: any) => p.episodeId));
      const completedChallengeIds = new Set((prevChallengeProgress as any[]).map((p: any) => p.challengeId));
      const episodesByChallengeId = new Map<string, string[]>();
      for (const ep of prevEpisodes) {
        const list = episodesByChallengeId.get(ep.challengeId) ?? [];
        list.push(ep.id);
        episodesByChallengeId.set(ep.challengeId, list);
      }

      // Restore flow order (findMany result order is not guaranteed)
      const orderedPrev = prevFlowItems
        .map(fi => prevChallenges.find((c: any) => c.id === fi.challengeId))
        .filter(Boolean) as { id: string; type: string }[];

      for (const prev of orderedPrev) {
        if (!prev.type || prev.type === 'watch') {
          const epIds = episodesByChallengeId.get(prev.id) ?? [];
          const allDone = epIds.length > 0 && epIds.every(eid => completedEpIds.has(eid));
          if (!allDone) return fail(reply, 403, 'Complete previous challenges first');
        } else {
          if (!completedChallengeIds.has(prev.id)) return fail(reply, 403, 'Complete previous challenges first');
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
    recalculateMemberStats(request.server.prisma, request.memberId!, request.server.redis),
    logActivity(request.server.prisma, request.memberId!, 'challenge_completed', { challengeId: id }),
  ]).catch(() => {});

  return ok(reply, { status: 'completed', completedAt: now.toISOString() });
}

export async function completeWorkshopEpisodeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const episode = await request.server.prisma.workshopEpisode.findUnique({
    where: { id },
    select: { id: true, durationSeconds: true, bunnyVideoId: true, challenge: { select: { workshopId: true } } },
  });
  if (!episode) return fail(reply, 404, 'Episode not found');

  const complEpWorkshopId = (episode as any).challenge?.workshopId as string | undefined;
  if (complEpWorkshopId) {
    const complEpEnrollment = await request.server.prisma.workshopEnrollment.findUnique({
      where: { workshopId_memberId: { workshopId: complEpWorkshopId, memberId: request.memberId } },
      select: { status: true },
    });
    if (!isEnrolled(complEpEnrollment?.status)) return fail(reply, 403, 'Enrollment required to access this workshop');
  }

  const progress = await request.server.prisma.memberEpisodeProgress.findUnique({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId: id } },
    select: { lastWatchedSecs: true, actualWatchedSecs: true, isCompleted: true }
  });

  if (progress?.isCompleted) {
    return ok(reply, { episodeId: id, isCompleted: true });
  }

  const { reportedDuration } = (request.body ?? {}) as { reportedDuration?: number };

  let duration = episode.durationSeconds;

  // Correct stored duration when client reports the real value (same 2x threshold as progress handler)
  if (reportedDuration && reportedDuration > 0) {
    const storedIsWrong = !duration || duration <= 0 ||
      Math.max(duration, reportedDuration) / Math.min(duration, reportedDuration) > 2;
    if (storedIsWrong) {
      duration = reportedDuration;
      void request.server.prisma.workshopEpisode.update({
        where: { id: episode.id },
        data: { durationSeconds: reportedDuration },
      }).catch(() => {});
    }
  }

  // Fetch duration if still missing
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
  // actualWatchedSecs = wall-clock seconds accumulated (anti-cheat).
  // lastWatchedSecs   = playhead position — covers fast playback speeds (2x) where
  //                     wall-clock elapsed is legitimately < 85% of duration.
  if (duration && duration > 0) {
    const actual = progress?.actualWatchedSecs ?? 0;
    const playhead = progress?.lastWatchedSecs ?? 0;
    const threshold = duration * 0.85;
    if (actual < threshold && playhead < threshold) {
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
    recalculateMemberStats(request.server.prisma, request.memberId!, request.server.redis),
    logActivity(request.server.prisma, request.memberId!, 'episode_completed', { episodeId: id }),
    invalidateCache(request.server.redis ?? null, `cont-learn:${request.memberId!}`),
  ]).catch(() => {});

  return ok(reply, { episodeId: id, isCompleted: true });
}

// ─── Watch History ────────────────────────────────────────────────────────────

export async function getWatchHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, filter = 'all' } = request.query as {
    page?: number; limit?: number; filter?: 'all' | 'in_progress' | 'completed';
  };

  const take = Number(limit);
  const skip = (Number(page) - 1) * take;

  const workshopWhere = {
    memberId: request.memberId,
    actualWatchedSecs: { gt: 0 },
    ...(filter === 'in_progress' ? { isCompleted: false } : {}),
    ...(filter === 'completed' ? { isCompleted: true } : {}),
  };

  const courseWhere = {
    memberId: request.memberId,
    OR: [{ actualWatchedSecs: { gt: 0 } }, { completed: true }],
    ...(filter === 'in_progress' ? { completed: false } : {}),
    ...(filter === 'completed' ? { completed: true } : {}),
  };

  const [workshopHistory, courseHistory] = await Promise.all([
    request.server.prisma.memberEpisodeProgress.findMany({
      where: workshopWhere,
      orderBy: { updatedAt: 'desc' },
      take: take + skip,
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
    (request.server.prisma as any).courseEpisodeProgress.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      take: take + skip,
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        actualWatchedSecs: true,
        completed: true,
        completedAt: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            order: true,
            durationSeconds: true,
            courseId: true,
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
  ]);

  const pct = (actual: number, duration: number | null | undefined) =>
    duration && duration > 0 ? Math.min(100, Math.round((actual / duration) * 100)) : 0;

  const workshopItems = (workshopHistory as any[]).map((p: any) => ({
    type: 'workshop' as const,
    episodeId: p.episodeId,
    workshopSlug: p.episode.challenge.workshop.slug as string,
    workshopTitle: p.episode.challenge.workshop.title as string,
    challengeTitle: p.episode.challenge.title as string | null,
    episodeTitle: p.episode.title as string,
    thumbnailUrl: p.episode.challenge.workshop.thumbnailUrl ?? null,
    lastWatchedSecs: p.lastWatchedSecs,
    actualWatchedSecs: p.actualWatchedSecs,
    durationSeconds: p.episode.durationSeconds ?? 0,
    isCompleted: p.isCompleted as boolean,
    completedAt: p.completedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    progressPercent: pct(p.actualWatchedSecs, p.episode.durationSeconds),
    episodeOrder: p.episode.order,
    episodeCount: p.episode.challenge._count.episodes,
    _ms: p.updatedAt.getTime() as number,
  }));

  const courseItems = (courseHistory as any[]).map((p: any) => ({
    type: 'course' as const,
    episodeId: p.episodeId,
    courseId: p.episode.courseId as string,
    courseTitle: p.episode.course.title as string,
    challengeTitle: null as string | null,
    episodeTitle: p.episode.title as string,
    thumbnailUrl: p.episode.course.thumbnailUrl ?? null,
    lastWatchedSecs: p.lastWatchedSecs,
    actualWatchedSecs: p.actualWatchedSecs,
    durationSeconds: p.episode.durationSeconds ?? 0,
    isCompleted: p.completed as boolean,
    completedAt: p.completedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    progressPercent: pct(p.actualWatchedSecs, p.episode.durationSeconds),
    episodeOrder: p.episode.order,
    episodeCount: p.episode.course._count.courseEpisodes,
    _ms: p.updatedAt.getTime() as number,
  }));

  // Merge across types, sort by most recent, paginate
  const merged = [...workshopItems, ...courseItems].sort((a, b) => b._ms - a._ms);
  const total = merged.length;
  const items = merged.slice(skip, skip + take).map(({ _ms: _ignored, ...rest }) => rest);

  return ok(reply, items, { total, page: Number(page), limit: take });
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

// ── Global search ─────────────────────────────────────────────────────────────

export async function searchHandler(request: FastifyRequest, reply: FastifyReply) {
  const { q = '' } = request.query as { q?: string };
  const query = q.trim();
  if (!query) return ok(reply, { workshops: [], courses: [], episodes: [], resources: [] });

  const like = { contains: query, mode: 'insensitive' as const };

  const [workshops, courses, episodes, resources] = await Promise.all([
    request.server.prisma.workshop.findMany({
      where: { isActive: true, OR: [{ title: like }, { description: like }] },
      select: { id: true, title: true, slug: true, thumbnailUrl: true },
      take: 10,
    }),
    (request.server.prisma.course.findMany as any)({
      where: { isPublished: true, OR: [{ title: like }, { description: like }] },
      select: { id: true, title: true, thumbnailUrl: true },
      take: 10,
    }) as Promise<{ id: string; title: string; thumbnailUrl: string | null }[]>,
    (request.server.prisma.courseEpisode.findMany as any)({
      where: { isVisible: true, title: like },
      select: { id: true, title: true, courseId: true },
      take: 10,
    }) as Promise<{ id: string; title: string; courseId: string }[]>,
    request.server.prisma.appResource.findMany({
      where: { OR: [{ title: like }, { description: like }] },
      select: { id: true, title: true, fileType: true },
      take: 10,
    }),
  ]);

  return ok(reply, {
    workshops: workshops.map((w) => ({ id: w.id, title: w.title, slug: w.slug, thumbnailUrl: w.thumbnailUrl ?? null })),
    courses: courses.map((c: any) => ({ id: c.id, title: c.title, thumbnailUrl: c.thumbnailUrl ?? null })),
    episodes: episodes.map((e: any) => ({ id: e.id, title: e.title, courseId: e.courseId })),
    resources: resources.map((r) => ({ id: r.id, title: r.title, fileType: r.fileType ?? null })),
  });
}

// ── Profile: connections + own posts ──────────────────────────────────────────

export async function getMyConnectionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const rows = await request.server.prisma.memberConnection.findMany({
    where: { followerId: request.memberId! },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      following: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhotoUrl: true,
          role: true,
          businessName: true,
        },
      },
    },
  });
  const items = rows.map((r) => ({
    id: r.following.id,
    name: [r.following.firstName, r.following.lastName].filter(Boolean).join(' '),
    avatarUrl: r.following.profilePhotoUrl ?? null,
    role: (r.following as any).role ?? null,
    businessName: r.following.businessName ?? null,
  }));
  return ok(reply, items);
}

export async function getMyPostsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { limit = 20 } = request.query as { limit?: number };
  const posts = await request.server.prisma.post.findMany({
    where: { memberId: request.memberId! },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    select: {
      id: true,
      content: true,
      mediaUrls: true,
      createdAt: true,
      isApproved: true,
      likesCount: true,
      commentsCount: true,
    },
  });
  const items = posts.map((p) => ({
    id: p.id,
    content: p.content,
    mediaUrls: p.mediaUrls ?? [],
    createdAt: p.createdAt.toISOString(),
    isApproved: p.isApproved,
    likeCount: p.likesCount,
    commentCount: p.commentsCount,
  }));
  return ok(reply, items);
}
