// Daily activity rules shared by the navbar streak (GET /api/user/streak) and the
// dashboard Tier Access tile (GET /api/user/mentorship/stats). Pure — no Prisma, no
// I/O, `today` is passed in — so it is unit-testable (activityDays.test.ts).
//
// Source of truth: tbt_activity_log. A member is "active" on a program calendar day
// when at least one QUALIFYING row carries that activity_date. Days are counted with
// DISTINCT, so any number of actions (or retried / concurrent requests — each event is
// already deduplicated by uniq_tbt_activity_log_member_source_ref) on the same day
// counts once.

/**
 * Ledger sources that represent real member learning activity. Everything else in
 * the ledger is points bookkeeping and must not mark a day active:
 * lifeline_spend / coin_purchase (coin balance), admin_grant (admin action),
 * early_completion (bonus on top of a lesson that already counts as course_xp).
 */
export const QUALIFYING_ACTIVITY_SOURCES = [
  'course_xp', // first completion of a course lesson (also quiz XP)
  'course_task', // course lesson task submission
  'task_submission', // approved batch task
  'batch_day', // approved batch program day (dated to submission)
  'workshop_episode',
  'workshop_challenge',
  'workshop_assignment',
  'task_completion', // legacy rows from the original ledger
] as const;

/** SQL list for `source IN (...)` — fixed constants, safe to inline. */
export const QUALIFYING_SOURCES_SQL = QUALIFYING_ACTIVITY_SOURCES.map((s) => `'${s}'`).join(', ');

export const DEFAULT_PROGRAM_TIMEZONE = 'Asia/Kolkata';

/**
 * The program's calendar timezone. There is no per-program setting in the schema,
 * so it is deployment-wide: PROGRAM_TIMEZONE env, else Asia/Kolkata. Only valid IANA
 * names are accepted — the value is inlined into SQL (`AT TIME ZONE '...'`).
 */
export function resolveProgramTimezone(raw: string | undefined | null): string {
  const tz = (raw ?? '').trim();
  if (!tz || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return DEFAULT_PROGRAM_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_PROGRAM_TIMEZONE;
  }
}

/** 'YYYY-MM-DD' of instant `d` on the program calendar. */
export function localDayKey(d: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Normalise a DATE column value (pg returns UTC-midnight Date or 'YYYY-MM-DD'). */
export function dayKeyOf(v: Date | string): string {
  return typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

/**
 * A Date at UTC midnight of the program-calendar day containing `now` — the form
 * computeStreakSummary's UTC-day arithmetic expects for "today".
 */
export function programToday(now: Date, tz: string): Date {
  return new Date(`${localDayKey(now, tz)}T00:00:00Z`);
}

const DAY_MS = 86_400_000;

/**
 * Tier Access "active days": distinct qualifying activity days inside the member's
 * program window [startDay, startDay + totalDays), never more than totalDays.
 * Activity before the program starts or after it ends does not count. No start
 * (no batch) → 0. Nothing is inferred for days without a ledger row.
 */
export function computeTierActiveDays(params: {
  activityDays: Array<Date | string>;
  programStartDay: string | null; // 'YYYY-MM-DD' on the program calendar
  totalDays: number;
}): number {
  const { activityDays, programStartDay, totalDays } = params;
  if (!programStartDay || !(totalDays > 0)) return 0;
  const start = Date.parse(`${programStartDay}T00:00:00Z`);
  if (Number.isNaN(start)) return 0;
  const end = start + totalDays * DAY_MS; // exclusive
  const days = new Set<string>();
  for (const v of activityDays) {
    const key = dayKeyOf(v);
    const t = Date.parse(`${key}T00:00:00Z`);
    if (t >= start && t < end) days.add(key);
  }
  return Math.min(days.size, totalDays);
}
