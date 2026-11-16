import { describe, it, expect } from 'vitest';
import {
  buildPendingWork,
  callWhen,
  isTicketOverdue,
  isOpenTicketStatus,
  istDate,
  parsePaging,
  type WorkspaceCounts,
} from './myWorkspaceLogic.js';

const zero: WorkspaceCounts = {
  ticketsNew: 0, ticketsOverdue: 0, ticketsOpen: 0, memberTicketsUnassigned: 0,
  membersUnderReview: 0, membersInactive: 0, callsToday: 0,
};

describe('tickets', () => {
  const now = new Date('2026-11-16T10:00:00Z');

  it('open statuses', () => {
    for (const s of ['new', 'acknowledged', 'in_progress', 'waiting_for_user']) expect(isOpenTicketStatus(s)).toBe(true);
    for (const s of ['resolved', 'closed']) expect(isOpenTicketStatus(s)).toBe(false);
  });

  it('overdue = open and past the resolve deadline', () => {
    const past = new Date('2026-11-16T09:00:00Z');
    expect(isTicketOverdue({ status: 'in_progress', resolveDeadline: past }, now)).toBe(true);
    expect(isTicketOverdue({ status: 'resolved', resolveDeadline: past }, now)).toBe(false);
    expect(isTicketOverdue({ status: 'new', resolveDeadline: null }, now)).toBe(false);
    expect(isTicketOverdue({ status: 'new', resolveDeadline: new Date('2026-11-17T00:00:00Z') }, now)).toBe(false);
  });
});

describe('callWhen (IST days)', () => {
  // 2026-11-16 10:00 UTC = 15:30 IST
  const now = new Date('2026-11-16T10:00:00Z');
  const call = (startsAt: string, status = 'scheduled', durationMinutes = 45) => ({ startsAt: new Date(startsAt), durationMinutes, status });

  it('later today in IST is today', () => {
    expect(callWhen(call('2026-11-16T13:00:00Z'), now)).toBe('today'); // 18:30 IST
  });

  it('a UTC date of today that is tomorrow in IST is upcoming', () => {
    expect(callWhen(call('2026-11-16T19:00:00Z'), now)).toBe('upcoming'); // 00:30 IST on the 17th
  });

  it('a call in progress is today; a finished one is past', () => {
    expect(callWhen(call('2026-11-16T09:30:00Z'), now)).toBe('today');
    expect(callWhen(call('2026-11-16T08:00:00Z'), now)).toBe('past');
  });

  it('a live call stays today past its scheduled end', () => {
    expect(callWhen(call('2026-11-16T08:00:00Z', 'live'), now)).toBe('today');
  });

  it('cancelled or ended calls are past even if in the future', () => {
    expect(callWhen(call('2026-11-20T08:00:00Z', 'cancelled'), now)).toBe('past');
    expect(callWhen(call('2026-11-20T08:00:00Z', 'ended'), now)).toBe('past');
  });

  it('istDate shifts by +05:30', () => {
    expect(istDate(new Date('2026-11-16T18:29:00Z'))).toBe('2026-11-16');
    expect(istDate(new Date('2026-11-16T18:30:00Z'))).toBe('2026-11-17');
  });
});

describe('buildPendingWork', () => {
  it('nothing to do → empty list', () => {
    expect(buildPendingWork(zero)).toEqual([]);
  });

  it('urgent first, then high, then normal; zero counts dropped', () => {
    const r = buildPendingWork({ ...zero, membersInactive: 4, ticketsNew: 1, callsToday: 2 });
    expect(r.map((i) => i.key)).toEqual(['tickets_new', 'calls_today', 'members_inactive']);
  });

  it('open tickets line excludes the new and overdue ones', () => {
    const r = buildPendingWork({ ...zero, ticketsOpen: 5, ticketsNew: 2, ticketsOverdue: 1 });
    expect(r.find((i) => i.key === 'tickets_open')?.count).toBe(2);
    expect(buildPendingWork({ ...zero, ticketsOpen: 2, ticketsNew: 2 }).some((i) => i.key === 'tickets_open')).toBe(false);
  });

  it('every item links into My Workspace', () => {
    const all = buildPendingWork({
      ticketsNew: 1, ticketsOverdue: 1, ticketsOpen: 9, memberTicketsUnassigned: 1,
      membersUnderReview: 1, membersInactive: 1, callsToday: 1,
    });
    expect(all).toHaveLength(7);
    for (const i of all) expect(i.href.startsWith('/my-workspace/')).toBe(true);
  });
});

describe('parsePaging', () => {
  it('defaults and clamps', () => {
    expect(parsePaging({})).toEqual({ page: 1, limit: 25, skip: 0 });
    expect(parsePaging({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(parsePaging({ page: '-2', limit: '999' })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePaging({ page: 'x', limit: '0' })).toEqual({ page: 1, limit: 25, skip: 0 });
  });
});
