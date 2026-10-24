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
