// Course section progress — pure helpers for the course page's lesson sidebar.
//
// Grouping mirrors the admin course editor (admin-panel/app/courses/page.tsx):
// sections in their `sortOrder`, each holding its lessons in course order, then
// a trailing "General" group for lessons with no section (or a section id that
// no longer exists). Counts are always taken from the course's real lesson list
// and the member's own progress rows — never from the module-filtered view, and
// never from progress rows whose lesson isn't in the course response (e.g. an
// episode an admin has since hidden).

export interface SectionLike {
  id: string;
  title?: string;
  sortOrder?: number;
}

export interface LessonLike {
  id: string;
  sectionId?: string | null;
}

export interface SectionGroup<L extends LessonLike, S extends SectionLike> {
  /** Section id, or null for the "General" (unsectioned) group. */
  id: string | null;
  section: S | null;
  /** Every lesson in this group — the basis of the counts. */
  lessons: L[];
  /** Lessons of this group that pass the current filter (what the list renders). */
  visibleLessons: L[];
  completed: number;
  total: number;
  percent: number;
}

/** Completed lesson ids, limited to lessons that exist in this course response. */
export function completedLessonIds(lessons: LessonLike[], completedIds: Iterable<string>): Set<string> {
  const ids = new Set(lessons.map((l) => l.id));
  const out = new Set<string>();
  for (const id of completedIds) if (ids.has(id)) out.add(id);
  return out;
}

export function progressPercent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Group lessons by section. Groups with no lessons are dropped, and when a
 * `visible` filter is given, groups with no visible lessons are dropped too —
 * but each group's completed/total still covers all of its lessons.
 */
export function buildSectionGroups<L extends LessonLike, S extends SectionLike>(
  lessons: L[],
  sections: S[],
  completedIds: Iterable<string>,
  visible?: (lesson: L) => boolean,
): SectionGroup<L, S>[] {
  const done = completedLessonIds(lessons, completedIds);
  const ordered = sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.sortOrder ?? a.i) - (b.s.sortOrder ?? b.i) || a.i - b.i)
    .map(({ s }) => s);
  const known = new Set(ordered.map((s) => s.id));

  const bySection = new Map<string | null, L[]>();
  for (const s of ordered) bySection.set(s.id, []);
  bySection.set(null, []);
  for (const l of lessons) {
    const key = l.sectionId && known.has(l.sectionId) ? l.sectionId : null;
    bySection.get(key)!.push(l);
  }

  const groups: SectionGroup<L, S>[] = [];
  const push = (id: string | null, section: S | null) => {
    const all = bySection.get(id)!;
    if (all.length === 0) return;
    const shown = visible ? all.filter(visible) : all;
    if (shown.length === 0) return;
    const completed = all.filter((l) => done.has(l.id)).length;
    groups.push({ id, section, lessons: all, visibleLessons: shown, completed, total: all.length, percent: progressPercent(completed, all.length) });
  };
  for (const s of ordered) push(s.id, s);
  push(null, null);
  return groups;
}
