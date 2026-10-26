// Where the Weekly Activity Graph's progression line runs — pure, so the rule
// is unit-tested on its own.
//
// The line follows each week's actual progress, as the backend measures it
// (weekProgressLevel in backend lib/weeklyGraphLogic.ts → week.progressLevel):
//  • the share of that week's activities the admin approved, scaled onto the
//    activity milestones (none approved = the baseline, all approved = the
//    highest activity milestone);
//  • lifted to a milestone's row when an approved activity is linked to it,
//    when the member's reported revenue reaches a revenue milestone's
//    threshold, or when the admin recorded that milestone for the week.
//  • for revenue milestones, moving proportionally between consecutive admin
//    thresholds (e.g. ₹1 lakh → ₹5 lakhs → ₹1 crore) as reported revenue grows.
// Each week stands alone, so the line rises when a week has more progress and
// falls back when a later week has less.
// Awaiting-approval, in-progress and not-started work never lifts a week; an
// activity approved later lifts its own week on the next load.
//
// Points: one per week, in X-axis order —
//  • none for a week that has not started (progressLevel null);
//  • none for a week with no progress at all (level 0: nothing approved, no
//    revenue milestone reached, no record) — the line connects only real
//    weekly points and never runs along the baseline as a second bottom line;
//  • fewer than two points → no line (nothing is fabricated).

export interface ProgressionWeek {
  weekNumber: number;
  /** null = not started yet. */
  progressLevel: number | null | undefined;
  total?: number;
  completed?: number;
}

export interface ProgressionPoint {
  weekNumber: number;
  /** Position of the week on the X axis (0-based). */
  weekIndex: number;
  level: number;
  x: number;
  y: number;
}

export function weekProgressionPoints(
  weeks: ProgressionWeek[],
  colX: (weekIndex: number) => number,
  yFor: (level: number) => number,
): ProgressionPoint[] {
  const points: ProgressionPoint[] = [];
  weeks.forEach((w, i) => {
    const level = w.progressLevel;
    if (typeof level !== "number" || !Number.isFinite(level)) return;
    if (level <= 0) return;
    points.push({ weekNumber: w.weekNumber, weekIndex: i, level, x: colX(i), y: yFor(level) });
  });
  return points;
}

/** The polyline's points attribute, or null when there are fewer than two points. */
export function progressionLine(points: ProgressionPoint[]): string | null {
  return points.length >= 2 ? points.map((p) => `${p.x},${p.y}`).join(" ") : null;
}
