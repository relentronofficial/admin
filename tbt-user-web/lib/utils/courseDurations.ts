// Course card durations — pure helpers for the /courses cards
// ("4 videos · Completed · Task: 30 min · Videos: 2 hr 15 min").
//
// Both totals are always for the whole course/module/section, never what is
// left: completed and unfinished cards show the same numbers. Video time is the
// sum of the episodes' real durations (`durationSeconds`); task time is the
// admin-set estimated minutes of the episodes' active tasks (`taskMinutes`,
// from tasks.estimated_minutes — not the focus timer). A value we can't know
// is null, and the card leaves it out rather than showing a guess.

export interface DurationLessonLike {
  id: string;
  durationSeconds?: number | null;
  taskMinutes?: number | null;
}

export interface DurationTotals {
  /** Sum of every video's duration in seconds; null if any video's length is unknown. */
  videoSeconds: number | null;
  /** Sum of the tasks' estimated minutes; null when no lesson has tasks. */
  taskMinutes: number | null;
}

export function sumLessonDurations(lessons: DurationLessonLike[]): DurationTotals {
  const seen = new Set<string>();
  let videoSeconds = 0;
  let videoKnown = true;
  let taskMinutes = 0;
  let hasTasks = false;
  for (const l of lessons) {
    // A lesson listed twice (e.g. tagged into one module twice) counts once.
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const secs = Number(l.durationSeconds ?? 0);
    if (secs > 0) videoSeconds += secs;
    else videoKnown = false;
    const mins = Number(l.taskMinutes ?? 0);
    if (mins > 0) {
      taskMinutes += mins;
      hasTasks = true;
    }
  }
  return {
    videoSeconds: seen.size > 0 && videoKnown ? videoSeconds : null,
    taskMinutes: hasTasks ? taskMinutes : null,
  };
}

/** "30 min", "1 hr", "2 hr 15 min". Null for unknown or non-positive input. */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const total = Math.max(1, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Seconds → the same format, rounded to the nearest minute (anything under a minute shows as 1 min). */
export function formatSeconds(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatMinutes(seconds / 60);
}
