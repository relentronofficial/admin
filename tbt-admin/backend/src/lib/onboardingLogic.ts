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
  /** Includes 'profilePhotoUrl' (first) when the photo is missing. */
  missingFields: string[];
  hasDocument: boolean;
  hasProfilePhoto: boolean;
  unwatchedVideoSteps: string[];
}

// ── Profile photo (mandatory in the onboarding flow) ─────────────────────────

export const PROFILE_PHOTO_REQUIRED_MESSAGE = 'Profile photo is required.';
/** Largest profile photo the member upload endpoint accepts. */
export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

/** A saved photo is a non-empty http(s) URL (what the upload endpoints store). */
export function hasProfilePhoto(url: unknown): boolean {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim());
}

export type ProfilePhotoType = 'jpeg' | 'png' | 'webp' | 'gif';

/** The image type from the file's own bytes, or null when it isn't a JPEG/PNG/WebP/GIF
 * (the Content-Type header alone can't be trusted). */
export function detectProfilePhotoType(b: Uint8Array): ProfilePhotoType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
    && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

/** Why a member profile photo upload is refused, or null when it is acceptable. */
export function validateProfilePhotoUpload(body: Uint8Array | null | undefined): { status: number; error: string } | null {
  if (!body || body.length === 0) return { status: 400, error: 'No file received' };
  if (body.length > MAX_PROFILE_PHOTO_BYTES) return { status: 413, error: 'Photo must be 10 MB or smaller' };
  if (!detectProfilePhotoType(body)) {
    return { status: 400, error: 'That file is not a valid image. Please upload a JPG, PNG, WebP or GIF photo.' };
  }
  return null;
}

/** Approving a self-registered member completes their onboarding, so it needs a
 * photo — the saved one, or one the admin supplies with the approval. An
 * admin-created member (createdBy set) never went through onboarding: unaffected. */
export function approvalMissingProfilePhoto(params: {
  createdBy: string | null;
  profilePhotoUrl: unknown;
  suppliedPhotoUrl?: unknown;
}): boolean {
  if (params.createdBy) return false;
  return !hasProfilePhoto(params.profilePhotoUrl) && !hasProfilePhoto(params.suppliedPhotoUrl);
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function checkOnboardingReadyToSubmit(
  profile: Record<string, unknown>,
  documentCount: number,
  requiredVideoStepKeys: string[] = [],
): OnboardingReadyCheck {
  const photo = hasProfilePhoto(profile.profilePhotoUrl);
  const missingFields: string[] = [
    ...(photo ? [] : ['profilePhotoUrl']),
    ...REQUIRED_ONBOARDING_FIELDS.filter((field) => isBlank(profile[field])),
  ];
  const hasDocument = documentCount > 0;
  const watched = Array.isArray(profile.watchedVideoSteps) ? (profile.watchedVideoSteps as string[]) : [];
  const unwatchedVideoSteps = requiredVideoStepKeys.filter((k) => !watched.includes(k));
  return {
    valid: missingFields.length === 0 && hasDocument && unwatchedVideoSteps.length === 0,
    missingFields,
    hasDocument,
    hasProfilePhoto: photo,
    unwatchedVideoSteps,
  };
}
