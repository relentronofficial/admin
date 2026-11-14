import { describe, expect, it } from 'vitest';

import {
  approvalMissingProfilePhoto,
  canApproveMember,
  canEditOnboarding,
  canReviewOnboarding,
  canSubmitOnboarding,
  checkOnboardingReadyToSubmit,
  detectProfilePhotoType,
  hasProfilePhoto,
  MAX_PROFILE_PHOTO_BYTES,
  REQUIRED_ONBOARDING_FIELDS,
  validateProfilePhotoUpload,
} from './onboardingLogic.js';

describe('canEditOnboarding / canSubmitOnboarding', () => {
  it('allows editing/submitting while awaiting_kyc', () => {
    expect(canEditOnboarding('awaiting_kyc')).toBe(true);
    expect(canSubmitOnboarding('awaiting_kyc')).toBe(true);
  });

  it('allows editing/submitting after changes_requested', () => {
    expect(canEditOnboarding('changes_requested')).toBe(true);
    expect(canSubmitOnboarding('changes_requested')).toBe(true);
  });

  it('blocks editing/submitting while under_review', () => {
    expect(canEditOnboarding('under_review')).toBe(false);
    expect(canSubmitOnboarding('under_review')).toBe(false);
  });

  it('a verified member may edit their details, but not submit for review again', () => {
    expect(canEditOnboarding('verified')).toBe(true);
    expect(canSubmitOnboarding('verified')).toBe(false);
  });

  it('a member without an onboarding status (e.g. admin-created) may edit, not submit', () => {
    expect(canEditOnboarding(null)).toBe(true);
    expect(canEditOnboarding(undefined)).toBe(true);
    expect(canSubmitOnboarding(null)).toBe(false);
  });

  it('blocks editing/submitting once rejected', () => {
    expect(canEditOnboarding('rejected')).toBe(false);
    expect(canSubmitOnboarding('rejected')).toBe(false);
  });
});

describe('canReviewOnboarding', () => {
  it('only allows admin reject/request-changes while under_review', () => {
    expect(canReviewOnboarding('under_review')).toBe(true);
    expect(canReviewOnboarding('awaiting_kyc')).toBe(false);
    expect(canReviewOnboarding('changes_requested')).toBe(false);
    expect(canReviewOnboarding('verified')).toBe(false);
    expect(canReviewOnboarding('rejected')).toBe(false);
  });
});

describe('canApproveMember', () => {
  it('allows approving any pending member regardless of createdBy or verificationStatus', () => {
    expect(canApproveMember({ status: 'pending', createdBy: 'admin-1', verificationStatus: 'awaiting_kyc' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: 'admin-1', verificationStatus: 'under_review' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'under_review' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'awaiting_kyc' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'changes_requested' })).toBe(true);
  });

  it('never allows approving a member that is not pending', () => {
    expect(canApproveMember({ status: 'active', createdBy: null, verificationStatus: 'under_review' })).toBe(false);
    expect(canApproveMember({ status: 'suspended', createdBy: 'admin-1', verificationStatus: 'awaiting_kyc' })).toBe(false);
  });
});

describe('checkOnboardingReadyToSubmit', () => {
  const completeProfile = {
    firstName: 'Priya',
    businessName: 'Priya Textiles',
    productServiceType: 'Retail',
    city: 'Chennai',
    state: 'Tamil Nadu',
    profilePhotoUrl: 'https://cdn.example.com/members/m1/photo.jpg',
  };

  it('is valid when every required field and the photo are present and at least one document exists', () => {
    const result = checkOnboardingReadyToSubmit(completeProfile, 1);
    expect(result).toEqual({ valid: true, missingFields: [], hasDocument: true, hasProfilePhoto: true, unwatchedVideoSteps: [] });
  });

  it('lists every missing required field, photo first', () => {
    const result = checkOnboardingReadyToSubmit({ firstName: 'Priya' }, 1);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual(['profilePhotoUrl', 'businessName', 'productServiceType', 'city', 'state']);
  });

  it('is invalid without a profile photo even when everything else is complete', () => {
    for (const photo of [undefined, null, '', '   ', 'not-a-url', 'javascript:alert(1)']) {
      const result = checkOnboardingReadyToSubmit({ ...completeProfile, profilePhotoUrl: photo }, 1);
      expect(result.valid).toBe(false);
      expect(result.hasProfilePhoto).toBe(false);
      expect(result.missingFields).toEqual(['profilePhotoUrl']);
    }
  });

  it('treats empty string the same as missing, not as provided', () => {
    const result = checkOnboardingReadyToSubmit({ ...completeProfile, city: '' }, 1);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual(['city']);
  });

  it('is invalid with zero documents even when every field is filled', () => {
    const result = checkOnboardingReadyToSubmit(completeProfile, 0);
    expect(result.valid).toBe(false);
    expect(result.hasDocument).toBe(false);
    expect(result.missingFields).toEqual([]);
  });

  it('is invalid when required video steps have not been watched', () => {
    const profile = { ...completeProfile, watchedVideoSteps: ['intro_welcome_video'] };
    const result = checkOnboardingReadyToSubmit(profile, 1, ['intro_welcome_video', 'mentorship_comparison']);
    expect(result.valid).toBe(false);
    expect(result.unwatchedVideoSteps).toEqual(['mentorship_comparison']);
  });

  it('is valid when all required video steps have been watched', () => {
    const profile = { ...completeProfile, watchedVideoSteps: ['intro_welcome_video', 'mentorship_comparison'] };
    const result = checkOnboardingReadyToSubmit(profile, 1, ['intro_welcome_video', 'mentorship_comparison']);
    expect(result.valid).toBe(true);
    expect(result.unwatchedVideoSteps).toEqual([]);
  });

  it('treats missing watchedVideoSteps as none watched', () => {
    const result = checkOnboardingReadyToSubmit(completeProfile, 1, ['intro_welcome_video']);
    expect(result.valid).toBe(false);
    expect(result.unwatchedVideoSteps).toEqual(['intro_welcome_video']);
  });

  it('required field list matches the documented minimal set', () => {
    expect(REQUIRED_ONBOARDING_FIELDS).toEqual(['firstName', 'businessName', 'productServiceType', 'city', 'state']);
  });
});

describe('profile photo (mandatory in onboarding)', () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  it('hasProfilePhoto accepts only an http(s) URL', () => {
    expect(hasProfilePhoto('https://cdn.example.com/a.jpg')).toBe(true);
    expect(hasProfilePhoto('  http://x.y/z.png  ')).toBe(true);
    for (const v of [undefined, null, '', '  ', 'a.jpg', 'ftp://x/y', 'data:image/png;base64,xx', 42]) expect(hasProfilePhoto(v)).toBe(false);
  });

  it('detects JPEG / PNG / GIF / WebP from the bytes, and nothing else', () => {
    expect(detectProfilePhotoType(jpeg)).toBe('jpeg');
    expect(detectProfilePhotoType(png)).toBe('png');
    expect(detectProfilePhotoType(gif)).toBe('gif');
    expect(detectProfilePhotoType(webp)).toBe('webp');
    expect(detectProfilePhotoType(new TextEncoder().encode('%PDF-1.7 not an image'))).toBeNull();
    expect(detectProfilePhotoType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectProfilePhotoType(new Uint8Array(0))).toBeNull();
  });

  it('upload validation refuses empty, oversized and non-image files', () => {
    expect(validateProfilePhotoUpload(jpeg)).toBeNull();
    expect(validateProfilePhotoUpload(null)?.status).toBe(400);
    expect(validateProfilePhotoUpload(new Uint8Array(0))?.error).toBe('No file received');
    const big = new Uint8Array(MAX_PROFILE_PHOTO_BYTES + 1); big.set(jpeg);
    expect(validateProfilePhotoUpload(big)?.status).toBe(413);
    expect(validateProfilePhotoUpload(new TextEncoder().encode('hello'))?.error).toMatch(/not a valid image/);
  });

  it('approval of a self-registered member needs a photo (saved or supplied); admin-created members are unaffected', () => {
    expect(approvalMissingProfilePhoto({ createdBy: null, profilePhotoUrl: null })).toBe(true);
    expect(approvalMissingProfilePhoto({ createdBy: null, profilePhotoUrl: '' })).toBe(true);
    expect(approvalMissingProfilePhoto({ createdBy: null, profilePhotoUrl: 'https://cdn/x.jpg' })).toBe(false);
    expect(approvalMissingProfilePhoto({ createdBy: null, profilePhotoUrl: null, suppliedPhotoUrl: 'https://cdn/y.jpg' })).toBe(false);
    expect(approvalMissingProfilePhoto({ createdBy: 'admin-1', profilePhotoUrl: null })).toBe(false);
  });
});
