import { beforeEach, describe, expect, it, vi } from 'vitest';

// PATCH /api/onboarding (save a wizard step) and POST /api/onboarding/submit,
// by the member's onboarding state. A member can edit their details whenever
// the wizard shows the form (incl. verified and no status); a verified member
// finishing the wizard is not sent back for review.

vi.mock('../../config/env.js', () => ({ env: {} }));
vi.mock('../../lib/memberProfileExtras.js', () => ({
  readProfileExtras: vi.fn(async () => ({})),
  writeProfileExtras: vi.fn(async () => {}),
}));
vi.mock('../../lib/memberModuleAccess.js', () => ({ invalidateMemberModuleAccess: vi.fn() }));
vi.mock('../../lib/adminNotifications.js', () => ({ createAdminNotification: vi.fn(async () => {}) }));

const onboarding = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000c1';
let member: Record<string, any> | null;
let updates: any[];
let emitted: any[];

function server() {
  return {
    prisma: {
      member: {
        findUnique: vi.fn(async () => member),
        update: vi.fn(async ({ data }: any) => { updates.push(data); Object.assign(member!, data); return member; }),
      },
      kycDocument: { count: vi.fn(async () => 1) },
      $queryRawUnsafe: vi.fn(async () => []),
    },
    io: { to: () => ({ emit: (...a: any[]) => emitted.push(a) }) },
    redis: null,
    log: { info() {}, warn() {}, error() {} },
  };
}
async function call(handler: (req: any, reply: any) => any, body: unknown = {}) {
  const res: { status: number; body?: any } = { status: 200 };
  const reply: any = { status(c: number) { res.status = c; return reply; }, send(b: any) { res.body = b; return reply; } };
  await handler({ memberId: ME, body, server: server(), log: { info() {}, warn() {}, error() {} } }, reply);
  return res;
}

beforeEach(() => {
  member = { id: ME, verificationStatus: 'awaiting_kyc', firstName: 'Kavi', lastName: 'R', phone: '9000000001' };
  updates = [];
  emitted = [];
});

describe('PATCH /api/onboarding — who can save their details', () => {
  for (const status of ['awaiting_kyc', 'changes_requested', 'verified', null]) {
    it(`saves for a member who is ${status ?? 'without an onboarding status'}`, async () => {
      member!.verificationStatus = status;
      const r = await call(onboarding.updateOnboardingHandler, { businessName: 'Kavi Crafts', city: 'Madurai' });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(updates).toEqual([expect.objectContaining({ businessName: 'Kavi Crafts', city: 'Madurai' })]);
    });
  }

  for (const status of ['under_review', 'rejected']) {
    it(`still refuses while ${status}, and saves nothing`, async () => {
      member!.verificationStatus = status;
      const r = await call(onboarding.updateOnboardingHandler, { businessName: 'X' });
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('Onboarding cannot be edited in its current state');
      expect(updates).toHaveLength(0);
    });
  }

  it('a member still cannot change admin-only fields (status, verificationStatus, plan)', async () => {
    member!.verificationStatus = 'verified';
    const r = await call(onboarding.updateOnboardingHandler, {
      businessName: 'Kavi Crafts', verificationStatus: 'awaiting_kyc', status: 'active', membershipPlan: 'premium',
    });
    expect(r.status).toBe(400); // the member schema is strict: admin-only keys are refused, nothing saved
    expect(updates).toHaveLength(0);
    expect(member!.verificationStatus).toBe('verified');
  });
});

describe('POST /api/onboarding/submit', () => {
  it('a verified member finishing the wizard is confirmed as saved — no new review, no admin alert', async () => {
    member!.verificationStatus = 'verified';
    const r = await call(onboarding.submitOnboardingHandler);
    expect(r.status).toBe(200);
    expect(r.body.data.verificationStatus).toBe('verified');
    expect(updates).toHaveLength(0);
    expect(emitted).toHaveLength(0);
  });

  for (const status of ['under_review', 'rejected', null]) {
    it(`cannot submit while ${status ?? 'without an onboarding status'} (unchanged)`, async () => {
      member!.verificationStatus = status;
      const r = await call(onboarding.submitOnboardingHandler);
      expect(r.status).toBe(403);
      expect(updates).toHaveLength(0);
    });
  }

  it('awaiting_kyc with missing required fields is still asked to complete them (unchanged)', async () => {
    const r = await call(onboarding.submitOnboardingHandler);
    expect(r.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  describe('profile photo is mandatory', () => {
    const complete = { businessName: 'Kavi Crafts', productServiceType: 'Retail', city: 'Madurai', state: 'Tamil Nadu' };

    it('everything complete except the photo → refused with "Profile photo is required.", nothing changes', async () => {
      Object.assign(member!, complete, { profilePhotoUrl: null });
      const r = await call(onboarding.submitOnboardingHandler);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Profile photo is required. Please upload your photo before submitting.');
      expect(r.body.data).toMatchObject({ missingFields: ['profilePhotoUrl'], hasProfilePhoto: false });
      expect(updates).toHaveLength(0);
      expect(member!.verificationStatus).toBe('awaiting_kyc');
      expect(emitted).toHaveLength(0);
    });

    it('a blank or non-URL photo value does not count', async () => {
      for (const photo of ['', '   ', 'photo.jpg']) {
        Object.assign(member!, complete, { profilePhotoUrl: photo });
        expect((await call(onboarding.submitOnboardingHandler)).status).toBe(400);
      }
      expect(updates).toHaveLength(0);
    });

    it('other fields missing too → the general message mentions the photo', async () => {
      member!.profilePhotoUrl = null;
      const r = await call(onboarding.submitOnboardingHandler);
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/including your profile photo/);
      expect(r.body.data.missingFields[0]).toBe('profilePhotoUrl');
    });

    it('with a saved photo the application goes to review', async () => {
      Object.assign(member!, complete, { profilePhotoUrl: 'https://cdn.example.test/members/m/photo.jpg' });
      const r = await call(onboarding.submitOnboardingHandler);
      expect(r.status).toBe(200);
      expect(member!.verificationStatus).toBe('under_review');
      expect(member!.profilePhotoUrl).toBe('https://cdn.example.test/members/m/photo.jpg'); // untouched
    });

    it('a verified member without a photo is not forced to add one (no new review)', async () => {
      Object.assign(member!, { verificationStatus: 'verified', profilePhotoUrl: null });
      const r = await call(onboarding.submitOnboardingHandler);
      expect(r.status).toBe(200);
      expect(updates).toHaveLength(0);
    });
  });
});
