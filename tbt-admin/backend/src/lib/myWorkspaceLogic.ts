// Pure rules for the admin "My Workspace" sidebar section: what counts as an
// open/overdue ticket, which day bucket a call falls in, and the computed
// pending-work list. No Prisma/config imports so it is unit-testable without
// a database — see myWorkspaceLogic.test.ts. DB orchestration lives in
// modules/my-workspace/controller.ts.

/** Helpdesk statuses that still need work (helpdeskTicketRules.ts lifecycle). */
export const OPEN_TICKET_STATUSES = ['new', 'acknowledged', 'in_progress', 'waiting_for_user'] as const;
export const CLOSED_TICKET_STATUSES = ['resolved', 'closed'] as const;

/** A member with no activity for this many days is listed for follow-up. */
export const INACTIVE_FOLLOW_UP_DAYS = 14;

const IST_OFFSET_MS = 330 * 60 * 1000; // Asia/Kolkata, fixed +05:30 (no DST)

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isOpenTicketStatus(status: string): boolean {
  return (OPEN_TICKET_STATUSES as readonly string[]).includes(status);
}

/** Open and past its resolve deadline. A ticket with no deadline is never overdue. */
export function isTicketOverdue(t: { status: string; resolveDeadline: Date | null }, now: Date): boolean {
  return isOpenTicketStatus(t.status) && !!t.resolveDeadline && t.resolveDeadline.getTime() < now.getTime();
}

export type CallWhen = 'today' | 'upcoming' | 'past';

/**
 * Bucket for a hosted call. A cancelled or finished call is 'past'. Otherwise
 * a call is 'today' on its IST start date (until it ends), 'upcoming' on a
 * later date, and 'past' once its scheduled end has gone by.
 */
export function callWhen(
  c: { startsAt: Date; durationMinutes: number; status: string },
  now: Date,
): CallWhen {
  if (c.status === 'cancelled' || c.status === 'ended' || c.status === 'completed') return 'past';
  const end = c.startsAt.getTime() + Math.max(0, c.durationMinutes) * 60_000;
  if (c.status !== 'live' && end < now.getTime()) return 'past';
  return istDate(c.startsAt) <= istDate(now) ? 'today' : 'upcoming';
}

export interface WorkspaceCounts {
  ticketsNew: number;          // assigned to me, not acknowledged yet
  ticketsOverdue: number;      // assigned to me, past resolve deadline
  ticketsOpen: number;         // assigned to me, still open
  memberTicketsUnassigned: number; // raised by my members, open, nobody assigned
  membersUnderReview: number;  // my members waiting for KYC review
  membersInactive: number;     // my active members idle ≥ INACTIVE_FOLLOW_UP_DAYS
  callsToday: number;          // calls I host today (IST)
}

export type PendingSeverity = 'urgent' | 'high' | 'normal';

export interface PendingItem {
  key: string;
  count: number;
  severity: PendingSeverity;
  /** Admin-panel route that lists exactly these items. */
  href: string;
}

/**
 * The computed "my responsibilities" list: one line per kind of pending work,
 * most urgent first, only kinds with something to do. Labels are left to the
 * UI so wording can change without touching the rules.
 */
export function buildPendingWork(c: WorkspaceCounts): PendingItem[] {
  const items: PendingItem[] = [
    { key: 'tickets_new', count: c.ticketsNew, severity: 'urgent', href: '/my-workspace/tickets?status=new' },
    { key: 'tickets_overdue', count: c.ticketsOverdue, severity: 'urgent', href: '/my-workspace/tickets?status=overdue' },
    { key: 'calls_today', count: c.callsToday, severity: 'high', href: '/my-workspace/calls?when=today' },
    { key: 'members_under_review', count: c.membersUnderReview, severity: 'high', href: '/my-workspace/members?filter=under_review' },
    { key: 'member_tickets_unassigned', count: c.memberTicketsUnassigned, severity: 'high', href: '/my-workspace/tickets?scope=my_members&status=unassigned' },
    {
      key: 'tickets_open',
      // New and overdue tickets already have their own lines.
      count: Math.max(0, c.ticketsOpen - c.ticketsNew - c.ticketsOverdue),
      severity: 'normal',
      href: '/my-workspace/tickets?status=open',
    },
    { key: 'members_inactive', count: c.membersInactive, severity: 'normal', href: '/my-workspace/members?filter=inactive' },
  ];
  const rank: Record<PendingSeverity, number> = { urgent: 0, high: 1, normal: 2 };
  return items.filter((i) => i.count > 0).sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Clamp list paging params from a query string. */
export function parsePaging(q: { page?: unknown; limit?: unknown }, maxLimit = 100): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(q.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}
