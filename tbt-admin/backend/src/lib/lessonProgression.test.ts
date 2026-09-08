import { describe, it, expect } from 'vitest';
import { computeLessonLockStates, isEpisodeUnlocked } from './lessonProgression.js';
import type { EpisodeForLockCheck, ProgressRow, CourseUnlockConfig } from './lessonProgression.js';

const SEQ: CourseUnlockConfig = { requireSequential: true, completionThresholdPercent: 95 };
const FREE: CourseUnlockConfig = { requireSequential: false, completionThresholdPercent: 95 };

function episodes(...orders: number[]): EpisodeForLockCheck[] {
  return orders.map((order, i) => ({ id: `ep${order}`, order, durationSeconds: 100 }));
}

describe('computeLessonLockStates', () => {
  it('unlocks only lesson 1 when nothing is watched', () => {
    const states = computeLessonLockStates(episodes(1, 2, 3, 4), [], SEQ);
    expect(states.map((s) => s.locked)).toEqual([false, true, true, true]);
    expect(states[0].completed).toBe(false);
  });

  it('unlocks lesson 2 once lesson 1 crosses the completion threshold', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 96, lastWatchedSecs: 96, isCompleted: false },
    ];
    const states = computeLessonLockStates(episodes(1, 2, 3, 4), progress, SEQ);
    expect(states.map((s) => s.locked)).toEqual([false, false, true, true]);
    expect(states[0].completed).toBe(true);
  });

  it('does NOT unlock lesson 2 when lesson 1 is short of the threshold', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 50, lastWatchedSecs: 50, isCompleted: false },
    ];
    const states = computeLessonLockStates(episodes(1, 2, 3, 4), progress, SEQ);
    expect(states.map((s) => s.locked)).toEqual([false, true, true, true]);
  });

  it('cascades: completing 1 and 2 unlocks 3 but not 4', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 100, lastWatchedSecs: 100, isCompleted: false },
      { episodeId: 'ep2', actualWatchedSecs: 100, lastWatchedSecs: 100, isCompleted: false },
    ];
    const states = computeLessonLockStates(episodes(1, 2, 3, 4), progress, SEQ);
    expect(states.map((s) => s.locked)).toEqual([false, false, false, true]);
  });

  it('completing the final lesson leaves every lesson unlocked and none dangling', () => {
    const progress: ProgressRow[] = [1, 2, 3, 4].map((n) => ({
      episodeId: `ep${n}`, actualWatchedSecs: 100, lastWatchedSecs: 100, isCompleted: false,
    }));
    const states = computeLessonLockStates(episodes(1, 2, 3, 4), progress, SEQ);
    expect(states.every((s) => !s.locked)).toBe(true);
    expect(states.every((s) => s.completed)).toBe(true);
  });

  it('a legacy isCompleted=true flag counts as completion even under the watch-fraction threshold', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 10, lastWatchedSecs: 10, isCompleted: true },
    ];
    const states = computeLessonLockStates(episodes(1, 2), progress, SEQ);
    expect(states[0].completed).toBe(true);
    expect(states[1].locked).toBe(false);
  });

  it('an episode with no durationSeconds falls back to the isCompleted flag', () => {
    const eps: EpisodeForLockCheck[] = [
      { id: 'ep1', order: 1, durationSeconds: null },
      { id: 'ep2', order: 2, durationSeconds: 100 },
    ];
    const notDone = computeLessonLockStates(eps, [], SEQ);
    expect(notDone[0].completed).toBe(false);
    expect(notDone[1].locked).toBe(true);

    const done = computeLessonLockStates(
      eps,
      [{ episodeId: 'ep1', actualWatchedSecs: 0, lastWatchedSecs: 0, isCompleted: true }],
      SEQ,
    );
    expect(done[0].completed).toBe(true);
    expect(done[1].locked).toBe(false);
  });

  it('everything is unlocked when requireSequential is false, regardless of progress', () => {
    const states = computeLessonLockStates(episodes(1, 2, 3), [], FREE);
    expect(states.every((s) => !s.locked)).toBe(true);
  });

  it('orders by `order` field, not array position, and breaks ties by id', () => {
    const eps: EpisodeForLockCheck[] = [
      { id: 'b', order: 1, durationSeconds: 100 },
      { id: 'a', order: 1, durationSeconds: 100 },
      { id: 'z', order: 0, durationSeconds: 100 },
    ];
    const states = computeLessonLockStates(eps, [], SEQ);
    expect(states.map((s) => s.episodeId)).toEqual(['z', 'a', 'b']);
    expect(states[0].locked).toBe(false); // first in order is always unlocked
  });

  it('reordering episodes recomputes locks from the new order (no hardcoded id chains)', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 100, lastWatchedSecs: 100, isCompleted: false },
    ];
    // ep1 was originally order=1 (completed). Admin reorders so ep1 is now last.
    const reordered: EpisodeForLockCheck[] = [
      { id: 'ep2', order: 1, durationSeconds: 100 },
      { id: 'ep3', order: 2, durationSeconds: 100 },
      { id: 'ep1', order: 3, durationSeconds: 100 },
    ];
    const states = computeLessonLockStates(reordered, progress, SEQ);
    const byId = new Map(states.map((s) => [s.episodeId, s]));
    expect(byId.get('ep2')!.locked).toBe(false); // now first — unlocked regardless of ep1's completion
    expect(byId.get('ep3')!.locked).toBe(true);  // gated on ep2, which isn't complete
    expect(byId.get('ep1')!.locked).toBe(true);  // now last — gated on ep2 and ep3
  });

  it('a newly-added episode at the end is locked until everything before it is complete', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 100, lastWatchedSecs: 100, isCompleted: false },
    ];
    // ep2 didn't exist before; admin just added it as order=2, no progress row yet.
    const states = computeLessonLockStates(episodes(1, 2), progress, SEQ);
    expect(states.find((s) => s.episodeId === 'ep2')!.locked).toBe(false);
  });

  it('a single-lesson course leaves that lesson unlocked', () => {
    const states = computeLessonLockStates(episodes(1), [], SEQ);
    expect(states).toHaveLength(1);
    expect(states[0].locked).toBe(false);
  });

  it('clamps a misconfigured 0% threshold to the 50% floor instead of auto-completing on open', () => {
    const progress: ProgressRow[] = [
      { episodeId: 'ep1', actualWatchedSecs: 10, lastWatchedSecs: 10, isCompleted: false },
    ];
    const states = computeLessonLockStates(episodes(1, 2), progress, { requireSequential: true, completionThresholdPercent: 0 });
    expect(states[0].completed).toBe(false); // 10% watched < 50% floor
    expect(states[1].locked).toBe(true);
  });
});

describe('isEpisodeUnlocked', () => {
  it('rejects a write to a locked episode (server-side guard)', () => {
    const unlocked = isEpisodeUnlocked('ep3', episodes(1, 2, 3), [], SEQ);
    expect(unlocked).toBe(false);
  });

  it('accepts a write to the first episode with no prior progress', () => {
    const unlocked = isEpisodeUnlocked('ep1', episodes(1, 2, 3), [], SEQ);
    expect(unlocked).toBe(true);
  });

  it('falls back to permissive (true) for an episode id not in the course episode list', () => {
    const unlocked = isEpisodeUnlocked('ghost', episodes(1, 2, 3), [], SEQ);
    expect(unlocked).toBe(true);
  });
});
