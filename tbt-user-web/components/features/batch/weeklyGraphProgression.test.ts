import { describe, it, expect } from "vitest";
import { progressionLine, weekProgressionPoints, type ProgressionWeek } from "./weeklyGraphProgression";

// x = weekIndex * 100, y = 100 - level * 10: easy to read back.
const colX = (i: number) => i * 100;
const yFor = (level: number) => 100 - level * 10;
const w = (weekNumber: number, progressLevel: number | null, total = 2, completed = 0): ProgressionWeek =>
  ({ weekNumber, progressLevel, total, completed });
const levels = (weeks: ProgressionWeek[]) => weekProgressionPoints(weeks, colX, yFor).map((p) => p.level);

describe("weekProgressionPoints", () => {
  it("one point per started week, at exactly the week's column and progress height", () => {
    expect(weekProgressionPoints([w(1, 1), w(2, 3)], colX, yFor)).toEqual([
      { weekNumber: 1, weekIndex: 0, level: 1, x: 0, y: 90 },
      { weekNumber: 2, weekIndex: 1, level: 3, x: 100, y: 70 },
    ]);
  });

  it("rises with more progress, falls when a later week has less", () => {
    expect(levels([w(1, 1), w(2, 2), w(3, 3)])).toEqual([1, 2, 3]); // upward
    expect(levels([w(1, 3), w(2, 1.5), w(3, 0.5)])).toEqual([3, 1.5, 0.5]); // downward
    expect(levels([w(1, 1), w(2, 3), w(3, 1), w(4, 2.25)])).toEqual([1, 3, 1, 2.25]); // zigzag
  });

  it("connects only real weekly points: weeks with no progress get none, so nothing runs along the baseline", () => {
    expect(levels([w(1, 0), w(2, 2), w(3, 0), w(4, 0), w(5, 1)])).toEqual([2, 1]);
    expect(levels([w(1, 0), w(2, 0)])).toEqual([]);
  });

  it("follows revenue progression between ₹1 lakh, ₹5 lakhs and ₹1 crore rows", () => {
    // Axis: Ads 1, Website 2, Funnels 3, ₹1 lakh 4, ₹5 lakhs 5, ₹1 crore 6 (backend revenueProgressLevel).
    expect(levels([w(1, 3), w(2, 4), w(3, 4.5), w(4, 5.25), w(5, 6)])).toEqual([3, 4, 4.5, 5.25, 6]);
  });

  it("draws nothing for weeks that have not started", () => {
    expect(levels([w(1, 2), w(2, 1), w(3, null), w(4, null)])).toEqual([2, 1]);
  });

  it("keeps a week with nothing assigned when revenue or a record lifts it", () => {
    expect(levels([w(1, 2), w(2, 4, 0), w(3, 1)])).toEqual([2, 4, 1]);
  });

  it("tolerates missing or broken values", () => {
    expect(levels([{ weekNumber: 1, progressLevel: undefined }, { weekNumber: 2, progressLevel: NaN, total: 1 }])).toEqual([]);
    expect(weekProgressionPoints([], colX, yFor)).toEqual([]);
  });
});

describe("progressionLine", () => {
  it("joins two or more points; fewer than two → no line (nothing fabricated)", () => {
    const pts = weekProgressionPoints([w(1, 1), w(2, 3), w(3, 0.5)], colX, yFor);
    expect(progressionLine(pts)).toBe("0,90 100,70 200,95");
    expect(progressionLine(pts.slice(0, 1))).toBeNull();
    expect(progressionLine([])).toBeNull();
  });
});
