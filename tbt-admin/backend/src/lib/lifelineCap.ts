// Lifeline holding cap — ONE rule for every lifeline pool in the system:
//   • course pool   (member_course_lifelines — the hearts on the mentorship dashboard / player)
//   • program pool  (member_batch_settings.lifelines_total/used — Extra Lifeline ₹ purchase, credit approvals)
//   • episode pool  (course_episodes.lifeline_count free lifelines per episode)
//
// A member can never HOLD more than MAX_LIFELINES_HELD unused lifelines. Buying
// refills toward the cap; it never stacks past it (4 → buy 1 → 5, never 6).
// Purchases that would cross the cap are refused before any money/coins move.
export const MAX_LIFELINES_HELD = 5;

/** How many more lifelines a member holding `remaining` may receive right now. */
export function lifelineRoomLeft(remaining: number): number {
  const r = Number.isFinite(remaining) ? Math.max(0, Math.floor(remaining)) : 0;
  return Math.max(0, MAX_LIFELINES_HELD - r);
}

/** Clamp an admin-configured free-lifeline count to the cap. */
export function clampLifelineCount(n: number): number {
  const v = Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, Math.min(MAX_LIFELINES_HELD, v));
}

export const LIFELINE_CAP_MESSAGE = `You already hold the maximum of ${MAX_LIFELINES_HELD} lifelines. Use one before buying more.`;

/** Error thrown/returned when a grant would push a member past the cap. */
export class LifelineCapError extends Error {
  code = 'LIFELINE_CAP_REACHED' as const;
  constructor(public roomLeft: number) {
    super(roomLeft > 0
      ? `You can hold at most ${MAX_LIFELINES_HELD} lifelines — you can buy ${roomLeft} more right now.`
      : LIFELINE_CAP_MESSAGE);
  }
}
