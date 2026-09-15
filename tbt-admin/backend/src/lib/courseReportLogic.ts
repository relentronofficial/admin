// Pure calculation helpers for the Weekly Course Report + Feedback feature:
// week-number math, per-course stats, and WhatsApp message copy. Deliberately
// zero imports of anything that touches config/env.ts (WhatsApp sending,
// Prisma) at module scope, so this file can be unit-tested with no .env /
// database present — see courseReportLogic.test.ts. DB orchestration lives
// in courseReports.ts. Mirrors the equivalent split in batchReportLogic.ts /
// batchReports.ts for the (separate) Batch Program report feature.

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Weeks elapsed since enrollment, 1-indexed (mirrors computeDayNumberForDate
 * in batchReportLogic.ts, which numbers days since batch start the same way). */
export function computeWeekNumberForDate(date: Date, enrolledAt: Date): number {
  return Math.floor((date.getTime() - enrolledAt.getTime()) / WEEK_MS) + 1;
}

// ── Stats ────────────────────────────────────────────────────────────────

export interface CourseReportStats {
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  progressPercentage: number; // 0-100
}

export function computeCourseStats(params: {
  totalLessons: number;
  completedLessons: number;
}): CourseReportStats {
  const { totalLessons, completedLessons } = params;
  const pendingLessons = Math.max(0, totalLessons - completedLessons);
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  return { totalLessons, completedLessons, pendingLessons, progressPercentage };
}

// ── Eligibility ──────────────────────────────────────────────────────────

export function isEligibleEnrollment(
  member: { status: string; phone?: string | null },
  enrollment: { completedAt: Date | null },
): boolean {
  return member.status === 'active' && !!member.phone && enrollment.completedAt === null;
}

// ── WhatsApp message copy ───────────────────────────────────────────────

function formatList(titles: string[]): string {
  if (titles.length === 0) return 'None yet';
  return titles.map((t) => `• ${t}`).join('\n');
}

/** "Weekly Course Report" message sent admin → member. */
export function buildCourseReportMessage(params: {
  userName: string;
  courseName: string;
  weekNumber: number;
  stats: CourseReportStats;
  completedTitles: string[];
  pendingTitles: string[];
  remarks?: string | null;
}): string {
  const { userName, courseName, weekNumber, stats, completedTitles, pendingTitles, remarks } = params;
  return [
    'Weekly Course Report',
    '',
    `User: ${userName}`,
    `Course: ${courseName}`,
    `Week: ${weekNumber}`,
    '',
    `Progress: ${stats.progressPercentage}%`,
    '',
    'Completed:',
    formatList(completedTitles),
    '',
    'Pending:',
    formatList(pendingTitles),
    '',
    'Admin Remarks:',
    remarks?.trim() || 'None',
  ].join('\n');
}

/** "Weekly User Feedback" message sent member → admin. */
export function buildFeedbackMessage(params: {
  userName: string;
  courseName: string;
  weekNumber: number;
  feedback: string;
  remarks?: string | null;
}): string {
  const { userName, courseName, weekNumber, feedback, remarks } = params;
  return [
    'Weekly User Feedback',
    '',
    `User: ${userName}`,
    `Course: ${courseName}`,
    `Week: ${weekNumber}`,
    '',
    'Feedback:',
    feedback.trim(),
    '',
    'Additional Remarks:',
    remarks?.trim() || 'None',
  ].join('\n');
}
