import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { invalidateCache, type RedisLike } from './cache.js';

/**
 * Notifies a member through the one path the member-facing notification
 * center actually reads: `AppNotification` + `AppNotificationRecipient`
 * (see modules/app-notifications/controller.ts) — NOT the `Notification`
 * Prisma model, which `GET /api/user/notifications` never queries. Also
 * emits the live socket event and busts the unread-count cache, mirroring
 * `createNotificationHandler`'s per-member path exactly.
 */
export async function notifyMember(
  prisma: PrismaClient,
  io: SocketIOServer,
  redis: RedisLike | null,
  payload: { memberId: string; title: string; message: string; type?: string; actionUrl?: string },
): Promise<void> {
  const { memberId, title, message, type = 'info', actionUrl } = payload;
  try {
    await prisma.appNotification.create({
      data: {
        title,
        message,
        type,
        actionUrl: actionUrl ?? null,
        recipients: { create: [{ memberId }] },
      },
    });
  } catch (err) {
    // Non-fatal — the socket toast below still fires even if the DB write fails.
    console.warn('[memberNotifications] DB write failed:', err);
  }

  io.to(`user:${memberId}`).emit('notification', {
    title,
    body: message,
    type,
    actionUrl: actionUrl ?? undefined,
  });

  void invalidateCache(redis, `notif:unread:${memberId}`);
}
