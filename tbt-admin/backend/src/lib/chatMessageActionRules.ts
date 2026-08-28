// Pure authorization rules for the group-chat "Edit" and "Raise Ticket"
// message actions. Deliberately zero imports of Prisma/config so these can
// be unit-tested with no .env / database present — see
// chatMessageActionRules.test.ts. DB orchestration lives in
// modules/chat-groups/controller.ts.
//
// Both rules exist because the frontend menu can be bypassed by a direct
// API call — the backend is the real gate, never the UI.

export const EDIT_WINDOW_MS = 5 * 60 * 1000;

export interface EditCheckParams {
  /** `sender_member_id` on the message row, or null for admin-sent messages. */
  senderMemberId: string | null;
  /** The authenticated caller's member id (never trust a client-supplied id). */
  requesterMemberId: string;
  /** `created_at` on the message row — the source of truth for the 5-minute window. */
  createdAt: Date;
  /** `deleted_at` on the message row. */
  deletedAt: Date | null;
  /** Server "now" — pass explicitly so tests don't depend on wall-clock time. */
  now: Date;
}

export interface RuleResult {
  allowed: boolean;
  code?: 'FORBIDDEN' | 'DELETED' | 'TOO_LATE' | 'NOT_OWN_MESSAGE' | 'SYSTEM_MESSAGE';
  message?: string;
}

/** Only the original sender may edit their own message, only within
 * EDIT_WINDOW_MS of the server-recorded createdAt — never the client clock. */
export function canEditMessage(params: EditCheckParams): RuleResult {
  const { senderMemberId, requesterMemberId, createdAt, deletedAt, now } = params;
  if (senderMemberId !== requesterMemberId) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only the sender can edit.' };
  }
  if (deletedAt) {
    return { allowed: false, code: 'DELETED', message: 'Cannot edit a deleted message.' };
  }
  const ageMs = now.getTime() - createdAt.getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    return { allowed: false, code: 'TOO_LATE', message: 'Messages can only be edited within 5 minutes.' };
  }
  return { allowed: true };
}

export interface RaiseTicketCheckParams {
  senderMemberId: string | null;
  senderAdminId: string | null;
  requesterMemberId: string;
  isSystem: boolean;
  deletedAt: Date | null;
  /** true when the caller is an admin (Clerk-authed) rather than a member. */
  isAdminCaller: boolean;
}

/**
 * A member may raise a ticket only against their own message. An admin may
 * raise a ticket against any accessible (non-system, non-deleted) message —
 * admin access is already gate-kept by Clerk auth at the route level, so no
 * per-message ownership check applies to the admin path.
 */
export function canRaiseTicketForMessage(params: RaiseTicketCheckParams): RuleResult {
  const { senderMemberId, senderAdminId, requesterMemberId, isSystem, deletedAt, isAdminCaller } = params;
  if (isSystem) {
    return { allowed: false, code: 'SYSTEM_MESSAGE', message: 'Cannot raise a ticket for a system message.' };
  }
  if (deletedAt) {
    return { allowed: false, code: 'DELETED', message: 'Cannot raise a ticket for a deleted message.' };
  }
  if (!isAdminCaller && senderMemberId !== requesterMemberId) {
    return {
      allowed: false,
      code: 'NOT_OWN_MESSAGE',
      message: 'You can only raise a ticket for your own message.',
    };
  }
  if (!senderMemberId && !senderAdminId) {
    return { allowed: false, code: 'SYSTEM_MESSAGE', message: 'This message has no identifiable sender.' };
  }
  return { allowed: true };
}

/** A message already has an "active" ticket if one exists with a status
 * that hasn't been resolved/closed yet — raising a second one is a no-op
 * from the member's perspective (they should follow up on the existing one). */
export function isBlockingDuplicateStatus(status: string): boolean {
  return status === 'new' || status === 'in_progress';
}
