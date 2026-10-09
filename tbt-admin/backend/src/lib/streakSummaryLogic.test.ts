import { describe, it, expect } from 'vitest';
import { computeStreakSummary } from './streakSummaryLogic.js';

const TODAY = new Date('2026-10-06T15:00:00Z');
const day = (iso: string, points = 10) => ({ activity_date: new Date(`${iso}T00:00:00Z`), points });

describe('computeStreakSummary', () => {
  it('returns zeros and seven inactive days for no activity', () => {
    const s = computeStreakSummary([], TODAY);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.activeToday).toBe(false);
    expect(s.totalActiveDays).toBe(0);
    expect(s.pointsToday).toBe(0);
    expect(s.last7Days).toHaveLength(7);
    expect(s.last7Days[0].date).toBe('2026-09-30');
    expect(s.last7Days[6].date).toBe('2026-10-06');
    expect(s.last7Days.every((d) => !d.active)).toBe(true);
  });

  it('counts a streak including today and sums points per day', () => {
    const s = computeStreakSummary(
      [day('2026-10-06', 10), day('2026-10-06', 5), day('2026-10-05'), day('2026-10-04')],
      TODAY,
    );
    expect(s.currentStreak).toBe(3);
    expect(s.activeToday).toBe(true);
    expect(s.pointsToday).toBe(15);
    expect(s.totalActiveDays).toBe(3);
    expect(s.last7Days[6]).toEqual({ date: '2026-10-06', active: true, points: 15 });
  });

  it('counts a 0-point activity day (course_task marker rows) as active', () => {
    // Course lesson task submissions write 0-point rows; they must still extend
    // the streak without adding points.
    const s = computeStreakSummary(
      [day('2026-10-06', 0), day('2026-10-05', 10), day('2026-10-04', 0)],
      TODAY,
    );
    expect(s.currentStreak).toBe(3);
    expect(s.activeToday).toBe(true);
    expect(s.pointsToday).toBe(0);
    expect(s.last7Days[6]).toEqual({ date: '2026-10-06', active: true, points: 0 });
  });

  it('keeps the streak alive when today has no activity yet', () => {
    const s = computeStreakSummary([day('2026-10-05'), day('2026-10-04')], TODAY);
    expect(s.currentStreak).toBe(2);
    expect(s.activeToday).toBe(false);
  });

  it('breaks the streak on a missed day but remembers the longest run', () => {
    const s = computeStreakSummary(
      [day('2026-10-06'), day('2026-10-03'), day('2026-10-02'), day('2026-10-01'), day('2026-09-30')],
      TODAY,
    );
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(4);
  });

  it('accepts string dates and bigint points from raw SQL', () => {
    const s = computeStreakSummary([{ activity_date: '2026-10-06', points: BigInt(20) }], TODAY);
    expect(s.pointsToday).toBe(20);
    expect(s.currentStreak).toBe(1);
  });
});
