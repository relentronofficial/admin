import { describe, expect, it } from 'vitest';
import { computeWeeklyReportStatus, istWeekStart, lastPassedDeadline, weekDeadline } from './weeklyReportGate.js';

// IST wall-clock → instant. 2026-11-16 is a Monday.
const ist = (s: string) => new Date(`${s}+05:30`);
const ENROLLED = ist('2026-10-01T10:00:00');

const status = (now: string, lastSubmittedAt: string | null, firstEnrolledAt: Date | null = ENROLLED) =>
  computeWeeklyReportStatus({ now: ist(now), lastSubmittedAt: lastSubmittedAt ? ist(lastSubmittedAt) : null, firstEnrolledAt });

describe('week boundaries (IST)', () => {
  it('week starts Monday 00:00 IST, even late Sunday night or just after midnight UTC', () => {
    expect(istWeekStart(ist('2026-11-19T12:00:00')).toISOString()).toBe(ist('2026-11-16T00:00:00').toISOString());
    expect(istWeekStart(ist('2026-11-22T23:59:00')).toISOString()).toBe(ist('2026-11-16T00:00:00').toISOString());
    expect(istWeekStart(ist('2026-11-23T00:00:00')).toISOString()).toBe(ist('2026-11-23T00:00:00').toISOString());
    expect(istWeekStart(ist('2026-11-23T03:00:00')).toISOString()).toBe(ist('2026-11-23T00:00:00').toISOString()); // still Sunday in UTC
  });

  it('deadline is Saturday 18:00 IST; the last passed one rolls back a week before it', () => {
    expect(weekDeadline(ist('2026-11-17T09:00:00')).toISOString()).toBe(ist('2026-11-21T18:00:00').toISOString());
    expect(lastPassedDeadline(ist('2026-11-21T17:59:00')).toISOString()).toBe(ist('2026-11-14T18:00:00').toISOString());
    expect(lastPassedDeadline(ist('2026-11-21T18:00:00')).toISOString()).toBe(ist('2026-11-21T18:00:00').toISOString());
  });
});

describe('reminder popup', () => {
  it('shows on Friday and Saturday only, when this week is not submitted', () => {
    expect(status('2026-11-20T09:00:00', null).showReminder).toBe(true); // Friday
    expect(status('2026-11-21T20:00:00', null).showReminder).toBe(true); // Saturday
    expect(status('2026-11-19T09:00:00', null).showReminder).toBe(false); // Thursday
    expect(status('2026-11-22T09:00:00', null).showReminder).toBe(false); // Sunday
  });

  it('a report from this week hides it; one from last week does not', () => {
    expect(status('2026-11-20T09:00:00', '2026-11-16T08:00:00').showReminder).toBe(false);
    expect(status('2026-11-20T09:00:00', '2026-11-15T22:00:00').showReminder).toBe(true);
  });
});

describe('video lock', () => {
  it('not locked before Saturday 18:00 when last week was submitted', () => {
    expect(status('2026-11-21T17:59:00', '2026-11-14T10:00:00').locked).toBe(false);
  });

  it('locks at Saturday 18:00 until this week is submitted', () => {
    expect(status('2026-11-21T18:00:00', '2026-11-14T10:00:00').locked).toBe(true);
    expect(status('2026-11-21T18:30:00', '2026-11-21T18:20:00').locked).toBe(false);
    expect(status('2026-11-22T10:00:00', '2026-11-17T10:00:00').locked).toBe(false); // submitted Tuesday
  });

  it('a missed week stays locked into the next week until a report is submitted', () => {
    expect(status('2026-11-23T09:00:00', '2026-11-14T10:00:00').locked).toBe(true); // Monday, skipped last week
    expect(status('2026-11-24T09:00:00', '2026-11-23T10:00:00').locked).toBe(false); // submitted Monday
  });

  it('members with no course enrollment are never asked or locked', () => {
    const s = status('2026-11-21T20:00:00', null, null);
    expect(s).toMatchObject({ required: false, locked: false, showReminder: false });
  });

  it('a member who enrolled after the deadline is not locked by it', () => {
    expect(status('2026-11-21T20:00:00', null, ist('2026-11-21T19:00:00')).locked).toBe(false);
    expect(status('2026-11-21T20:00:00', null, ist('2026-11-21T17:00:00')).locked).toBe(true);
  });
});
