/**
 * Scheduled group-chat messages — pure rules (no I/O, no `new Date()`;
 * `now` is always passed in so the rules are unit-testable).
 *
 * An admin schedules a message for a group either:
 *   - once    — on a specific date + time, or
 *   - daily   — every day at a time,
 *   - weekly  — every week on the start date's weekday,
 *   - monthly — every month on the start date's day of the month (the last
 *               day of the month in months too short for it, e.g. the 31st),
 * each starting on a date and optionally until an end date (inclusive).
 *
 * Every date and time an admin types is IST (Asia/Kolkata, fixed +05:30, no
 * DST), the same convention as support-call slots.
 */

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduleType = 'once' | RecurringFrequency;

export const SCHEDULE_TYPES: readonly ScheduleType[] = ['once', 'daily', 'weekly', 'monthly'];

export function isRecurring(t: ScheduleType): t is RecurringFrequency {
  return t !== 'once';
}

export const SCHEDULE_BODY_MAX = 5000;

/**
 * How late a run may still be sent. If the server was down (or idle) past a
 * run by more than this, that run is skipped instead of being posted hours
 * late; a daily schedule then simply moves on to its next day.
 */
export const SEND_GRACE_MS = 2 * 60 * 60 * 1000;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'YYYY-MM-DD' → UTC ms of IST midnight that day, or null if not a real date. */
export function istDateStartMs(date: string): number | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return utc - IST_OFFSET_MS;
}

/** 'HH:MM' → minutes after midnight, or null. */
export function timeOfDayMinutes(time: string): number | null {
  const m = TIME_RE.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** IST date + time → the instant it names. */
export function istDateTime(date: string, time: string): Date | null {
  const day = istDateStartMs(date);
  const mins = timeOfDayMinutes(time);
  if (day == null || mins == null) return null;
  return new Date(day + mins * 60_000);
}

/** The IST calendar date ('YYYY-MM-DD') an instant falls on. */
export function istDateOf(at: Date): string {
  const d = new Date(at.getTime() + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The IST wall-clock time ('HH:MM') of an instant. */
export function istTimeOf(at: Date): string {
  const d = new Date(at.getTime() + IST_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export interface RecurringRule {
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD, IST
  timeOfDay: string; // HH:MM, IST
  endDate: string | null; // YYYY-MM-DD, IST, inclusive
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** The monthly run `k` months after the start (day clamped to the month's length). */
function monthlyRunMs(startDate: string, timeOfDay: string, k: number): number {
  const [y, m, d] = startDate.split('-').map(Number);
  const total = (m - 1) + k;
  const year = y + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const day = Math.min(d, daysInMonth(year, month0));
  const date = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return istDateTime(date, timeOfDay)!.getTime();
}

/**
 * The first run at or after `from`, never before the start date and never
 * after the end date. Null when the schedule has no runs left.
 */
export function nextRecurringRun(rule: RecurringRule, from: Date): Date | null {
  const first = istDateTime(rule.startDate, rule.timeOfDay);
  if (!first) return null;
  let candidate = first.getTime();
  if (candidate < from.getTime()) {
    if (rule.frequency === 'monthly') {
      // Rough month count, then step forward to the first run >= from.
      let k = Math.max(0, Math.floor((from.getTime() - candidate) / (31 * DAY_MS)));
      candidate = monthlyRunMs(rule.startDate, rule.timeOfDay, k);
      while (candidate < from.getTime()) candidate = monthlyRunMs(rule.startDate, rule.timeOfDay, ++k);
    } else {
      const step = rule.frequency === 'weekly' ? 7 * DAY_MS : DAY_MS;
      candidate += Math.ceil((from.getTime() - candidate) / step) * step;
    }
  }
  if (rule.endDate) {
    const lastRun = istDateTime(rule.endDate, rule.timeOfDay);
    if (!lastRun || candidate > lastRun.getTime()) return null;
  }
  return new Date(candidate);
}

export interface ScheduleInput {
  scheduleType?: unknown;
  body?: unknown;
  date?: unknown;
  time?: unknown;
  endDate?: unknown;
}

export interface ValidSchedule {
  scheduleType: ScheduleType;
  body: string;
  /** once: the instant to send. daily: null. */
  sendAt: Date | null;
  /** daily/weekly/monthly: the rule. once: null. */
  recurring: RecurringRule | null;
  /** The first time this schedule will send. */
  nextRunAt: Date;
}

export type ValidationResult = { ok: true; value: ValidSchedule } | { ok: false; error: string };

/** Validate an admin's create/edit request. */
export function validateScheduleInput(input: ScheduleInput, now: Date): ValidationResult {
  const type = input.scheduleType;
  if (!SCHEDULE_TYPES.includes(type as ScheduleType)) {
    return { ok: false, error: 'Choose one time, daily, weekly or monthly.' };
  }

  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return { ok: false, error: 'Message text is required.' };
  if (body.length > SCHEDULE_BODY_MAX) return { ok: false, error: `Message is longer than ${SCHEDULE_BODY_MAX} characters.` };

  const date = typeof input.date === 'string' ? input.date : '';
  const time = typeof input.time === 'string' ? input.time : '';
  if (istDateStartMs(date) == null) return { ok: false, error: 'Pick a valid date.' };
  if (timeOfDayMinutes(time) == null) return { ok: false, error: 'Pick a valid time (HH:MM).' };

  if (type === 'once') {
    const sendAt = istDateTime(date, time)!;
    if (sendAt.getTime() <= now.getTime()) return { ok: false, error: 'Pick a date and time in the future.' };
    return { ok: true, value: { scheduleType: 'once', body, sendAt, recurring: null, nextRunAt: sendAt } };
  }

  let endDate: string | null = null;
  if (input.endDate != null && input.endDate !== '') {
    if (typeof input.endDate !== 'string' || istDateStartMs(input.endDate) == null) {
      return { ok: false, error: 'Pick a valid end date.' };
    }
    if (input.endDate < date) return { ok: false, error: 'The end date must be on or after the start date.' };
    endDate = input.endDate;
  }
  const frequency = type as RecurringFrequency;
  const recurring: RecurringRule = { frequency, startDate: date, timeOfDay: time, endDate };
  const nextRunAt = nextRecurringRun(recurring, now);
  if (!nextRunAt) return { ok: false, error: 'No send time is left before the end date — pick a later end date.' };
  return { ok: true, value: { scheduleType: frequency, body, sendAt: null, recurring, nextRunAt } };
}

export interface DueSchedule {
  scheduleType: ScheduleType;
  nextRunAt: Date;
  recurring: RecurringRule | null;
}

export interface RunDecision {
  /** true → post the message now; false → this run was missed, skip it. */
  send: boolean;
  /** When to run next; null → the schedule is finished. */
  nextRunAt: Date | null;
}

/**
 * What to do with a schedule whose `nextRunAt` has come. A repeating
 * schedule always moves to its next run after `now` (never back-fills).
 */
export function decideDueRun(s: DueSchedule, now: Date, graceMs = SEND_GRACE_MS): RunDecision {
  const late = now.getTime() - s.nextRunAt.getTime();
  const send = late <= graceMs;
  if (s.scheduleType === 'once' || !s.recurring) return { send, nextRunAt: null };
  return { send, nextRunAt: nextRecurringRun(s.recurring, new Date(Math.max(now.getTime(), s.nextRunAt.getTime()) + 1)) };
}

/**
 * When a paused schedule is resumed (or an edit keeps it active): the next
 * run at or after `now`. A one-time message whose moment has passed has none.
 */
export function resumeNextRun(s: { scheduleType: ScheduleType; sendAt: Date | null; recurring: RecurringRule | null }, now: Date): Date | null {
  if (s.scheduleType === 'once') return s.sendAt && s.sendAt.getTime() > now.getTime() ? s.sendAt : null;
  return s.recurring ? nextRecurringRun(s.recurring, now) : null;
}

/** Rebuild the rule from a stored row (start_date, time_of_day, end_date). */
export function ruleFromRow(
  scheduleType: string,
  startDate: string | null,
  timeOfDay: string | null,
  endDate: string | null,
): RecurringRule | null {
  if (!SCHEDULE_TYPES.includes(scheduleType as ScheduleType) || scheduleType === 'once') return null;
  if (!startDate || !timeOfDay) return null;
  return { frequency: scheduleType as RecurringFrequency, startDate, timeOfDay, endDate };
}
