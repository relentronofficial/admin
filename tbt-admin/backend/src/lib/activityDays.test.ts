import { describe, it, expect } from 'vitest';
import {
  QUALIFYING_ACTIVITY_SOURCES,
  computeTierActiveDays,
  localDayKey,
  programToday,
  resolveProgramTimezone,
} from './activityDays.js';
import { computeStreakSummary } from './streakSummaryLogic.js';

const TZ = 'Asia/Kolkata';
const START = '2026-10-01'; // program day 1
const at = (iso: string) => ({ activity_date: new Date(`${iso}T00:00:00Z`), points: 10 });

// Streak + Tier Access for one member's qualifying activity dates, "now" on the program calendar.
function metrics(days: string[], nowIso: string, totalDays = 90, start: string | null = START) {
  const today = programToday(new Date(nowIso), TZ);
  return {
    streak: computeStreakSummary(days.map(at), today).currentStreak,
    tier: computeTierActiveDays({ activityDays: days, programStartDay: start, totalDays }),
  };
}

describe('daily activity → streak + Tier Access', () => {
  it('1. new member active once: streak 1, Tier Access 1', () => {
    expect(metrics(['2026-10-05'], '2026-10-05T10:00:00+05:30')).toEqual({ streak: 1, tier: 1 });
  });

  it('2. many qualifying actions on one day count once', () => {
    expect(metrics(['2026-10-05', '2026-10-05', '2026-10-05'], '2026-10-05T20:00:00+05:30')).toEqual({ streak: 1, tier: 1 });
  });

  it('3. consecutive days: both increase by one per new day', () => {
    expect(metrics(['2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07T09:00:00+05:30')).toEqual({ streak: 3, tier: 3 });
  });

  it('4. one missed day: streak resets to 1, Tier Access keeps its total', () => {
    expect(metrics(['2026-10-05', '2026-10-06', '2026-10-08'], '2026-10-08T09:00:00+05:30')).toEqual({ streak: 1, tier: 3 });
  });

  it('5. several missed days: same rules', () => {
    expect(metrics(['2026-10-02', '2026-10-03', '2026-10-15'], '2026-10-15T09:00:00+05:30')).toEqual({ streak: 1, tier: 3 });
  });

  it('streak stays alive until the member misses a whole day (today may still be empty)', () => {
    expect(metrics(['2026-10-05', '2026-10-06'], '2026-10-07T09:00:00+05:30').streak).toBe(2);
    expect(metrics(['2026-10-05', '2026-10-06'], '2026-10-08T09:00:00+05:30').streak).toBe(0);
  });

  it('6. derived purely from stored days — same result on every refresh / login', () => {
    const a = metrics(['2026-10-05', '2026-10-06'], '2026-10-06T09:00:00+05:30');
    const b = metrics(['2026-10-05', '2026-10-06'], '2026-10-06T23:59:00+05:30');
    expect(a).toEqual(b);
  });

  it('7. duplicate rows from concurrent requests do not add days', () => {
    const dupes = Array.from({ length: 20 }, () => '2026-10-05');
    expect(metrics([...dupes, '2026-10-06', '2026-10-06'], '2026-10-06T09:00:00+05:30')).toEqual({ streak: 2, tier: 2 });
  });

  it('8. activity outside the program window is not counted, and never exceeds the duration', () => {
    // Before start and after the 3-day program end are ignored.
    expect(computeTierActiveDays({ activityDays: ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04'], programStartDay: START, totalDays: 3 })).toBe(2);
    const every = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    expect(computeTierActiveDays({ activityDays: every, programStartDay: START, totalDays: 90 })).toBe(90);
  });

  it('uses the configured program duration (extended program)', () => {
    const days = ['2026-10-01', '2026-12-30', '2027-01-10']; // day 1, 91, 102
    expect(computeTierActiveDays({ activityDays: days, programStartDay: START, totalDays: 90 })).toBe(1);
    expect(computeTierActiveDays({ activityDays: days, programStartDay: START, totalDays: 104 })).toBe(3);
  });

  it('no batch → Tier Access 0 (nothing inferred)', () => {
    expect(computeTierActiveDays({ activityDays: ['2026-10-05'], programStartDay: null, totalDays: 90 })).toBe(0);
  });

  it('10. missing history is not filled in', () => {
    expect(metrics([], '2026-10-05T09:00:00+05:30')).toEqual({ streak: 0, tier: 0 });
  });
});

describe('program calendar (timezone) boundaries', () => {
  it('local midnight, not UTC midnight, starts a new day', () => {
    // 2026-10-05 23:30 IST is still Oct 5 in IST but already… still Oct 5 UTC 18:00.
    expect(localDayKey(new Date('2026-10-05T23:30:00+05:30'), TZ)).toBe('2026-10-05');
    // 2026-10-06 00:30 IST is Oct 6 locally but Oct 5 in UTC.
    expect(localDayKey(new Date('2026-10-06T00:30:00+05:30'), TZ)).toBe('2026-10-06');
    expect(new Date('2026-10-06T00:30:00+05:30').toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it("'today' for the streak is the program-calendar day", () => {
    expect(programToday(new Date('2026-10-06T00:30:00+05:30'), TZ).toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });

  it('accepts valid IANA zones, falls back to Asia/Kolkata otherwise (value is inlined in SQL)', () => {
    expect(resolveProgramTimezone('Asia/Dubai')).toBe('Asia/Dubai');
    expect(resolveProgramTimezone(undefined)).toBe('Asia/Kolkata');
    expect(resolveProgramTimezone("UTC'; DROP TABLE x;--")).toBe('Asia/Kolkata');
    expect(resolveProgramTimezone('Not/AZone')).toBe('Asia/Kolkata');
  });
});

describe('qualifying activity sources', () => {
  it('excludes coin spends / purchases, admin grants and bonuses', () => {
    for (const s of ['lifeline_spend', 'coin_purchase', 'admin_grant', 'early_completion']) {
      expect(QUALIFYING_ACTIVITY_SOURCES as readonly string[]).not.toContain(s);
    }
    expect(QUALIFYING_ACTIVITY_SOURCES).toContain('course_xp');
    expect(QUALIFYING_ACTIVITY_SOURCES).toContain('course_task');
  });
});
