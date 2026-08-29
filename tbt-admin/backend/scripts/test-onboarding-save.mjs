// Automated test for the self-onboarding PATCH endpoint.
// Simulates exactly what the frontend saveAndAdvance() does and reports errors.
//
// Run: node scripts/test-onboarding-save.mjs (from tbt-admin/backend/)
// Requires: backend/.env with DATABASE_URL, JWT_ACCESS_SECRET, API_URL (optional)

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:8000';

// ── Step 1: find a pending member in awaiting_kyc or changes_requested state ──
const member = await prisma.$queryRawUnsafe(`
  SELECT id, first_name AS "firstName", last_name AS "lastName",
         phone, email, verification_status AS "verificationStatus"
  FROM members
  WHERE verification_status IN ('awaiting_kyc', 'changes_requested')
  ORDER BY created_at DESC
  LIMIT 1
`);

if (!member[0]) {
  console.error('❌  No member in awaiting_kyc or changes_requested state found.');
  console.log('   Create a test account first with: node scripts/prep-test-account.mjs');
  process.exit(1);
}
const m = member[0];
console.log(`\n✅  Found test member: ${m.firstName} ${m.lastName ?? ''} (${m.phone})`);
console.log(`   verificationStatus: ${m.verificationStatus}`);

// ── Step 2: mint a JWT ──
const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) { console.error('❌  JWT_ACCESS_SECRET missing'); process.exit(1); }
const token = jwt.sign({ memberId: m.id }, secret, { expiresIn: '2h' });
console.log(`\n✅  JWT minted for member ${m.id}`);

// ── Step 3: GET /api/onboarding — fetch their current state ──
console.log(`\n── GET ${API_URL}/api/onboarding ──────────────────────────────────`);
const getRes = await fetch(`${API_URL}/api/onboarding`, {
  headers: { Cookie: `tbt_access=${token}` },
});
const getBody = await getRes.json();
if (!getRes.ok || !getBody.success) {
  console.error(`❌  GET failed (${getRes.status}): ${JSON.stringify(getBody)}`);
  process.exit(1);
}
const state = getBody.data;
console.log(`✅  GET succeeded — verificationStatus: ${state.verificationStatus}`);
console.log(`   Profile keys returned: ${Object.keys(state.profile).join(', ')}`);

const profile = { ...state.profile };
// Decompose currentChallenges exactly as the frontend does
if (Array.isArray(profile.currentChallenges)) {
  profile.challenge1 = profile.currentChallenges[0] ?? '';
  profile.challenge2 = profile.currentChallenges[1] ?? '';
  profile.challenge3 = profile.currentChallenges[2] ?? '';
  delete profile.currentChallenges;
}
if (!Array.isArray(profile.marketingChannels)) {
  profile.marketingChannels = [];
}

// ── Step 4: simulate saveAndAdvance() body construction ──
console.log('\n── Simulating saveAndAdvance() body construction ───────────────────');

// Old logic (BEFORE the null filter fix — to reproduce original error)
const { phone: _p, email: _e, challenge1, challenge2, challenge3, ...editable } = profile;
const currentChallenges = [challenge1, challenge2, challenge3].filter(Boolean);
const bodyWithNulls = { ...editable, currentChallenges };

// New logic (AFTER the null filter fix)
const bodyFiltered = Object.fromEntries(
  Object.entries({ ...editable, currentChallenges }).filter(([, v]) => v !== null && v !== undefined)
);

// Find which keys are null/undefined and being stripped
const nullKeys = Object.entries({ ...editable, currentChallenges })
  .filter(([, v]) => v === null || v === undefined)
  .map(([k]) => k);
console.log(`   Keys with null/undefined (to be stripped): ${nullKeys.length > 0 ? nullKeys.join(', ') : '(none)'}`);

// Find what's in filtered body
console.log(`   Keys in filtered body: ${Object.keys(bodyFiltered).join(', ')}`);

// Check for empty strings that Zod might reject
const emptyStringKeys = Object.entries(bodyFiltered)
  .filter(([, v]) => v === '')
  .map(([k]) => k);
if (emptyStringKeys.length > 0) {
  console.warn(`⚠️   Empty string values (may fail z.string().min(1)): ${emptyStringKeys.join(', ')}`);
}

// Check for unknown keys (not in schema)
const SCHEMA_KEYS = new Set([
  'firstName', 'lastName', 'dob', 'gender', 'profilePhotoUrl',
  'city', 'state', 'pincode', 'businessName', 'businessType',
  'businessEstablishedOn', 'productServiceType', 'instagramLink',
  'annualTurnover', 'goalAfter90Days', 'preferredSessionMode', 'gstNumber',
  'marketingChannels', 'marketingChannelName', 'hasMarketingTeam',
  'marketingTeamDetails', 'hasVideoEditing', 'videoEditingDetails',
  'domainHostingDetails', 'businessAddress', 'sector', 'industry',
  'subIndustry', 'businessStage', 'currentChallenges',
  'hasWebsite', 'weeklyWebsiteOrders',
  'skillBusinessFoundation', 'skillContent', 'skillFunnels',
  'skillAds', 'skillSales', 'skillOverallMarketing',
  'weeklyLearningHours', 'teamSize', 'businessStartedFrom',
  'instagramStats', 'facebookStats', 'websiteUrl', 'revenueGoalAfterTbt',
]);

const unknownKeys = Object.keys(bodyFiltered).filter(k => !SCHEMA_KEYS.has(k));
if (unknownKeys.length > 0) {
  console.error(`❌  UNKNOWN KEYS (will be rejected by .strict()): ${unknownKeys.join(', ')}`);
} else {
  console.log('✅  All keys in filtered body are in the schema');
}

// ── Step 5: PATCH with old body (no null filter) ──
console.log('\n── PATCH with original body (null values included) ─────────────────');
const patchOldRes = await fetch(`${API_URL}/api/onboarding`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: `tbt_access=${token}` },
  body: JSON.stringify(bodyWithNulls),
});
const patchOldBody = await patchOldRes.json();
if (!patchOldRes.ok) {
  console.error(`❌  FAILED (${patchOldRes.status}): ${patchOldBody.error}`);
  console.log('   This is the bug the fix targets.');
} else {
  console.log(`✅  Succeeded (${patchOldRes.status}) — even with nulls (this means null filter isn't needed, root cause is elsewhere)`);
}

// ── Step 6: PATCH with filtered body (null filter applied) ──
console.log('\n── PATCH with filtered body (null values stripped) ──────────────────');
const patchNewRes = await fetch(`${API_URL}/api/onboarding`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: `tbt_access=${token}` },
  body: JSON.stringify(bodyFiltered),
});
const patchNewBody = await patchNewRes.json();
if (!patchNewRes.ok) {
  console.error(`❌  STILL FAILING (${patchNewRes.status}): ${patchNewBody.error}`);
  console.log('   Full error:', JSON.stringify(patchNewBody, null, 2));
} else {
  console.log(`✅  Succeeded (${patchNewRes.status}) — fix is working!`);
}

// ── Step 7: check Zod validation locally ──
console.log('\n── Local Zod validation check ───────────────────────────────────────');
// Inline the schema check so we don't need to import compiled backend code
const ENUM_FIELDS = {
  gender: ['male', 'female', 'other', 'prefer_not_to_say'],
  preferredSessionMode: ['online', 'offline', 'hybrid'],
  businessStage: ['idea', 'startup', 'growth', 'scaling'],
};
const MIN1_STRING_FIELDS = ['firstName'];
let zodErrors = [];

for (const [key, value] of Object.entries(bodyFiltered)) {
  if (!SCHEMA_KEYS.has(key)) {
    zodErrors.push(`Unrecognised key: "${key}" (rejected by .strict())`);
    continue;
  }
  if (value === null || value === undefined) {
    zodErrors.push(`Key "${key}" is null/undefined — should have been filtered`);
    continue;
  }
  if (ENUM_FIELDS[key] && !ENUM_FIELDS[key].includes(value)) {
    zodErrors.push(`Key "${key}" has invalid enum value: "${value}" (valid: ${ENUM_FIELDS[key].join(', ')})`);
  }
  if (MIN1_STRING_FIELDS.includes(key) && value === '') {
    zodErrors.push(`Key "${key}" is empty string, but schema requires min(1)`);
  }
}

if (zodErrors.length > 0) {
  console.error('❌  Predicted Zod issues:');
  zodErrors.forEach(e => console.error(`   • ${e}`));
} else {
  console.log('✅  Local schema check passed — no predicted Zod errors');
}

console.log('\n── Summary ──────────────────────────────────────────────────────────');
console.log('Done.\n');
await prisma.$disconnect();
