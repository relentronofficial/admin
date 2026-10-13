// Pure summary logic for Daily Time Spent (no Prisma, no I/O, no `new Date()` —
// `today` is passed in). Unit-tested in memberActivityLogic.test.ts. The SQL
// that produces the rows lives in lib/memberActivity.ts.
//
// Terminology
//   active minute  — a minute (server clock, ACTIVITY_TIMEZONE) in which the
//                    member was actively using the app on any device.
//   media minute   — an active minute in which a video/audio was playing.
//   tracked day    — a date on or after the day tracking started. Days before
//                    that are "not tracked" (unknown), never reported as 0.

export interface DailyActivityRow {
  date: string; // YYYY-MM-DD in ACTIVITY_TIMEZONE
  activeMinutes: number;
  mediaMinutes: number;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
}

export interface DayEntry extends DailyActivityRow {
  tracked: boolean;
}

export interface PeriodSummary {
  label: string; // e.g. "2026-W41" or "2026-10"
  startDate: string;
  endDate: string;
  activeMinutes: number;
  mediaMinutes: number;
  activeDays: number;
  trackedDays: number;
  totalDays: number;
}

export interface ActivitySummary {
  days: DayEntry[]; // newest first
  today: { activeMinutes: number; mediaMinutes: number; tracked: boolean };
  last7Days: { activeMinutes: number; activeDays: number; trackedDays: number };
  last30Days: { activeMinutes: number; activeDays: number; trackedDays: number };
  weekly: PeriodSummary[]; // newest first, ISO weeks (Mon–Sun)
  monthly: PeriodSummary[]; // newest first, calendar months
}

const DAY_MS = 86_400_000;

function toDayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function toDateString(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** ISO-8601 week label (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeekLabel(date: string): { label: string; monday: number } {
  const n = toDayNumber(date);
  const dow = (new Date(n * DAY_MS).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = n - dow;
  const thursday = monday + 3;
  const thursdayDate = new Date(thursday * DAY_MS);
  const year = thursdayDate.getUTCFullYear();
  const jan1 = Math.floor(Date.UTC(year, 0, 1) / DAY_MS);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return { label: `${year}-W${String(week).padStart(2, '0')}`, monday };
}

export function clampDays(days: unknown, fallback = 30, max = 366): number {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function summarizeDailyActivity(
  rows: DailyActivityRow[],
  opts: { today: string; days: number; trackingStartDate: string | null },
): ActivitySummary {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const todayN = toDayNumber(opts.today);
  const startN = opts.trackingStartDate ? toDayNumber(opts.trackingStartDate) : null;
  const isTracked = (n: number) => startN !== null && n >= startN;

  const days: DayEntry[] = [];
  for (let i = 0; i < opts.days; i++) {
    const n = todayN - i;
    const date = toDateString(n);
    const row = byDate.get(date);
    days.push({
      date,
      activeMinutes: row?.activeMinutes ?? 0,
      mediaMinutes: row?.mediaMinutes ?? 0,
      firstActiveAt: row?.firstActiveAt ?? null,
      lastActiveAt: row?.lastActiveAt ?? null,
      // A recorded row always means tracking was on that day.
      tracked: !!row || isTracked(n),
    });
  }

  const windowTotals = (span: number) => {
    let activeMinutes = 0, activeDays = 0, trackedDays = 0;
    for (let i = 0; i < span; i++) {
      const n = todayN - i;
      const row = byDate.get(toDateString(n));
      if (row || isTracked(n)) trackedDays++;
      if (row && row.activeMinutes > 0) { activeMinutes += row.activeMinutes; activeDays++; }
    }
    return { activeMinutes, activeDays, trackedDays };
  };

  const group = (keyOf: (d: DayEntry) => { label: string; start: number; end: number }): PeriodSummary[] => {
    const out = new Map<string, PeriodSummary>();
    for (const d of days) {
      const k = keyOf(d);
      let p = out.get(k.label);
      if (!p) {
        p = { label: k.label, startDate: toDateString(k.start), endDate: toDateString(k.end), activeMinutes: 0, mediaMinutes: 0, activeDays: 0, trackedDays: 0, totalDays: 0 };
        out.set(k.label, p);
      }
      p.totalDays++;
      if (d.tracked) p.trackedDays++;
      p.activeMinutes += d.activeMinutes;
      p.mediaMinutes += d.mediaMinutes;
      if (d.activeMinutes > 0) p.activeDays++;
    }
    return [...out.values()];
  };

  const weekly = group((d) => {
    const { label, monday } = isoWeekLabel(d.date);
    return { label, start: monday, end: monday + 6 };
  });
  const monthly = group((d) => {
    const [y, m] = d.date.split('-').map(Number);
    const start = Math.floor(Date.UTC(y, m - 1, 1) / DAY_MS);
    const end = Math.floor(Date.UTC(y, m, 1) / DAY_MS) - 1;
    return { label: `${y}-${String(m).padStart(2, '0')}`, start, end };
  });

  const todayRow = byDate.get(opts.today);
  return {
    days,
    today: { activeMinutes: todayRow?.activeMinutes ?? 0, mediaMinutes: todayRow?.mediaMinutes ?? 0, tracked: !!todayRow || isTracked(todayN) },
    last7Days: windowTotals(Math.min(7, opts.days)),
    last30Days: windowTotals(Math.min(30, opts.days)),
    weekly,
    monthly,
  };
}

/**
 * Server-side rule for a client heartbeat: only a visible tab with recent user
 * interaction or playing media counts as active. Hidden/background tabs never do.
 */
export function isActiveHeartbeat(body: unknown): { active: boolean; media: boolean } {
  const b = (body ?? {}) as Record<string, unknown>;
  const visible = b.visible === true;
  const interacted = b.interacted === true;
  const media = b.media === true;
  return { active: visible && (interacted || media), media: visible && media };
}
