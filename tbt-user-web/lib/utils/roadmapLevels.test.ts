import { describe, it, expect } from "vitest";
import { buildSectionGroups } from "./sectionProgress";
import { buildRoadmapLevels, roadmapSummary } from "./roadmapLevels";

const sections = [
  { id: "s2", title: "Grow", sortOrder: 2 },
  { id: "s1", title: "Start", sortOrder: 1 },
  { id: "s3", title: "Scale", sortOrder: 3 },
];
// Server lock = sequential rule: a lesson is locked until every earlier lesson is completed.
function lessonsFor(completed: string[]) {
  const ordered = ["a1", "a2", "b1", "b2", "c1"];
  const sectionOf: Record<string, string> = { a1: "s1", a2: "s1", b1: "s2", b2: "s2", c1: "s3" };
  return ordered.map((id, i) => ({
    id,
    title: id,
    sectionId: sectionOf[id],
    locked: ordered.slice(0, i).some((prev) => !completed.includes(prev)),
  }));
}
const levels = (completed: string[], lessons = lessonsFor(completed), secs: any[] = sections) =>
  buildRoadmapLevels(buildSectionGroups(lessons, secs, completed), completed);

describe("buildRoadmapLevels", () => {
  it("one level per section, in section order", () => {
    expect(levels([]).map((l) => [l.number, l.title])).toEqual([[1, "Start"], [2, "Grow"], [3, "Scale"]]);
  });

  it("Level 1 is open initially; every later level is locked", () => {
    expect(levels([]).map((l) => l.state)).toEqual(["current", "locked", "locked"]);
  });

  it("a level stays current until all its lessons are done (partial progress does not unlock the next)", () => {
    const l = levels(["a1"]);
    expect(l.map((x) => x.state)).toEqual(["current", "locked", "locked"]);
    expect(l[0]).toMatchObject({ completed: 1, total: 2 });
  });

  it("completing a level unlocks exactly the next one", () => {
    expect(levels(["a1", "a2"]).map((x) => x.state)).toEqual(["completed", "current", "locked"]);
    expect(levels(["a1", "a2", "b1", "b2"]).map((x) => x.state)).toEqual(["completed", "completed", "current"]);
    expect(levels(["a1", "a2", "b1", "b2", "c1"]).map((x) => x.state)).toEqual(["completed", "completed", "completed"]);
  });

  it("does not open a level the server still locks", () => {
    const completed = ["a1", "a2"];
    const lessons = lessonsFor(completed).map((l) => (l.id === "b1" ? { ...l, locked: true } : l));
    expect(levels(completed, lessons).map((x) => x.state)).toEqual(["completed", "locked", "locked"]);
  });

  it("a later level is never open while an earlier one is incomplete, even in a non-sequential course", () => {
    const completed = ["b1", "b2"]; // level 2 done out of order, level 1 not
    const lessons = lessonsFor([]).map((l) => ({ ...l, locked: false })); // requireSequential = false
    expect(levels(completed, lessons).map((x) => x.state)).toEqual(["current", "locked", "locked"]);
  });

  it("targets the first unfinished lesson of an open level; locked levels have no target", () => {
    const l = levels(["a1"]);
    expect(l[0].target?.id).toBe("a2");
    expect(l[1].target).toBeNull();
    expect(levels(["a1", "a2"])[0].target?.id).toBe("a1"); // completed level reopens at its first lesson
  });

  it("lessons without a section form a final 'General' level", () => {
    const lessons = [
      { id: "x", title: "x", sectionId: "s1", locked: false },
      { id: "y", title: "y", sectionId: null, locked: true },
    ];
    const l = buildRoadmapLevels(buildSectionGroups(lessons, [sections[1]], []), []);
    expect(l.map((x) => [x.title, x.state])).toEqual([["Start", "current"], ["General", "locked"]]);
  });

  it("a course without sections is a single level", () => {
    const lessons = [{ id: "x", locked: false }, { id: "y", locked: true }];
    const l = buildRoadmapLevels(buildSectionGroups(lessons, [], []), []);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ title: "General", state: "current", total: 2 });
  });

  it("ignores progress rows for lessons not in the course", () => {
    expect(levels(["a1", "a2", "ghost"]).map((x) => x.state)).toEqual(["completed", "current", "locked"]);
  });

  it("summarises completed levels", () => {
    expect(roadmapSummary(levels(["a1", "a2"]))).toEqual({ completed: 1, total: 3 });
  });
});

describe("buildRoadmapLevels — sections without lessons", () => {
  const secs = [
    { id: "s1", title: "Ads", sortOrder: 1 },
    { id: "s2", title: "Website", sortOrder: 2 },
    { id: "s3", title: "Funnels", sortOrder: 3 },
  ];
  const lessons = [{ id: "a1", title: "a1", sectionId: "s1", locked: false }, { id: "c1", title: "c1", sectionId: "s3", locked: true }];

  it("without the sections list, empty sections are skipped (sidebar grouping)", () => {
    expect(buildRoadmapLevels(buildSectionGroups(lessons, secs, []), []).map((l) => l.title)).toEqual(["Ads", "Funnels"]);
  });

  it("with the sections list, every section is a level in order; an empty one is locked and blocks later levels", () => {
    const l = buildRoadmapLevels(buildSectionGroups(lessons, secs, ["a1"]), ["a1"], secs);
    expect(l.map((x) => [x.number, x.title, x.state])).toEqual([
      [1, "Ads", "completed"],
      [2, "Website", "locked"],
      [3, "Funnels", "locked"],
    ]);
    expect(l[1]).toMatchObject({ total: 0, completed: 0, target: null });
    expect(roadmapSummary(l)).toEqual({ completed: 1, total: 3 });
  });

  it("keeps the unsectioned General group last", () => {
    const withLoose = [...lessons, { id: "x1", title: "x1", sectionId: null, locked: true }];
    expect(buildRoadmapLevels(buildSectionGroups(withLoose, secs, []), [], secs).map((x) => x.title)).toEqual(["Ads", "Website", "Funnels", "General"]);
  });
});
