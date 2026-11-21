// Loads a member's weekly-report status from the DB. The rules live in the pure
// weeklyReportGate.ts; this file only fetches the two timestamps they need.
import { computeWeeklyReportStatus, type WeeklyReportStatus } from './weeklyReportGate.js';

/** Error text the video endpoints return while locked (shown as-is by the mobile app). */
export const WEEKLY_REPORT_REQUIRED = 'Submit your weekly report to continue watching course videos.';

export async function loadWeeklyReportStatus(
  prisma: { $queryRawUnsafe: <T = unknown>(q: string, ...v: unknown[]) => Promise<T> },
  memberId: string,
  now: Date = new Date(),
): Promise<WeeklyReportStatus> {
  const rows = await prisma.$queryRawUnsafe<{ last_submitted_at: Date | null; first_enrolled_at: Date | null }[]>(
    `SELECT
       (SELECT MAX(submitted_at) FROM course_weekly_feedback WHERE member_id = $1::uuid) AS last_submitted_at,
       (SELECT MIN(enrolled_at)  FROM course_enrollments    WHERE member_id = $1::uuid) AS first_enrolled_at`,
    memberId,
  );
  const r = rows[0];
  return computeWeeklyReportStatus({
    now,
    lastSubmittedAt: r?.last_submitted_at ? new Date(r.last_submitted_at) : null,
    firstEnrolledAt: r?.first_enrolled_at ? new Date(r.first_enrolled_at) : null,
  });
}

/** Lock check for video endpoints. Fails open (not locked) on a DB error so an outage
 *  here never blocks every member's videos. */
export async function isWeeklyReportLocked(
  prisma: Parameters<typeof loadWeeklyReportStatus>[0],
  memberId: string | undefined,
): Promise<boolean> {
  if (!memberId) return false;
  try {
    return (await loadWeeklyReportStatus(prisma, memberId)).locked;
  } catch {
    return false;
  }
}
