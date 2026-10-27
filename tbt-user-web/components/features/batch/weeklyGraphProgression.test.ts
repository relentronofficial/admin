import { describe, it, expect } from "vitest";
import { progressionLine, progressionSvgPath, weekLinePoints, weekProgressionPoints, type ProgressionWeek } from "./weeklyGraphProgression";

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

describe("weekLinePoints (where the red line runs)", () => {
  const dots = (...ls: Array<number | null | undefined>) => ls.map((level) => ({ level }));
  const line = (weeks: ProgressionWeek[]) => weekLinePoints(weeks, colX, yFor).map((p) => [p.weekNumber, p.level]);

  it("passes through each started week's highest dot, whatever its status", () => {
    expect(line([
      { ...w(1, 0), activities: dots(1) },
      { ...w(2, 0), activities: dots(0, 3, 2) },
      { ...w(3, 0), activities: dots(2) },
    ])).toEqual([[1, 1], [2, 3], [3, 2]]);
  });

  it("uses the week's progress when it is higher than its dots (revenue progression)", () => {
    expect(line([{ ...w(1, 4.5), activities: dots(3) }, { ...w(2, 1.5), activities: dots(1) }])).toEqual([[1, 4.5], [2, 1.5]]);
  });

  it("at exactly the week's column and that height", () => {
    expect(weekLinePoints([{ ...w(1, 0), activities: dots(2) }], colX, yFor)).toEqual([
      { weekNumber: 1, weekIndex: 0, level: 2, x: 0, y: 80 },
    ]);
  });

  it("a week not started yet still gets a point at its dot; weeks with nothing above the baseline get none", () => {
    expect(line([
      { ...w(1, 0), activities: dots(0, 0) },
      { ...w(2, 0), activities: [] },
      { ...w(3, null), activities: dots(3) },
      { ...w(4, 0), activities: dots(1) },
      { ...w(5, null), activities: [] },
    ])).toEqual([[3, 3], [4, 1]]);
  });

  it("tolerates missing or broken levels", () => {
    expect(line([
      { ...w(1, 0), activities: dots(undefined, null, NaN) },
      { weekNumber: 2, progressLevel: undefined, activities: dots(2) },
      { ...w(3, 1) },
    ])).toEqual([[2, 2], [3, 1]]);
    expect(weekLinePoints([], colX, yFor)).toEqual([]);
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

describe("progressionSvgPath (smooth line from the chart origin)", () => {
  const P = (x: number, y: number, i = 0) => ({ weekNumber: i + 1, weekIndex: i, level: 1, x, y });
  const ends = (d: string) => d.trim().split(/(?=[MLC])/).map((seg) => seg.slice(1).trim().split(/[\s,]+/).map(Number).slice(-2));

  it("no points → no line (nothing fabricated)", () => {
    expect(progressionSvgPath([], 76, 200)).toBeNull();
  });

  it("one point → a straight segment from the origin to it", () => {
    expect(progressionSvgPath([P(108, 160)], 76, 200)).toBe("M 76,200 L 108,160");
  });

  it("several points → starts at the origin and passes exactly through every point, in order", () => {
    const pts = [P(108, 160, 0), P(172, 100, 1), P(236, 180, 2)];
    const d = progressionSvgPath(pts, 76, 200)!;
    expect(d.startsWith("M 76,200")).toBe(true);
    expect(ends(d)).toEqual([[76, 200], [108, 160], [172, 100], [236, 180]]);
    expect(d.match(/C /g)).toHaveLength(3);
  });
});
