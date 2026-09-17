// Local Zod validation test for the onboarding PATCH schema.
// Uses realistic mock data (what a fresh member's profile looks like after GET /api/onboarding).
// No DB or server needed — pure schema validation.
//
// Run: node scripts/test-onboarding-zod.mjs (from tbt-admin/backend/)

import { z } from 'zod';

// ── Exact copy of onboardingUpdateSchema from modules/onboarding/schema.ts ──
const onboardingUpdateSchema = z.object({
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

// ── Helper ──────────────────────────────────────────────────────────────────

function validate(label, body) {
  const result = onboardingUpdateSchema.partial().safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    console.error(`\n❌  ${label} FAILED (${issues.length} Zod issue(s)):`);
    for (const issue of issues) {
      const actualVal = issue.path[0] ? body[issue.path[0]] : '(root)';
      console.error(`   • [${issue.path.join('.') || 'root'}] ${issue.message}`);
      console.error(`     value: ${JSON.stringify(actualVal)} (type: ${typeof actualVal})`);
    }
    return false;
  }
  console.log(`\n✅  ${label} passed`);
  return true;
}

function simulateSaveAndAdvance(profile, useNullFilter) {
  const {
    phone: _p, email: _e,
    challenge1, challenge2, challenge3,
    ...editable
  } = profile;
  const currentChallenges = [challenge1, challenge2, challenge3].filter(Boolean);
  const merged = { ...editable, currentChallenges };

  if (!useNullFilter) return merged;

  return Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== null && v !== undefined)
  );
}

// ── Mock profiles ─────────────────────────────────────────────────────────────

// Profile 1: brand-new member — all optional fields are null (what DB returns before filling form)
const freshMemberProfile = {
  // from Prisma PROFILE_SELECT (phone/email stripped by saveAndAdvance destructuring)
  phone: '9876543210',
  email: null,
  firstName: null,
  lastName: null,
  dob: null,
  gender: null,         // DB null — enum field
  profilePhotoUrl: null,
  city: null,
  state: null,
  pincode: null,
  businessName: null,
  businessType: null,
  businessEstablishedOn: null,
  productServiceType: null,
  instagramLink: null,
  annualTurnover: null,
  goalAfter90Days: null,
  preferredSessionMode: null, // DB null — enum field
  gstNumber: null,
  marketingChannels: null,    // will be coerced to [] by wizard init
  marketingChannelName: null,
  hasMarketingTeam: null,
  marketingTeamDetails: null,
  hasVideoEditing: null,
  videoEditingDetails: null,
  domainHostingDetails: null,
  businessAddress: null,
  sector: null,
  industry: null,
  subIndustry: null,
  businessStage: null,        // DB null — enum field
  currentChallenges: null,    // DB null — array field
  // from raw SQL skill select
  hasWebsite: null,
  weeklyWebsiteOrders: null,
  skillBusinessFoundation: null,
  skillContent: null,
  skillFunnels: null,
  skillAds: null,
  skillSales: null,
  skillOverallMarketing: null,
  weeklyLearningHours: null,
  teamSize: null,
  businessStartedFrom: null,
  instagramStats: null,
  facebookStats: null,
  websiteUrl: null,
  revenueGoalAfterTbt: null,
};

// Simulate frontend wizard state init
function initProfile(raw) {
  const p = { ...raw };
  if (Array.isArray(p.currentChallenges)) {
    p.challenge1 = p.currentChallenges[0] ?? '';
    p.challenge2 = p.currentChallenges[1] ?? '';
    p.challenge3 = p.currentChallenges[2] ?? '';
    delete p.currentChallenges;
  }
  if (!Array.isArray(p.marketingChannels)) {
    p.marketingChannels = [];
  }
  return p;
}

// Profile 2: partially filled member (after profile step — typical save scenario)
const partialProfile = {
  ...freshMemberProfile,
  firstName: 'Ram',
  lastName: 'Test',
  city: 'Chennai',
  state: 'Tamil Nadu',
  businessName: 'Ram Enterprises',
  productServiceType: 'Service-based',
  preferredSessionMode: null, // user hasn't selected yet
  gender: null,
  businessStage: null,
  marketingChannels: ['SEO', 'Social Media'],
  currentChallenges: ['Lead generation', 'Closing sales'],
};

// Profile 3: profile WITH a `dob` as a Date object (Prisma returns DateTime as Date)
const profileWithDateDob = {
  ...freshMemberProfile,
  firstName: 'Test',
  dob: new Date('2000-01-15T00:00:00.000Z'), // Prisma DateTime field returns a Date object
};

// Profile 4: profile with empty string firstName (edge case)
const profileWithEmptyFirstName = {
  ...freshMemberProfile,
  firstName: '',  // user cleared the field
};

// ── Run tests ────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════════════════');
console.log('     TBT Onboarding PATCH — Zod Schema Validation Test Suite');
console.log('══════════════════════════════════════════════════════════════════════');

// Test 1: fresh member, NO null filter → should fail
console.log('\n── Test 1: Fresh member, old saveAndAdvance (NO null filter) ──────────');
const t1 = initProfile(freshMemberProfile);
validate('Test 1', simulateSaveAndAdvance(t1, false));

// Test 2: fresh member, WITH null filter → should pass
console.log('\n── Test 2: Fresh member, new saveAndAdvance (WITH null filter) ─────────');
validate('Test 2', simulateSaveAndAdvance(t1, true));

// Test 3: partial profile, NO null filter
console.log('\n── Test 3: Partial profile, old saveAndAdvance (NO null filter) ────────');
const t3 = initProfile(partialProfile);
validate('Test 3', simulateSaveAndAdvance(t3, false));

// Test 4: partial profile, WITH null filter
console.log('\n── Test 4: Partial profile, new saveAndAdvance (WITH null filter) ──────');
validate('Test 4', simulateSaveAndAdvance(t3, true));

// Test 5: dob as Date object (Prisma returns DateTime as Date, not string)
console.log('\n── Test 5: Profile with dob as Date object (Prisma DateTime) ───────────');
const t5 = initProfile(profileWithDateDob);
const body5 = simulateSaveAndAdvance(t5, true);
console.log(`   dob value: ${JSON.stringify(body5.dob)} (type: ${typeof body5.dob})`);
validate('Test 5', body5);

// Test 6: empty string firstName (z.string().min(1) should reject it)
console.log('\n── Test 6: Profile with empty string firstName ───────────────────────────');
const t6 = initProfile(profileWithEmptyFirstName);
const body6 = simulateSaveAndAdvance(t6, true);
console.log(`   firstName value: ${JSON.stringify(body6.firstName)} (type: ${typeof body6.firstName})`);
validate('Test 6', body6);
console.log('   (Expected to fail — empty string with min(1). Fix: also strip empty strings)');

// Test 7: verify that filtering empty strings too fixes it
console.log('\n── Test 7: Strip empty strings too (the complete fix) ───────────────────');
const body7 = Object.fromEntries(
  Object.entries({ ...simulateSaveAndAdvance(t1, false) })
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
);
validate('Test 7 (fresh member, strip null + empty string)', body7);

const body7b = Object.fromEntries(
  Object.entries({ ...simulateSaveAndAdvance(t6, false) })
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
);
validate('Test 7b (empty firstName, strip null + empty string)', body7b);

// Test 8: businessEstablishedOn as Date object
console.log('\n── Test 8: businessEstablishedOn as Date object ─────────────────────────');
const profileWithEstDate = {
  ...freshMemberProfile,
  businessEstablishedOn: new Date('2020-03-01T00:00:00.000Z'),
};
const t8 = initProfile(profileWithEstDate);
const body8 = simulateSaveAndAdvance(t8, true);
console.log(`   businessEstablishedOn: ${JSON.stringify(body8.businessEstablishedOn)} (type: ${typeof body8.businessEstablishedOn})`);
validate('Test 8', body8);

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('Done');
console.log('══════════════════════════════════════════════════════════════════════\n');
