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

  // 1. Mark payment completed
  await prisma.$executeRawUnsafe(
    `UPDATE course_payments
     SET status='completed', razorpay_payment_id=$1, razorpay_signature=$2,
         reference=$1, updated_at=NOW()
     WHERE id=$3::uuid`,
    razorpayPaymentId,
    razorpaySignature ?? null,
    paymentRecordId,
  );

  // 2. Upsert CourseAccess
  const hasDuration = accessDurationDays != null && accessDurationDays > 0;
  const expiresAt = hasDuration
    ? new Date(Date.now() + accessDurationDays! * 24 * 60 * 60 * 1000)
    : null;

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
