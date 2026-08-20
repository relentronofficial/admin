import { describe, expect, it } from 'vitest';

import {
  canApproveMember,
  canEditOnboarding,
  canReviewOnboarding,
  canSubmitOnboarding,
  checkOnboardingReadyToSubmit,
  REQUIRED_ONBOARDING_FIELDS,
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

  it('blocks editing/submitting once verified', () => {
    expect(canEditOnboarding('verified')).toBe(false);
    expect(canSubmitOnboarding('verified')).toBe(false);
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
  it('allows approving an admin-created member regardless of verificationStatus', () => {
    expect(canApproveMember({ status: 'pending', createdBy: 'admin-1', verificationStatus: 'awaiting_kyc' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: 'admin-1', verificationStatus: 'under_review' })).toBe(true);
  });

  it('requires under_review to approve a self-signed-up member', () => {
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'under_review' })).toBe(true);
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'awaiting_kyc' })).toBe(false);
    expect(canApproveMember({ status: 'pending', createdBy: null, verificationStatus: 'changes_requested' })).toBe(false);
  });

  it('never allows approving a member that is not pending, even if otherwise eligible', () => {
    expect(canApproveMember({ status: 'active', createdBy: null, verificationStatus: 'under_review' })).toBe(false);
    expect(canApproveMember({ status: 'suspended', createdBy: 'admin-1', verificationStatus: 'awaiting_kyc' })).toBe(false);
  });
});

describe('checkOnboardingReadyToSubmit', () => {
  const completeProfile = {
    firstName: 'Priya',
    businessName: 'Priya Textiles',
    businessType: 'Retail',
    city: 'Chennai',
    state: 'Tamil Nadu',
  };

  it('is valid when every required field is present and at least one document exists', () => {
    const result = checkOnboardingReadyToSubmit(completeProfile, 1);
    expect(result).toEqual({ valid: true, missingFields: [], hasDocument: true });
  });

  it('lists every missing required field', () => {
    const result = checkOnboardingReadyToSubmit({ firstName: 'Priya' }, 1);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toEqual(['businessName', 'businessType', 'city', 'state']);
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

  it('required field list matches the documented minimal set', () => {
    expect(REQUIRED_ONBOARDING_FIELDS).toEqual(['firstName', 'businessName', 'businessType', 'city', 'state']);
  });
});
