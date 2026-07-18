import type { PrismaClient } from '@prisma/client';

/**
 * Per-member daily + per-minute rate limits for the AI Content Buddy.
 *
 * Ported from the co-worker's `middleware/aiUsageGuard.js` but re-shaped
 * as a plain function (not Express middleware) so it can be called
 * inline from the Fastify handler before we do any expensive Claude
 * work. Same limits as the spec: 30/day, 10/minute — configurable via
 * env if we ever need to relax them for VIP members.
 *
 * Counters live in `ai_usage_counters` keyed by (member_id, window_type,
 * window_start). Each window's `count` is incremented atomically via
 * upsert; we bump the count only on successful Claude responses to
 * avoid burning quota on 500s (the co-worker's version bumped before
 * the call which was pessimistic — we do it after).
 */

export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 30);
export const PER_MINUTE_LIMIT = Number(process.env.AI_PER_MINUTE_LIMIT ?? 10);

type WindowType = 'day' | 'minute';

function startOfWindow(kind: WindowType, now = new Date()): Date {
  const d = new Date(now);
  if (kind === 'day') {
    d.setUTCHours(0, 0, 0, 0);
  } else {
    d.setUTCSeconds(0, 0);
  }
  return d;
}

/**
 * Returns null if the caller may proceed. Returns a { code, retryAfter }
 * object if either window is full — the handler should 429 with the code.
 */
export async function checkUsage(
  prisma: PrismaClient,
  memberId: string,
): Promise<{ code: 'daily_limit_reached' | 'rate_limited'; retryAfterSeconds: number } | null> {
  const now = new Date();
  const dayStart = startOfWindow('day', now);
  const minuteStart = startOfWindow('minute', now);

  const [dayRow, minuteRow] = await Promise.all([
    prisma.aIUsageCounter.findUnique({
      where: {
        memberId_windowType_windowStart: { memberId, windowType: 'day', windowStart: dayStart },
      },
    }),
    prisma.aIUsageCounter.findUnique({
      where: {
        memberId_windowType_windowStart: {
          memberId,
          windowType: 'minute',
          windowStart: minuteStart,
        },
      },
    }),
  ]);

  if ((dayRow?.count ?? 0) >= DAILY_LIMIT) {
    // seconds until next UTC midnight
    const nextMidnight = new Date(dayStart);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    return { code: 'daily_limit_reached', retryAfterSeconds: Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000) };
  }
  if ((minuteRow?.count ?? 0) >= PER_MINUTE_LIMIT) {
    const nextMinute = new Date(minuteStart);
    nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1);
    return { code: 'rate_limited', retryAfterSeconds: Math.ceil((nextMinute.getTime() - now.getTime()) / 1000) };
  }
  return null;
}

/**
 * Bump both the daily and per-minute counters atomically. Called only
 * after a successful Claude call — a failed call doesn't burn quota.
 */
export async function bumpUsage(prisma: PrismaClient, memberId: string): Promise<void> {
  const now = new Date();
  const dayStart = startOfWindow('day', now);
  const minuteStart = startOfWindow('minute', now);

  await Promise.all([
    prisma.aIUsageCounter.upsert({
      where: {
        memberId_windowType_windowStart: { memberId, windowType: 'day', windowStart: dayStart },
      },
      create: { memberId, windowType: 'day', windowStart: dayStart, count: 1 },
      update: { count: { increment: 1 } },
    }),
    prisma.aIUsageCounter.upsert({
      where: {
        memberId_windowType_windowStart: {
          memberId,
          windowType: 'minute',
          windowStart: minuteStart,
        },
      },
      create: { memberId, windowType: 'minute', windowStart: minuteStart, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);
}
