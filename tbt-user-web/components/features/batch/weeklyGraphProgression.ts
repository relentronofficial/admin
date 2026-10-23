// Which activity markers the Weekly Activity Graph's progression line passes
// through, and in what order — pure, so the rule is unit-tested on its own.
//
// Rules (from the existing data model and progress logic):
//  • only activities whose status is "completed" — the admin-approved work the
//    backend counts as progress (weeklyGraphLogic.ts). Awaiting approval, not
//    started and upcoming activities stay markers only, never progress;
//  • only activities linked to a configured milestone (level ≥ 1): an activity
//    with no milestone has no height to progress to, so it is not joined in;
//  • chronological order: week order on the X axis, then program day, then the
//    order the API returns (the admin's day / sort order) — never DB row order;
//  • several eligible points in one week on the same milestone are one step:
//    only the first is used, so duplicate coordinates never draw an artificial
//    segment;
//  • fewer than two points → no line (nothing is fabricated).

export interface ProgressionCandidate {
  key: string;
  /** Position of the activity's week on the X axis (0-based). */
  weekIndex: number;
  dayNumber: number;
  /** Index of the activity in its week's API list (the admin's ordering). */
  order: number;
  /** Milestone row (1 = first milestone); 0 = not linked. */
  level: number;
  status: string;
  /** The marker's drawn coordinates, so the line meets the markers exactly. */
  x: number;
  y: number;
}

export interface ProgressionPoint { key: string; x: number; y: number }

export function progressionPoints(candidates: ProgressionCandidate[]): ProgressionPoint[] {
  const eligible = candidates
    .filter((c) => c.status === "completed" && c.level >= 1)
    .sort((a, b) => a.weekIndex - b.weekIndex || a.dayNumber - b.dayNumber || a.order - b.order);

  const points: ProgressionPoint[] = [];
  let prev: ProgressionCandidate | null = null;
  for (const c of eligible) {
    if (prev && prev.weekIndex === c.weekIndex && prev.level === c.level) continue;
    points.push({ key: c.key, x: c.x, y: c.y });
    prev = c;
  }
  return points.length >= 2 ? points : [];
}
