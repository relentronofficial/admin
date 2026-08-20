/**
 * Reusable "notify these members" helper.
 *
 * Consolidates the three separate delivery channels every notification path
 * has to touch — AppNotification (in-app inbox + badge), Socket.IO (live
 * push if the app is open), and Firebase Cloud Messaging (lockscreen push
 * if the app is closed) — so callers can't accidentally skip one.
 *
 * All three channels degrade gracefully:
 *   - AppNotification insert is a real DB write; failure is swallowed with
 *     a warn log (delivery attempt shouldn't bubble up as a 500).
 *   - Socket emit is fire-and-forget by design.
 *   - FCM send returns false if the token is stale or Firebase env is
 *     missing — the app_notifications row still lands.
 */

import type { FastifyInstance } from 'fastify';
import { sendPushNotification } from './firebase.js';

export interface NotifyMembersInput {
  memberIds: string[];
  title: string;
  body: string;
  /** AppNotification.type — e.g. "message", "group_message", "group_mention". */
  type: string;
  /** Deep-link the notification opens. Web + mobile share the same set. */
  actionUrl: string;
  /**
   * Extra key/value payload for FCM `data` (max 4 KB total). Stringified.
   * Web ignores; mobile can read via FirebaseMessaging.onMessage handlers.
   */
  data?: Record<string, string>;
  /** Emit a matching socket event alongside FCM/AppNotification. */
  socketEvent?: string;
  /** Payload for the socket event; defaults to `{ title, body, type, actionUrl }`. */
  socketPayload?: Record<string, unknown>;
}

/**
 * Fan-out notification to every memberId in parallel. Silent on individual
 * failures — this is a best-effort side effect from a mutation handler,
 * not a critical path.
 */
export async function notifyMembers(
  fastify: FastifyInstance,
  input: NotifyMembersInput,
): Promise<void> {
  const { memberIds, title, body, type, actionUrl, data, socketEvent, socketPayload } = input;
  if (memberIds.length === 0) return;

  const prisma = fastify.prisma;
  const io = (fastify as any).io;

  // 1) AppNotification row + recipients. Single insert with N recipients.
  try {
    await prisma.appNotification.create({
      data: {
        title,
        message: body,
        type,
        actionUrl,
        recipients: { create: memberIds.map((memberId) => ({ memberId })) },
      },
    });
  } catch (err) {
    fastify.log.warn({ err, memberIds }, 'notifyMembers: appNotification insert failed');
  }

  // 2) Socket emit. Per-user rooms so anyone with the app open sees the
  // Navbar badge + in-app toast without a round-trip.
  if (io) {
    const evt = socketEvent ?? 'notification';
    const payload = socketPayload ?? { title, body, type, actionUrl };
    for (const memberId of memberIds) {
      try {
        io.to(`user:${memberId}`).emit(evt, payload);
      } catch (err) {
        fastify.log.warn({ err, memberId }, 'notifyMembers: socket emit failed');
      }
    }
  }

  // 3) FCM push. Requires the member to have a push_token stored. Fetch
  // all tokens in one query — avoids N+1 in large groups.
  try {
    const rows = await prisma.member.findMany({
      where: { id: { in: memberIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
    if (rows.length === 0) return;

    // Coerce all data values to strings (FCM requires string map). Skip
    // in flight if any value is null/undefined so we don't crash the send.
    const fcmData: Record<string, string> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (v == null) continue;
        fcmData[k] = String(v);
      }
    }
    fcmData.type = type;
    fcmData.actionUrl = actionUrl;

    await Promise.all(
      rows.map((row) =>
        sendPushNotification(row.pushToken as string, title, body, fcmData).catch((err) => {
          fastify.log.warn({ err, memberId: row.id }, 'notifyMembers: FCM send failed');
          return false;
        }),
      ),
    );
  } catch (err) {
    fastify.log.warn({ err }, 'notifyMembers: FCM batch failed');
  }
}

/**
 * Filters a list of memberIds by group mute preference. Members whose
 * `chat_group_members.muted_until` is in the future are excluded — they
 * still get the socket event (in-app badge), but no FCM lockscreen ping.
 *
 * Uses raw SQL because chat_group_members is not in Prisma schema.
 */
export async function filterUnmutedMembers(
  fastify: FastifyInstance,
  groupId: string,
  memberIds: string[],
): Promise<string[]> {
  if (memberIds.length === 0) return [];
  try {
    const rows = await fastify.prisma.$queryRawUnsafe<Array<{ member_id: string }>>(
      `SELECT member_id FROM chat_group_members
       WHERE group_id = $1::uuid
         AND left_at IS NULL
         AND member_id = ANY($2::uuid[])
         AND (muted_until IS NULL OR muted_until < NOW())`,
      groupId,
      memberIds,
    );
    return rows.map((r) => r.member_id);
  } catch (err) {
    fastify.log.warn({ err, groupId }, 'filterUnmutedMembers failed — falling back to all');
    return memberIds;
  }
}
