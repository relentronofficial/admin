import { describe, expect, it } from "vitest";
import { amountFromRevenueLabel, revenueAxisLabel, revenueAxisTicks, revenueAxisTop, revenueLevelOnAxis, revenueLinePath, revenueLinePoints, revenueWeeksUpToCurrent, smoothLinePath } from "./weeklyGraphRevenueAxis";

describe("revenueWeeksUpToCurrent (weeks the revenue line covers)", () => {
  it("W1 … current week: saved amounts kept, unsaved → ₹0 (saved: false); later weeks → null", () => {
    const out = revenueWeeksUpToCurrent([
      { weekNumber: 1, revenue: 50_000 }, { weekNumber: 2, revenue: null }, { weekNumber: 3, revenue: 1_00_000, isCurrent: true }, { weekNumber: 4, revenue: null },
    ]);
    expect(out.map((w) => [w.revenue, w.saved])).toEqual([[50_000, true], [0, false], [1_00_000, true], [null, false]]);
  });

  it("without an isCurrent week, the last started week (progressLevel not null) is the end", () => {
    const out = revenueWeeksUpToCurrent([
      { weekNumber: 1, revenue: null, progressLevel: 0 }, { weekNumber: 2, revenue: 10, progressLevel: 1 }, { weekNumber: 3, revenue: null, progressLevel: null },
    ]);
    expect(out.map((w) => w.revenue)).toEqual([0, 10, null]);
  });

  it("no current and no started week: nothing is plotted", () => {
    expect(revenueWeeksUpToCurrent([{ weekNumber: 1, revenue: null }]).map((w) => w.revenue)).toEqual([null]);
  });
});

describe("smoothLinePath (monotone smooth curve)", () => {
  // Evaluate the drawn cubic segments to check where the curve actually goes.
  const sample = (d: string) => {
    const nums = d.replace(/[MC]/g, " ").trim().split(/[\s,]+/).map(Number);
    const out: Array<[number, number]> = [];
    let [x0, y0] = [nums[0], nums[1]];
    for (let i = 2; i + 5 < nums.length + 1; i += 6) {
      const [c1x, c1y, c2x, c2y, x1, y1] = nums.slice(i, i + 6);
      for (let k = 0; k <= 20; k++) {
        const t = k / 20, u = 1 - t;
        out.push([u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x1, u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y1]);
      }
      [x0, y0] = [x1, y1];
    }
    return out;
  };
  const pts = [{ x: 0, y: 200 }, { x: 50, y: 120 }, { x: 100, y: 40 }, { x: 150, y: 90 }, { x: 200, y: 90 }, { x: 250, y: 10 }];

  it("passes through every point, as one smooth cubic curve", () => {
    const d = smoothLinePath(pts)!;
    expect(d).toMatch(/^M 0,200( C [\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+){5}$/);
    const ends = d.split(/ (?=[MC] )/).map((s) => s.split(" ").at(-1));
    expect(ends).toEqual(["0,200", "50,120", "100,40", "150,90", "200,90", "250,10"]);
  });

  it("never overshoots: each segment stays between its two points (no revenue that wasn't reported)", () => {
    const s = sample(smoothLinePath(pts)!);
    for (let i = 0; i < pts.length - 1; i++) {
      const lo = Math.min(pts[i].y, pts[i + 1].y) - 1e-6, hi = Math.max(pts[i].y, pts[i + 1].y) + 1e-6;
      for (const [x, y] of s.filter(([x]) => x >= pts[i].x && x <= pts[i + 1].x)) expect(y >= lo && y <= hi).toBe(true);
    }
  });

  it("a flat stretch stays flat; fewer than two points → null", () => {
    const flat = sample(smoothLinePath([{ x: 0, y: 50 }, { x: 10, y: 50 }, { x: 20, y: 50 }])!);
    expect(flat.every(([, y]) => Math.abs(y - 50) < 1e-9)).toBe(true);
    expect(smoothLinePath([{ x: 0, y: 1 }])).toBeNull();
    expect(smoothLinePath([])).toBeNull();
  });
});

describe("amountFromRevenueLabel (amount a revenue row's label names)", () => {
  it("reads lakh / crore / thousand labels, with or without ₹, case and plural", () => {
    expect(["1 lakh", "5 Lakhs", "1 crore", "₹1 Lakh", "₹5 Lakhs", "₹1 Crore", "2.5 crores", "50L", "1 Cr", "10 lac", "10k", "₹1,00,000", "250000"]
      .map(amountFromRevenueLabel))
      .toEqual([1_00_000, 5_00_000, 1_00_00_000, 1_00_000, 5_00_000, 1_00_00_000, 2_50_00_000, 50_00_000, 1_00_00_000, 10_00_000, 10_000, 1_00_000, 2_50_000]);
  });

  it("labels that name no amount give null (nothing is assumed)", () => {
    expect(["Ads", "First big month", "", null, undefined, "0 lakh", "lakh"].map(amountFromRevenueLabel)).toEqual([null, null, null, null, null, null, null]);
  });
});

describe("revenueLevelOnAxis (revenue on the milestone axis)", () => {
  // Rows: Ads(1) Website(2) Funnels(3) 1 Lakh(4, ₹1,00,000) 5 Lakhs(5, ₹5,00,000) 1 Crore(6, ₹1,00,00,000)
  const th = [null, null, null, 1_00_000, 5_00_000, 1_00_00_000];

  it("₹0 is Start, each threshold sits exactly on its row", () => {
    expect(revenueLevelOnAxis(0, th)).toBe(0);
    expect(revenueLevelOnAxis(1_00_000, th)).toBe(4);
    expect(revenueLevelOnAxis(5_00_000, th)).toBe(5);
    expect(revenueLevelOnAxis(1_00_00_000, th)).toBe(6);
  });

  it("amounts in between are proportional between the neighbouring anchors", () => {
    expect(revenueLevelOnAxis(50_000, th)).toBe(2);   // halfway from Start to the 1 Lakh row
    expect(revenueLevelOnAxis(3_00_000, th)).toBe(4.5); // halfway from ₹1L to ₹5L
    expect(revenueLevelOnAxis(52_50_000, th)).toBe(5.5);
  });

  it("above the highest threshold stays on the top row; negative counts as ₹0", () => {
    expect(revenueLevelOnAxis(3_00_00_000, th)).toBe(6);
    expect(revenueLevelOnAxis(-5, th)).toBe(0);
  });

  it("no revenue milestone with a threshold: no position (nothing to read the amount against)", () => {
    expect(revenueLevelOnAxis(1_00_000, [null, null, null])).toBeNull();
    expect(revenueLevelOnAxis(1_00_000, [])).toBeNull();
  });

  it("ignores thresholds that are not increasing (an out-of-order row is not an anchor)", () => {
    expect(revenueLevelOnAxis(1_00_000, [5_00_000, 1_00_000])).toBe(0.2); // only the ₹5L row (level 1) anchors
  });
});

describe("revenue axis", () => {
  it("top is the smallest step covering the highest week (₹1 Lakh with no revenue)", () => {
    expect(revenueAxisTop([])).toBe(1_00_000);
    expect(revenueAxisTop([null, undefined])).toBe(1_00_000);
    expect(revenueAxisTop([40_000])).toBe(1_00_000);
    expect(revenueAxisTop([1_00_000])).toBe(1_00_000);
    expect(revenueAxisTop([1_20_000, null, 3_00_000])).toBe(5_00_000);
    expect(revenueAxisTop([12_00_000])).toBe(25_00_000);
    expect(revenueAxisTop([99_00_000])).toBe(1_00_00_000);
    expect(revenueAxisTop([1_50_00_000])).toBe(2_00_00_000);
    expect(revenueAxisTop([6_00_00_000])).toBe(10_00_00_000);
  });

  it("labels in Indian units", () => {
    expect([0, 1_00_000, 5_00_000, 10_00_000, 25_00_000, 50_00_000, 1_00_00_000, 2_00_00_000, 1_50_000].map(revenueAxisLabel))
      .toEqual(["₹0", "₹1 Lakh", "₹5 Lakhs", "₹10 Lakhs", "₹25 Lakhs", "₹50 Lakhs", "₹1 Crore", "₹2 Crores", "₹1.5 Lakhs"]);
  });

  it("ticks: ₹0, the steps below the top, and the top; crowded labels are skipped (₹0 and the top always stay)", () => {
    expect(revenueAxisTicks(5_00_000, 216)).toEqual([0, 1_00_000, 5_00_000]);
    expect(revenueAxisTicks(25_00_000, 216)).toEqual([0, 5_00_000, 10_00_000, 25_00_000]); // ₹1 Lakh would sit 8.6px above ₹0
    expect(revenueAxisTicks(1_00_00_000, 216)).toEqual([0, 10_00_000, 25_00_000, 50_00_000, 1_00_00_000]);
    expect(revenueAxisTicks(1_00_000, 216)).toEqual([0, 1_00_000]);
  });
});

describe("revenue line", () => {
  const colX = (i: number) => 100 + i * 50;
  const yOf = (v: number) => 200 - v / 1000;
  const weeks = [
    { weekNumber: 1, revenue: 20_000 },
    { weekNumber: 2, revenue: 60_000 },
    { weekNumber: 3, revenue: 30_000 }, // falls: the line goes down
    { weekNumber: 4, revenue: null },    // nothing reported: a gap, not ₹0
    { weekNumber: 5, revenue: 90_000 },
    { weekNumber: 6 },                   // future week / older response
  ];

  it("one point per week with reported revenue, at its amount", () => {
    expect(revenueLinePoints(weeks, colX, yOf)).toEqual([
      { weekIndex: 0, weekNumber: 1, x: 100, y: 180, revenue: 20_000 },
      { weekIndex: 1, weekNumber: 2, x: 150, y: 140, revenue: 60_000 },
      { weekIndex: 2, weekNumber: 3, x: 200, y: 170, revenue: 30_000 },
      { weekIndex: 4, weekNumber: 5, x: 300, y: 110, revenue: 90_000 },
    ]);
  });

  it("joins consecutive weeks and breaks at a week with no report", () => {
    expect(revenueLinePath(revenueLinePoints(weeks, colX, yOf))).toBe("M 100,180 L 150,140 L 200,170 M 300,110");
  });

  it("no line when no two consecutive weeks have revenue (the dots still show)", () => {
    expect(revenueLinePath(revenueLinePoints([{ weekNumber: 1, revenue: 5 }, { weekNumber: 2, revenue: null }], colX, yOf))).toBeNull();
    expect(revenueLinePath([])).toBeNull();
  });
});
