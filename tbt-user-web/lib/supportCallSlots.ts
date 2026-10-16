// Pure helpers for the Expert Support Calls slot picker (SUPPORT_CALLS_SPECKIT.md).
// Slots are the real sessions published by the TBT team — nothing here invents
// availability. All calendar maths is done in IST (Asia/Kolkata), the timezone
// sessions are published and shown in.
import type { SupportCallSession } from "@/lib/api/services/supportCalls.service";

export const SLOT_TIMEZONE = "Asia/Kolkata";

export type SlotState =
  | "available" // can be selected and booked
  | "mine" // the member already holds this slot
  | "full" // no seats left
  | "started" // in progress or past its start — booking closed
  | "blocked"; // not bookable for this member (plan / quota)

export type DayState = "past" | "available" | "unavailable";

/** YYYY-MM-DD of an instant in IST. */
export function istDateKey(input: string | number | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SLOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(input));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function slotEnd(session: Pick<SupportCallSession, "startsAt" | "durationMinutes">): Date {
  return new Date(new Date(session.startsAt).getTime() + session.durationMinutes * 60_000);
}

export function slotState(
  session: SupportCallSession,
  nowMs: number,
  member: { notIncluded: boolean; canBookMore: boolean },
): SlotState {
  if (session.myBooking) return "mine";
  if (new Date(session.startsAt).getTime() <= nowMs) return "started";
  if (session.seatsLeft <= 0) return "full";
  if (member.notIncluded || !member.canBookMore) return "blocked";
  return "available";
}

/** Sessions grouped by IST date, each day sorted by start time. */
export function groupByDate(sessions: SupportCallSession[]): Map<string, SupportCallSession[]> {
  const map = new Map<string, SupportCallSession[]>();
  for (const s of [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = istDateKey(s.startsAt);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return map;
}

/** A date is selectable only when it has at least one slot the member could still pick. */
export function dayState(
  dateKey: string,
  todayKey: string,
  byDate: Map<string, SupportCallSession[]>,
  nowMs: number,
  member: { notIncluded: boolean; canBookMore: boolean },
): DayState {
  if (dateKey < todayKey) return "past";
  const slots = byDate.get(dateKey) ?? [];
  return slots.some((s) => slotState(s, nowMs, member) === "available") ? "available" : "unavailable";
}

/** Dates (IST) that have open slots, ignoring the member's own quota — used to tell
 *  "nothing published" apart from "published, but you can't book". */
export function datesWithOpenSlots(byDate: Map<string, SupportCallSession[]>, nowMs: number): string[] {
  return [...byDate.entries()]
    .filter(([, slots]) => slots.some((s) => slotState(s, nowMs, { notIncluded: false, canBookMore: true }) === "available"))
    .map(([key]) => key)
    .sort();
}

export interface MonthCell {
  key: string; // YYYY-MM-DD
  day: number;
}

/** Calendar grid for a month (Sunday-first). Leading blanks are `null`. */
export function monthGrid(year: number, monthIndex: number): (MonthCell | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (MonthCell | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= days; d++) {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ key: `${year}-${mm}-${dd}`, day: d });
  }
  return cells;
}

export function monthOf(key: string): { year: number; monthIndex: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, monthIndex: m - 1 };
}

export function shiftMonth(year: number, monthIndex: number, delta: number) {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

export function formatTime(input: string | number | Date): string {
  return new Date(input).toLocaleTimeString("en-IN", { timeZone: SLOT_TIMEZONE, hour: "numeric", minute: "2-digit" });
}

export function formatSlotRange(session: Pick<SupportCallSession, "startsAt" | "durationMinutes">): string {
  return `${formatTime(session.startsAt)} – ${formatTime(slotEnd(session))}`;
}

export function formatDateLong(key: string): string {
  const { year, monthIndex } = monthOf(key);
  const day = Number(key.slice(8, 10));
  // Noon UTC keeps the calendar date stable in IST.
  return new Date(Date.UTC(year, monthIndex, day, 12)).toLocaleDateString("en-IN", {
    timeZone: SLOT_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 15)).toLocaleDateString("en-IN", {
    timeZone: SLOT_TIMEZONE,
    month: "long",
    year: "numeric",
  });
}
