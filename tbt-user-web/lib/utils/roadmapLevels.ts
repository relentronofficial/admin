// Floating Learning Roadmap — pure level logic for the course page.
//
// One level per course section (chapter), built from the same section groups
// as the lesson sidebar (buildSectionGroups in ./sectionProgress), so the
// roadmap and the sidebar always agree on what each level contains and how far
// along it is. Nothing here invents progress:
//   • a level is COMPLETED when every lesson in it is completed (the member's
//     own progress rows — the same completedIds the sidebar counts);
//   • Level 1 is always open; Level N opens only after every earlier level is
//     completed, and never while the server still locks its first lesson
//     (server-side sequential unlock, lessonProgression.ts);
//   • the open level that isn't finished yet is the CURRENT one;
//   • when the course's sections are passed in, a section with no lessons yet
//     still appears (the sidebar drops it): it is LOCKED — there is nothing to
//     open or complete — and, being unfinished, keeps every later level locked.

import type { LessonLike, SectionGroup, SectionLike } from "./sectionProgress";

export type RoadmapLevelState = "completed" | "current" | "available" | "locked";

export interface RoadmapLesson extends LessonLike {
  title?: string;
  /** Server-computed: true when the course's sequential rule still locks this lesson. */
  locked?: boolean;
}

export interface RoadmapLevel<L extends RoadmapLesson = RoadmapLesson> {
  /** Section id, or null for the "General" (unsectioned) group. */
  id: string | null;
  /** 1-based position on the path. */
  number: number;
  title: string;
  completed: number;
  total: number;
  state: RoadmapLevelState;
  /** Lesson to open when the level is clicked: its first not-yet-completed lesson (or its first lesson). */
  target: L | null;
}

/** Every course section in order, as a group — the lesson groups plus empty groups for sections with no lessons yet. */
function withEmptySections<L extends RoadmapLesson, S extends SectionLike>(groups: SectionGroup<L, S>[], sections: S[]): SectionGroup<L, S>[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const ordered = sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.sortOrder ?? a.i) - (b.s.sortOrder ?? b.i) || a.i - b.i)
    .map(({ s }) => s);
  const out = ordered.map(
    (s) => byId.get(s.id) ?? { id: s.id, section: s, lessons: [], visibleLessons: [], completed: 0, total: 0, percent: 0 },
  );
  const general = byId.get(null);
  return general ? [...out, general] : out;
}

export function buildRoadmapLevels<L extends RoadmapLesson, S extends SectionLike>(
  groups: SectionGroup<L, S>[],
  completedIds: Iterable<string>,
  /** The course's sections; when given, sections without lessons are shown as locked levels too. */
  sections?: S[],
): RoadmapLevel<L>[] {
  if (sections?.length) groups = withEmptySections(groups, sections);
  const done = new Set(completedIds);
  let previousAllCompleted = true;
  let currentAssigned = false;

  return groups.map((g, i) => {
    const isComplete = g.total > 0 && g.completed >= g.total;
    const firstLesson = g.lessons[0] ?? null;
    const serverLocked = !!firstLesson?.locked;
    // Level 1 has no earlier levels, so previousAllCompleted starts true.
    const open = previousAllCompleted && g.total > 0 && (!serverLocked || isComplete);

    let state: RoadmapLevelState;
    if (isComplete && open) state = "completed";
    else if (!open) state = "locked";
    else if (!currentAssigned) {
      state = "current";
      currentAssigned = true;
    } else state = "available";

    previousAllCompleted = previousAllCompleted && isComplete;

    const target = (g.lessons.find((l) => !done.has(l.id)) ?? firstLesson) as L | null;
    return {
      id: g.id,
      number: i + 1,
      title: g.section?.title?.trim() || (g.id === null ? "General" : `Level ${i + 1}`),
      completed: g.completed,
      total: g.total,
      state,
      target: state === "locked" ? null : target,
    };
  });
}

export function roadmapSummary(levels: RoadmapLevel[]): { completed: number; total: number } {
  return { completed: levels.filter((l) => l.state === "completed").length, total: levels.length };
}
