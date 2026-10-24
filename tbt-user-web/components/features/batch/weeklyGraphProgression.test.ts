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

  it("rises with more approved work, falls when a later week is missed or partly done", () => {
    expect(levels([w(1, 1), w(2, 2), w(3, 3)])).toEqual([1, 2, 3]); // upward
    expect(levels([w(1, 3), w(2, 1.5), w(3, 0)])).toEqual([3, 1.5, 0]); // downward, a missed week drops to the baseline
    expect(levels([w(1, 0), w(2, 3), w(3, 1), w(4, 2.25), w(5, 0)])).toEqual([0, 3, 1, 2.25, 0]); // zigzag
  });

  it("draws nothing for weeks that have not started", () => {
    expect(levels([w(1, 2), w(2, 1), w(3, null), w(4, null)])).toEqual([2, 1]);
  });

  it("skips a week with nothing assigned (no false dip), but keeps it when revenue or a record lifts it", () => {
    expect(levels([w(1, 2), w(2, 0, 0), w(3, 1)])).toEqual([2, 1]);
    expect(levels([w(1, 2), w(2, 4, 0), w(3, 1)])).toEqual([2, 4, 1]);
  });

  it("tolerates missing or broken values", () => {
    expect(levels([{ weekNumber: 1, progressLevel: undefined }, { weekNumber: 2, progressLevel: NaN, total: 1 }])).toEqual([]);
    expect(weekProgressionPoints([], colX, yFor)).toEqual([]);
  });
});

describe("progressionLine", () => {
  it("joins two or more points; fewer than two → no line (nothing fabricated)", () => {
    const pts = weekProgressionPoints([w(1, 1), w(2, 3), w(3, 0)], colX, yFor);
    expect(progressionLine(pts)).toBe("0,90 100,70 200,100");
    expect(progressionLine(pts.slice(0, 1))).toBeNull();
    expect(progressionLine([])).toBeNull();
  });
});
