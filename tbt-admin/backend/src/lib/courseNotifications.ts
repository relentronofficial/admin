import { sendPushNotification } from './firebase.js';
import { sendWhatsappMessage } from './whatsapp.js';

interface Ctx {
  prisma: any;
  io: any;
  memberId: string;
}

async function getMemberNotifDetails(prisma: any, memberId: string) {
  const m = await prisma.member.findUnique({
    where: { id: memberId },
    select: { phone: true, pushToken: true },
  }).catch(() => null);
  return { phone: m?.phone ?? null, pushToken: m?.pushToken ?? null };
}

async function createInApp(prisma: any, memberId: string, title: string, message: string, type: string, actionUrl?: string) {
  return prisma.appNotification.create({
    data: {
      title, message, type,
      actionUrl: actionUrl ?? null,
      recipients: { create: [{ memberId }] },
    },
  });
}

function emit(io: any, memberId: string, title: string, body: string, type: string) {
  io.to(`user:${memberId}`).emit('notification', { title, body, type });
}

/**
 * True when the member already holds usable access to the course (active and not
 * expired). Read BEFORE a grant upsert so a re-grant — admin re-saving access, a
 * second payment approval, the Razorpay webhook racing /verify — doesn't send
 * another "Course Access Granted" notification for access the member already had.
 */
export async function hasLiveCourseAccess(prisma: any, memberId: string, courseId: string): Promise<boolean> {
  const row = await prisma.courseAccess
    .findUnique({ where: { memberId_courseId: { memberId, courseId } }, select: { isActive: true, expiresAt: true } })
    .catch(() => null);
  if (!row?.isActive) return false;
  return !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now();
}

export async function notifyCourseAccessGranted(
  ctx: Ctx & { courseId: string; courseTitle: string; alreadyHadAccess?: boolean },
): Promise<void> {
  const { prisma, io, memberId, courseId, courseTitle } = ctx;
  if (ctx.alreadyHadAccess) {
    // Nothing new for the member to hear about — just let open course pages refetch.
    io?.to(`user:${memberId}`).emit('course:access_granted', { courseId });
    return;
  }
  const title = 'Course Access Granted';
  const body = `You now have access to "${courseTitle}". Start learning now!`;
  await createInApp(prisma, memberId, title, body, 'course_access', `/learning/${courseId}`);
  emit(io, memberId, title, body, 'course_access');
  // Dedicated event so the course page can invalidate its query cache immediately
  io?.to(`user:${memberId}`).emit('course:access_granted', { courseId });
  const { phone, pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
  if (phone) await sendWhatsappMessage(phone, `${title}: ${body}`);
}

export async function notifyCourseEnrolled(ctx: Ctx & { courseId: string; courseTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, courseTitle } = ctx;
  const title = 'Enrollment Confirmed';
  const body = `Welcome to "${courseTitle}"! Start your first lesson.`;
  await createInApp(prisma, memberId, title, body, 'course_enroll', `/learning/${courseId}`);
  emit(io, memberId, title, body, 'course_enroll');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
}

export async function notifyEpisodeCompleted(ctx: Ctx & { courseId: string; episodeId: string; episodeTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, episodeId, episodeTitle } = ctx;
  const title = 'Episode Completed';
  const body = `"${episodeTitle}" done! Keep the streak going.`;
  await createInApp(prisma, memberId, title, body, 'episode_complete', `/learning/${courseId}?lesson=${episodeId}`);
  emit(io, memberId, title, body, 'episode_complete');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId, episodeId });
}

export async function notifyCourseCompleted(ctx: Ctx & { courseId: string; courseTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, courseTitle } = ctx;
  const title = 'Course Completed!';
  const body = `Congratulations! You completed "${courseTitle}". Download your certificate.`;
  await createInApp(prisma, memberId, title, body, 'course_complete', `/learning/${courseId}`);
  emit(io, memberId, title, body, 'course_complete');
  const { phone, pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
  if (phone) await sendWhatsappMessage(phone, `${title} ${body}`);
}

export async function notifyQuizPassed(ctx: Ctx & { courseId: string; episodeId: string; episodeTitle: string; score: number; xp: number }): Promise<void> {
  const { prisma, io, memberId, courseId, episodeId, episodeTitle, score, xp } = ctx;
  const title = 'Quiz Passed!';
  const body = `You scored ${score}% on the "${episodeTitle}" quiz! +${xp} XP`;
  await createInApp(prisma, memberId, title, body, 'quiz_pass', `/learning/${courseId}?lesson=${episodeId}`);
  emit(io, memberId, title, body, 'quiz_pass');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId, episodeId });
}

export async function notifyBadgeAwarded(ctx: Ctx & { badgeId: string; badgeLabel: string }): Promise<void> {
  const { prisma, io, memberId, badgeId, badgeLabel } = ctx;
  const title = 'Badge Earned!';
  const body = `You earned the "${badgeLabel}" badge!`;
  await createInApp(prisma, memberId, title, body, 'badge_award', '/learning/badges');
  emit(io, memberId, title, body, 'badge_award');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { badgeId });
}
