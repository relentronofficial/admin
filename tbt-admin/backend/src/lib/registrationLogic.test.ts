import { describe, expect, it } from 'vitest';
import { decideRegistration, EMAIL_TAKEN, isNeverVerified, NEEDS_SUPPORT, normalizeEmail, PHONE_TAKEN, type ExistingAccount } from './registrationLogic.js';

const acct = (id: string, extra: Partial<ExistingAccount> = {}): ExistingAccount => ({
  id, status: 'pending', verificationStatus: 'awaiting_kyc', onboardingSubmittedAt: null, sessionCount: 0, ...extra,
});

describe('isNeverVerified', () => {
  it('is true only for an untouched old-flow sign-up', () => {
    expect(isNeverVerified(acct('a'))).toBe(true);
    expect(isNeverVerified(acct('a', { verificationStatus: null }))).toBe(true);
  });
  it('is false once the member ever logged in, submitted onboarding, or was approved', () => {
    expect(isNeverVerified(acct('a', { sessionCount: 1 }))).toBe(false);
    expect(isNeverVerified(acct('a', { onboardingSubmittedAt: new Date() }))).toBe(false);
    expect(isNeverVerified(acct('a', { status: 'active' }))).toBe(false);
    expect(isNeverVerified(acct('a', { verificationStatus: 'under_review' }))).toBe(false);
  });
});

describe('decideRegistration', () => {
  it('a brand-new phone and email proceed to OTP', () => {
    expect(decideRegistration({ phoneMember: null, emailMember: null })).toEqual({ ok: true, claimMemberId: null });
  });

  it('a real account with the phone or email still blocks', () => {
    expect(decideRegistration({ phoneMember: acct('p', { sessionCount: 2 }), emailMember: null })).toEqual({ ok: false, status: 409, error: PHONE_TAKEN });
    expect(decideRegistration({ phoneMember: null, emailMember: acct('e', { status: 'active' }) })).toEqual({ ok: false, status: 409, error: EMAIL_TAKEN });
  });

  it('an unverified old sign-up with the same email no longer blocks: the retry claims it', () => {
    expect(decideRegistration({ phoneMember: null, emailMember: acct('old') })).toEqual({ ok: true, claimMemberId: 'old' });
    expect(decideRegistration({ phoneMember: acct('old'), emailMember: acct('old') })).toEqual({ ok: true, claimMemberId: 'old' });
  });

  it('two different unverified sign-ups for the phone and the email need support, never a silent merge', () => {
    expect(decideRegistration({ phoneMember: acct('p'), emailMember: acct('e') })).toEqual({ ok: false, status: 409, error: NEEDS_SUPPORT });
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases; rejects implausible addresses', () => {
    expect(normalizeEmail('  Priya@Example.COM ')).toBe('priya@example.com');
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});
