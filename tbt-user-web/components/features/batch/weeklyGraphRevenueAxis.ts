// Revenue (₹) Y axis and red line for the Weekly Activity Graph — pure, no I/O.
//
// Each week's value is week.revenue from the API: the member's reported
// "Revenue Generated" figures placed on that program week. A week with nothing
// reported is null and is drawn as a gap — never as ₹0, nothing is estimated.
// The scale is linear (heights are proportional to the amounts); its top is the
// smallest axis step that covers the highest week.

/** Axis steps above ₹0: ₹1 Lakh, ₹5 Lakhs, ₹10 Lakhs, ₹25 Lakhs, ₹50 Lakhs, ₹1 Crore. */
export const REVENUE_AXIS_STEPS = [1_00_000, 5_00_000, 10_00_000, 25_00_000, 50_00_000, 1_00_00_000];
const CRORE = 1_00_00_000;
const LAKH = 1_00_000;

/** Top of the scale: the smallest step ≥ the highest weekly revenue (₹1 Lakh when nothing is reported). */
export function revenueAxisTop(values: (number | null | undefined)[]): number {
  const max = Math.max(0, ...values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
  const step = REVENUE_AXIS_STEPS.find((t) => t >= max);
  if (step !== undefined) return step;
  // Beyond ₹1 Crore: 2, 5, 10, 20, 50 … Crores.
  for (let mag = 1; ; mag *= 10) {
    for (const m of [2, 5, 10]) if (m * mag * CRORE >= max) return m * mag * CRORE;
  }
}

/** Axis label in Indian units: ₹0, ₹1 Lakh, ₹5 Lakhs, ₹1 Crore, ₹2 Crores. */
export function revenueAxisLabel(v: number): string {
  if (v <= 0) return "₹0";
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  if (v >= CRORE) { const n = v / CRORE; return `₹${fmt(n)} ${n === 1 ? "Crore" : "Crores"}`; }
  if (v >= LAKH) { const n = v / LAKH; return `₹${fmt(n)} ${n === 1 ? "Lakh" : "Lakhs"}`; }
  return `₹${fmt(v)}`;
}

/**
 * Tick values from ₹0 to the top, keeping only labels at least `minGapPx`
 * apart on a plot `plotH` px tall (₹0 and the top are always kept).
 */
export function revenueAxisTicks(top: number, plotH: number, minGapPx = 14): number[] {
  const candidates = [0, ...REVENUE_AXIS_STEPS.filter((t) => t < top), top];
  const px = (v: number) => (v / top) * plotH;
  const kept: number[] = [];
  for (const v of candidates) {
    if (v === top) {
      while (kept.length > 1 && px(top) - px(kept[kept.length - 1]) < minGapPx) kept.pop();
      kept.push(v);
    } else if (kept.length === 0 || px(v) - px(kept[kept.length - 1]) >= minGapPx) {
      kept.push(v);
    }
  }
  return kept;
}

export interface RevenueWeek { weekNumber: number; revenue?: number | null }
export interface RevenuePoint { weekIndex: number; weekNumber: number; x: number; y: number; revenue: number }

/** One point per week with reported revenue, at its amount. */
export function revenueLinePoints(
  weeks: RevenueWeek[],
  colX: (i: number) => number,
  yOf: (revenue: number) => number,
): RevenuePoint[] {
  const out: RevenuePoint[] = [];
  weeks.forEach((w, i) => {
    const v = w.revenue;
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    out.push({ weekIndex: i, weekNumber: w.weekNumber, x: colX(i), y: yOf(v), revenue: v });
  });
  return out;
}

/** SVG path data for the red line: consecutive reported weeks are joined; a week with no report breaks it. */
export function revenueLinePath(points: RevenuePoint[]): string | null {
  const parts: string[] = [];
  points.forEach((p, k) => {
    const joined = k > 0 && points[k - 1].weekIndex === p.weekIndex - 1;
    parts.push(`${joined ? "L" : "M"} ${p.x},${p.y}`);
  });
  // A path of only single points draws nothing; the week dots still show them.
  return parts.some((s) => s.startsWith("L")) ? parts.join(" ") : null;
}
