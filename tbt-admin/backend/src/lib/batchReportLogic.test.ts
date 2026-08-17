import { describe, expect, it } from 'vitest';

import {
  buildTanglishMessage,
  computeDayNumberForDate,
  computeMemberStats,
  getMonthlyPeriod,
  getWeeklyPeriod,
  isEligibleMember,
  isLastDayOfMonth,
} from './batchReportLogic.js';

// All fixed instants below are UTC; comments note the IST-equivalent wall clock
// since batchReports.ts computes period boundaries on the IST calendar date.

describe('getWeeklyPeriod', () => {
  it('returns the Monday-Sunday week containing the given date, keyed by ISO week', () => {
    // 2026-08-16T15:00:00Z = 2026-08-16 20:30 IST = Sunday
    const period = getWeeklyPeriod(new Date('2026-08-16T15:00:00Z'));
    expect(period.type).toBe('weekly');
    expect(period.periodKey).toBe('2026-W33');
    expect(period.label).toBe('10 Aug - 16 Aug 2026');
  });

  it('produces the same periodKey for any day within the same IST week', () => {
    const monday = getWeeklyPeriod(new Date('2026-08-10T04:00:00Z')); // Mon 09:30 IST
    const sunday = getWeeklyPeriod(new Date('2026-08-16T15:00:00Z')); // Sun 20:30 IST
    expect(monday.periodKey).toBe(sunday.periodKey);
  });
});

describe('getMonthlyPeriod', () => {
  it('returns the calendar month (IST) containing the given date', () => {
    // 2026-08-31T16:00:00Z = 2026-08-31 21:30 IST
    const period = getMonthlyPeriod(new Date('2026-08-31T16:00:00Z'));
    expect(period.type).toBe('monthly');
    expect(period.periodKey).toBe('2026-08');
    expect(period.label).toBe('August 2026');
  });
});

describe('isLastDayOfMonth', () => {
  it('is true on the last IST calendar day of a 31-day month', () => {
    expect(isLastDayOfMonth(new Date('2026-08-31T16:00:00Z'))).toBe(true); // 21:30 IST Aug 31
  });

  it('is false the day before month end', () => {
    expect(isLastDayOfMonth(new Date('2026-08-30T16:00:00Z'))).toBe(false);
  });

  it('handles a UTC date that has already crossed into the next month but is still the last IST day', () => {
    // 2026-08-31T19:00:00Z = 2026-09-01 00:30 IST — already the 1st in IST, so NOT last-day-of-Aug
    expect(isLastDayOfMonth(new Date('2026-08-31T19:00:00Z'))).toBe(false);
  });
});

describe('computeDayNumberForDate', () => {
  it('returns 1 on the batch start date', () => {
    const start = new Date('2026-08-01T00:00:00Z');
    expect(computeDayNumberForDate(start, start)).toBe(1);
  });

  it('increments by 1 per elapsed day', () => {
    const start = new Date('2026-08-01T00:00:00Z');
    const tenDaysLater = new Date('2026-08-11T00:00:00Z');
    expect(computeDayNumberForDate(tenDaysLater, start)).toBe(11);
  });
});

describe('computeMemberStats', () => {
  it('counts approved days as completed and everything else as pending', () => {
    const stats = computeMemberStats({
      progress: [
        { dayNumber: 1, status: 'approved' },
        { dayNumber: 2, status: 'approved' },
        { dayNumber: 3, status: 'rejected' },
        { dayNumber: 4, status: 'not_started' },
      ],
      periodDayStart: 1,
      periodDayEnd: 4,
      currentDay: 4,
      totalDays: 90,
    });
    expect(stats).toEqual({ totalAssigned: 4, completed: 2, pending: 2, completionRate: 50, streak: 0 });
  });

  it('treats a day with no progress row as pending, not an error', () => {
    const stats = computeMemberStats({
      progress: [{ dayNumber: 1, status: 'approved' }],
      periodDayStart: 1,
      periodDayEnd: 3,
      currentDay: 3,
      totalDays: 90,
    });
    expect(stats.totalAssigned).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(2);
  });

  it('computes the current streak by walking back from currentDay while approved', () => {
    const stats = computeMemberStats({
      progress: [
        { dayNumber: 1, status: 'rejected' },
        { dayNumber: 2, status: 'approved' },
        { dayNumber: 3, status: 'approved' },
        { dayNumber: 4, status: 'approved' },
      ],
      periodDayStart: 1,
      periodDayEnd: 4,
      currentDay: 4,
      totalDays: 90,
    });
    expect(stats.streak).toBe(3);
  });

  it('resets streak to 0 the moment a non-approved day is hit walking backward from currentDay', () => {
    const stats = computeMemberStats({
      progress: [
        { dayNumber: 1, status: 'approved' },
        { dayNumber: 2, status: 'approved' },
        { dayNumber: 3, status: 'not_started' },
      ],
      periodDayStart: 1,
      periodDayEnd: 3,
      currentDay: 3,
      totalDays: 90,
    });
    expect(stats.streak).toBe(0);
  });

  it('returns a zero completion rate (not NaN/Infinity) when totalAssigned is 0', () => {
    const stats = computeMemberStats({
      progress: [],
      periodDayStart: 5,
      periodDayEnd: 4, // end before start → empty range
      currentDay: 4,
      totalDays: 90,
    });
    expect(stats.totalAssigned).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe('isEligibleMember', () => {
  it('is eligible when member is active, batch is active, and phone is present', () => {
    expect(isEligibleMember({ status: 'active', phone: '9876543210' }, { isActive: true })).toBe(true);
  });

  it('is not eligible when member status is not active', () => {
    expect(isEligibleMember({ status: 'paused', phone: '9876543210' }, { isActive: true })).toBe(false);
  });

  it('is not eligible when the batch is inactive', () => {
    expect(isEligibleMember({ status: 'active', phone: '9876543210' }, { isActive: false })).toBe(false);
  });

  it('is not eligible when phone is missing', () => {
    expect(isEligibleMember({ status: 'active', phone: null }, { isActive: true })).toBe(false);
  });
});

describe('buildTanglishMessage', () => {
  const baseStats = { totalAssigned: 10, completed: 8, pending: 2, completionRate: 80, streak: 6 };

  it('includes the member name, period label and computed numbers verbatim', () => {
    const msg = buildTanglishMessage({
      firstName: 'Priya',
      reportType: 'weekly',
      periodLabel: '10 Aug - 16 Aug 2026',
      stats: baseStats,
    });
    expect(msg).toContain('Hi Priya 👋');
    expect(msg).toContain('10 Aug - 16 Aug 2026');
    expect(msg).toContain('Completed Tasks: 8');
    expect(msg).toContain('Pending Tasks: 2');
    expect(msg).toContain('Completion Rate: 80%');
    expect(msg).toContain('Current Streak: 6 days');
  });

  it('uses encouraging, non-negative wording even for low completion rates', () => {
    const msg = buildTanglishMessage({
      firstName: 'Rajan',
      reportType: 'weekly',
      periodLabel: '10 Aug - 16 Aug 2026',
      stats: { totalAssigned: 10, completed: 1, pending: 9, completionRate: 10, streak: 0 },
    });
    expect(msg.toLowerCase()).not.toMatch(/fail|bad|poor|lazy|disappoint/);
    expect(msg).toContain('konjam tasks pending irukku');
  });

  it('switches "week" wording to "month" for monthly reports', () => {
    const msg = buildTanglishMessage({
      firstName: 'Priya',
      reportType: 'monthly',
      periodLabel: 'August 2026',
      stats: baseStats,
    });
    expect(msg).toContain('Monthly Report');
    expect(msg).not.toContain('Weekly Report');
  });
});
