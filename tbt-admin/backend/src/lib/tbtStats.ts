/**
 * Canonical member points/streak from the `tbt_activity_log` ledger.
 *
 * Historically two parallel point systems coexisted:
 *   * System A — `members.total_points`, computed heuristically from
 *     workshop episode / challenge / assignment counts × per-source
 *     multipliers, plus a sum of `member_xp.amount` for course XP.
 *   * System B — `tbt_activity_log`, an append-only ledger written by
 *     the 90-day TBT task completion flow.
 *
 * The profile stats row surfaced System A; the TBT Points screen
 * surfaced System B; completing a task in one bucket didn't move the
 * other, so the two numbers diverged. This helper unifies both around
 * the ledger:
 *
 *   1. Lazy backfill — for every source that used to be counted by the
 *      heuristic, we insert a matching ledger row (idempotent via the
 *      partial unique index on `(member_id, source, reference_id)`).
 *      Subsequent calls are no-ops.
 *   2. Sum + streak — `totalPoints = SUM(tbt_activity_log.points)`,
 *      `currentStreak = distinct activity_date counted back from today`
 *      (same rule as the co-worker's `TbtPointsService`).
 *
 * Callers: `recalculateMemberStats` in the user module (persists to
 * `members.total_points` / `.current_streak`) and `_fetchMemberSummary`
 * in the gamification module (returns to the TBT Points screen).
 */

type PrismaLike = {
  $executeRawUnsafe: (...args: any[]) => Promise<any>;
  $queryRawUnsafe: <T = any>(...args: any[]) => Promise<T>;
};

const WORKSHOP_EPISODE_POINTS = 10;
const WORKSHOP_CHALLENGE_POINTS = 25;
const WORKSHOP_ASSIGNMENT_POINTS = 15;

export async function syncLegacyPointsToLedger(
  prisma: PrismaLike,
  memberId: string,
): Promise<void> {
  // Each INSERT scans the member's rows in the source table and upserts
  // the matching ledger row. `ON CONFLICT DO NOTHING` on the partial
  // unique index makes repeated calls cheap — only genuinely new rows
  // hit disk.

  // Workshop episodes — one point event per completed row.
  await prisma.$executeRawUnsafe(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     SELECT $1::uuid, $2::int, 'workshop_episode', mep.id, COALESCE(mep.completed_at, mep.updated_at)::date
     FROM member_episode_progress mep
     WHERE mep.member_id = $1::uuid AND mep.is_completed = true
     ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
    memberId,
    WORKSHOP_EPISODE_POINTS,
  );

  // Workshop challenges.
  await prisma.$executeRawUnsafe(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     SELECT $1::uuid, $2::int, 'workshop_challenge', mcp.id, COALESCE(mcp.completed_at, mcp.updated_at, mcp.created_at)::date
     FROM member_challenge_progress mcp
     WHERE mcp.member_id = $1::uuid AND mcp.status = 'completed'
     ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
    memberId,
    WORKSHOP_CHALLENGE_POINTS,
  );

  // Assignment submissions.
  await prisma.$executeRawUnsafe(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     SELECT $1::uuid, $2::int, 'workshop_assignment', a.id, a.submitted_at::date
     FROM assignment_submissions a
     WHERE a.member_id = $1::uuid
     ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
    memberId,
    WORKSHOP_ASSIGNMENT_POINTS,
  );

  // Course XP — carries its own point amount per row, so pass it through.
  await prisma.$executeRawUnsafe(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     SELECT $1::uuid, x.amount, 'course_xp', x.id, x.earned_at::date
     FROM member_xp x
     WHERE x.member_id = $1::uuid
     ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
    memberId,
  );
}

export type MemberStats = {
  totalPoints: number;
  currentStreak: number;
};

export async function computeMemberStats(
  prisma: PrismaLike,
  memberId: string,
): Promise<MemberStats> {
  await syncLegacyPointsToLedger(prisma, memberId);

  const [sumRow] = await prisma.$queryRawUnsafe<Array<{ sum: bigint | null }>>(
    `SELECT COALESCE(SUM(points), 0)::bigint AS sum
     FROM tbt_activity_log
     WHERE member_id = $1::uuid`,
    memberId,
  );
  const totalPoints = Number(sumRow?.sum ?? 0);

  const dateRows = await prisma.$queryRawUnsafe<Array<{ activity_date: Date }>>(
    `SELECT DISTINCT activity_date
     FROM tbt_activity_log
     WHERE member_id = $1::uuid
     ORDER BY activity_date DESC`,
    memberId,
  );
  const dateKeys = new Set(
    dateRows.map((r) => {
      const d = new Date(r.activity_date);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }),
  );

  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 366; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    if (dateKeys.has(key)) currentStreak++;
    else if (i === 0) continue; // today can be empty; still allow yesterday
    else break;
  }

  return { totalPoints, currentStreak };
}
