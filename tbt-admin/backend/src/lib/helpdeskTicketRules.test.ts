import { describe, expect, it } from 'vitest';
import {
  canAcknowledge,
  isAlarmActive,
  isEscalationDue,
  isValidStatusTransition,
} from './helpdeskTicketRules.js';

describe('isAlarmActive', () => {
  it('is active only while status is new', () => {
    expect(isAlarmActive('new')).toBe(true);
    expect(isAlarmActive('acknowledged')).toBe(false);
    expect(isAlarmActive('in_progress')).toBe(false);
    expect(isAlarmActive('waiting_for_user')).toBe(false);
    expect(isAlarmActive('resolved')).toBe(false);
    expect(isAlarmActive('closed')).toBe(false);
  });
});

describe('canAcknowledge', () => {
  it('only allows acknowledging a new ticket', () => {
    expect(canAcknowledge('new')).toBe(true);
    expect(canAcknowledge('acknowledged')).toBe(false);
    expect(canAcknowledge('resolved')).toBe(false);
  });
});

describe('isEscalationDue', () => {
  const createdAt = new Date('2026-01-01T00:00:00Z');

  it('is not due before the threshold elapses', () => {
    const now = new Date('2026-01-01T00:09:59Z');
    expect(isEscalationDue(createdAt, 10, now)).toBe(false);
  });

  it('is due once the threshold elapses', () => {
    const now = new Date('2026-01-01T00:10:00Z');
    expect(isEscalationDue(createdAt, 10, now)).toBe(true);
  });

  it('is due well past the threshold', () => {
    const now = new Date('2026-01-01T01:00:00Z');
    expect(isEscalationDue(createdAt, 10, now)).toBe(true);
  });
});

describe('isValidStatusTransition', () => {
  it('never allows leaving new via the generic transition (only ack/reply may)', () => {
    expect(isValidStatusTransition('new', 'acknowledged')).toBe(false);
    expect(isValidStatusTransition('new', 'in_progress')).toBe(false);
    expect(isValidStatusTransition('new', 'resolved')).toBe(false);
    expect(isValidStatusTransition('new', 'closed')).toBe(false);
  });

  it('allows staying in the same status (no-op)', () => {
    expect(isValidStatusTransition('new', 'new')).toBe(true);
    expect(isValidStatusTransition('in_progress', 'in_progress')).toBe(true);
  });

  it('allows forward movement, including skipping stages', () => {
    expect(isValidStatusTransition('acknowledged', 'in_progress')).toBe(true);
    expect(isValidStatusTransition('acknowledged', 'waiting_for_user')).toBe(true);
    expect(isValidStatusTransition('acknowledged', 'resolved')).toBe(true);
    expect(isValidStatusTransition('in_progress', 'waiting_for_user')).toBe(true);
    expect(isValidStatusTransition('waiting_for_user', 'resolved')).toBe(true);
    expect(isValidStatusTransition('resolved', 'closed')).toBe(true);
  });

  it('rejects backward movement other than the reopen exception', () => {
    expect(isValidStatusTransition('in_progress', 'acknowledged')).toBe(false);
    expect(isValidStatusTransition('closed', 'resolved')).toBe(false);
  });

  it('allows reopening a resolved/closed ticket back to in_progress or waiting_for_user', () => {
    expect(isValidStatusTransition('resolved', 'in_progress')).toBe(true);
    expect(isValidStatusTransition('resolved', 'waiting_for_user')).toBe(true);
    expect(isValidStatusTransition('closed', 'in_progress')).toBe(true);
    expect(isValidStatusTransition('closed', 'waiting_for_user')).toBe(true);
  });

  it('rejects reopening straight back to new or acknowledged', () => {
    expect(isValidStatusTransition('closed', 'new')).toBe(false);
    expect(isValidStatusTransition('closed', 'acknowledged')).toBe(false);
    expect(isValidStatusTransition('resolved', 'acknowledged')).toBe(false);
  });
});
