import { describe, it, expect } from "vitest";
import { progressionPoints, type ProgressionCandidate } from "./weeklyGraphProgression";

// x = weekIndex * 100 + order, y = 100 - level * 10: easy to read back.
const c = (key: string, weekIndex: number, level: number, extra: Partial<ProgressionCandidate> = {}): ProgressionCandidate => ({
  key, weekIndex, dayNumber: weekIndex * 7 + 1, order: 0, level, status: "completed",
  x: weekIndex * 100 + (extra.order ?? 0), y: 100 - level * 10, ...extra,
});
const keys = (cs: ProgressionCandidate[]) => progressionPoints(cs).map((p) => p.key);
const levels = (cs: ProgressionCandidate[]) => progressionPoints(cs).map((p) => (100 - p.y) / 10);

describe("progressionPoints", () => {
  it("two points at different milestones: a line through exactly their marker coordinates", () => {
    const pts = progressionPoints([c("a", 0, 1), c("b", 1, 3)]);
    expect(pts).toEqual([{ key: "a", x: 0, y: 90 }, { key: "b", x: 100, y: 70 }]);
  });

  it("increasing milestones rise; decreasing milestones fall; alternating ones zigzag", () => {
    expect(levels([c("a", 0, 1), c("b", 1, 2), c("c", 2, 3), c("d", 3, 4)])).toEqual([1, 2, 3, 4]);
    expect(levels([c("a", 0, 4), c("b", 1, 3), c("c", 2, 2), c("d", 3, 1)])).toEqual([4, 3, 2, 1]);
    expect(levels([c("a", 0, 1), c("b", 1, 3), c("c", 2, 2), c("d", 3, 4), c("e", 4, 1)])).toEqual([1, 3, 2, 4, 1]);
  });

  it("is chronological whatever order the data arrives in: week, then day, then the API order", () => {
    const shuffled = [
      c("w2", 2, 2),
      c("w0-late", 0, 3, { dayNumber: 5, order: 1 }),
      c("w0-early", 0, 1, { dayNumber: 2, order: 0 }),
      c("w1", 1, 4),
    ];
    expect(keys(shuffled)).toEqual(["w0-early", "w0-late", "w1", "w2"]);
    // Same day: the API's (admin's) order decides.
    expect(keys([c("second", 0, 2, { order: 1 }), c("first", 0, 1, { order: 0 }), c("next", 1, 3)])).toEqual(["first", "second", "next"]);
  });

  it("several activities on the same milestone in one week are one step, not an artificial segment", () => {
    const cs = [c("a1", 0, 2, { order: 0 }), c("a2", 0, 2, { order: 1 }), c("a3", 0, 2, { order: 2 }), c("b", 1, 3)];
    expect(keys(cs)).toEqual(["a1", "b"]);
    // Different milestones in the same week, ordered by day, stay separate steps.
    expect(keys([c("ads", 0, 1, { dayNumber: 1 }), c("web", 0, 2, { dayNumber: 3, order: 1 }), c("fun", 1, 3)])).toEqual(["ads", "web", "fun"]);
  });

  it("only approved work joins the line: awaiting approval, not started and unlinked activities stay markers", () => {
    const cs = [
      c("done", 0, 1),
      c("awaiting", 1, 3, { status: "submitted" }),
      c("drafting", 1, 3, { status: "in_progress" }),
      c("todo", 2, 4, { status: "not_started" }),
      c("later", 3, 4, { status: "upcoming" }),
      c("revise", 3, 2, { status: "needs_revision" }),
      c("no-milestone", 2, 0),
      c("done-2", 4, 2),
    ];
    expect(keys(cs)).toEqual(["done", "done-2"]);
  });

  it("fabricates nothing: no data, one eligible point, or none at all → no line", () => {
    expect(progressionPoints([])).toEqual([]);
    expect(progressionPoints([c("only", 0, 2)])).toEqual([]);
    expect(progressionPoints([c("a", 0, 2, { status: "not_started" }), c("b", 1, 3, { status: "submitted" })])).toEqual([]);
  });

  it("skips weeks with no approved activity without inventing points for them", () => {
    expect(progressionPoints([c("w0", 0, 1), c("w5", 5, 2)]).map((p) => p.x)).toEqual([0, 500]);
  });
});
