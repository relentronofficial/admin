"use client";

/**
 * Skip control with countdown — TBT_ADS_SPECKIT.md §9.
 *
 * Purely presentational. It renders whatever `remaining` it is handed and never
 * runs a clock of its own: for video ads the caller feeds it the playhead so
 * buffering cannot unlock skip early, and for image ads it feeds visible-time
 * only. A timer inside this component would silently reintroduce wall-clock
 * gating for both.
 */

interface AdCountdownProps {
  /** Seconds left before the control unlocks. `null` = no countdown to show
   *  (either already unlocked, or it only unlocks when the ad ends). */
  remaining: number | null;
  ready: boolean;
  /** e.g. "Skip in" — from uiStrings, never hardcoded at the call site. */
  waitingLabel: string;
  /** e.g. "Skip" */
  readyLabel: string;
  onClick: () => void;
}

export function AdCountdown({
  remaining,
  ready,
  waitingLabel,
  readyLabel,
  onClick,
}: AdCountdownProps) {
  const label = ready
    ? readyLabel
    : remaining === null
      ? waitingLabel
      : `${waitingLabel} ${remaining}`.trim();

  return (
    <button
      type="button"
      // Still rendered while locked rather than hidden: a control that appears
      // out of nowhere mid-ad is worse than one that visibly counts down, and
      // the countdown is what tells the user the ad is finite.
      disabled={!ready}
      onClick={onClick}
      aria-live="off"
      className={`rounded-full px-4 py-2 text-sm font-medium backdrop-blur transition ${
        ready
          ? "bg-white/90 text-black hover:bg-white"
          : "cursor-not-allowed bg-black/50 text-white/60"
      }`}
    >
      {label}
    </button>
  );
}
