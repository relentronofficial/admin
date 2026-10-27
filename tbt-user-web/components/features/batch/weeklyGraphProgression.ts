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
  /** The week's activity markers; only their axis level is used here. */
  activities?: Array<{ level?: number | null }>;
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

/**
 * Where the red line runs: one point per week, at the higher of the week's
 * measured progress (progressLevel) and its highest activity marker, so the
 * line passes through the dots the member sees — whatever their status — while
 * revenue progression still lifts it. A week that has not started yet
 * (progressLevel null) counts as no progress, so a newly added week's dot still
 * extends the line. Weeks with nothing above the baseline get no point, so the
 * line never runs along the X axis. The small progress dots keep using
 * weekProgressionPoints (approved progress only).
 */
export function weekLinePoints(
  weeks: ProgressionWeek[],
  colX: (weekIndex: number) => number,
  yFor: (level: number) => number,
): ProgressionPoint[] {
  const points: ProgressionPoint[] = [];
  weeks.forEach((w, i) => {
    const progress = typeof w.progressLevel === "number" && Number.isFinite(w.progressLevel) ? w.progressLevel : 0;
    const topMarker = (w.activities ?? []).reduce(
      (top, a) => (typeof a?.level === "number" && Number.isFinite(a.level) ? Math.max(top, a.level) : top),
      0,
    );
    const level = Math.max(progress, topMarker);
    if (level <= 0) return;
    points.push({ weekNumber: w.weekNumber, weekIndex: i, level, x: colX(i), y: yFor(level) });
  });
  return points;
}

/** The polyline's points attribute, or null when there are fewer than two points. */
export function progressionLine(points: ProgressionPoint[]): string | null {
  return points.length >= 2 ? points.map((p) => `${p.x},${p.y}`).join(" ") : null;
}

/**
 * Returns an SVG path `d` attribute using Catmull-Rom → cubic Bézier smooth
 * interpolation.  The line always begins at the chart origin (originX, originY)
 * and runs through every progression point; null when there are no real points
 * (nothing to connect the origin to).
 */
export function progressionSvgPath(
  points: ProgressionPoint[],
  originX: number,
  originY: number,
): string | null {
  if (points.length === 0) return null;
  const all: { x: number; y: number }[] = [
    { x: originX, y: originY },
    ...points.map((p) => ({ x: p.x, y: p.y })),
  ];
  // Single progression point → straight line from origin
  if (all.length === 2) {
    return `M ${all[0].x},${all[0].y} L ${all[1].x},${all[1].y}`;
  }
  // Catmull-Rom → cubic Bézier: CP1 = P1 + (P2-P0)/6, CP2 = P2 - (P3-P1)/6
  let d = `M ${all[0].x},${all[0].y}`;
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[Math.max(0, i - 1)];
    const p1 = all[i];
    const p2 = all[i + 1];
    const p3 = all[Math.min(all.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x},${p2.y}`;
  }
  return d;
}
