import { sendPushNotificationDetailed } from './firebase.js';

/**
 * Sends a push to every registered device for a member (NotificationDevice
 * rows), falling back to the legacy single member.pushToken when no device
 * rows exist yet. Prunes device rows / clears pushToken when FCM reports the
 * token as dead, so stale tokens don't accumulate. Never throws.
 */
export async function sendPushToMember(
  prisma: any,
  memberId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const devices: { id: string; fcmToken: string }[] = await prisma.notificationDevice
    .findMany({ where: { memberId }, select: { id: true, fcmToken: true } })
    .catch(() => []);

  let targets: { id?: string; fcmToken: string }[] = devices;
  if (targets.length === 0) {
    const member = await prisma.member
      .findUnique({ where: { id: memberId }, select: { pushToken: true } })
      .catch(() => null);
    if (member?.pushToken) targets = [{ fcmToken: member.pushToken }];
  }

  await Promise.all(targets.map(async (t) => {
    const result = await sendPushNotificationDetailed(t.fcmToken, title, body, data);
    if (result.invalidToken) {
      if (t.id) await prisma.notificationDevice.delete({ where: { id: t.id } }).catch(() => {});
      await prisma.member
        .updateMany({ where: { id: memberId, pushToken: t.fcmToken }, data: { pushToken: null } })
        .catch(() => {});
    }
  }));
}
