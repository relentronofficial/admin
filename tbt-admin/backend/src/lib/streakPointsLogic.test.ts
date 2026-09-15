import { describe, it, expect } from 'vitest';
import { computeStreakPointsSummary } from './streakPointsLogic.js';

describe('computeStreakPointsSummary', () => {
  it('returns zeroed totals and empty history for no rows', () => {
    expect(computeStreakPointsSummary([])).toEqual({ total: 0, videoTotal: 0, taskTotal: 0, history: [] });
  });

  it('separates video (episode_completion) from task (task_submission/milestone) sources', () => {
    const summary = computeStreakPointsSummary([
      { points: 5, reference_type: 'episode_completion', title: 'Intro Video', created_at: '2026-01-01' },
      { points: 20, reference_type: 'task_submission', title: 'Write a plan', created_at: '2026-01-02' },
      { points: 50, reference_type: 'milestone', title: 'Milestone task', created_at: '2026-01-03' },
    ]);
    expect(summary.videoTotal).toBe(5);
    expect(summary.taskTotal).toBe(70);
    expect(summary.total).toBe(75);
    expect(summary.history).toHaveLength(3);
    expect(summary.history[0]).toEqual({ type: 'video', title: 'Intro Video', points: 5, createdAt: '2026-01-01' });
    expect(summary.history[1].type).toBe('task');
    expect(summary.history[2].type).toBe('task');
  });

  it('falls back to a generic title when none is joined', () => {
    const summary = computeStreakPointsSummary([
      { points: 10, reference_type: 'episode_completion', title: null, created_at: '2026-01-01' },
    ]);
    expect(summary.history[0].title).toBe('Video');
  });

  it('coerces non-numeric points to 0 rather than propagating NaN', () => {
    const summary = computeStreakPointsSummary([
      { points: NaN, reference_type: 'task_submission', title: 'Broken', created_at: '2026-01-01' },
    ]);
    expect(summary.taskTotal).toBe(0);
    expect(summary.total).toBe(0);
  });
});
