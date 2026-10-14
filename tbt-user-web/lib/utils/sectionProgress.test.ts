import { describe, it, expect } from "vitest";
import { buildSectionGroups, completedLessonIds, progressPercent } from "./sectionProgress";

// Course with three sections of different sizes (3 / 1 / 2 lessons) plus two
// unsectioned lessons. Episode `order` interleaves sections (ep4 belongs to
// section A but sorts after section B's first lesson) — the admin editor
// allows this because episode order is course-wide.
const sections = [
  { id: "B", title: "Section B", sortOrder: 1 },
  { id: "A", title: "Section A", sortOrder: 0 },
  { id: "C", title: "Section C", sortOrder: 2 },
  { id: "EMPTY", title: "Empty", sortOrder: 3 },
];
const lessons: { id: string; sectionId: string | null; moduleIds: string[] }[] = [
  { id: "ep1", sectionId: "A", moduleIds: ["m1"] },
  { id: "ep2", sectionId: "A", moduleIds: ["m2"] },
  { id: "ep3", sectionId: "B", moduleIds: ["m1"] },
  { id: "ep4", sectionId: "A", moduleIds: ["m1"] },
  { id: "ep5", sectionId: "C", moduleIds: ["m2"] },
  { id: "ep6", sectionId: null, moduleIds: [] },
  { id: "ep7", sectionId: "C", moduleIds: ["m1"] },
  { id: "ep8", sectionId: "DELETED", moduleIds: [] },
];
const summary = (g: ReturnType<typeof buildSectionGroups>) =>
  g.map((x) => `${x.id ?? "general"}:${x.completed}/${x.total}:${x.percent}%`);

describe("buildSectionGroups", () => {
  it("counts each section's own lessons, in section sortOrder, General last", () => {
    const g = buildSectionGroups(lessons, sections, ["ep1", "ep4", "ep5"]);
    expect(summary(g)).toEqual(["A:2/3:67%", "B:0/1:0%", "C:1/2:50%", "general:0/2:0%"]);
    expect(g[0].lessons.map((l) => l.id)).toEqual(["ep1", "ep2", "ep4"]);
  });

  it("renders a section once even when its lessons are not adjacent in course order", () => {
    const g = buildSectionGroups(lessons, sections, []);
    expect(g.filter((x) => x.id === "A")).toHaveLength(1);
    expect(g.flatMap((x) => x.lessons.map((l) => l.id)).sort()).toEqual(lessons.map((l) => l.id).sort());
  });

  it("drops empty sections and puts lessons of an unknown section in General", () => {
    const g = buildSectionGroups(lessons, sections, ["ep8"]);
    expect(g.find((x) => x.id === "EMPTY")).toBeUndefined();
    const general = g.find((x) => x.id === null)!;
    expect(general.lessons.map((l) => l.id)).toEqual(["ep6", "ep8"]);
    expect(general.completed).toBe(1);
  });

  it("gives different members their own counts for the same course", () => {
    const memberA = buildSectionGroups(lessons, sections, ["ep1", "ep2", "ep4", "ep3"]);
    const memberB = buildSectionGroups(lessons, sections, ["ep7"]);
    const fresh = buildSectionGroups(lessons, sections, []);
    expect(summary(memberA)).toEqual(["A:3/3:100%", "B:1/1:100%", "C:0/2:0%", "general:0/2:0%"]);
    expect(summary(memberB)).toEqual(["A:0/3:0%", "B:0/1:0%", "C:1/2:50%", "general:0/2:0%"]);
    expect(summary(fresh).every((s) => s.includes(":0/"))).toBe(true);
  });

  it("ignores completed progress rows for lessons not in the course (e.g. hidden episodes)", () => {
    const g = buildSectionGroups(lessons, sections, ["ep1", "hidden-ep", "other-course-ep"]);
    expect(g.reduce((n, x) => n + x.completed, 0)).toBe(1);
  });

  it("keeps full section totals when a module filter hides some lessons", () => {
    const inM1 = (l: (typeof lessons)[number]) => l.moduleIds.includes("m1");
    const g = buildSectionGroups(lessons, sections, ["ep2", "ep4"], inM1);
    // Section A: ep1, ep4 visible under m1, but the count still covers ep2.
    const a = g.find((x) => x.id === "A")!;
    expect(a.visibleLessons.map((l) => l.id)).toEqual(["ep1", "ep4"]);
    expect([a.completed, a.total]).toEqual([2, 3]);
    // General has no m1 lessons → not rendered under this filter.
    expect(g.find((x) => x.id === null)).toBeUndefined();
  });

  it("returns a single General group when the course has no sections", () => {
    const g = buildSectionGroups(lessons, [], ["ep1"]);
    expect(summary(g)).toEqual(["general:1/8:13%"]);
  });
});

describe("completedLessonIds / progressPercent", () => {
  it("limits completed ids to the course lessons", () => {
    expect([...completedLessonIds(lessons, ["ep1", "x", "ep1"])]).toEqual(["ep1"]);
  });
  it("is 0% for an empty group and never over 100%", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(3, 3)).toBe(100);
  });
});
