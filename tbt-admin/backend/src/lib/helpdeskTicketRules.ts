// Pure rules for the helpdesk support-ticket alarm/lifecycle. Deliberately
// zero imports of Prisma/config so these can be unit-tested with no .env /
// database present — see helpdeskTicketRules.test.ts. DB orchestration lives
// in modules/helpdesk/controller.ts and jobs/helpdeskEscalation.ts.
//
// `status === 'new'` IS "alarm active, unacknowledged" — there is no
// separate boolean column. Only an explicit acknowledge (or an admin reply,
// which counts as engaging with the ticket) may leave the 'new' state; a
// ticket must never be silently moved out of 'new' by a passive view,
// refresh, or reconnect.

export type TicketStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'waiting_for_user'
  | 'resolved'
  | 'closed';

/** Alarm is active exactly while the ticket is unacknowledged. */
export function isAlarmActive(status: TicketStatus): boolean {
  return status === 'new';
}

/** Only a ticket still in 'new' can be acknowledged. */
export function canAcknowledge(status: TicketStatus): boolean {
  return status === 'new';
}

/** True once `escalationMinutes` have elapsed since creation with no ack. */
export function isEscalationDue(createdAt: Date, escalationMinutes: number, now: Date): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= escalationMinutes * 60 * 1000;
}

const FORWARD_ORDER: TicketStatus[] = [
  'new',
  'acknowledged',
  'in_progress',
  'waiting_for_user',
  'resolved',
  'closed',
];

/**
 * Permissive forward-movement validation: any move to a later stage in the
 * lifecycle is allowed (skipping stages is fine — e.g. new -> resolved for a
 * quick fix), plus reopening a resolved/closed ticket back to in_progress
 * (mirrors the existing member-reply reopen behavior in the controller).
 * Leaving 'new' is intentionally excluded here entirely — that transition
 * only happens via the dedicated acknowledge action or a reply's implicit-ack
 * side-effect, never via the generic status-update endpoint, so the alarm
 * can never be stopped by an accidental/generic status PATCH.
 */
export function isValidStatusTransition(current: TicketStatus, next: TicketStatus): boolean {
  if (current === next) return true;
  if (current === 'new') return false;
  if (next === 'new') return false;
  if (next === 'acknowledged') return false;
  const isReopen =
    (current === 'resolved' || current === 'closed') &&
    (next === 'in_progress' || next === 'waiting_for_user');
  if (isReopen) return true;
  const currentIdx = FORWARD_ORDER.indexOf(current);
  const nextIdx = FORWARD_ORDER.indexOf(next);
  return nextIdx > currentIdx;
}
