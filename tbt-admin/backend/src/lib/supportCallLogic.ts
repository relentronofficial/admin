// Pure rules for Expert Support Call booking (SUPPORT_CALLS_SPECKIT.md) —
// no I/O and no `new Date()`: callers pass `now`, so every rule is unit-tested.
import type { SupportQuota, SupportQuotaBucket } from './supportQuota.js';

/** The six categories, keyed by the existing support_usage.type values. */
export const SUPPORT_CALL_CATEGORIES = [
  'sales_support',
  'tech_support',
  'content_support',
  'ad_support',
  'one_to_one',
  'group_call',
] as const;
export type SupportCallCategory = (typeof SUPPORT_CALL_CATEGORIES)[number];

export function isSupportCallCategory(v: unknown): v is SupportCallCategory {
  return typeof v === 'string' && (SUPPORT_CALL_CATEGORIES as readonly string[]).includes(v);
}

const CATEGORY_TO_QUOTA_KEY: Record<SupportCallCategory, keyof SupportQuota> = {
  sales_support: 'salesSupport',
  tech_support: 'techSupport',
  content_support: 'contentSupport',
  ad_support: 'adSupport',
  one_to_one: 'callCredits',
  group_call: 'groupCall',
};

export function quotaBucketFor(quota: SupportQuota, category: SupportCallCategory): SupportQuotaBucket {
  return quota[CATEGORY_TO_QUOTA_KEY[category]] as SupportQuotaBucket;
}

export const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;   // members cancel until 2h before start
export const JOIN_OPENS_BEFORE_MS = 10 * 60 * 1000;   // join link available 10 min before start

export type SessionStatus = 'scheduled' | 'cancelled';
export type BookingStatus = 'booked' | 'cancelled' | 'attended' | 'no_show';

export interface SessionLike {
  status: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  hostAdminId?: string | null;
}

export interface CategoryQuota {
  allocated: number;
  used: number;
  reserved: number;
  remaining: number;
  /** Calls the plan (plus approved credit purchases) includes — excludes coin unlocks. */
  included: number;
  /** Calls unlocked with TBT coins that are still live (booked/attended/no-show). */
  unlocked: number;
}

/** Bookings that are still pending attendance hold a slot of the member's quota. */
export function categoryQuota(bucket: SupportQuotaBucket, reserved: number): CategoryQuota {
  const r = Math.max(0, reserved);
  const unlocked = Math.max(0, bucket.unlocked ?? 0);
  return {
    allocated: bucket.allocated,
    used: bucket.used,
    reserved: r,
    remaining: Math.max(0, bucket.allocated - bucket.used - r),
    included: Math.max(0, bucket.allocated - unlocked),
    unlocked,
  };
}

export function sessionEndsAt(s: SessionLike): Date {
  return new Date(s.startsAt.getTime() + s.durationMinutes * 60_000);
}

export type RuleResult = { ok: true } | { ok: false; status: number; code: string; message: string };
const deny = (status: number, code: string, message: string): RuleResult => ({ ok: false, status, code, message });

export function canBook(input: {
  session: SessionLike;
  now: Date;
  activeBookingCount: number;
  alreadyBooked: boolean;
  memberStatus: string | null | undefined;
  quota: CategoryQuota;
}): RuleResult {
  const { session, now, activeBookingCount, alreadyBooked, memberStatus, quota } = input;
  if (session.status !== 'scheduled') return deny(409, 'session_unavailable', 'This session is no longer available.');
  if (session.startsAt.getTime() <= now.getTime()) return deny(409, 'session_started', 'This session has already started.');
  if (alreadyBooked) return deny(409, 'already_booked', 'You have already booked this session.');
  if (memberStatus !== 'active') return deny(403, 'member_inactive', 'Your membership must be active to book calls.');
  // `included`, not `allocated`: coin-unlocked calls never make a category part of the plan.
  if (quota.included <= 0) return deny(403, 'not_included', 'This call type is not included in your plan.');
  if (quota.remaining <= 0) return deny(403, 'quota_exhausted', 'You have no calls left in this category.');
  if (activeBookingCount >= session.capacity) return deny(409, 'session_full', 'This session is full.');
  return { ok: true };
}

/**
 * Booking an extra call paid with TBT coins. Only offered once the included
 * calls are all used or booked (never instead of a free call), only in a
 * category the plan includes, only when an admin has set a coin price, and
 * only at the price the member confirmed — a changed price is refused rather
 * than charged.
 */
export function canBookWithCoins(input: {
  session: SessionLike;
  now: Date;
  activeBookingCount: number;
  alreadyBooked: boolean;
  memberStatus: string | null | undefined;
  quota: CategoryQuota;
  coinCost: number | null;
  expectedCoinCost: unknown;
  balance: number;
}): RuleResult {
  const { session, now, activeBookingCount, alreadyBooked, memberStatus, quota, coinCost, expectedCoinCost, balance } = input;
  if (session.status !== 'scheduled') return deny(409, 'session_unavailable', 'This session is no longer available.');
  if (session.startsAt.getTime() <= now.getTime()) return deny(409, 'session_started', 'This session has already started.');
  if (alreadyBooked) return deny(409, 'already_booked', 'You have already booked this session.');
  if (memberStatus !== 'active') return deny(403, 'member_inactive', 'Your membership must be active to book calls.');
  if (quota.included <= 0) return deny(403, 'not_included', 'This call type is not included in your plan.');
  if (quota.remaining > 0) return deny(409, 'free_quota_available', 'You still have free calls in this category — book with your quota instead.');
  if (!isValidCoinCost(coinCost)) return deny(403, 'coin_unlock_unavailable', 'Extra calls in this category cannot be unlocked with TBT coins.');
  if (activeBookingCount >= session.capacity) return deny(409, 'session_full', 'This session is full.');
  if (expectedCoinCost !== coinCost) {
    return deny(409, 'coin_price_changed', `The price for an extra call is now ${coinCost} TBT coins. Please review and confirm again.`);
  }
  if (balance < coinCost) {
    return deny(402, 'insufficient_coins', `You need ${coinCost} TBT coins but have ${Math.max(0, balance)}.`);
  }
  return { ok: true };
}

export function isValidCoinCost(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export type CallCardAction = 'book' | 'unlock_with_coins' | 'purchase_coins' | 'locked';
export type CallLockedReason = 'not_included' | 'quota_exhausted' | null;

/**
 * The one next step a call card offers, from server state only:
 * free calls left → Book Call; all used and a coin price set → Unlock with
 * TBT Coins (enough coins) or Purchase TBT Coins (not enough); otherwise locked.
 */
export function callCardAction(input: {
  quota: CategoryQuota;
  coinCost: number | null;
  balance: number;
  coinPurchaseAvailable: boolean;
}): { action: CallCardAction; lockedReason: CallLockedReason } {
  const { quota, coinCost, balance, coinPurchaseAvailable } = input;
  if (quota.included <= 0) return { action: 'locked', lockedReason: 'not_included' };
  if (quota.remaining > 0) return { action: 'book', lockedReason: null };
  if (!isValidCoinCost(coinCost)) return { action: 'locked', lockedReason: 'quota_exhausted' };
  if (balance >= coinCost) return { action: 'unlock_with_coins', lockedReason: null };
  if (coinPurchaseAvailable) return { action: 'purchase_coins', lockedReason: null };
  return { action: 'locked', lockedReason: 'quota_exhausted' };
}

/** Coins returned when a booking is cancelled (by the member or with its session). */
export function coinRefundFor(coinCost: number | null | undefined): number {
  return isValidCoinCost(coinCost) ? coinCost : 0;
}

export function canCancelBooking(input: { bookingStatus: string; session: SessionLike; now: Date }): RuleResult {
  const { bookingStatus, session, now } = input;
  if (bookingStatus !== 'booked') return deny(409, 'not_cancellable', 'Only upcoming bookings can be cancelled.');
  if (session.startsAt.getTime() - now.getTime() < CANCEL_CUTOFF_MS) {
    return deny(403, 'cancel_cutoff', 'Bookings can only be cancelled up to 2 hours before the call.');
  }
  return { ok: true };
}

export type JoinState =
  | { ok: true }
  | { ok: false; reason: 'not_booked' | 'session_cancelled' | 'no_link' | 'too_early' | 'ended'; message: string; opensAt?: Date };

export function joinState(input: { bookingStatus: string; session: SessionLike; hasMeetingUrl: boolean; now: Date }): JoinState {
  const { bookingStatus, session, hasMeetingUrl, now } = input;
  if (bookingStatus !== 'booked' && bookingStatus !== 'attended') {
    return { ok: false, reason: 'not_booked', message: 'You do not have an active booking for this session.' };
  }
  if (session.status !== 'scheduled') return { ok: false, reason: 'session_cancelled', message: 'This session was cancelled.' };
  const opensAt = new Date(session.startsAt.getTime() - JOIN_OPENS_BEFORE_MS);
  if (now.getTime() > sessionEndsAt(session).getTime()) return { ok: false, reason: 'ended', message: 'This session has ended.' };
  if (now.getTime() < opensAt.getTime()) {
    return { ok: false, reason: 'too_early', message: 'The join link opens 10 minutes before the call.', opensAt };
  }
  if (!hasMeetingUrl) return { ok: false, reason: 'no_link', message: 'The host has not added the meeting link yet.' };
  return { ok: true };
}

/** Admin attendance marking: only for still-booked bookings once the session has started. */
export function canMarkAttendance(input: { bookingStatus: string; session: SessionLike; now: Date }): RuleResult {
  const { bookingStatus, session, now } = input;
  if (bookingStatus !== 'booked') return deny(409, 'already_marked', 'Attendance is already recorded for this booking.');
  if (session.status !== 'scheduled') return deny(409, 'session_cancelled', 'This session was cancelled.');
  if (session.startsAt.getTime() > now.getTime()) return deny(409, 'not_started', 'Attendance can be marked once the call has started.');
  return { ok: true };
}

const FULL_ACCESS_ROLES = new Set(['super_admin', 'admin']);

/** super_admin/admin manage every session; mentors only sessions they host. */
export function canManageSupportSession(
  role: string | null | undefined,
  adminId: string | null | undefined,
  session?: { hostAdminId?: string | null },
): boolean {
  if (!role) return false;
  if (FULL_ACCESS_ROLES.has(role)) return true;
  if (role !== 'mentor' || !adminId) return false;
  return session === undefined ? true : session.hostAdminId === adminId;
}

export function isFullAccessRole(role: string | null | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role);
}

/**
 * A support call is "1:1" when its session has exactly one seat — whatever the
 * category (a 1-seat Sales or Tech call is just as private as Mentor 1-On-1).
 * Same rule as the admin Support Calls page's "1:1 only" filter and badge
 * (`session.capacity === 1`), so notifications and the admin list agree.
 */
export function isOneToOneSession(session: { capacity: number }): boolean {
  return session.capacity === 1;
}
