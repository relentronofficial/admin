import { describe, it, expect } from 'vitest';
import { countConsecutiveStreak } from './tbtStats.js';

// Helper: build a Set<string> of date keys (YYYY-M-D UTC) from ISO date strings.
function keys(...dates: string[]): Set<string> {
  return new Set(
    dates.map((iso) => {
      const d = new Date(iso + 'T00:00:00Z');
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }),
  );
}

// Pin "today" so tests don't drift with wall-clock date.
const TODAY = new Date('2026-09-28T12:00:00Z');

describe('countConsecutiveStreak', () => {
  it('returns 0 for empty activity log', () => {
    expect(countConsecutiveStreak(new Set(), TODAY)).toBe(0);
  });

  it('counts 1 when only today has activity', () => {
    expect(countConsecutiveStreak(keys('2026-09-28'), TODAY)).toBe(1);
  });

  it('counts consecutive days including today', () => {
    expect(countConsecutiveStreak(keys('2026-09-28', '2026-09-27', '2026-09-26'), TODAY)).toBe(3);
  });

  it('counts consecutive days when today has no activity (grace for end-of-day)', () => {
    // User was active 3 days ending yesterday but hasn't done anything yet today.
    expect(countConsecutiveStreak(keys('2026-09-27', '2026-09-26', '2026-09-25'), TODAY)).toBe(3);
  });

  it('returns 0 when today is empty and yesterday is also empty', () => {
    // Last activity was 2 days ago — streak is broken.
    expect(countConsecutiveStreak(keys('2026-09-26'), TODAY)).toBe(0);
  });

  it('stops counting at the first gap in the middle of activity history', () => {
    // Active today + 2 days ago, gap on yesterday → streak stops at 1.
    expect(countConsecutiveStreak(keys('2026-09-28', '2026-09-26'), TODAY)).toBe(1);
  });

  it('does not count isolated old activity as part of the current streak', () => {
    // 10 days of activity from 20-11 days ago, nothing recent.
    const old = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 28 - 11 - i));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });
    expect(countConsecutiveStreak(keys(...old), TODAY)).toBe(0);
  });

  it('streak days are distinct from streak points — a 3-day streak ≠ 300 points', () => {
    // 3 consecutive days each with many activity entries still = 3 days.
    const dates = keys('2026-09-28', '2026-09-27', '2026-09-26');
    const streak = countConsecutiveStreak(dates, TODAY);
    expect(streak).toBe(3);
    expect(streak).not.toBe(300); // not the sum of any points value
  });

  it('caps at 365 consecutive days even with longer history', () => {
    // Build 400 consecutive days of activity.
    const d400 = Array.from({ length: 400 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 28 - i));
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    });
    const streak = countConsecutiveStreak(new Set(d400), TODAY);
    expect(streak).toBeLessThanOrEqual(366);
    expect(streak).toBeGreaterThan(300);
  });

  it('handles month and year boundaries correctly', () => {
    // Activity spanning Sep 1, Aug 31, Aug 30 — crosses a month boundary.
    const anchor = new Date('2026-09-01T12:00:00Z');
    expect(countConsecutiveStreak(keys('2026-09-01', '2026-08-31', '2026-08-30'), anchor)).toBe(3);
  });
});
