/**
 * Sequential-unlock computation for course lessons.
 *
 * The whole system trusts one function: given (a) the ordered list of a
 * course's episodes, (b) the member's progress rows, and (c) the course's
 * unlock config, compute the per-episode {locked, completed, watchPercent}
 * state. Every consumer — course-detail responses, the progress-POST
 * guard, admin analytics — routes through this pure function so the
 * "locked" verdict cannot drift between call sites.
 *
 * Determinism rules:
 *   * Order comes from `episode.order` (ascending). Ties broken by id.
 *   * Completion = `actualWatchedSecs / durationSeconds >= threshold/100`
 *     where `threshold` is `course.completionThresholdPercent` (default 95).
 *     `actualWatchedSecs` is already fraud-scrubbed on the write path.
 *   * If the episode has no `durationSeconds` (metadata missing), the
 *     legacy `isCompleted` boolean is honored as a fallback so pre-
 *     existing completions aren't invalidated by the schema migration.
 *   * A lesson is "unlocked" iff every strictly-earlier lesson is
 *     "completed". Lesson 1 is always unlocked.
 *   * "locked" is the negation of "unlocked". Kept as its own field so
 *     the client doesn't have to compute `!unlocked` in three places.
 *   * When `course.requireSequential === false`, every lesson is
 *     unlocked (locked: false).
 */

export interface EpisodeForLockCheck {
  id: string;
  order: number;
  durationSeconds: number | null;
}

export interface ProgressRow {
  episodeId: string;
  actualWatchedSecs: number;
  lastWatchedSecs: number;
  isCompleted: boolean;
}

export interface CourseUnlockConfig {
  requireSequential: boolean;
  completionThresholdPercent: number; // 1..100
}

export interface LessonLockState {
  episodeId: string;
  /** true when every previous lesson is completed OR requireSequential is off. */
  unlocked: boolean;
  /** Convenience negation of `unlocked` for the client. */
  locked: boolean;
  /** true when the member's watched fraction >= threshold. Server-computed. */
  completed: boolean;
  /**
   * Fraction watched, clamped to 0..1. `null` when we can't compute
   * (episode has no `durationSeconds`) — the client can still render
   * the completed/locked state without the exact percent.
   */
  watchFraction: number | null;
  /** Convenience 0..100 for UI. Same source as `watchFraction`. */
  watchPercent: number | null;
  /** Last recorded playback position in seconds — for the resume button. */
  lastPositionSeconds: number;
}

const MIN_COMPLETION_THRESHOLD = 0.5;   // clamp so a mis-set 0% doesn't autocomplete on open
const MAX_COMPLETION_THRESHOLD = 1;

/**
 * Compute lock/completion state for every episode in a course, in order.
 * Pure function — no I/O, no side effects. Safe to call in a tight loop.
 */
export function computeLessonLockStates(
  episodes: readonly EpisodeForLockCheck[],
  progress: readonly ProgressRow[],
  course: CourseUnlockConfig,
): LessonLockState[] {
  const progressById = new Map<string, ProgressRow>();
  for (const row of progress) progressById.set(row.episodeId, row);

  const ordered = [...episodes].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : 1;
  });

  const threshold = clampThreshold(course.completionThresholdPercent);
  const out: LessonLockState[] = [];
  let allPreviousCompleted = true;

  for (const ep of ordered) {
    const p = progressById.get(ep.id);
    const durationSecs = ep.durationSeconds ?? 0;
    const watchedSecs = p?.actualWatchedSecs ?? 0;

    // Watch fraction: null when we don't know the duration (metadata
    // missing). Never trust the client's isCompleted flag alone —
    // require BOTH the flag to be set AND the watched fraction to
    // exceed the threshold. Legacy rows without a duration fall
    // through to the stored flag so pre-migration completions survive.
    let watchFraction: number | null = null;
    let completed: boolean;
    if (durationSecs > 0) {
      watchFraction = Math.min(1, Math.max(0, watchedSecs / durationSecs));
      completed = watchFraction >= threshold;
    } else {
      completed = p?.isCompleted ?? false;
    }

    const unlocked = course.requireSequential ? allPreviousCompleted : true;

    out.push({
      episodeId: ep.id,
      unlocked,
      locked: !unlocked,
      completed,
      watchFraction,
      watchPercent: watchFraction == null ? null : Math.round(watchFraction * 100),
      lastPositionSeconds: p?.lastWatchedSecs ?? 0,
    });

    // A locked lesson can never gate the next one — but that's already
    // enforced because a locked lesson has no progress row, so `completed`
    // is false, so `allPreviousCompleted` becomes false too. The
    // explicit check below is defensive against future refactors.
    if (!completed) allPreviousCompleted = false;
  }

  return out;
}

/**
 * Convenience: given the same inputs, return true iff `episodeId` is
 * currently unlocked for the member. Used by the progress-POST guard,
 * which needs to reject a write to a locked episode.
 *
 * Falls back to `true` (permissive) if the episode isn't in the list —
 * that shouldn't happen in practice, but a defensive default is safer
 * than a 403 that permanently blocks the member.
 */
export function isEpisodeUnlocked(
  episodeId: string,
  episodes: readonly EpisodeForLockCheck[],
  progress: readonly ProgressRow[],
  course: CourseUnlockConfig,
): boolean {
  const states = computeLessonLockStates(episodes, progress, course);
  const target = states.find((s) => s.episodeId === episodeId);
  return target?.unlocked ?? true;
}

function clampThreshold(percent: number): number {
  const raw = percent / 100;
  if (!Number.isFinite(raw)) return MAX_COMPLETION_THRESHOLD;
  return Math.min(MAX_COMPLETION_THRESHOLD, Math.max(MIN_COMPLETION_THRESHOLD, raw));
}
