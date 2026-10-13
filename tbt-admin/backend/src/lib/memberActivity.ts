// Daily Time Spent — storage helpers (table created in plugins/prisma.ts).
// Pure summary logic lives in memberActivityLogic.ts.
//
// Every recorded minute uses the DATABASE clock (now()), never a client
// timestamp, so a client cannot backdate or inflate activity. Setting a bit in
// the per-day minute map is idempotent: repeated heartbeats, retries and
// several devices active in the same minute all count as one minute.

import type { DailyActivityRow } from './memberActivityLogic.js';

/** All TBT members are India-based; daily totals use IST. */
export const ACTIVITY_TIMEZONE = 'Asia/Kolkata';

type PrismaLike = {
  $executeRawUnsafe: (...args: any[]) => Promise<any>;
  $queryRawUnsafe: <T = any>(...args: any[]) => Promise<T>;
};

const LOCAL_NOW = `(now() AT TIME ZONE '${ACTIVITY_TIMEZONE}')`;
const MINUTE_INDEX = `(EXTRACT(HOUR FROM ${LOCAL_NOW}) * 60 + EXTRACT(MINUTE FROM ${LOCAL_NOW}))::int`;
const EMPTY_BITS = `repeat('0', 1440)::bit(1440)`;

/** Mark the current minute as active for a member (and as media time if `media`). */
export async function recordActiveMinute(prisma: PrismaLike, memberId: string, media: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO member_daily_activity
       (member_id, activity_date, active_bits, media_bits, heartbeat_count, first_active_at, last_active_at)
     VALUES (
       $1::uuid,
       ${LOCAL_NOW}::date,
       set_bit(${EMPTY_BITS}, ${MINUTE_INDEX}, 1),
       CASE WHEN $2::boolean THEN set_bit(${EMPTY_BITS}, ${MINUTE_INDEX}, 1) ELSE ${EMPTY_BITS} END,
       1, now(), now()
     )
     ON CONFLICT (member_id, activity_date) DO UPDATE SET
       active_bits     = set_bit(member_daily_activity.active_bits, ${MINUTE_INDEX}, 1),
       media_bits      = CASE WHEN $2::boolean
                           THEN set_bit(member_daily_activity.media_bits, ${MINUTE_INDEX}, 1)
                           ELSE member_daily_activity.media_bits END,
       heartbeat_count = member_daily_activity.heartbeat_count + 1,
       last_active_at  = now()`,
    memberId,
    media,
  );
}

/** Fire-and-forget variant for request handlers: never throws, never blocks the response. */
export function trackActivity(prisma: PrismaLike, memberId: string | undefined, media: boolean): void {
  if (!memberId) return;
  void recordActiveMinute(prisma, memberId, media).catch(() => {});
}

/** Today's date in ACTIVITY_TIMEZONE, from the database clock. */
export async function getActivityToday(prisma: PrismaLike): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ d: string }[]>(`SELECT to_char(${LOCAL_NOW}::date, 'YYYY-MM-DD') AS d`);
  return rows[0].d;
}

/** First date on which any member activity was recorded (= when tracking went live), or null. */
export async function getTrackingStartDate(prisma: PrismaLike): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT to_char(MIN(activity_date), 'YYYY-MM-DD') AS d FROM member_daily_activity`,
  );
  return rows[0]?.d ?? null;
}

export async function getMemberDailyRows(prisma: PrismaLike, memberId: string, fromDate: string): Promise<DailyActivityRow[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT to_char(activity_date, 'YYYY-MM-DD') AS date,
            length(replace(active_bits::text, '0', ''))::int AS active_minutes,
            length(replace(media_bits::text,  '0', ''))::int AS media_minutes,
            first_active_at, last_active_at
       FROM member_daily_activity
      WHERE member_id = $1::uuid AND activity_date >= $2::date
      ORDER BY activity_date DESC`,
    memberId,
    fromDate,
  );
  return rows.map((r) => ({
    date: r.date,
    activeMinutes: Number(r.active_minutes),
    mediaMinutes: Number(r.media_minutes),
    firstActiveAt: r.first_active_at ? new Date(r.first_active_at).toISOString() : null,
    lastActiveAt: r.last_active_at ? new Date(r.last_active_at).toISOString() : null,
  }));
}

export async function getMemberLastActiveAt(prisma: PrismaLike, memberId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ t: Date | null }[]>(
    `SELECT MAX(last_active_at) AS t FROM member_daily_activity WHERE member_id = $1::uuid`,
    memberId,
  );
  return rows[0]?.t ? new Date(rows[0].t).toISOString() : null;
}
