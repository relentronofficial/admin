// Revenue input for the Weekly Activity Graph — pure (no Prisma, no clock).
//
// Revenue = member_revenue_reports.revenue_generated: the weekly figure the
// member enters on "Your Revenue Stats" (GET/PUT /api/user/mentorship/revenue).
// It is self-reported and stored per ISO week (Monday–Sunday, IST), while the
// graph's X axis is program days counted from the batch start. This module
// places each reported week on the program-day axis so the graph can compare a
// running total with the admin's revenue thresholds. A week with no figure
// (row missing or revenue_generated NULL) contributes nothing — missing is
// never read as ₹0, and nothing is estimated.
//
// A calendar week (Mon–Sun) straddles two program weeks whenever the batch did
// not start on a Monday, so a week's figure is placed on the program day the
// member reported it (the row's created_at — the member can only save the
// current week, so that day lies inside the week). That is the program week
// they were in when they reported it. A row whose report date is missing or
// outside its week (e.g. entered later by an admin) goes on the week's Thursday:
// the program week holding most (4 of 7) of its days.
//
// Placement is by IST calendar date, not by the batch start's time of day: a
// batch whose startsAt is, say, 05:30 IST must still put a report made that
// day on that day's program day.

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60_000;

/** Whole IST calendar days since the epoch for an instant. */
const istDayIndex = (d: Date) => Math.floor((d.getTime() + IST_OFFSET_MS) / DAY_MS);

/** Program day (1 = the batch start's IST date) of the IST calendar date of `d`. */
export function programDayOfIstDate(batchStartsAt: Date, d: Date): number {
  return istDayIndex(d) - istDayIndex(batchStartsAt) + 1;
}

export interface RevenueWeekRow {
  isoYear: number;
  isoWeek: number;
  /** revenue_generated; null when the member left it blank */
  revenue: number | null;
  /** created_at — when the member first reported this week. Omitted/null → placed on the week's Thursday. */
  reportedAt?: Date | null;
}

/** One reported week, placed on the program-day axis. */
export interface RevenueEntry {
  isoYear: number;
  isoWeek: number;
  /** Program day the week's revenue counts on (the day it was reported in that week, else its Thursday; at least day 1). */
  dayNumber: number;
  amount: number;
}

/** Monday 00:00 IST of an ISO week, as an instant. */
export function isoWeekStartIst(isoYear: number, isoWeek: number): Date {
  // ISO week 1 is the week containing 4 January.
  const jan4 = Date.UTC(isoYear, 0, 4);
  const jan4Weekday = (new Date(jan4).getUTCDay() + 6) % 7; // Monday = 0
  const week1MondayUtc = jan4 - jan4Weekday * DAY_MS;
  return new Date(week1MondayUtc + (isoWeek - 1) * 7 * DAY_MS - IST_OFFSET_MS);
}

/**
 * The member's reported weeks that fall in their program, in day order. A week
 * counts when it ends after the batch start (a batch that starts mid-week takes
 * that week's figure on day 1); weeks entirely before the start are excluded.
 */
export function revenueEntriesForProgram(rows: RevenueWeekRow[], batchStartsAt: Date): RevenueEntry[] {
  const out: RevenueEntry[] = [];
  for (const r of rows) {
    if (r.revenue === null || r.revenue === undefined) continue;
    const amount = Number(r.revenue);
    if (!Number.isFinite(amount)) continue;
    if (!Number.isInteger(r.isoYear) || !Number.isInteger(r.isoWeek) || r.isoWeek < 1 || r.isoWeek > 53) continue;
    const monday = isoWeekStartIst(r.isoYear, r.isoWeek);
    const mondayDay = programDayOfIstDate(batchStartsAt, monday);
    if (mondayDay + 6 < 1) continue; // the whole week (Mon–Sun) is before the batch's first day
    const reported = r.reportedAt instanceof Date && Number.isFinite(r.reportedAt.getTime()) ? r.reportedAt : null;
    const reportedOffset = reported ? istDayIndex(reported) - istDayIndex(monday) : -1; // 0 = Monday … 6 = Sunday
    const day = reportedOffset >= 0 && reportedOffset <= 6 ? mondayDay + reportedOffset : mondayDay + 3;
    out.push({ isoYear: r.isoYear, isoWeek: r.isoWeek, dayNumber: Math.max(1, day), amount });
  }
  return out.sort((a, b) => a.dayNumber - b.dayNumber);
}
