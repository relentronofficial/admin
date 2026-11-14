// Lifeline holding cap — mirrors the backend rule (tbt-admin/backend/src/lib/lifelineCap.ts).
// A member never holds more than this many unused lifelines; buying refills
// toward it and never stacks past it. Heart rows always show exactly this many slots.
export const MAX_LIFELINES_HELD = 5;

/** Filled hearts for a server-reported remaining count, clamped to the cap. */
export function heldLifelines(remaining: number | null | undefined): number {
  const r = Number(remaining);
  return Number.isFinite(r) ? Math.max(0, Math.min(MAX_LIFELINES_HELD, Math.floor(r))) : 0;
}
