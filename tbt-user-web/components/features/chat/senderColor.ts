/**
 * Deterministic per-sender name colour, WhatsApp-style. Given a stable
 * senderMemberId, returns one of a small muted palette that reads well
 * on both light and dark backgrounds. Same id → same colour every time.
 */
const PALETTE = [
  "#0ea5e9", // sky-500
  "#f59e0b", // amber-500
  "#a855f7", // purple-500
  "#22c55e", // green-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function senderColor(id: string | null | undefined): string {
  if (!id) return PALETTE[0];
  return PALETTE[hashString(id) % PALETTE.length];
}
