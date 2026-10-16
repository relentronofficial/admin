import { beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real mentorship handlers with a fake Prisma client to prove the
// demo overlay is isolated to the configured member, never writes, and turns
// off cleanly when the configuration is removed.

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_EMAIL = 'demo@example.com';

const envMock = vi.hoisted(() => ({
  env: { MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } as Record<string, string | undefined>,
}));
vi.mock('../../config/env.js', () => envMock);

const {
  getMentorshipStatsHandler,
  getMentorshipRevenueHandler,
  upsertMentorshipRevenueHandler,
  getMentorshipSocialHandler,
  upsertMentorshipSocialHandler,
} = await import('./controller.js');

const REAL_REVENUE_ROW = { revenue_generated: 1000, number_of_orders: 3, daily_revenue: [1000], updated_at: null };
const REAL_SOCIAL_ROW = { total_followers: 50, updated_at: null };
const EMAILS = { [TARGET_ID]: TARGET_EMAIL, [OTHER_ID]: 'other@example.com' };

function harness(memberId: string, emails: Record<string, string> = EMAILS) {
  const queryRaw = vi.fn(async (sql: string) => {
    if (sql.includes('member_revenue_reports')) return [REAL_REVENUE_ROW];
    if (sql.includes('member_social_reports')) return [REAL_SOCIAL_ROW];
    return [];
  });
  const executeRaw = vi.fn(async () => 0);
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) =>
    emails[where.id] ? { id: where.id, email: emails[where.id], batchId: null } : null);
  const request: any = {
    memberId,
    body: { revenueGenerated: 1000, totalFollowers: 50 },
    server: {
      prisma: {
        $queryRawUnsafe: queryRaw,
        $executeRawUnsafe: executeRaw,
        member: { findUnique },
        batch: { findUnique: vi.fn(async () => null) },
        courseStreak: { findUnique: vi.fn(async () => ({ currentStreak: 3 })) },
      },
      redis: null,
    },
  };
  const sent: { body?: any; headers: Record<string, string> } = { headers: {} };
  const reply: any = {
    header: (k: string, v: string) => { sent.headers[k] = v; return reply; },
    status: () => reply,
    code: () => reply,
    send: (b: any) => { sent.body = b; return reply; },
  };
  const dbWrites = () =>
    queryRaw.mock.calls.filter(([sql]) => /\b(INSERT|UPDATE|DELETE)\b/i.test(String(sql))).length +
    executeRaw.mock.calls.length;
  return { request, reply, sent, queryRaw, findUnique, dbWrites };
}

beforeEach(() => {
  envMock.env.MENTORSHIP_DEMO_MEMBER_ID = TARGET_ID;
  envMock.env.MENTORSHIP_DEMO_EMAIL = TARGET_EMAIL;
});

describe('demo mode on — isolation', () => {
  it('serves demo revenue and social to the configured member, marked with x-tbt-demo', async () => {
    const rev = harness(TARGET_ID);
    await getMentorshipRevenueHandler(rev.request, rev.reply);
    expect(rev.sent.headers['x-tbt-demo']).toBe('mentorship');
    expect(rev.sent.body.data.revenueGenerated).toBe(499900);
    expect(rev.queryRaw).not.toHaveBeenCalled(); // real rows not even read

    const soc = harness(TARGET_ID);
    await getMentorshipSocialHandler(soc.request, soc.reply);
    expect(soc.sent.headers['x-tbt-demo']).toBe('mentorship');
    expect(soc.sent.body.data.totalFollowers).toBe(12450);
  });

  it('serves real data to every other member and never looks up the demo config for them', async () => {
    const h = harness(OTHER_ID);
    await getMentorshipRevenueHandler(h.request, h.reply);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.revenueGenerated).toBe(1000);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it('does not enable demo when the target id now has a different email', async () => {
    const h = harness(TARGET_ID, { [TARGET_ID]: 'changed@example.com' });
    await getMentorshipSocialHandler(h.request, h.reply);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.totalFollowers).toBe(50);
  });

  it('leaves /mentorship/stats real for the demo member (kept consistent with streak, graph and courses)', async () => {
    const h = harness(TARGET_ID);
    await getMentorshipStatsHandler(h.request, h.reply);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.streakDays).toBe(3); // the real courseStreak value
    expect(h.sent.body.data.tasksCompleted).toBe(0);
  });
});

describe('demo saves never modify real records', () => {
  it('PUT revenue / PUT social for the demo member issue no database statement at all', async () => {
    const h = harness(TARGET_ID);
    await upsertMentorshipRevenueHandler(h.request, h.reply);
    expect(h.sent.body.data.revenueGenerated).toBe(499900);
    await upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.sent.body.data.totalFollowers).toBe(12450);
    expect(h.queryRaw).not.toHaveBeenCalled();
    expect(h.dbWrites()).toBe(0);
  });

  it('other members\' saves still write normally while demo mode is on', async () => {
    const h = harness(OTHER_ID);
    await upsertMentorshipRevenueHandler(h.request, h.reply);
    await upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.dbWrites()).toBe(2);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
  });
});

describe('demo configuration removed', () => {
  const removals: Array<[string, Partial<Record<'MENTORSHIP_DEMO_MEMBER_ID' | 'MENTORSHIP_DEMO_EMAIL', string | undefined>>]> = [
    ['both unset', { MENTORSHIP_DEMO_MEMBER_ID: undefined, MENTORSHIP_DEMO_EMAIL: undefined }],
    ['member id removed', { MENTORSHIP_DEMO_MEMBER_ID: '' }],
    ['email removed', { MENTORSHIP_DEMO_EMAIL: '' }],
    ['blank values', { MENTORSHIP_DEMO_MEMBER_ID: '  ', MENTORSHIP_DEMO_EMAIL: '  ' }],
  ];

  for (const [label, change] of removals) {
    it(`${label}: the former demo member gets their real data back and can save again`, async () => {
      Object.assign(envMock.env, change);

      const rev = harness(TARGET_ID);
      await getMentorshipRevenueHandler(rev.request, rev.reply);
      expect(rev.sent.headers['x-tbt-demo']).toBeUndefined();
      expect(rev.sent.body.data.revenueGenerated).toBe(1000);
      expect(rev.findUnique).not.toHaveBeenCalled();

      const soc = harness(TARGET_ID);
      await getMentorshipSocialHandler(soc.request, soc.reply);
      expect(soc.sent.body.data.totalFollowers).toBe(50);

      const save = harness(TARGET_ID);
      await upsertMentorshipRevenueHandler(save.request, save.reply);
      await upsertMentorshipSocialHandler(save.request, save.reply);
      expect(save.dbWrites()).toBe(2);
    });
  }
});
