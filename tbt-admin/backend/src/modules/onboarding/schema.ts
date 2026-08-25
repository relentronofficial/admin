import { z } from 'zod';

// The security boundary for self-onboarding (SELF_ONBOARDING_SPECKIT.md §5.2,
// D3). Only fields a member may safely set on themselves. Never add
// status/verificationStatus/onboardingCompleted/membershipPlan/
// accountManagerId/batchId/password/currentTier/createdBy/email/phone/notes
// here — see the spec for why each is excluded. `.strict()` rejects unknown
// keys outright instead of silently dropping them, so a client bug fails
// loudly rather than quietly succeeding minus the dangerous fields.
export const onboardingUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  profilePhotoUrl: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  businessEstablishedOn: z.string().optional(),
  productServiceType: z.string().optional(),
  instagramLink: z.string().optional(),
  annualTurnover: z.string().optional(),
  goalAfter90Days: z.string().optional(),
  preferredSessionMode: z.enum(['online', 'offline', 'hybrid']).optional(),
  gstNumber: z.string().optional(),
  marketingChannels: z.array(z.string()).optional(),
  marketingChannelName: z.string().optional(),
  hasMarketingTeam: z.boolean().optional(),
  marketingTeamDetails: z.string().optional(),
  hasVideoEditing: z.boolean().optional(),
  videoEditingDetails: z.string().optional(),
  domainHostingDetails: z.string().optional(),
  businessAddress: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  subIndustry: z.string().optional(),
  businessStage: z.enum(['idea', 'startup', 'growth', 'scaling']).optional(),
  currentChallenges: z.array(z.string()).optional(),
  hasWebsite: z.boolean().optional(),
  weeklyWebsiteOrders: z.number().int().min(0).optional().nullable(),
  skillBusinessFoundation: z.number().int().min(1).max(10).optional().nullable(),
  skillContent: z.number().int().min(1).max(10).optional().nullable(),
  skillFunnels: z.number().int().min(1).max(10).optional().nullable(),
  skillAds: z.number().int().min(1).max(10).optional().nullable(),
  skillSales: z.number().int().min(1).max(10).optional().nullable(),
  skillOverallMarketing: z.number().int().min(1).max(10).optional().nullable(),
  weeklyLearningHours: z.number().int().min(5).max(80).optional().nullable(),
  teamSize: z.string().optional(),
  businessStartedFrom: z.string().optional(),
  instagramStats: z.string().optional(),
  facebookStats: z.string().optional(),
  websiteUrl: z.string().optional(),
  revenueGoalAfterTbt: z.string().optional(),
}).strict();

export const registerDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentUrl: z.string().min(1),
});

export const presignDocumentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  documentType: z.string().min(1).optional(),
});

export const onboardingContentSchema = z.object({
  stepKey: z.string().min(1),
  title: z.string().min(1),
  textBody: z.string().optional(),
  videoUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  lottieUrl: z.string().optional(),
  quizData: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
