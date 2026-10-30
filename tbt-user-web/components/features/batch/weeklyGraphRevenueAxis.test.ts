import { describe, expect, it } from "vitest";
import { amountFromRevenueLabel, revenueAxisLabel, revenueAxisTicks, revenueAxisTop, revenueLevelOnAxis, revenueLinePath, revenueLinePoints } from "./weeklyGraphRevenueAxis";

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
