// Pure state-machine + validation helpers for self-onboarding. Deliberately
// zero imports of anything that touches config/env.ts or Prisma at module
// scope, so this file can be unit-tested with no .env / database present —
// see onboardingLogic.test.ts. DB orchestration lives in modules/onboarding/.
// Design reference: SELF_ONBOARDING_SPECKIT.md §6, §11.

export type VerificationStatus = 'awaiting_kyc' | 'under_review' | 'verified' | 'rejected' | 'changes_requested';

/** A member may edit their profile / upload documents only while their
 * application hasn't been submitted yet, or after admin sent it back for
 * changes. Not while under review (admin is looking at it) or already
 * verified (nothing left to change). */
export function canEditOnboarding(verificationStatus: VerificationStatus): boolean {
  return verificationStatus === 'awaiting_kyc' || verificationStatus === 'changes_requested';
}

/** Submitting has the same precondition as editing — you can only submit
 * what you're still allowed to touch. */
export function canSubmitOnboarding(verificationStatus: VerificationStatus): boolean {
  return canEditOnboarding(verificationStatus);
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
  if (params.status !== 'pending') return false;
  if (params.createdBy !== null) return true;
  return params.verificationStatus === 'under_review';
}

/** Minimal required fields to submit — deliberately smaller than the full
 * ~25-field admin form (see SELF_ONBOARDING_SPECKIT.md §11 item 1). */
export const REQUIRED_ONBOARDING_FIELDS = ['firstName', 'businessName', 'businessType', 'city', 'state'] as const;

export interface OnboardingReadyCheck {
  valid: boolean;
  missingFields: string[];
  hasDocument: boolean;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function checkOnboardingReadyToSubmit(
  profile: Record<string, unknown>,
  documentCount: number,
): OnboardingReadyCheck {
  const missingFields = REQUIRED_ONBOARDING_FIELDS.filter((field) => isBlank(profile[field]));
  const hasDocument = documentCount > 0;
  return {
    valid: missingFields.length === 0 && hasDocument,
    missingFields,
    hasDocument,
  };
}
