import { describe, it, expect } from "vitest";
import { buildGrowthMilestones, DEFAULT_GROWTH_MILESTONES } from "./growthMilestones";
import type { WeeklyGraph, WeeklyGraphMilestone } from "@/lib/api/services/batchProgram.service";

const ms = (over: Array<Partial<WeeklyGraphMilestone>> = []): WeeklyGraphMilestone[] =>
  [
    { id: "m1", label: "Ads", kind: "activity" as const, reached: false, dayNumber: 3 },
    { id: "m2", label: "Website", kind: "activity" as const, reached: false, dayNumber: 9 },
    { id: "m3", label: "Funnels", kind: "activity" as const, reached: false, dayNumber: null },
    { id: "m4", label: "1 lakh", kind: "revenue" as const, reached: false, dayNumber: null },
    { id: "m5", label: "1 crore", kind: "revenue" as const, reached: false, dayNumber: null },
  ].map((m, i) => ({ ...m, ...over[i] }));

const graph = (milestones: WeeklyGraphMilestone[], weeks: any[] = []): WeeklyGraph => ({
  totalDays: 28,
  currentDay: 10,
  currentWeek: 2,
  hasActivities: true,
  weeks,
  summary: { total: 0, completed: 0, completionPercent: null },
  config: { source: "program", milestones },
});
const states = (g: WeeklyGraph | null) => buildGrowthMilestones(g).levels.map((l) => l.state);

describe("buildGrowthMilestones", () => {
  it("not in a batch: the five defaults, all locked, nothing to open", () => {
    const r = buildGrowthMilestones(null);
    expect(r.inBatch).toBe(false);
    expect(r.levels.map((l) => l.title)).toEqual(DEFAULT_GROWTH_MILESTONES.map((m) => m.label));
    expect(r.levels.every((l) => l.state === "locked" && l.href === null)).toBe(true);
  });

  it("uses the program's configured labels and order", () => {
    const custom = ms().reverse().map((m, i) => ({ ...m, label: `${m.label} ${i}` }));
    expect(buildGrowthMilestones(graph(custom)).levels.map((l) => [l.number, l.title])).toEqual(custom.map((m, i) => [i + 1, m.label]));
  });

  it("milestone 1 is open from the start; the rest are locked", () => {
    expect(states(graph(ms()))).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });

  it("reaching a milestone unlocks only the next one", () => {
    expect(states(graph(ms([{ reached: true }])))).toEqual(["completed", "current", "locked", "locked", "locked"]);
    expect(states(graph(ms([{ reached: true }, { reached: true }])))).toEqual(["completed", "completed", "current", "locked", "locked"]);
  });

  it("never treats the plotted week height (progressLevel) as reached", () => {
    const g = graph(ms(), [{ weekNumber: 1, progressLevel: 3, completionPercent: 100 }]);
    expect(states(g)).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });

  it("an older backend without `reached` reaches nothing", () => {
    const old = ms().map(({ reached: _r, dayNumber: _d, ...m }) => m);
    expect(states(graph(old))).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });

  it("a milestone reached out of order shows reached but opens nothing past the gap", () => {
    expect(states(graph(ms([{}, {}, {}, { reached: true }])))).toEqual(["current", "locked", "locked", "completed", "locked"]);
  });

  it("activity milestones open their linked day, else the batch program; locked ones open nothing", () => {
    const l = buildGrowthMilestones(graph(ms([{ reached: true }, { reached: true }]))).levels;
    expect(l.map((x) => x.href)).toEqual(["/batch-program/3", "/batch-program/9", "/batch-program", null, null]);
  });

  it("revenue milestones never have a destination, even when open or reached", () => {
    const all = ms([{ reached: true }, { reached: true }, { reached: true }, { reached: true }]);
    const l = buildGrowthMilestones(graph(all)).levels;
    expect(l.slice(3).map((x) => [x.state, x.href])).toEqual([["completed", null], ["current", null]]);
  });

  it("flags revenue milestones that cannot be recorded yet (program settings never saved)", () => {
    const unsaved = ms().map((m) => ({ ...m, id: null }));
    expect(buildGrowthMilestones(graph(unsaved)).levels.map((l) => l.notRecordable)).toEqual([false, false, false, true, true]);
  });
});
