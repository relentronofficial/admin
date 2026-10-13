import { describe, it, expect } from 'vitest';
import { summarizeDailyActivity, isActiveHeartbeat, isoWeekLabel, clampDays, type DailyActivityRow } from './memberActivityLogic.js';

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
