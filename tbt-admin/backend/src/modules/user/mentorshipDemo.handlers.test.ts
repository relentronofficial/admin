import { beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real mentorship handlers with a fake Prisma client to prove the
// demo overlay is isolated to the configured member and never writes.

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_EMAIL = 'demo@example.com';

const envMock = vi.hoisted(() => ({
  env: { MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } as Record<string, string>,
}));
vi.mock('../../config/env.js', () => envMock);

const {
  getMentorshipRevenueHandler,
  upsertMentorshipRevenueHandler,
  getMentorshipSocialHandler,
  upsertMentorshipSocialHandler,
} = await import('./controller.js');

const REAL_REVENUE_ROW = { revenue_generated: 1000, number_of_orders: 3, daily_revenue: [1000], updated_at: null };
const REAL_SOCIAL_ROW = { total_followers: 50, updated_at: null };

function harness(memberId: string, emails: Record<string, string>) {
  const queryRaw = vi.fn(async (sql: string) => {
    if (sql.includes('FROM member_revenue_reports') || sql.includes('INSERT INTO member_revenue_reports')) return [REAL_REVENUE_ROW];
    if (sql.includes('FROM member_social_reports') || sql.includes('INSERT INTO member_social_reports')) return [REAL_SOCIAL_ROW];
    return [];
  });
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) =>
    emails[where.id] ? { id: where.id, email: emails[where.id] } : null);
  const request: any = {
    memberId,
    body: { revenueGenerated: 1000, totalFollowers: 50 },
    server: { prisma: { $queryRawUnsafe: queryRaw, member: { findUnique } }, redis: null },
  };
  const sent: { body?: any; headers: Record<string, string> } = { headers: {} };
  const reply: any = {
    header: (k: string, v: string) => { sent.headers[k] = v; return reply; },
    status: () => reply,
    code: () => reply,
    send: (b: any) => { sent.body = b; return reply; },
  };
  const writes = () => queryRaw.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO')).length;
  return { request, reply, sent, queryRaw, findUnique, writes };
}

const EMAILS = { [TARGET_ID]: TARGET_EMAIL, [OTHER_ID]: 'other@example.com' };

beforeEach(() => {
  envMock.env.MENTORSHIP_DEMO_MEMBER_ID = TARGET_ID;
  envMock.env.MENTORSHIP_DEMO_EMAIL = TARGET_EMAIL;
});

describe('mentorship demo mode — handler isolation', () => {
  it('serves demo revenue to the configured member, marked with x-tbt-demo', async () => {
    const h = harness(TARGET_ID, EMAILS);
    await getMentorshipRevenueHandler(h.request, h.reply);
    expect(h.sent.headers['x-tbt-demo']).toBe('mentorship');
    expect(h.sent.body.data.revenueGenerated).toBe(499900);
    expect(h.queryRaw).not.toHaveBeenCalled(); // real rows not even read
  });

  it('serves real data to every other member and never looks up the demo config for them', async () => {
    const h = harness(OTHER_ID, EMAILS);
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

  it('demo-mode saves do not write the member\'s real revenue or social rows', async () => {
    const h = harness(TARGET_ID, EMAILS);
    await upsertMentorshipRevenueHandler(h.request, h.reply);
    await upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.writes()).toBe(0);
    expect(h.sent.body.data.totalFollowers).toBe(12450);
  });

  it('other members\' saves still write normally', async () => {
    const h = harness(OTHER_ID, EMAILS);
    await upsertMentorshipRevenueHandler(h.request, h.reply);
    await upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.writes()).toBe(2);
  });

  it('unsetting the config restores the real view for the target member', async () => {
    envMock.env.MENTORSHIP_DEMO_EMAIL = '';
    const h = harness(TARGET_ID, EMAILS);
    await getMentorshipRevenueHandler(h.request, h.reply);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.revenueGenerated).toBe(1000);
  });
});
