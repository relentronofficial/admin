import { describe, expect, it } from 'vitest';
import {
  decideDueRun,
  istDateOf,
  istDateTime,
  istTimeOf,
  nextRecurringRun,
  ruleFromRow,
  resumeNextRun,
  validateScheduleInput,
} from './chatScheduleLogic.js';
import { relativeDate, relativeRunAt, syncRelative } from './chatScheduleLogic.js';

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

describe('nextRecurringRun — daily', () => {
  const rule = { frequency: 'daily' as const, startDate: '2026-11-21', timeOfDay: '09:00', endDate: null };
  it('moves to tomorrow when today’s time has passed', () => {
    expect(nextRecurringRun(rule, NOW)!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('uses today when the time is still ahead', () => {
    expect(nextRecurringRun({ ...rule, timeOfDay: '18:00' }, NOW)!.toISOString()).toBe('2026-11-21T12:30:00.000Z');
  });
  it('never starts before the start date', () => {
    expect(nextRecurringRun({ ...rule, startDate: '2026-12-01' }, NOW)!.toISOString()).toBe('2026-12-01T03:30:00.000Z');
  });
  it('a run at exactly `from` counts', () => {
    const at = istDateTime('2026-11-25', '09:00')!;
    expect(nextRecurringRun(rule, at)!.getTime()).toBe(at.getTime());
  });
  it('stops after the end date (inclusive)', () => {
    expect(nextRecurringRun({ ...rule, endDate: '2026-11-22' }, NOW)!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
    expect(nextRecurringRun({ ...rule, endDate: '2026-11-21' }, NOW)).toBeNull();
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
      expect(r.value.recurring).toEqual({ frequency: 'daily', startDate: '2026-11-01', timeOfDay: '09:00', endDate: null });
      expect(r.value.nextRunAt.toISOString()).toBe('2026-11-22T03:30:00.000Z');
    }
  });
  it('refuses an end date before the start date, or one already over', () => {
    expect(validateScheduleInput({ scheduleType: 'daily', body: 'x', date: '2026-11-25', time: '09:00', endDate: '2026-11-24' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'daily', body: 'x', date: '2026-11-01', time: '09:00', endDate: '2026-11-21' }, NOW).ok).toBe(false);
  });
  it('requires a type, text, date and time', () => {
    expect(validateScheduleInput({ scheduleType: 'yearly', body: 'x', date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: '   ', date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x', date: '', time: '09:00' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x', date: '2026-11-22', time: '9am' }, NOW).ok).toBe(false);
    expect(validateScheduleInput({ scheduleType: 'once', body: 'x'.repeat(5001), date: '2026-11-22', time: '09:00' }, NOW).ok).toBe(false);
  });
});

describe('decideDueRun', () => {
  const daily = { frequency: 'daily' as const, startDate: '2026-11-01', timeOfDay: '09:00', endDate: null };
  it('sends a one-time message that is due, then finishes', () => {
    const due = new Date('2026-11-21T04:29:30Z');
    expect(decideDueRun({ scheduleType: 'once', nextRunAt: due, recurring: null }, NOW)).toEqual({ send: true, nextRunAt: null });
  });
  it('skips a one-time message missed by more than the grace period', () => {
    const due = new Date('2026-11-21T01:00:00Z');
    expect(decideDueRun({ scheduleType: 'once', nextRunAt: due, recurring: null }, NOW)).toEqual({ send: false, nextRunAt: null });
  });
  it('sends a daily run and moves to the next day', () => {
    const due = istDateTime('2026-11-21', '09:00')!; // 1 h ago
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, recurring: daily }, NOW);
    expect(d.send).toBe(true);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('a daily run due right now never runs twice the same day', () => {
    const due = istDateTime('2026-11-21', '10:00')!; // == NOW
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, recurring: { ...daily, timeOfDay: '10:00' } }, NOW);
    expect(d.send).toBe(true);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T04:30:00.000Z');
  });
  it('skips days missed while down instead of back-filling them', () => {
    const due = istDateTime('2026-11-18', '09:00')!;
    const d = decideDueRun({ scheduleType: 'daily', nextRunAt: due, recurring: daily }, NOW);
    expect(d.send).toBe(false);
    expect(d.nextRunAt!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('finishes a daily schedule after its last day', () => {
    const due = istDateTime('2026-11-21', '09:00')!;
    expect(decideDueRun({ scheduleType: 'daily', nextRunAt: due, recurring: { ...daily, endDate: '2026-11-21' } }, NOW))
      .toEqual({ send: true, nextRunAt: null });
  });
});

describe('resumeNextRun', () => {
  it('resumes a daily schedule from now', () => {
    const r = resumeNextRun({ scheduleType: 'daily', sendAt: null, recurring: { frequency: 'daily', startDate: '2026-11-01', timeOfDay: '09:00', endDate: null } }, NOW);
    expect(r!.toISOString()).toBe('2026-11-22T03:30:00.000Z');
  });
  it('a one-time message whose moment passed cannot resume', () => {
    expect(resumeNextRun({ scheduleType: 'once', sendAt: new Date('2026-11-21T04:00:00Z'), recurring: null }, NOW)).toBeNull();
    expect(resumeNextRun({ scheduleType: 'once', sendAt: new Date('2026-11-21T05:00:00Z'), recurring: null }, NOW)!.toISOString()).toBe('2026-11-21T05:00:00.000Z');
  });
});

describe('nextRecurringRun — weekly', () => {
  // 2026-11-16 is a Monday
  const rule = { frequency: 'weekly' as const, startDate: '2026-11-16', timeOfDay: '09:00', endDate: null };
  it('runs on the start date’s weekday each week', () => {
    expect(nextRecurringRun(rule, NOW)!.toISOString()).toBe('2026-11-23T03:30:00.000Z'); // next Monday
  });
  it('uses the start date itself when it is ahead', () => {
    expect(nextRecurringRun({ ...rule, startDate: '2026-11-26' }, NOW)!.toISOString()).toBe('2026-11-26T03:30:00.000Z');
  });
  it('respects the end date', () => {
    expect(nextRecurringRun({ ...rule, endDate: '2026-11-22' }, NOW)).toBeNull();
    expect(nextRecurringRun({ ...rule, endDate: '2026-11-23' }, NOW)!.toISOString()).toBe('2026-11-23T03:30:00.000Z');
  });
  it('after a run, moves exactly one week on', () => {
    const due = istDateTime('2026-11-23', '09:00')!;
    const d = decideDueRun({ scheduleType: 'weekly', nextRunAt: due, recurring: rule }, new Date(due.getTime() + 20_000));
    expect(d).toEqual({ send: true, nextRunAt: istDateTime('2026-11-30', '09:00') });
  });
});

describe('nextRecurringRun — monthly', () => {
  const rule = { frequency: 'monthly' as const, startDate: '2026-10-15', timeOfDay: '10:30', endDate: null };
  it('runs on the same day of each month', () => {
    expect(nextRecurringRun(rule, NOW)!.toISOString()).toBe(istDateTime('2026-12-15', '10:30')!.toISOString());
    expect(nextRecurringRun({ ...rule, startDate: '2026-10-21', timeOfDay: '11:00' }, NOW)!.toISOString())
      .toBe(istDateTime('2026-11-21', '11:00')!.toISOString()); // later today
  });
  it('uses the last day in months too short, then returns to the 31st', () => {
    const r31 = { ...rule, startDate: '2027-01-31' };
    const feb = nextRecurringRun(r31, istDateTime('2027-02-01', '00:00')!);
    expect(feb!.toISOString()).toBe(istDateTime('2027-02-28', '10:30')!.toISOString());
    const after = decideDueRun({ scheduleType: 'monthly', nextRunAt: feb!, recurring: r31 }, new Date(feb!.getTime() + 1000));
    expect(after.nextRunAt!.toISOString()).toBe(istDateTime('2027-03-31', '10:30')!.toISOString());
  });
  it('crosses the year boundary', () => {
    expect(nextRecurringRun(rule, istDateTime('2026-12-20', '00:00')!)!.toISOString())
      .toBe(istDateTime('2027-01-15', '10:30')!.toISOString());
  });
  it('a long-running schedule still lands on the right month', () => {
    expect(nextRecurringRun({ ...rule, startDate: '2024-03-31' }, NOW)!.toISOString())
      .toBe(istDateTime('2026-11-30', '10:30')!.toISOString());
  });
  it('validates and refuses an end date with no run left', () => {
    const okR = validateScheduleInput({ scheduleType: 'monthly', body: 'x', date: '2026-10-15', time: '10:30' }, NOW);
    expect(okR.ok && okR.value.nextRunAt.toISOString()).toBe(istDateTime('2026-12-15', '10:30')!.toISOString());
    expect(validateScheduleInput({ scheduleType: 'monthly', body: 'x', date: '2026-10-15', time: '10:30', endDate: '2026-12-01' }, NOW).ok).toBe(false);
  });
});

describe('ruleFromRow', () => {
  it('rebuilds repeating rules and ignores one-time rows', () => {
    expect(ruleFromRow('weekly', '2026-11-16', '09:00', null)).toEqual({ frequency: 'weekly', startDate: '2026-11-16', timeOfDay: '09:00', endDate: null });
    expect(ruleFromRow('once', '2026-11-16', '09:00', null)).toBeNull();
    expect(ruleFromRow('yearly', '2026-11-16', '09:00', null)).toBeNull();
  });
});

describe('relative to the start date', () => {
  it('Day 1 is the start date, Day 10 is nine days later, -1 is the day before', () => {
    expect(relativeDate('2026-12-01', 1)).toBe('2026-12-01');
    expect(relativeDate('2026-12-01', 10)).toBe('2026-12-10');
    expect(relativeDate('2026-12-01', -1)).toBe('2026-11-30');
    expect(relativeDate('2027-01-01', -2)).toBe('2026-12-30');
    expect(relativeDate('2026-12-01', 0)).toBeNull();
  });
  it('validates and computes the send time', () => {
    const v = validateScheduleInput({ scheduleType: 'relative', body: 'x', day: -2, time: '09:00' }, NOW, '2026-12-01');
    expect(v.ok && v.value.nextRunAt.toISOString()).toBe('2026-11-29T03:30:00.000Z');
    expect(v.ok && v.value.relative).toEqual({ day: -2, timeOfDay: '09:00' });
  });
  it('refuses day 0, fractions, text, missing start date and past days', () => {
    const base = { scheduleType: 'relative', body: 'x', time: '09:00' };
    for (const day of [0, 1.5, '3', 1001, -366, null]) {
      expect(validateScheduleInput({ ...base, day }, NOW, '2026-12-01').ok).toBe(false);
    }
    expect(validateScheduleInput({ ...base, day: 1 }, NOW, null).ok).toBe(false);
    expect(validateScheduleInput({ ...base, day: 1 }, NOW, '2026-11-21').ok).toBe(false); // 09:00, now is 10:00
    expect(validateScheduleInput({ ...base, day: 2 }, NOW, '2026-11-21').ok).toBe(true);
  });
  it('sends once: no next run, and no repeating rule', () => {
    const due = relativeRunAt('2026-11-21', 1, '10:00')!;
    expect(decideDueRun({ scheduleType: 'relative', nextRunAt: due, recurring: null }, NOW)).toEqual({ send: true, nextRunAt: null });
    expect(ruleFromRow('relative', null, '10:00', null)).toBeNull();
  });
  it('follows a moved start date, and never posts a passed day late', () => {
    const old = relativeRunAt('2026-12-01', 5, '09:00')!;
    const later = relativeRunAt('2026-12-08', 5, '09:00')!;
    const past = relativeRunAt('2026-11-01', 5, '09:00')!;
    expect(syncRelative({ status: 'active', nextRunAt: old, runAt: old }, NOW)).toBeNull();
    expect(syncRelative({ status: 'active', nextRunAt: old, runAt: later }, NOW)).toEqual({ status: 'active', nextRunAt: later, error: null });
    expect(syncRelative({ status: 'paused', nextRunAt: old, runAt: later }, NOW)?.status).toBe('paused');
    expect(syncRelative({ status: 'active', nextRunAt: old, runAt: past }, NOW)).toMatchObject({ status: 'missed', nextRunAt: null });
    expect(syncRelative({ status: 'missed', nextRunAt: null, runAt: later }, NOW)).toEqual({ status: 'active', nextRunAt: later, error: null });
    expect(syncRelative({ status: 'missed', nextRunAt: null, runAt: past }, NOW)).toBeNull();
    expect(syncRelative({ status: 'completed', nextRunAt: null, runAt: later }, NOW)).toBeNull();
  });
  it('waits without a start date; a due message is left for the sender', () => {
    const due = relativeRunAt('2026-11-21', 1, '10:00')!;
    expect(syncRelative({ status: 'active', nextRunAt: due, runAt: null }, NOW)).toMatchObject({ status: 'active', nextRunAt: null });
    expect(syncRelative({ status: 'active', nextRunAt: due, runAt: due }, NOW)).toBeNull();
  });
});
