import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { createAdminNotification } from './adminNotifications.js';
import { invalidateCache } from './cache.js';

interface GrantParams {
  prisma: PrismaClient;
  io: Server | null;
  redis: any;
  paymentRecordId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  memberId: string;
  courseId: string;
  accessDurationDays: number | null;
}

export async function grantCourseAccessAfterPayment(params: GrantParams): Promise<void> {
  const { prisma, io, redis, paymentRecordId, razorpayPaymentId, razorpaySignature, memberId, courseId, accessDurationDays } = params;

  // 1. Mark payment completed — always stamp method='razorpay' so records originally
  //    created with method='external'/'manual' are corrected when paid via Razorpay.
  await prisma.$executeRawUnsafe(
    `UPDATE course_payments
     SET status='completed', method='razorpay', razorpay_payment_id=$1, razorpay_signature=$2,
         reference=$1, paid_at=NOW(), updated_at=NOW()
     WHERE id=$3::uuid`,
    razorpayPaymentId,
    razorpaySignature ?? null,
    paymentRecordId,
  );

  // 2. Upsert CourseAccess
  let hasDuration = accessDurationDays != null && accessDurationDays > 0;
  let expiresAt = hasDuration
    ? new Date(Date.now() + accessDurationDays! * 24 * 60 * 60 * 1000)
    : null;
  // A purchase never shortens access the member already holds: active lifetime access
  // stays lifetime, and a later existing expiry is kept.
  const existing = await (prisma as any).courseAccess.findUnique({
    where: { memberId_courseId: { memberId, courseId } },
    select: { isActive: true, accessType: true, expiresAt: true },
  }).catch(() => null);
  if (existing?.isActive && hasDuration) {
    if (existing.accessType === 'lifetime') {
      hasDuration = false;
      expiresAt = null;
    } else if (existing.expiresAt && expiresAt && existing.expiresAt > expiresAt) {
      expiresAt = existing.expiresAt;
    }
  }

  await (prisma as any).courseAccess.upsert({
    where: { memberId_courseId: { memberId, courseId } },
    create: {
      memberId,
      courseId,
      accessType: hasDuration ? 'duration' : 'lifetime',
      expiresAt,
      isActive: true,
      paymentId: paymentRecordId,
    },
    update: {
      isActive: true,
      revokedAt: null,
      revokedBy: null,
      paymentId: paymentRecordId,
      accessType: hasDuration ? 'duration' : 'lifetime',
      expiresAt,
    },
  });

  // 3. Upsert CourseEnrollment (progress = 0)
  await (prisma as any).courseEnrollment.upsert({
    where: { memberId_courseId: { memberId, courseId } },
    create: { memberId, courseId, progressPercentage: 0 },
    update: {},
  }).catch(() => {});

  // 4. Emit socket event to member
  try {
    io?.to(`user:${memberId}`).emit('course:access_granted', { courseId });
  } catch {}

  // 5. Fetch course title once — used by both member notification and admin notification
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }).catch(() => null);
  const courseTitle = course?.title ?? courseId;

  // 6. In-app notification to member (best-effort)
  void prisma.appNotification.create({
    data: {
      title: 'Course Access Granted',
      message: `You now have access to "${courseTitle}". Start learning!`,
      type: 'course_access',
      actionUrl: `/learning/${courseId}`,
      recipients: { create: [{ memberId }] },
    },
  }).catch(() => {});

  // 7. Notify admin
  void createAdminNotification(prisma, {
    title: 'Course Payment Received',
    body: `Razorpay payment received for "${courseTitle}".`,
    type: 'course_access_request',
    metadata: { memberId, courseId, paymentId: paymentRecordId, method: 'razorpay' },
  }).catch(() => {});

  // 8. Invalidate me cache
  void invalidateCache(redis, `me:${memberId}`);
}

// ── Package purchases (Bundle / All Packages) ───────────────────────────────
//
// A course_payments row is anchored to the course page it was bought from
// (course_id), but a package covers more courses. Every grant path — the
// Razorpay webhook and the /verify handlers — must resolve the full set from
// here, or whichever path completes the payment first decides what the member
// gets. (Bug 2026-11-14: the webhook beat /verify and granted only the anchor.)

export interface PaymentForGrant {
  id: string;
  member_id: string;
  course_id: string;
  payment_type: string | null;
  bundle_data: unknown;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
}

/** Courses a payment unlocks: all published mini courses (all_access), the bundle's courses (bundle), else the anchor. */
export async function resolvePaymentCourseIds(prisma: PrismaClient, payment: PaymentForGrant): Promise<string[]> {
  const ids = new Set<string>([payment.course_id]);
  if (payment.payment_type === 'all_access') {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM courses WHERE course_type = 'mini_course' AND is_published = true`,
    );
    for (const r of rows) ids.add(r.id);
  } else if (payment.payment_type === 'bundle') {
    let data: any = payment.bundle_data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
    for (const id of Array.isArray(data?.courseIds) ? data.courseIds : []) if (typeof id === 'string') ids.add(id);
  }
  return [...ids];
}

export async function loadPaymentForGrant(prisma: PrismaClient, paymentRecordId: string): Promise<PaymentForGrant | null> {
  const [row] = await prisma.$queryRawUnsafe<PaymentForGrant[]>(
    `SELECT id, member_id, course_id, payment_type, bundle_data, razorpay_payment_id, razorpay_signature
     FROM course_payments WHERE id = $1::uuid`,
    paymentRecordId,
  );
  return row ?? null;
}

/**
 * Grants every course a payment covers.
 *  mode 'complete' — first completion: grant all (access duration from the anchor
 *                    course for single/bundle; each course's own for All Packages).
 *  mode 'repair'   — payment already completed: grant only courses the member has
 *                    no active access to (no duplicate notifications), so a late
 *                    /verify or an admin repair fills in what an earlier path missed.
 */
export async function grantPaymentAccess(params: {
  prisma: PrismaClient;
  io: Server | null;
  redis: any;
  payment: PaymentForGrant;
  /** Omit (admin repair) to keep the ids already stored on the payment row. */
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  mode: 'complete' | 'repair';
  log?: { error: (obj: unknown, msg?: string) => void };
}): Promise<{ courseIds: string[]; granted: string[]; failed: string[] }> {
  const { prisma, payment, mode } = params;
  const courseIds = await resolvePaymentCourseIds(prisma, payment);

  let targets = courseIds;
  if (mode === 'repair') {
    const active = await (prisma as any).courseAccess.findMany({
      where: {
        memberId: payment.member_id,
        courseId: { in: courseIds },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { courseId: true },
    });
    const have = new Set(active.map((a: { courseId: string }) => a.courseId));
    targets = courseIds.filter((id) => !have.has(id));
  }

  // Access period: single/bundle purchases use the anchor course's setting for every
  // course they cover; All Packages gives each course its own setting, exactly as if
  // that course were bought alone (null = lifetime).
  const durationRows = await prisma.$queryRawUnsafe<{ id: string; access_duration_days: number | null }[]>(
    `SELECT id::text AS id, access_duration_days FROM courses WHERE id = ANY($1::uuid[])`,
    [...new Set([payment.course_id, ...targets])],
  ).catch(() => []);
  const durationOf = new Map(durationRows.map((r) => [r.id, r.access_duration_days != null ? Number(r.access_duration_days) : null]));
  const anchorDuration = durationOf.get(payment.course_id) ?? null;
  const durationFor = (courseId: string) =>
    payment.payment_type === 'all_access' ? (durationOf.get(courseId) ?? null) : anchorDuration;

  const granted: string[] = [];
  const failed: string[] = [];
  // Sequential: each grant also stamps the same payment row; no need to race them.
  for (const courseId of targets) {
    try {
      await grantCourseAccessAfterPayment({
        prisma, io: params.io, redis: params.redis,
        paymentRecordId: payment.id,
        razorpayPaymentId: params.razorpayPaymentId || payment.razorpay_payment_id || '',
        razorpaySignature: params.razorpaySignature ?? payment.razorpay_signature ?? undefined,
        memberId: payment.member_id,
        courseId,
        accessDurationDays: durationFor(courseId),
      });
      granted.push(courseId);
    } catch (err) {
      failed.push(courseId);
      params.log?.error({ err, paymentId: payment.id, courseId }, 'package course grant failed');
    }
  }
  return { courseIds, granted, failed };
}
