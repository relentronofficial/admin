import { describe, expect, it } from 'vitest';
import { checkSignupPhotoUrl, decideRegistration, EMAIL_TAKEN, isNeverVerified, NEEDS_SUPPORT, normalizeEmail, PHONE_TAKEN, SIGNUP_PHOTO_INVALID, signupPhotoBases, type ExistingAccount } from './registrationLogic.js';

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

describe('sign-up profile photo URL', () => {
  const bases = signupPhotoBases({ cdnHost: 'cdn.example.net', r2AccountId: 'acc', r2Bucket: 'bkt' });

  it('builds the CDN and R2 prefixes (scheme or trailing slash in the host is tolerated)', () => {
    expect(bases).toEqual([
      'https://cdn.example.net/signup-photos/',
      'https://acc.r2.cloudflarestorage.com/bkt/signup-photos/',
    ]);
    expect(signupPhotoBases({ cdnHost: 'https://cdn.example.net/' })).toEqual(['https://cdn.example.net/signup-photos/']);
    expect(signupPhotoBases({})).toEqual([]);
  });

  it('accepts a photo uploaded into our sign-up folder', () => {
    expect(checkSignupPhotoUrl(' https://cdn.example.net/signup-photos/abc-123.webp ', bases))
      .toEqual({ ok: true, url: 'https://cdn.example.net/signup-photos/abc-123.webp' });
    expect(checkSignupPhotoUrl('https://acc.r2.cloudflarestorage.com/bkt/signup-photos/x.png', bases).ok).toBe(true);
  });

  it('no photo sent is allowed (older app versions); onboarding still requires one', () => {
    expect(checkSignupPhotoUrl(undefined, bases)).toEqual({ ok: true, url: null });
    expect(checkSignupPhotoUrl('  ', bases)).toEqual({ ok: true, url: null });
  });

  it.each([
    'https://evil.example.com/signup-photos/a.png',
    'https://cdn.example.net/members/m1/a.png',
    'https://cdn.example.net/signup-photos/../members/a.png',
    'https://cdn.example.net/signup-photos/sub/a.png',
    'https://cdn.example.net/signup-photos/a.png?x=1',
    'https://cdn.example.net/signup-photos/',
    'http://cdn.example.net/signup-photos/a.png',
  ])('refuses %s', (url) => {
    expect(checkSignupPhotoUrl(url, bases)).toEqual({ ok: false, error: SIGNUP_PHOTO_INVALID });
  });

  it('refuses a non-string value', () => {
    expect(checkSignupPhotoUrl(42, bases).ok).toBe(false);
  });
});
