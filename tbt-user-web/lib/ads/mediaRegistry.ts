/**
 * Media interruption coordinator — TBT_ADS_SPECKIT.md §7.
 *
 * Players register themselves; the ad system asks the registry to pause
 * everything, and later to restore. No ad code ever reaches into a player
 * directly, and no player knows the ad system exists.
 *
 * Deliberately module-level rather than React context/state: the snapshot has
 * to outlive component unmounts. A user can navigate away from the course
 * player while an ad is showing, and the registry must not lose track of what
 * it paused.
 */

export interface InterruptibleMedia {
  /** Stable across re-renders. Re-registering the same id replaces the entry. */
  id: string;
  kind: "video" | "audio";
  isPlaying(): boolean;
  /** Current playhead in seconds. */
  getPosition(): number;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
}

interface Snapshot {
  id: string;
  wasPlaying: boolean;
  position: number;
}

const registry = new Map<string, InterruptibleMedia>();

/** What we paused, and whether it was actually playing when we did. */
let snapshot: Snapshot[] | null = null;

/**
 * Ref-COUNTED, not a boolean set. Nested suppressions are real: a cue quiz
 * inside a course inside a subscription gate all suppress independently, and
 * the inner unsuppress must not clear the outer one.
 */
const suppressions = new Map<string, number>();

/** Only one fullscreen ad may exist at a time (criterion 30). */
let adLockHolder: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // A broken listener must not stop the others or abort an ad teardown.
    }
  });
}

// ── Registration ────────────────────────────────────────────────────────────

/**
 * Register a player. Returns a deregister function — call it on unmount.
 *
 * Registering while an ad is already showing is safe: the player simply isn't
 * in the current snapshot, so it will not be resumed when the ad ends. That is
 * correct — we never paused it, so it is not ours to start.
 */
export function registerMedia(media: InterruptibleMedia): () => void {
  registry.set(media.id, media);
  return () => {
    registry.delete(media.id);
  };
}

export function getRegisteredCount(): number {
  return registry.size;
}

// ── Suppression ─────────────────────────────────────────────────────────────

/**
 * Block ads entirely while some incompatible UI is up (live calls, auth flows,
 * an open quiz modal — speckit §7.4). Ads are suppressed, not queued.
 */
export function suppressAds(reason: string): void {
  suppressions.set(reason, (suppressions.get(reason) ?? 0) + 1);
  notify();
}

export function unsuppressAds(reason: string): void {
  const count = suppressions.get(reason);
  if (count === undefined) return;
  if (count <= 1) suppressions.delete(reason);
  else suppressions.set(reason, count - 1);
  notify();
}

export function isSuppressed(): boolean {
  return suppressions.size > 0;
}

export function suppressionReasons(): string[] {
  return [...suppressions.keys()];
}

// ── Display lock ────────────────────────────────────────────────────────────

/** Returns false if an ad already holds the lock. */
export function acquireAdLock(token: string): boolean {
  if (adLockHolder !== null) return false;
  adLockHolder = token;
  notify();
  return true;
}

export function releaseAdLock(token: string): void {
  // Only the holder may release, so a late teardown from a previous ad cannot
  // unlock the one currently showing.
  if (adLockHolder === token) {
    adLockHolder = null;
    notify();
  }
}

export function isAdShowing(): boolean {
  return adLockHolder !== null;
}

// ── Interrupt / restore ─────────────────────────────────────────────────────

/**
 * Snapshot every registered player, then pause the ones that are playing.
 *
 * Called BEFORE the ad overlay mounts and before any ad media is created, so
 * two sources can never produce audio at once (criterion 22).
 */
export function interruptAll(): void {
  // An ad teardown that failed to restore would leave a stale snapshot; taking
  // a fresh one would then lose the original positions. Restore first.
  if (snapshot !== null) restoreAll();

  const next: Snapshot[] = [];
  registry.forEach((media) => {
    let wasPlaying = false;
    let position = 0;
    try {
      wasPlaying = media.isPlaying();
      position = media.getPosition();
    } catch {
      // A player that throws on inspection is treated as not playing — never
      // let a broken player block the ad.
    }
    next.push({ id: media.id, wasPlaying, position });
    if (wasPlaying) {
      try {
        media.pause();
      } catch {
        // Best effort. Worst case is overlapping audio for this one player,
        // which is better than the ad never showing.
      }
    }
  });

  snapshot = next;
}

/**
 * Restore what we paused.
 *
 * MUST run on every ad exit path — completed, skipped, closed, media error,
 * load timeout, campaign invalidation, navigation. That is why teardown is
 * funnelled through a single `endAd()` in the overlay: multiple exit paths is
 * exactly how "the video never came back" bugs ship.
 */
export function restoreAll(): void {
  if (snapshot === null) return;
  const entries = snapshot;
  snapshot = null;

  for (const entry of entries) {
    // Content that was ALREADY PAUSED before the ad must stay paused
    // (criterion 21). A naive "resume everything" passes every other test and
    // fails this one.
    if (!entry.wasPlaying) continue;

    const media = registry.get(entry.id);
    // Unmounted or disposed while the ad was up — nothing to restore.
    if (!media) continue;

    try {
      // Seek before resume: some players reset to 0 on a fresh play().
      if (entry.position > 0) media.seek(entry.position);
      media.resume();
    } catch {
      // Never throw out of a teardown path.
    }
  }
}

/** True while an interruption snapshot is outstanding. */
export function hasPendingRestore(): boolean {
  return snapshot !== null;
}

// ── Subscription (for devtools / debugging surfaces) ────────────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test/HMR escape hatch. Not used in normal app flow. */
export function __resetMediaRegistry(): void {
  registry.clear();
  suppressions.clear();
  snapshot = null;
  adLockHolder = null;
}
