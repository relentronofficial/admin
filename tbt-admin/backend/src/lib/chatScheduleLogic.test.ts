import { describe, expect, it } from 'vitest';
import {
  decideDueRun,
  istDateOf,
  istDateTime,
  istTimeOf,
  nextDailyRun,
  resumeNextRun,
  validateScheduleInput,
} from './chatScheduleLogic.js';

// 2026-11-21 10:00 IST = 04:30 UTC
const NOW = new Date('2026-11-21T04:30:00Z');

describe('IST helpers', () => {
  it('reads date + time as IST', () => {
    expect(istDateTime('2026-11-21', '09:00')!.toISOString()).toBe('2026-11-21T03:30:00.000Z');
    expect(istDateTime('2026-11-22', '00:15')!.toISOString()).toBe('2026-11-21T18:45:00.000Z');
  });
  it('rejects impossible dates and times', () => {
    expect(istDateTime('2026-02-30', '09:00')).toBeNull();
    expect(istDateTime('2026-11-21', '24:00')).toBeNull();
    expect(istDateTime('21-11-2026', '09:00')).toBeNull();
  });
  it('formats an instant back to IST', () => {
    const at = new Date('2026-11-21T18:45:00Z');
    expect(istDateOf(at)).toBe('2026-11-22');
    expect(istTimeOf(at)).toBe('00:15');
  });
});

describe('nextDailyRun', () => {
  const rule = { startDate: '2026-11-21', timeOfDay: '09:00', endDate: null };
  it('moves to tomorrow when today’s time has passed', () => {
    expect(nextDailyRun(rule, NOW)!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('uses today when the time is still ahead', () => {
    expect(nextDailyRun({ ...rule, timeOfDay: '18:00' }, NOW)!.toISOString()).toBe('2026-11-21T12:30:00.000Z');
  });
  it('never starts before the start date', () => {
    expect(nextDailyRun({ ...rule, startDate: '2026-12-01' }, NOW)!.toISOString()).toBe('2026-12-01T03:30:00.000Z');
  });
  it('a run at exactly `from` counts', () => {
    const at = istDateTime('2026-11-25', '09:00')!;
    expect(nextDailyRun(rule, at)!.getTime()).toBe(at.getTime());
  });
  it('stops after the end date (inclusive)', () => {
    expect(nextDailyRun({ ...rule, endDate: '2026-11-22' }, NOW)!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
    expect(nextDailyRun({ ...rule, endDate: '2026-11-21' }, NOW)).toBeNull();
  });
});

describe('validateScheduleInput', () => {
  it('accepts a future one-time message', () => {
    const r = validateScheduleInput({ scheduleType: 'once', body: ' Hello ', date: '2026-11-21', time: '18:30' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.body).toBe('Hello');
      expect(r.value.sendAt!.toISOString()).toBe('2026-11-21T13:00:00.000Z');
      expect(r.value.nextRunAt.toISOString()).toBe('2026-11-21T13:00:00.000Z');
    }
  });
  it('refuses a one-time message in the past', () => {
    const r = validateScheduleInput({ scheduleType: 'once', body: 'x', date: '2026-11-21', time: '09:59' }, NOW);
    expect(r.ok).toBe(false);
  });
  it('accepts a daily schedule that started in the past', () => {
    const r = validateScheduleInput({ scheduleType: 'daily', body: 'Good morning', date: '2026-11-01', time: '09:00' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.daily).toEqual({ startDate: '2026-11-01', timeOfDay: '09:00', endDate: null });
      expect(r.value.nextRunAt.toISOString()).toBe('2026-11-22T03:30:00.000Z');
    }
  });
  it('refuses an end date before the start date, or one already over', () => {
    expect(validateScheduleInput({ scheduleType: 'daily', body: 'x', date: '2026-11-25', time: '09:00', endDate: '2026-11-24' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'daily', body: 'x', date: '2026-11-01', time: '09:00', endDate: '2026-11-21' }, NOW).ok).toBe(false);
  });
  it('requires a type, text, date and time', () => {
    expect(validateScheduleInput({ scheduleType: 'weekly', body: 'x', date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: '   ', date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x', date: '', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x', date: '2026-11-22', time: '9am' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x'.repeat(5001), date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
  });
});

describe('decideDueRun', () => {
  const daily = { startDate: '2026-11-01', timeOfDay: '09:00', endDate: null };
  it('sends a one-time message that is due, then finishes', () => {
    const due = new Date('2026-11-21T04:29:30Z');
    expect(decideDueRun({ scheduleType: 'once', nextRunAt: due, daily: null }, NOW)).toEqual({ send: true, nextRunAt: null });
  });
  it('skips a one-time message missed by more than the grace period', () => {
    const due = new Date('2026-11-21T01:00:00Z');
    expect(decideDueRun({ scheduleType: 'once', nextRunAt: due, daily: null }, NOW)).toEqual({ send: false, nextRunAt: null });
  });
  it('sends a daily run and moves to the next day', () => {
    const due = istDateTime('2026-11-21', '09:00')!; // 1 h ago
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, daily }, NOW);
    expect(d.send).toBe(true);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('a daily run due right now never runs twice the same day', () => {
    const due = istDateTime('2026-11-21', '10:00')!; // == NOW
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, daily: { ...daily, timeOfDay: '10:00' } }, NOW);
    expect(d.send).toBe(true);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T04:30:00.000Z');
  });
  it('skips days missed while down instead of back-filling them', () => {
    const due = istDateTime('2026-11-18', '09:00')!;
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, daily }, NOW);
    expect(d.send).toBe(false);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('finishes a daily schedule after its last day', () => {
    const due = istDateTime('2026-11-21', '09:00')!;
    expect(decideDueRun({ scheduleType: 'daily', nextRunAt: due, daily: { ...daily, endDate: '2026-11-21' } }, NOW))
      .toEqual({ send: true, nextRunAt: null });
  });
});

describe('resumeNextRun', () => {
  it('resumes a daily schedule from now', () => {
    const r = resumeNextRun({ scheduleType: 'daily', sendAt: null, daily: { startDate: '2026-11-01', timeOfDay: '09:00', endDate: null } }, NOW);
    expect(r!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('a one-time message whose moment passed cannot resume', () => {
    expect(resumeNextRun({ scheduleType: 'once', sendAt: new Date('2026-11-21T04:00:00Z'), daily: null }, NOW)).toBeNull();
    expect(resumeNextRun({ scheduleType: 'once', sendAt: new Date('2026-11-21T05:00:00Z'), daily: null }, NOW)!.toISOString()).toBe('2026-11-21T05:00:00.000Z');
  });
});
