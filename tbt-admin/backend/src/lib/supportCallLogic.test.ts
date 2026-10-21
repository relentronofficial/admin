import { describe, it, expect } from 'vitest';
import {
  callCardAction,
  canBook,
  canBookWithCoins,
  canCancelBooking,
  coinRefundFor,
  canManageSupportSession,
  canMarkAttendance,
  categoryQuota,
  isOneToOneSession,
  isSupportCallCategory,
  joinState,
  quotaBucketFor,
  sessionEndsAt,
} from './supportCallLogic.js';
import { computeSupportQuota } from './supportQuota.js';

const NOW = new Date('2026-10-20T10:00:00Z');
const at = (min: number) => new Date(NOW.getTime() + min * 60_000);
const session = (over: Partial<{ status: string; startsAt: Date; durationMinutes: number; capacity: number; hostAdminId: string | null }> = {}) => ({
  status: 'scheduled', startsAt: at(24 * 60), durationMinutes: 45, capacity: 1, hostAdminId: 'mentor-1', ...over,
});
const quota = (allocated: number, used = 0, reserved = 0) => categoryQuota({ allocated, used, remaining: Math.max(0, allocated - used), unlocked: 0 }, reserved);

describe('categories', () => {
  it('accepts exactly the six support_usage types', () => {
    for (const c of ['sales_support', 'tech_support', 'content_support', 'ad_support', 'one_to_one', 'group_call']) {
      expect(isSupportCallCategory(c)).toBe(true);
    }
    expect(isSupportCallCategory('lifeline')).toBe(false);
    expect(isSupportCallCategory(undefined)).toBe(false);
  });

  it('maps each category to its existing quota bucket', () => {
    const q = computeSupportQuota('p', [{
      tech_support_days: 1, ad_support_days: 2, group_call_count: 3, call_credit_count: 4, one_to_one_enabled: true,
      sales_call_count: 5, content_call_count: 6,
    }], [], []);
    expect(quotaBucketFor(q, 'tech_support').allocated).toBe(1);
    expect(quotaBucketFor(q, 'ad_support').allocated).toBe(2);
    expect(quotaBucketFor(q, 'group_call').allocated).toBe(3);
    expect(quotaBucketFor(q, 'one_to_one').allocated).toBe(4);
    expect(quotaBucketFor(q, 'sales_support').allocated).toBe(5);
    expect(quotaBucketFor(q, 'content_support').allocated).toBe(6);
  });
});

describe('categoryQuota', () => {
  it('subtracts pending reservations from remaining', () => {
    expect(quota(5, 2, 1)).toEqual({ allocated: 5, used: 2, reserved: 1, remaining: 2, included: 5, unlocked: 0 });
  });
  it('never goes negative and handles a 0/0 category', () => {
    expect(quota(0)).toEqual({ allocated: 0, used: 0, reserved: 0, remaining: 0, included: 0, unlocked: 0 });
    expect(quota(1, 3, 2).remaining).toBe(0);
  });
});

describe('canBook', () => {
  const base = { session: session(), now: NOW, activeBookingCount: 0, alreadyBooked: false, memberStatus: 'active', quota: quota(3) };
  it('allows an eligible member', () => expect(canBook(base)).toEqual({ ok: true }));
  it('rejects a cancelled session', () => expect(canBook({ ...base, session: session({ status: 'cancelled' }) })).toMatchObject({ ok: false, code: 'session_unavailable' }));
  it('rejects a session that has started', () => expect(canBook({ ...base, session: session({ startsAt: NOW }) })).toMatchObject({ ok: false, code: 'session_started' }));
  it('rejects a duplicate booking', () => expect(canBook({ ...base, alreadyBooked: true })).toMatchObject({ ok: false, status: 409, code: 'already_booked' }));
  it('rejects inactive members', () => expect(canBook({ ...base, memberStatus: 'pending' })).toMatchObject({ ok: false, code: 'member_inactive' }));
  it('rejects a category not in the plan (0/0)', () => expect(canBook({ ...base, quota: quota(0) })).toMatchObject({ ok: false, code: 'not_included' }));
  it('treats a category with only coin-unlocked calls (plan no longer includes it) as not included', () => {
    const q = categoryQuota({ allocated: 1, used: 0, remaining: 1, unlocked: 1 }, 0);
    expect(canBook({ ...base, quota: q })).toMatchObject({ ok: false, code: 'not_included' });
  });
  it('rejects when quota is used up', () => expect(canBook({ ...base, quota: quota(2, 2) })).toMatchObject({ ok: false, code: 'quota_exhausted' }));
  it('counts reservations against quota', () => expect(canBook({ ...base, quota: quota(2, 1, 1) })).toMatchObject({ ok: false, code: 'quota_exhausted' }));
  it('rejects a full session', () => expect(canBook({ ...base, activeBookingCount: 1 })).toMatchObject({ ok: false, code: 'session_full' }));
  it('allows a group session with seats left', () => expect(canBook({ ...base, session: session({ capacity: 10 }), activeBookingCount: 9 })).toEqual({ ok: true }));
});

describe('canCancelBooking', () => {
  it('allows cancelling more than 2 hours before', () => {
    expect(canCancelBooking({ bookingStatus: 'booked', session: session({ startsAt: at(121) }), now: NOW })).toEqual({ ok: true });
    expect(canCancelBooking({ bookingStatus: 'booked', session: session({ startsAt: at(120) }), now: NOW })).toEqual({ ok: true });
  });
  it('blocks cancelling inside the 2 hour cutoff', () => {
    expect(canCancelBooking({ bookingStatus: 'booked', session: session({ startsAt: at(119) }), now: NOW })).toMatchObject({ ok: false, code: 'cancel_cutoff' });
  });
  it('blocks cancelling a booking that is not active', () => {
    for (const s of ['cancelled', 'attended', 'no_show']) {
      expect(canCancelBooking({ bookingStatus: s, session: session(), now: NOW })).toMatchObject({ ok: false, code: 'not_cancellable' });
    }
  });
});

describe('joinState', () => {
  const j = (over: Partial<Parameters<typeof joinState>[0]> = {}) =>
    joinState({ bookingStatus: 'booked', session: session({ startsAt: at(5) }), hasMeetingUrl: true, now: NOW, ...over });
  it('opens 10 minutes before start', () => {
    expect(j()).toEqual({ ok: true });
    expect(j({ session: session({ startsAt: at(10) }) })).toEqual({ ok: true });
    expect(j({ session: session({ startsAt: at(11) }) })).toMatchObject({ ok: false, reason: 'too_early' });
  });
  it('stays open until the session ends, then closes', () => {
    expect(j({ session: session({ startsAt: at(-45), durationMinutes: 45 }) })).toEqual({ ok: true });
    expect(j({ session: session({ startsAt: at(-46), durationMinutes: 45 }) })).toMatchObject({ ok: false, reason: 'ended' });
  });
  it('needs an active booking, a live session and a link', () => {
    expect(j({ bookingStatus: 'cancelled' })).toMatchObject({ ok: false, reason: 'not_booked' });
    expect(j({ bookingStatus: 'no_show' })).toMatchObject({ ok: false, reason: 'not_booked' });
    expect(j({ bookingStatus: 'attended' })).toEqual({ ok: true });
    expect(j({ session: session({ startsAt: at(5), status: 'cancelled' }) })).toMatchObject({ ok: false, reason: 'session_cancelled' });
    expect(j({ hasMeetingUrl: false })).toMatchObject({ ok: false, reason: 'no_link' });
  });
  it('computes the end time from duration', () => {
    expect(sessionEndsAt(session({ startsAt: NOW, durationMinutes: 30 })).toISOString()).toBe('2026-10-20T10:30:00.000Z');
  });
});

describe('canMarkAttendance', () => {
  it('only after start, only once', () => {
    expect(canMarkAttendance({ bookingStatus: 'booked', session: session({ startsAt: at(-1) }), now: NOW })).toEqual({ ok: true });
    expect(canMarkAttendance({ bookingStatus: 'booked', session: session({ startsAt: at(1) }), now: NOW })).toMatchObject({ ok: false, code: 'not_started' });
    expect(canMarkAttendance({ bookingStatus: 'attended', session: session({ startsAt: at(-1) }), now: NOW })).toMatchObject({ ok: false, code: 'already_marked' });
    expect(canMarkAttendance({ bookingStatus: 'booked', session: session({ startsAt: at(-1), status: 'cancelled' }), now: NOW })).toMatchObject({ ok: false, code: 'session_cancelled' });
  });
});

describe('canManageSupportSession', () => {
  it('lets admin/super_admin manage everything', () => {
    expect(canManageSupportSession('admin', 'a1', { hostAdminId: 'someone' })).toBe(true);
    expect(canManageSupportSession('super_admin', 'a1', { hostAdminId: null })).toBe(true);
  });
  it('limits mentors to their own sessions', () => {
    expect(canManageSupportSession('mentor', 'mentor-1', { hostAdminId: 'mentor-1' })).toBe(true);
    expect(canManageSupportSession('mentor', 'mentor-1', { hostAdminId: 'mentor-2' })).toBe(false);
    expect(canManageSupportSession('mentor', 'mentor-1', { hostAdminId: null })).toBe(false);
    expect(canManageSupportSession('mentor', 'mentor-1')).toBe(true); // may use the module at all
  });
  it('denies other roles and unknown admins', () => {
    for (const r of ['account_manager', 'moderator', '', null, undefined]) {
      expect(canManageSupportSession(r as any, 'x', { hostAdminId: 'x' })).toBe(false);
    }
  });
});

describe('one_to_one rules', () => {
  const base = { now: NOW, activeBookingCount: 0, alreadyBooked: false, memberStatus: 'active', quota: quota(3) };
  it('capacity=1 session is bookable when no one has booked yet', () => {
    // A 1:1 call is exclusive: first booker gets it.
    expect(canBook({ ...base, session: session({ capacity: 1 }), activeBookingCount: 0 })).toEqual({ ok: true });
  });
  it('capacity=1 session is full the moment one active booking exists', () => {
    // The second caller is rejected immediately — no partial seats for a 1:1 call.
    expect(canBook({ ...base, session: session({ capacity: 1 }), activeBookingCount: 1 })).toMatchObject({ ok: false, code: 'session_full' });
  });
  it('a call is 1:1 when its session has one seat, whatever the category', () => {
    // Same rule as the admin "1:1 only" filter and badge (capacity === 1).
    expect(isOneToOneSession({ capacity: 1 })).toBe(true);
    expect(isOneToOneSession({ capacity: 2 })).toBe(false);
    expect(isOneToOneSession({ capacity: 10 })).toBe(false);
  });
});

// A quota with `unlocked` coin calls on top of `included` plan calls.
const paidQuota = (included: number, used = 0, reserved = 0, unlocked = 0) =>
  categoryQuota({ allocated: included + unlocked, used, remaining: Math.max(0, included + unlocked - used), unlocked }, reserved);

describe('quota states (free calls)', () => {
  it('free quota remaining → Book Call', () => {
    expect(callCardAction({ quota: paidQuota(3, 1), coinCost: 100, balance: 0, coinPurchaseAvailable: true }))
      .toEqual({ action: 'book', lockedReason: null });
  });
  it('completed (used) and pending (booked) calls both use up quota; cancelled ones do not', () => {
    // 3 included: 1 attended/no-show (used) + 1 pending booking (reserved) → 1 left.
    expect(paidQuota(3, 1, 1).remaining).toBe(1);
    // A cancelled booking is neither used nor reserved, so it is simply absent.
    expect(paidQuota(3, 1, 0).remaining).toBe(2);
  });
  it('free quota exhausted by completed + pending calls → no free booking', () => {
    const q = paidQuota(2, 1, 1);
    expect(q.remaining).toBe(0);
    expect(canBook({ session: session(), now: NOW, activeBookingCount: 0, alreadyBooked: false, memberStatus: 'active', quota: q }))
      .toMatchObject({ ok: false, code: 'quota_exhausted' });
  });
  it('a coin-paid booking does not consume an included call', () => {
    // 2 included both used, 1 coin booking pending → still 0 free left, included unchanged.
    const q = paidQuota(2, 2, 1, 1);
    expect(q).toMatchObject({ included: 2, unlocked: 1, remaining: 0 });
  });
});

describe('callCardAction', () => {
  const exhausted = paidQuota(2, 2);
  it('locks a category the plan does not include, even with coins', () => {
    expect(callCardAction({ quota: paidQuota(0), coinCost: 50, balance: 999, coinPurchaseAvailable: true }))
      .toEqual({ action: 'locked', lockedReason: 'not_included' });
  });
  it('locks when quota is used and no coin price is set', () => {
    expect(callCardAction({ quota: exhausted, coinCost: null, balance: 999, coinPurchaseAvailable: true }))
      .toEqual({ action: 'locked', lockedReason: 'quota_exhausted' });
  });
  it('offers Unlock with TBT Coins when the balance covers the price', () => {
    expect(callCardAction({ quota: exhausted, coinCost: 100, balance: 100, coinPurchaseAvailable: true }).action).toBe('unlock_with_coins');
  });
  it('offers Purchase TBT Coins when the balance is short', () => {
    expect(callCardAction({ quota: exhausted, coinCost: 100, balance: 99, coinPurchaseAvailable: true }).action).toBe('purchase_coins');
  });
  it('stays locked when the balance is short and coins cannot be bought', () => {
    expect(callCardAction({ quota: exhausted, coinCost: 100, balance: 0, coinPurchaseAvailable: false }).action).toBe('locked');
  });
});

describe('canBookWithCoins', () => {
  const base = {
    session: session(), now: NOW, activeBookingCount: 0, alreadyBooked: false, memberStatus: 'active',
    quota: paidQuota(2, 2), coinCost: 100 as number | null, expectedCoinCost: 100 as unknown, balance: 150,
  };
  it('allows an exhausted member with enough coins at the confirmed price', () => expect(canBookWithCoins(base)).toEqual({ ok: true }));
  it('refuses to charge coins while free calls remain (attempting to exceed quota the free way is separate)', () =>
    expect(canBookWithCoins({ ...base, quota: paidQuota(3, 2) })).toMatchObject({ ok: false, code: 'free_quota_available' }));
  it('refuses a category not in the plan', () =>
    expect(canBookWithCoins({ ...base, quota: paidQuota(0) })).toMatchObject({ ok: false, code: 'not_included' }));
  it('refuses when the admin has not set a coin price', () =>
    expect(canBookWithCoins({ ...base, coinCost: null })).toMatchObject({ ok: false, code: 'coin_unlock_unavailable' }));
  it('refuses a price the member did not confirm', () => {
    expect(canBookWithCoins({ ...base, expectedCoinCost: 80 })).toMatchObject({ ok: false, status: 409, code: 'coin_price_changed' });
    expect(canBookWithCoins({ ...base, expectedCoinCost: undefined })).toMatchObject({ ok: false, code: 'coin_price_changed' });
    expect(canBookWithCoins({ ...base, expectedCoinCost: '100' })).toMatchObject({ ok: false, code: 'coin_price_changed' });
  });
  it('sufficient vs insufficient balance', () => {
    expect(canBookWithCoins({ ...base, balance: 100 })).toEqual({ ok: true });
    expect(canBookWithCoins({ ...base, balance: 99 })).toMatchObject({ ok: false, status: 402, code: 'insufficient_coins' });
    expect(canBookWithCoins({ ...base, balance: -20 })).toMatchObject({ ok: false, code: 'insufficient_coins' });
  });
  it('still enforces session, duplicate, membership and capacity rules', () => {
    expect(canBookWithCoins({ ...base, alreadyBooked: true })).toMatchObject({ ok: false, code: 'already_booked' });
    expect(canBookWithCoins({ ...base, memberStatus: 'paused' })).toMatchObject({ ok: false, code: 'member_inactive' });
    expect(canBookWithCoins({ ...base, activeBookingCount: 1 })).toMatchObject({ ok: false, code: 'session_full' });
    expect(canBookWithCoins({ ...base, session: session({ status: 'cancelled' }) })).toMatchObject({ ok: false, code: 'session_unavailable' });
    expect(canBookWithCoins({ ...base, session: session({ startsAt: NOW }) })).toMatchObject({ ok: false, code: 'session_started' });
  });
});

describe('coinRefundFor', () => {
  it('refunds exactly the coins paid, nothing for free bookings', () => {
    expect(coinRefundFor(120)).toBe(120);
    expect(coinRefundFor(null)).toBe(0);
    expect(coinRefundFor(undefined)).toBe(0);
    expect(coinRefundFor(0)).toBe(0);
  });
});

