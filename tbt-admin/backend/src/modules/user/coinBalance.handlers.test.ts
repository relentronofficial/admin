import { beforeEach, describe, expect, it, vi } from 'vitest';

// GET /api/user/coins/balance (navbar TBT Coins) against an in-memory
// tbt_activity_log. The balance is the plain ledger sum that every coin spend
// checks (loadCoinBalance): earnings are positive rows, spends negative. Only
// the authenticated member's rows count, and a DB failure is a 503 — never a
// made-up 0.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000a1';
const OTHER = '50000000-0000-4000-8000-0000000000a2';

let ledger: Array<{ memberId: string; points: number; source: string }>;
let dbDown: boolean;

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (dbDown) throw new Error('connection terminated unexpectedly');
  if (q.startsWith('SELECT COALESCE(SUM(points), 0)::bigint AS balance FROM tbt_activity_log WHERE member_id = $1::uuid')) {
    const sum = ledger.filter((r) => r.memberId === a[0]).reduce((n, r) => n + r.points, 0);
    return [{ balance: BigInt(sum) }];
  }
  throw new Error(`unhandled SQL: ${q.slice(0, 80)}`);
}

async function balance(memberId = ME) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = {
    memberId, params: {}, query: {}, headers: {}, body: undefined,
    server: { prisma: { $queryRawUnsafe: sql, $executeRawUnsafe: sql }, redis: null },
    log: { error() {}, warn() {} },
  };
  await user.getCoinBalanceHandler(req, reply);
  return sent;
}

beforeEach(() => {
  dbDown = false;
  ledger = [
    { memberId: ME, points: 200, source: 'coin_purchase' },
    { memberId: ME, points: 10, source: 'course_xp' },
    { memberId: ME, points: -50, source: 'lifeline_spend' },
    { memberId: OTHER, points: 999, source: 'admin_grant' },
  ];
});

describe('GET /api/user/coins/balance', () => {
  it('returns the remaining (spendable) balance: earnings minus spends', async () => {
    const r = await balance();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, data: { balance: 160 } });
  });

  it('reflects a new spend and a new earning on the next read', async () => {
    ledger.push({ memberId: ME, points: -100, source: 'support_call_coin' });
    expect((await balance()).body.data.balance).toBe(60);
    ledger.push({ memberId: ME, points: 25, source: 'course_task' });
    expect((await balance()).body.data.balance).toBe(85);
  });

  it("only counts the authenticated member's own ledger rows", async () => {
    expect((await balance(ME)).body.data.balance).toBe(160);
    expect((await balance(OTHER)).body.data.balance).toBe(999);
  });

  it('a member with no ledger rows has 0', async () => {
    expect((await balance('50000000-0000-4000-8000-0000000000ff')).body.data.balance).toBe(0);
  });

  it('a database failure is a 503 with no balance, not a fabricated 0', async () => {
    dbDown = true;
    const r = await balance();
    expect(r.status).toBe(503);
    expect(r.body.success).toBe(false);
    expect(r.body.data).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(/connection terminated/);
  });
});
