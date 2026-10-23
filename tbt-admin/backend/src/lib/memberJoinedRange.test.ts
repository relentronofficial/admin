import { describe, expect, it } from 'vitest';
import { memberJoinedRange } from './memberJoinedRange.js';

// Regression: the admin Members filter sends plain dates ("YYYY-MM-DD"). They
// were read as midnight UTC (05:30 IST), so "Joined to <today>" hid everyone
// who joined after 05:30 IST today.
describe('memberJoinedRange', () => {
  it('"Joined to" a date includes the whole IST day', () => {
    const r = memberJoinedRange(undefined, '2026-10-23');
    expect(r).toEqual({ lt: new Date('2026-10-23T18:30:00.000Z') }); // 24 Oct 00:00 IST
    const joinedAt = (iso: string) => new Date(iso).getTime() < r.lt!.getTime();
    expect(joinedAt('2026-10-23T12:00:00.000Z')).toBe(true);  // 17:30 IST on the 23rd
    expect(joinedAt('2026-10-23T18:29:59.000Z')).toBe(true);  // 23:59:59 IST
    expect(joinedAt('2026-10-23T18:30:00.000Z')).toBe(false); // 24 Oct 00:00 IST
  });

  it('"Joined from" a date starts at 00:00 IST, not 05:30 IST', () => {
    expect(memberJoinedRange('2026-10-23', undefined)).toEqual({ gte: new Date('2026-10-22T18:30:00.000Z') });
  });

  it('the same date in both bounds means that single IST day', () => {
    expect(memberJoinedRange('2026-10-23', '2026-10-23')).toEqual({
      gte: new Date('2026-10-22T18:30:00.000Z'),
      lt: new Date('2026-10-23T18:30:00.000Z'),
    });
  });

  it('keeps a full timestamp exactly as given', () => {
    expect(memberJoinedRange('2026-10-01T10:00:00Z', '2026-10-05T10:00:00Z')).toEqual({
      gte: new Date('2026-10-01T10:00:00Z'),
      lte: new Date('2026-10-05T10:00:00Z'),
    });
  });

  it('ignores empty, invalid and impossible dates (no filter, no 500)', () => {
    expect(memberJoinedRange('', undefined)).toEqual({});
    expect(memberJoinedRange('not-a-date', 'also-bad')).toEqual({});
    expect(memberJoinedRange('2026-02-30', '2026-13-01')).toEqual({});
    expect(memberJoinedRange(123, null)).toEqual({});
  });
});
