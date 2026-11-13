// Pure rules for member actions on direct (member ↔ TBT team) conversation
// messages: edit, delete, react, forward. No I/O — unit-tested in
// dmMessageActionRules.test.ts. DB orchestration lives in
// modules/user/conversationMessageActions.ts. Editing reuses the group-chat
// rule (canEditMessage) so both chats follow the same edit policy.

export type DmSenderType = 'member' | 'admin';

export interface RuleResult {
  allowed: boolean;
  code?: 'FORBIDDEN' | 'DELETED';
  message?: string;
}

/** The member who sent it, or null for a TBT team (admin) message. */
export function dmSenderMemberId(m: { senderType: DmSenderType | string; senderId: string }): string | null {
  return m.senderType === 'member' ? m.senderId : null;
}

/**
 * "Delete for me" hides any message in the member's own conversation from
 * the member. "Delete for everyone" is only for the member's own messages.
 */
export function canDeleteDm(p: {
  senderType: DmSenderType | string;
  senderId: string;
  requesterMemberId: string;
  forEveryone: boolean;
  deletedForEveryone: boolean;
}): RuleResult {
  if (p.deletedForEveryone) return { allowed: false, code: 'DELETED', message: 'This message was already deleted.' };
  if (p.forEveryone && dmSenderMemberId(p) !== p.requesterMemberId) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only the sender can delete for everyone.' };
  }
  return { allowed: true };
}

/** Deleted "for me" (by the member) — hidden from the member, still visible to the TBT team. */
export function isHiddenForMember(m: { deletedAt: Date | string | null; deletedForEveryone: boolean }): boolean {
  return !!m.deletedAt && !m.deletedForEveryone;
}

export const DM_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export function isValidDmReaction(emoji: unknown): emoji is string {
  return typeof emoji === 'string' && (DM_REACTIONS as readonly string[]).includes(emoji);
}

/**
 * One reaction per member per message: picking the reaction you already
 * have removes it; picking another one replaces it.
 */
export function nextDmReaction(current: string | null, requested: string): string | null {
  return current === requested ? null : requested;
}

export interface DmReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/** Group reaction rows per message: [{ emoji, count, reactedByMe }], in first-reacted order. */
export function summarizeDmReactions(
  rows: Array<{ message_id: string; sender_type: string; sender_id: string; emoji: string }>,
  memberId: string,
): Map<string, DmReactionSummary[]> {
  const out = new Map<string, DmReactionSummary[]>();
  for (const r of rows) {
    const list = out.get(r.message_id) ?? [];
    let entry = list.find((e) => e.emoji === r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, reactedByMe: false };
      list.push(entry);
    }
    entry.count += 1;
    if (r.sender_type === 'member' && r.sender_id === memberId) entry.reactedByMe = true;
    out.set(r.message_id, list);
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DM_FORWARD_MAX_TARGETS = 10;

/** Target conversation ids for a forward: 1–10 distinct UUIDs. */
export function validateForwardTargets(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Choose a conversation to forward to.' };
  const ids = [...new Set(raw)];
  if (!ids.every((v) => typeof v === 'string' && UUID.test(v))) return { ok: false, error: 'Invalid conversation.' };
  if (ids.length > DM_FORWARD_MAX_TARGETS) return { ok: false, error: `Forward to at most ${DM_FORWARD_MAX_TARGETS} conversations at once.` };
  return { ok: true, value: ids as string[] };
}

export const DM_BODY_MAX = 5000;

/**
 * Forward targets: the member's other direct conversations and/or their chat
 * groups. Each list holds up to DM_FORWARD_MAX_TARGETS distinct ids; at least one target overall.
 */
export function validateForwardRequest(body: { toConversationIds?: unknown; toGroupIds?: unknown }):
  { ok: true; value: { conversationIds: string[]; groupIds: string[] } } | { ok: false; error: string } {
  const lists: string[][] = [];
  for (const raw of [body.toConversationIds, body.toGroupIds]) {
    if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
      lists.push([]);
      continue;
    }
    const v = validateForwardTargets(raw);
    if (!v.ok) return v;
    lists.push(v.value);
  }
  if (lists[0].length + lists[1].length === 0) return { ok: false, error: 'Choose a conversation to forward to.' };
  return { ok: true, value: { conversationIds: lists[0], groupIds: lists[1] } };
}
