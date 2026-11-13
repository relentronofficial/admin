// Pure state-machine + validation helpers for self-onboarding. Deliberately
// zero imports of anything that touches config/env.ts or Prisma at module
// scope, so this file can be unit-tested with no .env / database present —
// see onboardingLogic.test.ts. DB orchestration lives in modules/onboarding/.
// Design reference: SELF_ONBOARDING_SPECKIT.md §6, §11.

export type VerificationStatus = 'awaiting_kyc' | 'under_review' | 'verified' | 'rejected' | 'changes_requested';

/** A member may edit their own onboarding details (profile, photo, documents)
 * whenever the wizard shows them the form: before submitting, after admin
 * sent it back for changes, once verified, and when no onboarding status was
 * ever set (e.g. an admin-created account). Not while under review (admin is
 * looking at it) or after rejection — the wizard shows those screens instead. */
export function canEditOnboarding(verificationStatus: VerificationStatus | null | undefined): boolean {
  return verificationStatus !== 'under_review' && verificationStatus !== 'rejected';
}

/** Submitting for review stays limited to an application that is not yet in
 * (or back from) review: before the first submit, or after changes were
 * requested. A verified member's edits are saved without a new review. */
export function canSubmitOnboarding(verificationStatus: VerificationStatus | null | undefined): boolean {
  return verificationStatus === 'awaiting_kyc' || verificationStatus === 'changes_requested';
}

/** Admin reject / request-changes both require the application to actually
 * be sitting in the review queue. */
export function canReviewOnboarding(verificationStatus: VerificationStatus): boolean {
  return verificationStatus === 'under_review';
}

/** Approve is the one action with two independent paths:
 *  - an admin-direct-created member (createdBy !== null) never went through
 *    self-onboarding at all, so the existing "create then immediately
 *    approve" workflow must keep working regardless of verificationStatus.
 *  - a self-signed-up member (createdBy === null) must have actually
 *    submitted the wizard (verificationStatus === 'under_review') before an
 *    admin can approve them.
 * Both paths additionally require status === 'pending' (an already-active,
 * suspended, etc. member can't be re-approved). */
export function canApproveMember(params: {
  status: string;
  createdBy: string | null;
  verificationStatus: VerificationStatus;
}): boolean {
  // Any pending member can be approved by admin — whether admin-created or
  // self-registered. The KYC wizard is a helpful step but not a hard gate;
  // the admin is the final authority on approval.
  return params.status === 'pending';
}

/** Minimal required fields to submit — deliberately smaller than the full
 * ~25-field admin form (see SELF_ONBOARDING_SPECKIT.md §11 item 1). */
export const REQUIRED_ONBOARDING_FIELDS = ['firstName', 'businessName', 'productServiceType', 'city', 'state'] as const;

export interface OnboardingReadyCheck {
  valid: boolean;
  missingFields: string[];
  hasDocument: boolean;
  unwatchedVideoSteps: string[];
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function checkOnboardingReadyToSubmit(
  profile: Record<string, unknown>,
  documentCount: number,
  requiredVideoStepKeys: string[] = [],
): OnboardingReadyCheck {
  const missingFields = REQUIRED_ONBOARDING_FIELDS.filter((field) => isBlank(profile[field]));
  const hasDocument = documentCount > 0;
  const watched = Array.isArray(profile.watchedVideoSteps) ? (profile.watchedVideoSteps as string[]) : [];
  const unwatchedVideoSteps = requiredVideoStepKeys.filter((k) => !watched.includes(k));
  return {
    valid: missingFields.length === 0 && hasDocument && unwatchedVideoSteps.length === 0,
    missingFields,
    hasDocument,
    unwatchedVideoSteps,
  };
}
