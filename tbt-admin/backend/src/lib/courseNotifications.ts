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

export async function notifyCourseAccessGranted(ctx: Ctx & { courseId: string; courseTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, courseTitle } = ctx;
  const title = 'Course Access Granted';
  const body = `You now have access to "${courseTitle}". Start learning now!`;
  await createInApp(prisma, memberId, title, body, 'course_access', `/tbt/programs/${courseId}`);
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
  await createInApp(prisma, memberId, title, body, 'course_enroll', `/tbt/learning/${courseId}`);
  emit(io, memberId, title, body, 'course_enroll');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
}

export async function notifyEpisodeCompleted(ctx: Ctx & { courseId: string; episodeTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, episodeTitle } = ctx;
  const title = 'Episode Completed';
  const body = `"${episodeTitle}" done! Keep the streak going.`;
  await createInApp(prisma, memberId, title, body, 'episode_complete', `/tbt/learning/${courseId}`);
  emit(io, memberId, title, body, 'episode_complete');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
}

export async function notifyCourseCompleted(ctx: Ctx & { courseId: string; courseTitle: string }): Promise<void> {
  const { prisma, io, memberId, courseId, courseTitle } = ctx;
  const title = 'Course Completed!';
  const body = `Congratulations! You completed "${courseTitle}". Download your certificate.`;
  await createInApp(prisma, memberId, title, body, 'course_complete', `/tbt/learning/${courseId}`);
  emit(io, memberId, title, body, 'course_complete');
  const { phone, pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
  if (phone) await sendWhatsappMessage(phone, `${title} ${body}`);
}

export async function notifyQuizPassed(ctx: Ctx & { courseId: string; episodeTitle: string; score: number; xp: number }): Promise<void> {
  const { prisma, io, memberId, courseId, episodeTitle, score, xp } = ctx;
  const title = 'Quiz Passed!';
  const body = `You scored ${score}% on the "${episodeTitle}" quiz! +${xp} XP`;
  await createInApp(prisma, memberId, title, body, 'quiz_pass', `/tbt/learning/${courseId}`);
  emit(io, memberId, title, body, 'quiz_pass');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { courseId });
}

export async function notifyBadgeAwarded(ctx: Ctx & { badgeId: string; badgeLabel: string }): Promise<void> {
  const { prisma, io, memberId, badgeId, badgeLabel } = ctx;
  const title = 'Badge Earned!';
  const body = `You earned the "${badgeLabel}" badge!`;
  await createInApp(prisma, memberId, title, body, 'badge_award');
  emit(io, memberId, title, body, 'badge_award');
  const { pushToken } = await getMemberNotifDetails(prisma, memberId);
  if (pushToken) await sendPushNotification(pushToken, title, body, { badgeId });
}
