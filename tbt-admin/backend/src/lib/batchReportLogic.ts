// Pure calculation helpers for the Batch Program ("90-Day Task") weekly /
// monthly WhatsApp report feature: period math, per-member stats, Tanglish
// message copy, and eligibility. Deliberately zero imports of anything that
// touches config/env.ts (WhatsApp sending, Prisma) at module scope, so this
// file can be unit-tested with no .env / database present — see
// batchReportLogic.test.ts. DB orchestration lives in batchReports.ts.

// ── Time helpers (IST) ──────────────────────────────────────────────────────
// Business is India-only; cron patterns elsewhere in this codebase are
// already expressed in UTC-for-IST-business-hours (see jobs/courseExpiryReminder.ts).
// Period boundaries (week/month) are computed on the IST calendar date so a
// job firing at ~21:00-21:30 IST always lands on the intended day.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function toIST(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

function fromISTFields(year: number, month0: number, day: number, hour = 0, minute = 0, second = 0): Date {
  // Build a UTC instant that represents the given IST wall-clock fields.
  return new Date(Date.UTC(year, month0, day, hour, minute, second) - IST_OFFSET_MS);
}

export function isLastDayOfMonth(now: Date): boolean {
  const ist = toIST(now);
  const tomorrow = new Date(ist.getTime() + DAY_MS);
  return tomorrow.getUTCDate() === 1;
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ISO-8601 week number (Monday-start, week 1 contains the year's first Thursday).
function isoWeekParts(ist: Date): { isoYear: number; isoWeek: number } {
  // Work entirely in the UTC-getter space of the already-IST-shifted date.
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const isoWeek = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { isoYear: d.getUTCFullYear(), isoWeek };
}

export interface BatchReportPeriod {
  type: 'weekly' | 'monthly';
  periodKey: string; // e.g. "2026-W33" or "2026-08"
  label: string; // human readable, e.g. "10 Aug - 16 Aug 2026" or "August 2026"
  rangeStart: Date; // inclusive, UTC instant
  rangeEnd: Date; // inclusive, UTC instant (end of day)
}

/** Monday-to-Sunday week containing `now` (IST calendar). Intended to be
 * called on the Sunday the week ends, but works for any date. */
export function getWeeklyPeriod(now: Date): BatchReportPeriod {
  const ist = toIST(now);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const day = ist.getUTCDate();
  const dow = (ist.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const mondayIst = new Date(Date.UTC(y, m, day - dow));
  const sundayIst = new Date(Date.UTC(y, m, day - dow + 6));

  const rangeStart = fromISTFields(mondayIst.getUTCFullYear(), mondayIst.getUTCMonth(), mondayIst.getUTCDate(), 0, 0, 0);
  const rangeEnd = fromISTFields(sundayIst.getUTCFullYear(), sundayIst.getUTCMonth(), sundayIst.getUTCDate(), 23, 59, 59);
  const { isoYear, isoWeek } = isoWeekParts(mondayIst);

  const label = `${mondayIst.getUTCDate()} ${MONTH_SHORT[mondayIst.getUTCMonth()]} - ${sundayIst.getUTCDate()} ${MONTH_SHORT[sundayIst.getUTCMonth()]} ${sundayIst.getUTCFullYear()}`;

  return {
    type: 'weekly',
    periodKey: `${isoYear}-W${pad2(isoWeek)}`,
    label,
    rangeStart,
    rangeEnd,
  };
}

/** Calendar month containing `now` (IST calendar). Intended to be called on
 * the last day of the month. */
export function getMonthlyPeriod(now: Date): BatchReportPeriod {
  const ist = toIST(now);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const rangeStart = fromISTFields(y, m, 1, 0, 0, 0);
  const rangeEnd = fromISTFields(y, m, lastDay, 23, 59, 59);

  return {
    type: 'monthly',
    periodKey: `${y}-${pad2(m + 1)}`,
    label: `${MONTH_LABELS[m]} ${y}`,
    rangeStart,
    rangeEnd,
  };
}

/** Batch-day number for a calendar date, mirroring the exact formula already
 * used by getMyBatchHandler / batchReminderCronHandler in user-batch/controller.ts. */
export function computeDayNumberForDate(date: Date, batchStartsAt: Date): number {
  return Math.floor((date.getTime() - batchStartsAt.getTime()) / DAY_MS) + 1;
}

// ── Stats ────────────────────────────────────────────────────────────────

export interface MemberReportStats {
  totalAssigned: number;
  completed: number;
  pending: number;
  completionRate: number; // 0-100
  streak: number;
}

export function computeMemberStats(params: {
  progress: { dayNumber: number; status: string }[];
  periodDayStart: number;
  periodDayEnd: number;
  currentDay: number;
  totalDays: number;
}): MemberReportStats {
  const { progress, periodDayStart, periodDayEnd, currentDay, totalDays } = params;
  const statusByDay = new Map(progress.map((p) => [p.dayNumber, p.status]));

  let totalAssigned = 0;
  let completed = 0;
  for (let day = periodDayStart; day <= periodDayEnd; day++) {
    totalAssigned++;
    if (statusByDay.get(day) === 'approved') completed++;
  }
  const pending = totalAssigned - completed;
  const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

  let streak = 0;
  const lastDay = Math.min(currentDay, totalDays);
  for (let day = lastDay; day >= 1; day--) {
    if (statusByDay.get(day) === 'approved') streak++;
    else break;
  }

  return { totalAssigned, completed, pending, completionRate, streak };
}

// ── Eligibility ──────────────────────────────────────────────────────────

export function isEligibleMember(
  member: { status: string; phone?: string | null },
  batch: { isActive: boolean },
): boolean {
  return member.status === 'active' && batch.isActive && !!member.phone;
}

// ── Tanglish message ─────────────────────────────────────────────────────

function encouragementFor(completionRate: number, periodWord: string): string {
  if (completionRate >= 80)
    return `Indha ${periodWord} unga progress semma-a irukku! 🔥 Idhu maadhiri continue pannunga.`;
  if (completionRate >= 50)
    return `Indha ${periodWord} nalla progress panreenga! 💪 Innum konjam push pannunga.`;
  return `Indha ${periodWord} konjam tasks pending irukku. Next ${periodWord} steady-a complete pannunga 💪`;
}

function streakDisplayFor(streak: number): string {
  return streak >= 7
    ? `${streak} days — semma consistency! 🏆`
    : `${streak} days`;
}

export function buildTanglishMessage(params: {
  firstName: string;
  reportType: 'weekly' | 'monthly';
  periodLabel: string;
  stats: MemberReportStats;
}): string {
  const { firstName, reportType, periodLabel, stats } = params;
  const { completed, pending, completionRate, streak } = params.stats;
  const periodWord = reportType === 'weekly' ? 'week' : 'month';
  const reportLabel = reportType === 'weekly' ? 'Weekly Report' : 'Monthly Report';

  return [
    `Hi ${firstName} 👋`,
    ``,
    `Ungaloda indha ${periodWord} 90-Day Task Report ready!`,
    ``,
    `📊 ${reportLabel}`,
    `━━━━━━━━━━━━━━`,
    `📅 Period: ${periodLabel}`,
    `✅ Completed Tasks: ${completed}`,
    `⏳ Pending Tasks: ${pending}`,
    `📈 Completion Rate: ${completionRate}%`,
    `🔥 Current Streak: ${streakDisplayFor(streak)}`,
    ``,
    encouragementFor(completionRate, periodWord),
    ``,
    `– TBT Team`,
  ].join('\n');
}

/**
 * Returns the 7 template variables for batch_weekly_report /
 * batch_monthly_report WhatsApp templates:
 *   {{1}} firstName  {{2}} periodLabel  {{3}} completed  {{4}} pending
 *   {{5}} completionRate  {{6}} streakDisplay  {{7}} encouragement
 */
export function buildReportVariables(params: {
  firstName: string;
  reportType: 'weekly' | 'monthly';
  periodLabel: string;
  stats: MemberReportStats;
}): string[] {
  const { firstName, reportType, periodLabel, stats } = params;
  const { completed, pending, completionRate, streak } = stats;
  const periodWord = reportType === 'weekly' ? 'week' : 'month';
  return [
    firstName,
    periodLabel,
    String(completed),
    String(pending),
    String(completionRate),
    streakDisplayFor(streak),
    encouragementFor(completionRate, periodWord),
  ];
}
