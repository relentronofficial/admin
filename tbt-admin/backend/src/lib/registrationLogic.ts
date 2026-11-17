// Self-registration rules — pure (no Prisma, no clock).
//
// A sign-up becomes a member account only after its phone OTP is verified.
// Until then it is a pending registration (pending_registrations table, keyed
// by the E.164 phone), so an abandoned or mistyped attempt never blocks a
// retry with "email already exists".
//
// Accounts created by the old flow (account first, OTP after) may never have
// been verified. Such a row can be re-registered: the verified retry updates
// it instead of creating a new one — nothing is deleted.

export interface ExistingAccount {
  id: string;
  status: string | null;
  verificationStatus: string | null;
  onboardingSubmittedAt: Date | string | null;
  /** member_sessions rows ever created for this member (one is written on every successful OTP login). */
  sessionCount: number;
}

/**
 * A member that only ever got as far as the old sign-up form: still pending,
 * still awaiting KYC, never submitted onboarding, and never completed an OTP
 * login (no session was ever created).
 */
export function isNeverVerified(m: ExistingAccount): boolean {
  return (
    m.status === 'pending' &&
    (m.verificationStatus === null || m.verificationStatus === 'awaiting_kyc') &&
    !m.onboardingSubmittedAt &&
    m.sessionCount === 0
  );
}

export type RegistrationDecision =
  | { ok: true; claimMemberId: string | null }
  | { ok: false; status: 409; error: string };

export const PHONE_TAKEN = 'An account with this phone number already exists. Please log in.';
export const EMAIL_TAKEN = 'An account with this email already exists. Please log in.';
export const NEEDS_SUPPORT =
  'This phone number and email belong to two different unfinished sign-ups. Please contact support to complete your registration.';

/**
 * Whether a sign-up for this phone/email may proceed to OTP, given the members
 * already holding that phone and that email (null = none). Only a real
 * (verified) account blocks; a never-verified one is claimed by the retry.
 */
export function decideRegistration(input: {
  phoneMember: ExistingAccount | null;
  emailMember: ExistingAccount | null;
}): RegistrationDecision {
  const { phoneMember, emailMember } = input;
  if (phoneMember && !isNeverVerified(phoneMember)) return { ok: false, status: 409, error: PHONE_TAKEN };
  if (emailMember && !isNeverVerified(emailMember)) return { ok: false, status: 409, error: EMAIL_TAKEN };
  if (phoneMember && emailMember && phoneMember.id !== emailMember.id) {
    return { ok: false, status: 409, error: NEEDS_SUPPORT };
  }
  return { ok: true, claimMemberId: phoneMember?.id ?? emailMember?.id ?? null };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trimmed, lower-cased email, or null when it is not a plausible address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/** How long a pending registration (and so its OTP flow) stays usable. */
export const PENDING_REGISTRATION_TTL_MINUTES = 30;

// ── Profile photo at sign-up ──────────────────────────────────────────────────
// Uploaded before the account exists (POST /api/user-auth/signup/photo), into
// this folder of our own storage. Sign-up only accepts a URL from there, so a
// form can't point a new account at an arbitrary image on the internet.

export const SIGNUP_PHOTO_FOLDER = 'signup-photos';
export const SIGNUP_PHOTO_INVALID = 'Please upload your profile photo again.';

/** Public URL prefixes a sign-up photo can have, from the storage settings. */
export function signupPhotoBases(cfg: {
  cdnHost?: string | null; r2AccountId?: string | null; r2Bucket?: string | null;
}): string[] {
  const bases: string[] = [];
  if (cfg.cdnHost) bases.push(`https://${cfg.cdnHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${SIGNUP_PHOTO_FOLDER}/`);
  if (cfg.r2AccountId && cfg.r2Bucket) {
    bases.push(`https://${cfg.r2AccountId}.r2.cloudflarestorage.com/${cfg.r2Bucket}/${SIGNUP_PHOTO_FOLDER}/`);
  }
  return bases;
}

/**
 * The sign-up photo to save: null when none was sent (older app versions; the
 * onboarding wizard still requires one before review), the trimmed URL when it
 * points into our sign-up photo folder, or an error otherwise.
 */
export function checkSignupPhotoUrl(
  raw: unknown,
  bases: string[],
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, url: null };
  if (typeof raw !== 'string') return { ok: false, error: SIGNUP_PHOTO_INVALID };
  const url = raw.trim();
  const base = bases.find((b) => url.startsWith(b));
  const rest = base ? url.slice(base.length) : null;
  // One plain file name inside the folder: no sub-paths, queries or traversal.
  if (rest == null || !/^[A-Za-z0-9._-]+$/.test(rest) || rest.includes('..') || url.length > 500) {
    return { ok: false, error: SIGNUP_PHOTO_INVALID };
  }
  return { ok: true, url };
}
