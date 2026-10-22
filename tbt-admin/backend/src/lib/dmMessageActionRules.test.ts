import { describe, expect, it } from 'vitest';
import {
  canDeleteDm,
  dmSenderMemberId,
  isHiddenForMember,
  isValidDmReaction,
  nextDmReaction,
  summarizeDmReactions,
  validateForwardTargets,
} from './dmMessageActionRules.js';

const ME = '50000000-0000-4000-8000-0000000000a1';
const ADMIN = '60000000-0000-4000-8000-0000000000b1';

describe('dmSenderMemberId', () => {
  it('is the member id for member messages and null for TBT team messages', () => {
    expect(dmSenderMemberId({ senderType: 'member', senderId: ME })).toBe(ME);
    expect(dmSenderMemberId({ senderType: 'admin', senderId: ADMIN })).toBeNull();
  });
});

describe('canDeleteDm', () => {
  const base = { senderType: 'member', senderId: ME, requesterMemberId: ME, deletedForEveryone: false };
  it('lets the member delete any message for themselves', () => {
    expect(canDeleteDm({ ...base, forEveryone: false }).allowed).toBe(true);
    expect(canDeleteDm({ ...base, senderType: 'admin', senderId: ADMIN, forEveryone: false }).allowed).toBe(true);
  });
  it('only the sender can delete for everyone', () => {
    expect(canDeleteDm({ ...base, forEveryone: true }).allowed).toBe(true);
    expect(canDeleteDm({ ...base, senderType: 'admin', senderId: ADMIN, forEveryone: true })).toMatchObject({ allowed: false, code: 'FORBIDDEN' });
  });
  it('a message already deleted for everyone cannot be deleted again', () => {
    expect(canDeleteDm({ ...base, deletedForEveryone: true, forEveryone: false })).toMatchObject({ allowed: false, code: 'DELETED' });
  });
});

describe('isHiddenForMember', () => {
  it('hides only messages deleted "for me"', () => {
    expect(isHiddenForMember({ deletedAt: new Date(), deletedForEveryone: false })).toBe(true);
    expect(isHiddenForMember({ deletedAt: new Date(), deletedForEveryone: true })).toBe(false);
    expect(isHiddenForMember({ deletedAt: null, deletedForEveryone: false })).toBe(false);
  });
});

describe('reactions', () => {
  it('accepts only the offered reactions', () => {
    expect(isValidDmReaction('👍')).toBe(true);
    for (const bad of ['', 'x', '🔥', null, 5, '👍👍']) expect(isValidDmReaction(bad)).toBe(false);
  });
  it('picking a reaction sets it, picking another changes it, picking the same removes it', () => {
    expect(nextDmReaction(null, '👍')).toBe('👍');
    expect(nextDmReaction('👍', '❤️')).toBe('❤️');
    expect(nextDmReaction('❤️', '❤️')).toBeNull();
  });
  it('summarises per message with counts and the member\'s own reaction', () => {
    const map = summarizeDmReactions([
      { message_id: 'm1', sender_type: 'admin', sender_id: ADMIN, emoji: '👍' },
      { message_id: 'm1', sender_type: 'member', sender_id: ME, emoji: '👍' },
      { message_id: 'm1', sender_type: 'admin', sender_id: 'other', emoji: '❤️' },
      { message_id: 'm2', sender_type: 'admin', sender_id: ADMIN, emoji: '😂' },
    ], ME);
    expect(map.get('m1')).toEqual([{ emoji: '👍', count: 2, reactedByMe: true }, { emoji: '❤️', count: 1, reactedByMe: false }]);
    expect(map.get('m2')).toEqual([{ emoji: '😂', count: 1, reactedByMe: false }]);
    expect(map.get('m3')).toBeUndefined();
  });
});

describe('validateForwardTargets', () => {
  const C1 = '70000000-0000-4000-8000-000000000001';
  const C2 = '70000000-0000-4000-8000-000000000002';
  it('needs 1–10 distinct conversation ids', () => {
    expect(validateForwardTargets([C1, C2, C1])).toEqual({ ok: true, value: [C1, C2] });
    expect(validateForwardTargets([]).ok).toBe(false);
    expect(validateForwardTargets(undefined).ok).toBe(false);
    expect(validateForwardTargets(['nope']).ok).toBe(false);
    const many = Array.from({ length: 11 }, (_, i) => `70000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`);
    expect(validateForwardTargets(many).ok).toBe(false);
  });
});
