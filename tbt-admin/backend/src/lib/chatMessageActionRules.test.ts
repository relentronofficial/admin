import { describe, expect, it } from 'vitest';

import {
  EDIT_WINDOW_MS,
  canEditMessage,
  canRaiseTicketForMessage,
  isBlockingDuplicateStatus,
} from './chatMessageActionRules.js';

const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';
const ADMIN_1 = '33333333-3333-3333-3333-333333333333';

describe('canEditMessage', () => {
  const now = new Date('2026-08-28T12:00:00.000Z');

  it('allows the sender to edit within the 5-minute window (test case E)', () => {
    const createdAt = new Date(now.getTime() - EDIT_WINDOW_MS + 1000);
    const result = canEditMessage({ senderMemberId: MEMBER_A, requesterMemberId: MEMBER_A, createdAt, deletedAt: null, now });
    expect(result.allowed).toBe(true);
  });

  it('blocks editing at exactly the 5-minute boundary and beyond (test case F/G)', () => {
    const createdAt = new Date(now.getTime() - EDIT_WINDOW_MS - 1);
    const result = canEditMessage({ senderMemberId: MEMBER_A, requesterMemberId: MEMBER_A, createdAt, deletedAt: null, now });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOO_LATE');
    expect(result.message).toBe('Messages can only be edited within 5 minutes.');
  });

  it('has no client-clock escape hatch — only createdAt/now (both server-sourced by the caller) affect the result (test case Q)', () => {
    // A "manipulated device clock" has no representation in this function's
    // inputs at all — it only ever sees the DB createdAt and the server's
    // own `now`, both supplied by the controller, never the client.
    const createdAt = new Date(now.getTime() - EDIT_WINDOW_MS - 60_000);
    const result = canEditMessage({ senderMemberId: MEMBER_A, requesterMemberId: MEMBER_A, createdAt, deletedAt: null, now });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOO_LATE');
  });

  it('blocks a different member from editing (test case C/H)', () => {
    const createdAt = new Date(now.getTime() - 1000);
    const result = canEditMessage({ senderMemberId: MEMBER_A, requesterMemberId: MEMBER_B, createdAt, deletedAt: null, now });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('blocks editing a deleted message', () => {
    const createdAt = new Date(now.getTime() - 1000);
    const result = canEditMessage({ senderMemberId: MEMBER_A, requesterMemberId: MEMBER_A, createdAt, deletedAt: now, now });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('DELETED');
  });

  it('blocks admin-sent messages from being edited by a member (senderMemberId is null)', () => {
    const createdAt = new Date(now.getTime() - 1000);
    const result = canEditMessage({ senderMemberId: null, requesterMemberId: MEMBER_A, createdAt, deletedAt: null, now });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
  });
});

describe('canRaiseTicketForMessage', () => {
  it('allows a member to raise a ticket for their own message (test case B/J)', () => {
    const result = canRaiseTicketForMessage({
      senderMemberId: MEMBER_A,
      senderAdminId: null,
      requesterMemberId: MEMBER_A,
      isSystem: false,
      deletedAt: null,
      isAdminCaller: false,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks a member from raising a ticket for another member's message (test case D/I)", () => {
    const result = canRaiseTicketForMessage({
      senderMemberId: MEMBER_A,
      senderAdminId: null,
      requesterMemberId: MEMBER_B,
      isSystem: false,
      deletedAt: null,
      isAdminCaller: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('NOT_OWN_MESSAGE');
  });

  it('allows an admin to raise a ticket for any accessible message (test case M)', () => {
    const result = canRaiseTicketForMessage({
      senderMemberId: MEMBER_A,
      senderAdminId: null,
      requesterMemberId: ADMIN_1,
      isSystem: false,
      deletedAt: null,
      isAdminCaller: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks raising a ticket for a deleted message', () => {
    const result = canRaiseTicketForMessage({
      senderMemberId: MEMBER_A,
      senderAdminId: null,
      requesterMemberId: MEMBER_A,
      isSystem: false,
      deletedAt: new Date(),
      isAdminCaller: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('DELETED');
  });

  it('blocks raising a ticket for a system message', () => {
    const result = canRaiseTicketForMessage({
      senderMemberId: null,
      senderAdminId: null,
      requesterMemberId: ADMIN_1,
      isSystem: true,
      deletedAt: null,
      isAdminCaller: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('SYSTEM_MESSAGE');
  });
});

describe('isBlockingDuplicateStatus', () => {
  it('treats new/in_progress as active (blocks a second ticket)', () => {
    expect(isBlockingDuplicateStatus('new')).toBe(true);
    expect(isBlockingDuplicateStatus('in_progress')).toBe(true);
  });

  it('treats resolved/closed as inactive (a new ticket may be raised)', () => {
    expect(isBlockingDuplicateStatus('resolved')).toBe(false);
    expect(isBlockingDuplicateStatus('closed')).toBe(false);
  });
});
