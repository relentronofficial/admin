// When a course lesson completes automatically — pure, so the rule is unit-tested.
//
// A lesson completes once the member has genuinely watched 90% of the video:
//   genuine seconds = the server's watched seconds for the lesson when it was
//   opened (earlier sessions, from the progress heartbeats) + this session's
//   live watch time (counted only while the video is actually playing, the tab
//   is visible and the member is not seeking; scaled by playback speed).
// Seeking ahead adds nothing, so skipping to the end never completes a lesson.
// The real video duration from the player is used (the stored duration can be
// a placeholder).

export const AUTO_COMPLETE_FRACTION = 0.9;

/** How long to wait before retrying after a failed or refused completion save. */
export const AUTO_COMPLETE_RETRY_MS = 15_000;

export function genuineWatchedSeconds(serverSecsAtOpen: number | null | undefined, sessionSecs: number): number {
  return Math.max(0, serverSecsAtOpen ?? 0) + Math.max(0, sessionSecs);
}

export function shouldAutoComplete(p: {
  genuineSecs: number;
  /** Real duration reported by the player; 0 until it is known. */
  durationSecs: number;
  /** Already completed on the server (or in this session). */
  alreadyCompleted: boolean;
  /** A completion request for this lesson is already in flight. */
  requestInFlight: boolean;
  /** Epoch ms before which no retry is made after a failed save (0 = none). */
  retryNotBefore: number;
  now: number;
}): boolean {
  if (p.alreadyCompleted || p.requestInFlight) return false;
  if (!(p.durationSecs > 0)) return false;
  if (p.now < p.retryNotBefore) return false;
  return p.genuineSecs >= p.durationSecs * AUTO_COMPLETE_FRACTION;
}
