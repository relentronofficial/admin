import { describe, expect, it } from 'vitest';

import {
  checklistAvailableActionUrl,
  computeApprovalRate,
  getCurrentDayNumber,
  getCurrentWeekNumber,
  getWeekDateRange,
  getWeekDayRange,
  getWeekNumber,
  shouldSendChecklistAvailableNotif,
  summarizeWeek,
} from './weekChecklistLogic.js';

describe('getWeekNumber', () => {
  it('maps days 1-7 to week 1, 8-14 to week 2', () => {
    expect(getWeekNumber(1)).toBe(1);
    expect(getWeekNumber(7)).toBe(1);
    expect(getWeekNumber(8)).toBe(2);
    expect(getWeekNumber(14)).toBe(2);
    expect(getWeekNumber(15)).toBe(3);
  });

  it('never goes below week 1', () => {
    expect(getWeekNumber(0)).toBe(1);
    expect(getWeekNumber(-5)).toBe(1);
  });
});

describe('getWeekDayRange', () => {
  it('computes the 7-day span for a week', () => {
    expect(getWeekDayRange(1)).toEqual({ startDay: 1, endDay: 7 });
    expect(getWeekDayRange(2)).toEqual({ startDay: 8, endDay: 14 });
  });

  it('clamps endDay to totalDays for the final partial week', () => {
    expect(getWeekDayRange(13, 90)).toEqual({ startDay: 85, endDay: 90 });
  });
});

describe('getWeekDateRange', () => {
  it('derives calendar dates from the batch start date, never hardcoded', () => {
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    const { startDate, endDate } = getWeekDateRange(startsAt, 2);
    expect(startDate.toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2026-01-14T00:00:00.000Z');
  });
});

describe('getCurrentDayNumber / getCurrentWeekNumber', () => {
  it('day 1 is the batch start date itself', () => {
    const startsAt = new Date('2026-08-01T00:00:00.000Z');
    expect(getCurrentDayNumber(startsAt, new Date('2026-08-01T12:00:00.000Z'))).toBe(1);
  });

  it('advances one day per 24h elapsed and rolls the week over on day 8', () => {
    const startsAt = new Date('2026-08-01T00:00:00.000Z');
    expect(getCurrentDayNumber(startsAt, new Date('2026-08-08T00:00:00.000Z'))).toBe(8);
    expect(getCurrentWeekNumber(startsAt, new Date('2026-08-08T00:00:00.000Z'))).toBe(2);
    expect(getCurrentWeekNumber(startsAt, new Date('2026-08-07T00:00:00.000Z'))).toBe(1);
  });
});

describe('computeApprovalRate', () => {
  it('rounds to nearest percent and guards divide-by-zero', () => {
    expect(computeApprovalRate(1, 3)).toBe(33);
    expect(computeApprovalRate(0, 0)).toBe(0);
    expect(computeApprovalRate(5, 5)).toBe(100);
  });
});

describe('summarizeWeek', () => {
  it('aggregates per-day rows into week totals and rates', () => {
    const summary = summarizeWeek({
      weekNumber: 1,
      batchStartsAt: new Date('2026-08-01T00:00:00.000Z'),
      totalMembers: 10,
      dayRows: [
        { dayNumber: 1, approved: 8, rejected: 1, pending: 1, inProgress: 0, total: 10 },
        { dayNumber: 2, approved: 6, rejected: 0, pending: 2, inProgress: 2, total: 10 },
      ],
    });
    expect(summary.totalAssigned).toBe(20);
    expect(summary.completed).toBe(14);
    expect(summary.pending).toBe(5); // (1+0) + (2+2)
    expect(summary.completionRate).toBe(70);
    expect(summary.dailyBreakdown[0].approvalRate).toBe(80);
    expect(summary.startDay).toBe(1);
    expect(summary.endDay).toBe(7);
  });
});

describe('checklist-available dedup', () => {
  it('encodes a per-day actionUrl for dedup lookups', () => {
    expect(checklistAvailableActionUrl(5)).toBe('/batch-program/5');
  });

  it('sends only once per day number', () => {
    expect(shouldSendChecklistAvailableNotif([1, 2, 3], 4)).toBe(true);
    expect(shouldSendChecklistAvailableNotif([1, 2, 3], 3)).toBe(false);
  });
});
