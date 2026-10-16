import { describe, it, expect } from "vitest";
import {
  datesWithOpenSlots,
  dayState,
  formatSlotRange,
  groupByDate,
  istDateKey,
  monthGrid,
  shiftMonth,
  slotEnd,
  slotState,
} from "./supportCallSlots";
import type { SupportCallSession } from "@/lib/api/services/supportCalls.service";

const NOW = Date.parse("2026-10-20T04:30:00Z"); // 10:00 IST, Tue 20 Oct
const session = (over: Partial<SupportCallSession> = {}): SupportCallSession => ({
  id: over.id ?? "s1",
  title: "Pricing clinic",
  description: null,
  hostName: null,
  startsAt: "2026-10-22T10:30:00Z", // 16:00 IST, Thu 22 Oct
  durationMinutes: 45,
  capacity: 1,
  seatsLeft: 1,
  myBooking: null,
  ...over,
});
const ok = { notIncluded: false, canBookMore: true };

describe("IST dates", () => {
  it("keys instants by their IST calendar date", () => {
    expect(istDateKey("2026-10-22T18:29:00Z")).toBe("2026-10-22"); // 23:59 IST
    expect(istDateKey("2026-10-22T18:30:00Z")).toBe("2026-10-23"); // 00:00 IST next day
  });
  it("groups sessions by IST date, sorted by start", () => {
    const g = groupByDate([
      session({ id: "b", startsAt: "2026-10-22T11:30:00Z" }),
      session({ id: "a", startsAt: "2026-10-22T05:30:00Z" }),
      session({ id: "c", startsAt: "2026-10-23T05:30:00Z" }),
    ]);
    expect([...g.keys()]).toEqual(["2026-10-22", "2026-10-23"]);
    expect(g.get("2026-10-22")!.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("slot times", () => {
  it("ends after the configured duration", () => {
    expect(slotEnd(session()).toISOString()).toBe("2026-10-22T11:15:00.000Z");
  });
  it("formats the real start and end time in IST", () => {
    expect(formatSlotRange(session()).replace(/\s/g, " ").toLowerCase()).toBe("4:00 pm – 4:45 pm");
  });
});

describe("slotState", () => {
  it("is available when open, in the future, with a seat and quota", () => {
    expect(slotState(session(), NOW, ok)).toBe("available");
  });
  it("marks the member's own booking", () => {
    expect(slotState(session({ myBooking: { id: "b", status: "booked", canCancel: true, canJoin: false, joinMessage: null } }), NOW, ok)).toBe("mine");
  });
  it("closes slots that have started", () => {
    expect(slotState(session({ startsAt: "2026-10-20T04:30:00Z" }), NOW, ok)).toBe("started");
  });
  it("marks full slots", () => {
    expect(slotState(session({ seatsLeft: 0 }), NOW, ok)).toBe("full");
  });
  it("blocks members without the entitlement or remaining quota", () => {
    expect(slotState(session(), NOW, { notIncluded: true, canBookMore: false })).toBe("blocked");
    expect(slotState(session(), NOW, { notIncluded: false, canBookMore: false })).toBe("blocked");
  });
});

describe("dayState", () => {
  const byDate = groupByDate([
    session({ id: "open", startsAt: "2026-10-22T10:30:00Z" }),
    session({ id: "full", startsAt: "2026-10-23T10:30:00Z", seatsLeft: 0 }),
  ]);
  it("past dates are never selectable", () => {
    expect(dayState("2026-10-19", "2026-10-20", byDate, NOW, ok)).toBe("past");
  });
  it("only dates with a bookable slot are available", () => {
    expect(dayState("2026-10-22", "2026-10-20", byDate, NOW, ok)).toBe("available");
    expect(dayState("2026-10-23", "2026-10-20", byDate, NOW, ok)).toBe("unavailable");
    expect(dayState("2026-10-24", "2026-10-20", byDate, NOW, ok)).toBe("unavailable");
  });
  it("no date is available for a member who cannot book", () => {
    expect(dayState("2026-10-22", "2026-10-20", byDate, NOW, { notIncluded: true, canBookMore: false })).toBe("unavailable");
  });
  it("lists dates with open slots regardless of the member's quota", () => {
    expect(datesWithOpenSlots(byDate, NOW)).toEqual(["2026-10-22"]);
    expect(datesWithOpenSlots(new Map(), NOW)).toEqual([]);
  });
});

describe("calendar grid", () => {
  it("starts on the right weekday with every day of the month", () => {
    const g = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(g.slice(0, 4)).toEqual([null, null, null, null]);
    expect(g[4]).toEqual({ key: "2026-10-01", day: 1 });
    expect(g.filter(Boolean)).toHaveLength(31);
  });
  it("moves across year boundaries", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
  });
});
