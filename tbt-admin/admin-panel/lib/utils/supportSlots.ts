// IST calendar helpers for the Support Calls availability screens. Slots are
// published and shown in Asia/Kolkata (fixed UTC+05:30) whatever the admin's
// browser timezone is. Mirrors the backend helpers in lib/supportCallLogic.ts.
import type { SupportSession, SupportSlotStatus } from "@/lib/hooks/useTbt";

export const IST = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000;

/** YYYY-MM-DD of an instant in IST. */
export function istDateKey(input: string | number | Date): string {
  return new Date(new Date(input).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** HH:MM (24h) of an instant in IST. */
export function istTime24(input: string | number | Date): string {
  return new Date(new Date(input).getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

/** IST date + HH:MM → ISO instant with the +05:30 offset the backend expects. */
export function istToIso(dateKey: string, time24: string): string {
  return new Date(`${dateKey}T${time24}:00+05:30`).toISOString();
}

export function formatIstTime(input: string | number | Date): string {
  return new Date(input).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
}

export function formatSlotRange(s: Pick<SupportSession, "startsAt" | "durationMinutes">): string {
  const start = new Date(s.startsAt).getTime();
  return `${formatIstTime(start)} – ${formatIstTime(start + s.durationMinutes * 60_000)}`;
}

/** e.g. "Wed, 21 Oct 2026" for a YYYY-MM-DD key (noon UTC keeps the date stable in IST). */
export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-IN", { timeZone: IST, ...opts });
}

export interface Month { year: number; monthIndex: number }

export const monthOf = (key: string): Month => {
  const [y, m] = key.split("-").map(Number);
  return { year: y, monthIndex: m - 1 };
};

export function shiftMonth({ year, monthIndex }: Month, delta: number): Month {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

export function formatMonth({ year, monthIndex }: Month): string {
  return new Date(Date.UTC(year, monthIndex, 15)).toLocaleDateString("en-IN", { timeZone: IST, month: "long", year: "numeric" });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last date keys of a month. */
export function monthRange({ year, monthIndex }: Month): { from: string; to: string } {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { from: `${year}-${pad(monthIndex + 1)}-01`, to: `${year}-${pad(monthIndex + 1)}-${pad(last)}` };
}

/** Sunday-first grid for a month; leading blanks are null. */
export function monthGrid({ year, monthIndex }: Month): ({ key: string; day: number } | null)[] {
  const blanks = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: ({ key: string; day: number } | null)[] = Array.from({ length: blanks }, () => null);
  for (let d = 1; d <= days; d++) cells.push({ key: `${year}-${pad(monthIndex + 1)}-${pad(d)}`, day: d });
  return cells;
}

export function groupByIstDate<T extends { startsAt: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = istDateKey(it.startsAt);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return map;
}

export const SLOT_STATUS_BADGE: Record<SupportSlotStatus, { label: string; color: string; bg: string }> = {
  available: { label: "Available", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  booked: { label: "Booked", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  in_progress: { label: "In progress", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  completed: { label: "Completed", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

/** Status label for a slot: group slots that are partly booked say how many seats are taken. */
export function slotStatusLabel(s: Pick<SupportSession, "slotStatus" | "activeBookings" | "capacity">): string {
  if (s.slotStatus === "available" && s.capacity > 1 && s.activeBookings > 0) return `${s.activeBookings}/${s.capacity} booked`;
  if (s.slotStatus === "booked" && s.capacity > 1) return "Full";
  return SLOT_STATUS_BADGE[s.slotStatus]?.label ?? s.slotStatus;
}
