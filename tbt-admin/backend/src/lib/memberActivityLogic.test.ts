import { describe, it, expect } from 'vitest';
import { buildUsageHistory, summarizeDailyActivity, isActiveHeartbeat, isoWeekLabel, clampDays, type DailyActivityRow } from './memberActivityLogic.js';

const row = (date: string, activeMinutes: number, mediaMinutes = 0): DailyActivityRow => ({
  date, activeMinutes, mediaMinutes, firstActiveAt: `${date}T03:30:00.000Z`, lastActiveAt: `${date}T10:00:00.000Z`,
});

describe('isActiveHeartbeat', () => {
  it('counts a visible tab with recent interaction', () => {
    expect(isActiveHeartbeat({ visible: true, interacted: true })).toEqual({ active: true, media: false });
  });
  it('counts a visible tab playing media without interaction', () => {
    expect(isActiveHeartbeat({ visible: true, interacted: false, media: true })).toEqual({ active: true, media: true });
  });
  it('never counts a hidden/background tab, even if media is reported', () => {
    expect(isActiveHeartbeat({ visible: false, interacted: true, media: true })).toEqual({ active: false, media: false });
  });
  it('does not count an idle visible tab', () => {
    expect(isActiveHeartbeat({ visible: true, interacted: false, media: false }).active).toBe(false);
  });
  it('rejects malformed bodies (strings, missing fields)', () => {
    expect(isActiveHeartbeat({ visible: 'true', interacted: 1 }).active).toBe(false);
    expect(isActiveHeartbeat(undefined).active).toBe(false);
  });
});

describe('summarizeDailyActivity', () => {
  it('member with no recorded activity after tracking started → zeros, tracked', () => {
    const s = summarizeDailyActivity([], { today: '2026-10-13', days: 7, trackingStartDate: '2026-10-01' });
    expect(s.days).toHaveLength(7);
    expect(s.days.every((d) => d.tracked && d.activeMinutes === 0)).toBe(true);
    expect(s.today).toEqual({ activeMinutes: 0, mediaMinutes: 0, tracked: true });
    expect(s.last7Days).toEqual({ activeMinutes: 0, activeDays: 0, trackedDays: 7 });
  });

  it('days before tracking started are "not tracked", not zero', () => {
    const s = summarizeDailyActivity([row('2026-10-13', 40)], { today: '2026-10-13', days: 5, trackingStartDate: '2026-10-12' });
    expect(s.days.map((d) => [d.date, d.tracked])).toEqual([
      ['2026-10-13', true], ['2026-10-12', true], ['2026-10-11', false], ['2026-10-10', false], ['2026-10-09', false],
    ]);
    expect(s.last7Days.trackedDays).toBe(2);
  });

  it('no tracking data anywhere yet → every day not tracked', () => {
    const s = summarizeDailyActivity([], { today: '2026-10-13', days: 3, trackingStartDate: null });
    expect(s.days.every((d) => !d.tracked)).toBe(true);
    expect(s.today.tracked).toBe(false);
  });

  it('sums today, last 7 and last 30 days from recorded rows', () => {
    const rows = [row('2026-10-13', 30, 10), row('2026-10-10', 60), row('2026-10-01', 120)];
    const s = summarizeDailyActivity(rows, { today: '2026-10-13', days: 30, trackingStartDate: '2026-09-20' });
    expect(s.today).toEqual({ activeMinutes: 30, mediaMinutes: 10, tracked: true });
    expect(s.last7Days).toEqual({ activeMinutes: 90, activeDays: 2, trackedDays: 7 });
    expect(s.last30Days).toEqual({ activeMinutes: 210, activeDays: 3, trackedDays: 24 }); // window 09-14..10-13, tracking from 09-20
    expect(s.days[0].date).toBe('2026-10-13'); // newest first
  });

  it('groups into ISO weeks (Mon–Sun) and calendar months across a month boundary', () => {
    // 2026-09-28 is a Monday; 2026-10-04 is a Sunday.
    const rows = [row('2026-09-28', 10), row('2026-10-04', 20), row('2026-10-05', 5)];
    const s = summarizeDailyActivity(rows, { today: '2026-10-05', days: 8, trackingStartDate: '2026-09-01' });
    const w40 = s.weekly.find((w) => w.label === '2026-W40')!;
    expect(w40).toMatchObject({ startDate: '2026-09-28', endDate: '2026-10-04', activeMinutes: 30, activeDays: 2, totalDays: 7 });
    expect(s.weekly.find((w) => w.label === '2026-W41')!.activeMinutes).toBe(5);
    expect(s.monthly.find((m) => m.label === '2026-09')!.activeMinutes).toBe(10);
    expect(s.monthly.find((m) => m.label === '2026-10')!.activeMinutes).toBe(25);
  });

  it('a recorded row on a day before the global start still counts as tracked', () => {
    const s = summarizeDailyActivity([row('2026-10-11', 15)], { today: '2026-10-13', days: 3, trackingStartDate: '2026-10-12' });
    expect(s.days.find((d) => d.date === '2026-10-11')).toMatchObject({ tracked: true, activeMinutes: 15 });
  });
});

describe('helpers', () => {
  it('isoWeekLabel handles the year boundary (2027-01-01 is in 2026-W53)', () => {
    expect(isoWeekLabel('2027-01-01').label).toBe('2026-W53');
    expect(isoWeekLabel('2026-01-01').label).toBe('2026-W01');
  });
  it('clampDays bounds the range', () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays('0')).toBe(30);
    expect(clampDays('9999')).toBe(366);
    expect(clampDays('90')).toBe(90);
  });
});

describe('buildUsageHistory (member Daily Time Spent popup)', () => {
  const row = (date: string, activeMinutes: number, mediaMinutes = 0): DailyActivityRow =>
    ({ date, activeMinutes, mediaMinutes, firstActiveAt: null, lastActiveAt: null });

  it('new member with no usage: every day from onboarding to today, all 0, nothing invented', () => {
    const h = buildUsageHistory([], { today: '2026-11-11', onboardingDate: '2026-11-09', trackingStartDate: '2026-10-01' });
    expect(h.days.map((d) => [d.date, d.activeMinutes])).toEqual([['2026-11-11', 0], ['2026-11-10', 0], ['2026-11-09', 0]]);
    expect(h).toMatchObject({ totalMinutes: 0, averageDailyMinutes: 0, activeDays: 0, trackedDays: 3, rangeStart: '2026-11-09', trackedFrom: '2026-11-09' });
  });

  it('newest first, zero-use days included, totals and average over tracked days', () => {
    // One row per day already merges every session/device of that day (one bit per minute).
    const h = buildUsageHistory([row('2026-11-01', 85), row('2026-11-02', 130), row('2026-11-04', 45)],
      { today: '2026-11-05', onboardingDate: '2026-11-01', trackingStartDate: '2026-10-01' });
    expect(h.days.map((d) => d.activeMinutes)).toEqual([0, 45, 0, 130, 85]);
    expect(h.days[0].date).toBe('2026-11-05');
    expect(h).toMatchObject({ totalMinutes: 260, trackedDays: 5, activeDays: 3, averageDailyMinutes: 52 });
  });

  it('days before tracking went live are not tracked (unknown), never reported as 0', () => {
    const h = buildUsageHistory([row('2026-10-02', 30)], { today: '2026-10-03', onboardingDate: '2026-09-28', trackingStartDate: '2026-10-01' });
    expect(h.rangeStart).toBe('2026-09-28');
    expect(h.trackedFrom).toBe('2026-10-01');
    expect(h.days.map((d) => d.date)).toEqual(['2026-10-03', '2026-10-02', '2026-10-01']);
    expect(h.averageDailyMinutes).toBe(10);
  });

  it('activity recorded before the onboarding date is included (the range starts there)', () => {
    const h = buildUsageHistory([row('2026-11-01', 20), row('2026-11-03', 10)], { today: '2026-11-03', onboardingDate: '2026-11-02', trackingStartDate: '2026-10-01' });
    expect(h.onboardingDate).toBe('2026-11-02');
    expect(h.rangeStart).toBe('2026-11-01');
    expect(h.totalMinutes).toBe(30);
  });

  it('no onboarding date: starts at the first recorded day; no rows: just today', () => {
    expect(buildUsageHistory([row('2026-11-09', 5)], { today: '2026-11-11', onboardingDate: null, trackingStartDate: '2026-10-01' }).rangeStart).toBe('2026-11-09');
    const none = buildUsageHistory([], { today: '2026-11-11', onboardingDate: null, trackingStartDate: null });
    expect(none).toMatchObject({ trackedFrom: null, days: [], totalMinutes: 0 });
  });

  it('dates are the stored program-timezone (IST) days — a row is never moved across midnight', () => {
    const h = buildUsageHistory([row('2026-11-10', 1), row('2026-11-11', 1439)], { today: '2026-11-11', onboardingDate: '2026-11-10', trackingStartDate: '2026-10-01' });
    expect(h.days.map((d) => [d.date, d.activeMinutes])).toEqual([['2026-11-11', 1439], ['2026-11-10', 1]]);
  });

  it('long histories are capped at maxDays (flagged), and future rows are ignored', () => {
    const h = buildUsageHistory([row('2026-11-12', 99)], { today: '2026-11-11', onboardingDate: '2020-01-01', trackingStartDate: '2020-01-01', maxDays: 400 });
    expect(h.days).toHaveLength(400);
    expect(h.truncated).toBe(true);
    expect(h.totalMinutes).toBe(0);
  });
});
