// Grouping for the dashboard's "Weekly Revenue & Order Trajectory" chart.
// Source: the member's saved weekly rows (member_revenue_reports) — the 7 daily
// values on their real calendar dates, or, for a week saved without any daily
// values, that week's total (placed on the ISO week's Thursday, the day that
// decides which month/year an ISO week belongs to). Nothing is invented: a
// period with no saved value stays null (a gap), never 0.

export type ChartPeriod = "daily" | "weekly" | "monthly" | "yearly" | "overall";

export const CHART_PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "overall", label: "Overall" },
];

export interface RevenueHistoryWeek {
  weekNumber: number;
  year: number;
  revenueGenerated: number | null;
  numberOfOrders: number | null;
  dailyRevenue: (number | string | null)[] | null;
  dailyOrders: (number | string | null)[] | null;
}

export interface PeriodPoint {
  /** x-axis label */
  label: string;
  /** tooltip / peak label */
  tip: string;
  rev: number | null;
  ord: number | null;
}

/** Number of weeks / months shown by the Weekly / Monthly views. */
export const WEEKLY_WINDOW = 12;
export const MONTHLY_WINDOW = 12;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Monday (UTC midnight) of an ISO week. */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7; // Mon = 0
  return new Date(jan4 - jan4Dow * DAY_MS + (week - 1) * 7 * DAY_MS);
}

/** ISO week + year of a date (UTC components). */
function isoWeekOf(d: Date): { week: number; year: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7)); // Thursday of this week
  const year = t.getUTCFullYear();
  return { week: 1 + Math.round((t.getTime() - isoWeekMonday(year, 1).getTime() - 3 * DAY_MS) / (7 * DAY_MS)), year };
}

const fmtDay = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

/** Every saved value of one series as (date, value) entries. */
function entries(weeks: RevenueHistoryWeek[], pick: "rev" | "ord"): { date: Date; value: number }[] {
  const out: { date: Date; value: number }[] = [];
  for (const w of weeks) {
    const monday = isoWeekMonday(w.year, w.weekNumber);
    const daily = ((pick === "rev" ? w.dailyRevenue : w.dailyOrders) ?? []).slice(0, 7).map(num);
    if (daily.some((v) => v != null)) {
      daily.forEach((v, i) => { if (v != null) out.push({ date: new Date(monday.getTime() + i * DAY_MS), value: v }); });
    } else {
      const total = num(pick === "rev" ? w.revenueGenerated : w.numberOfOrders);
      if (total != null) out.push({ date: new Date(monday.getTime() + 3 * DAY_MS), value: total });
    }
  }
  return out;
}

/** Sum the entries per bucket key; a bucket without any saved value is null. */
function bucketSums(list: { date: Date; value: number }[], keyOf: (d: Date) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of list) { const k = keyOf(e.date); m.set(k, (m.get(k) ?? 0) + e.value); }
  return m;
}

const weekKey = (d: Date) => { const { week, year } = isoWeekOf(d); return `${year}-W${week}`; };
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
const yearKey = (d: Date) => `${d.getUTCFullYear()}`;

function weekPoints(mondays: Date[], rev: Map<string, number>, ord: Map<string, number>): PeriodPoint[] {
  // Week numbers restart each year: when the range spans years, add the year ("W8 '26").
  const spansYears = mondays.length > 1 && isoWeekOf(mondays[0]).year !== isoWeekOf(mondays[mondays.length - 1]).year;
  return mondays.map((mon) => {
    const { week, year } = isoWeekOf(mon);
    const k = `${year}-W${week}`;
    const label = spansYears ? `W${week} '${String(year).slice(2)}` : `W${week}`;
    return { label, tip: `${label} (${fmtDay(mon)} – ${fmtDay(new Date(mon.getTime() + 6 * DAY_MS))})`, rev: rev.get(k) ?? null, ord: ord.get(k) ?? null };
  });
}

/**
 * Points for the Weekly / Monthly / Yearly / Overall views.
 * currentWeek comes from the server (same week the Daily view shows).
 */
export function buildPeriodPoints(
  period: Exclude<ChartPeriod, "daily">,
  weeks: RevenueHistoryWeek[],
  currentWeek: { weekNumber: number; year: number },
): PeriodPoint[] {
  const revE = entries(weeks, "rev");
  const ordE = entries(weeks, "ord");
  const thisMonday = isoWeekMonday(currentWeek.year, currentWeek.weekNumber);

  if (period === "weekly" || period === "overall") {
    const rev = bucketSums(revE, weekKey);
    const ord = bucketSums(ordE, weekKey);
    let first = new Date(thisMonday.getTime() - (WEEKLY_WINDOW - 1) * 7 * DAY_MS);
    if (period === "overall") {
      const saved = weeks.map((w) => isoWeekMonday(w.year, w.weekNumber).getTime());
      if (!saved.length) return [];
      first = new Date(Math.min(Math.min(...saved), thisMonday.getTime()));
    }
    const mondays: Date[] = [];
    for (let t = first.getTime(); t <= thisMonday.getTime(); t += 7 * DAY_MS) mondays.push(new Date(t));
    return weekPoints(mondays, rev, ord);
  }

  // Month / year of the current ISO week's Thursday (consistent with the weekly fallback).
  const anchor = new Date(thisMonday.getTime() + 3 * DAY_MS);
  if (period === "monthly") {
    const rev = bucketSums(revE, monthKey);
    const ord = bucketSums(ordE, monthKey);
    const out: PeriodPoint[] = [];
    for (let i = MONTHLY_WINDOW - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
      const k = monthKey(d);
      out.push({ label: MONTHS[d.getUTCMonth()], tip: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, rev: rev.get(k) ?? null, ord: ord.get(k) ?? null });
    }
    return out;
  }

  // yearly: first year with any saved value .. current year
  const rev = bucketSums(revE, yearKey);
  const ord = bucketSums(ordE, yearKey);
  const years = [...revE, ...ordE].map((e) => e.date.getUTCFullYear());
  if (!years.length) return [];
  const out: PeriodPoint[] = [];
  for (let y = Math.min(...years, anchor.getUTCFullYear()); y <= anchor.getUTCFullYear(); y++) {
    out.push({ label: `${y}`, tip: `${y}`, rev: rev.get(`${y}`) ?? null, ord: ord.get(`${y}`) ?? null });
  }
  return out;
}
