import { describe, expect, it } from "vitest";
import { buildPeriodPoints, CHART_PERIODS, isoWeekMonday, type RevenueHistoryWeek } from "./revenuePeriods";

const week = (year: number, weekNumber: number, dailyRevenue: (number | null)[] | null, dailyOrders: (number | null)[] | null = null,
  revenueGenerated: number | null = null, numberOfOrders: number | null = null): RevenueHistoryWeek =>
  ({ year, weekNumber, dailyRevenue, dailyOrders, revenueGenerated, numberOfOrders });

const CURRENT = { year: 2026, weekNumber: 44 }; // Mon 26 Oct – Sun 1 Nov 2026

describe("revenue chart periods", () => {
  it("offers exactly Daily, Weekly, Monthly, Yearly, Overall in that order", () => {
    expect(CHART_PERIODS.map((p) => p.label)).toEqual(["Daily", "Weekly", "Monthly", "Yearly", "Overall"]);
  });

  it("ISO week Mondays match the calendar", () => {
    expect(isoWeekMonday(2026, 44).toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(isoWeekMonday(2026, 1).toISOString().slice(0, 10)).toBe("2025-12-29"); // ISO week 1 starts in the previous year
    expect(isoWeekMonday(2020, 53).toISOString().slice(0, 10)).toBe("2020-12-28");
  });

  it("weekly: last 12 weeks ending this week, daily values summed per week, unsaved weeks are gaps", () => {
    const pts = buildPeriodPoints("weekly", [
      week(2026, 43, [100, 200, null, null, null, null, 50], [1, 2, null, null, null, null, 1]),
      week(2026, 44, [10, null, null, null, null, null, null], [3, null, null, null, null, null, null]),
    ], CURRENT);
    expect(pts).toHaveLength(12);
    expect(pts[0].label).toBe("W33");
    expect(pts.at(-1)).toEqual({ label: "W44", tip: "W44 (26 Oct – 1 Nov)", rev: 10, ord: 3 });
    expect(pts.at(-2)).toMatchObject({ label: "W43", rev: 350, ord: 4 });
    expect(pts[5]).toMatchObject({ rev: null, ord: null }); // never shown as 0
  });

  it("a week saved with only weekly totals uses those totals (no daily values to split)", () => {
    const pts = buildPeriodPoints("weekly", [week(2026, 42, null, null, 5000, 12)], CURRENT);
    expect(pts.find((p) => p.label === "W42")).toMatchObject({ rev: 5000, ord: 12 });
  });

  it("monthly: days are placed on their real dates, so a week spanning two months is split", () => {
    // ISO 2026-W44: Mon 26 Oct .. Sat 31 Oct are October, Sun 1 Nov is November
    const pts = buildPeriodPoints("monthly", [week(2026, 44, [1, 1, 1, 1, 1, 1, 7], [1, 0, 0, 0, 0, 0, 2])], CURRENT);
    expect(pts).toHaveLength(12);
    expect(pts.at(-1)).toEqual({ label: "Oct", tip: "Oct 2026", rev: 6, ord: 1 }); // window ends at the current week's month
    expect(pts[0].tip).toBe("Nov 2025");
    // November 2026 is outside the window ending October (the current ISO week's Thursday is 29 Oct)
    expect(pts.some((p) => p.tip === "Nov 2026")).toBe(false);
  });

  it("yearly: from the first year with data to the current year; empty years are gaps", () => {
    const pts = buildPeriodPoints("yearly", [week(2024, 10, [100, null, null, null, null, null, null]), week(2026, 40, null, null, 900, 9)], CURRENT);
    expect(pts).toEqual([
      { label: "2024", tip: "2024", rev: 100, ord: null },
      { label: "2025", tip: "2025", rev: null, ord: null },
      { label: "2026", tip: "2026", rev: 900, ord: 9 },
    ]);
  });

  it("overall: every week from the first saved week to this week", () => {
    const pts = buildPeriodPoints("overall", [week(2026, 30, [5, null, null, null, null, null, null])], CURRENT);
    expect(pts).toHaveLength(15); // W30 .. W44
    expect(pts[0]).toMatchObject({ label: "W30", rev: 5 });
    expect(pts.at(-1)).toMatchObject({ label: "W44", rev: null });
  });

  it("week labels carry the year when the range crosses a year (week numbers restart)", () => {
    const pts = buildPeriodPoints("overall", [week(2025, 52, [5, null, null, null, null, null, null])], { year: 2026, weekNumber: 2 });
    expect(pts.map((p) => p.label)).toEqual(["W52 '25", "W1 '26", "W2 '26"]);
    expect(pts[0].tip).toBe("W52 '25 (22 Dec – 28 Dec)");
  });

  it("no saved history: yearly and overall are empty; weekly and monthly are all gaps", () => {
    expect(buildPeriodPoints("yearly", [], CURRENT)).toEqual([]);
    expect(buildPeriodPoints("overall", [], CURRENT)).toEqual([]);
    expect(buildPeriodPoints("weekly", [], CURRENT).every((p) => p.rev == null && p.ord == null)).toBe(true);
    expect(buildPeriodPoints("monthly", [], CURRENT).every((p) => p.rev == null && p.ord == null)).toBe(true);
  });

  it("string values from the API are read as numbers; blanks stay gaps", () => {
    const pts = buildPeriodPoints("weekly", [week(2026, 44, ["120", "", null, null, null, null, null] as any)], CURRENT);
    expect(pts.at(-1)).toMatchObject({ rev: 120 });
  });
});
