import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/user-batch/spend-coins (coin-bought batch task lifeline) against an
// in-memory ledger. The price is the server's, the debit and the grant commit
// together, and the per-member wallet lock serialises parallel spends — the
// fake transaction honours pg_advisory_xact_lock with a mutex held until commit.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const batch = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000b1';
const OTHER = '50000000-0000-4000-8000-0000000000b2';
const BATCH = '50000000-0000-4000-8000-0000000000c1';
const TASK = '50000000-0000-4000-8000-0000000000d1';

let ledger: Array<{ memberId: string; points: number; source: string }>;
let usages: Array<{ memberId: string; batchId: string | null; taskId: string | null; day: number | null; coins: number }>;
let timerResets: Array<{ memberId: string; taskId: string; batchId: string; day: number }>;
let failUsageInsert: boolean;
const locks = new Map<string, Promise<void>>();

function makeTx(held: Array<() => void>, pending: { ledger: typeof ledger; usages: typeof usages; resets: typeof timerResets }) {
  const mine = new Set<string>();
  const run = async (text: string, ...a: any[]): Promise<any> => {
    const q = text.replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT pg_advisory_xact_lock(hashtext($1))')) {
      if (mine.has(a[0])) return []; // re-entrant within one transaction, as in Postgres
      while (locks.has(a[0])) await locks.get(a[0]);
      mine.add(a[0]);
      let release!: () => void;
      locks.set(a[0], new Promise<void>((r) => { release = r; }));
      held.push(() => { locks.delete(a[0]); release(); });
      return [];
    }
    if (q.startsWith('SELECT COALESCE(SUM(points), 0)::bigint AS balance FROM tbt_activity_log WHERE member_id = $1::uuid')) {
      await Promise.resolve(); // let parallel requests interleave
      const sum = [...ledger, ...pending.ledger].filter((r) => r.memberId === a[0]).reduce((n, r) => n + r.points, 0);
      return [{ balance: BigInt(sum) }];
    }
    if (q.startsWith('INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date) VALUES ($1::uuid, $2, $3, $4::uuid, NOW()::DATE)')) {
      pending.ledger.push({ memberId: a[0], points: a[1], source: a[2] });
      return 1;
    }
    if (q.startsWith('INSERT INTO lifeline_usages (member_id, batch_id, task_id, day_number, coins_spent) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)')) {
      if (failUsageInsert) throw new Error('column "batch_id" is of type uuid but expression is of type text');
      pending.usages.push({ memberId: a[0], batchId: a[1], taskId: a[2], day: a[3], coins: a[4] });
      return 1;
    }
    if (q.startsWith('UPDATE task_submissions SET timer_started_at = NOW(), submitted_after_expiry = FALSE')) {
      pending.resets.push({ memberId: a[0], taskId: a[1], batchId: a[2], day: a[3] });
      return 1;
    }
    throw new Error(`unhandled SQL: ${q.slice(0, 90)}`);
  };
  return { $queryRawUnsafe: run, $executeRawUnsafe: run };
}

const prisma: any = {
  member: { findUnique: async ({ where }: any) => ({ batchId: where.id === ME || where.id === OTHER ? BATCH : null }) },
  async $transaction(fn: (tx: any) => Promise<any>) {
    const held: Array<() => void> = [];
    const pending = { ledger: [] as typeof ledger, usages: [] as typeof usages, resets: [] as typeof timerResets };
    try {
      const out = await fn(makeTx(held, pending));
      ledger.push(...pending.ledger); usages.push(...pending.usages); timerResets.push(...pending.resets); // commit
      return out;
    } finally {
      held.forEach((release) => release());
    }
  },
};

async function spend(body: any, memberId = ME) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { memberId, body, server: { prisma, redis: null }, log: { error() {} } };
  try {
    await batch.spendCoinsHandler(req, reply);
  } catch (err) {
    sent.status = 500; sent.body = String(err);
  }
  return sent;
}
const balanceOf = (m: string) => ledger.filter((r) => r.memberId === m).reduce((n, r) => n + r.points, 0);

beforeEach(() => {
  locks.clear();
  failUsageInsert = false;
  usages = [];
  timerResets = [];
  ledger = [{ memberId: ME, points: 120, source: 'coin_purchase' }, { memberId: OTHER, points: 30, source: 'course_xp' }];
});

describe('POST /api/user-batch/spend-coins', () => {
  it('charges the server price, records the lifeline and restarts the task timer', async () => {
    const r = await spend({ amount: 50, taskId: TASK, dayNumber: 3 });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ remainingCoins: 70, coinsSpent: 50 });
    expect(ledger.at(-1)).toEqual({ memberId: ME, points: -50, source: 'lifeline_spend' });
    expect(usages).toEqual([{ memberId: ME, batchId: BATCH, taskId: TASK, day: 3, coins: 50 }]);
    expect(timerResets).toEqual([{ memberId: ME, taskId: TASK, batchId: BATCH, day: 3 }]);
  });

  it('charges the server price when an older client omits amount', async () => {
    const r = await spend({ taskId: TASK, dayNumber: 1 });
    expect(r.status).toBe(200);
    expect(balanceOf(ME)).toBe(70);
  });

  it('refuses a client-chosen price instead of charging it', async () => {
    for (const amount of [1, 0, -50, 500, '50']) {
      const r = await spend({ amount, taskId: TASK, dayNumber: 1 });
      expect(r.status).toBe(409);
    }
    expect(balanceOf(ME)).toBe(120);
    expect(usages).toHaveLength(0);
  });

  it('refuses a malformed taskId before touching the wallet', async () => {
    const r = await spend({ amount: 50, taskId: "x' OR 1=1", dayNumber: 1 });
    expect(r.status).toBe(400);
    expect(balanceOf(ME)).toBe(120);
  });

  it('insufficient balance: 400, no debit and no lifeline', async () => {
    const r = await spend({ amount: 50, taskId: TASK, dayNumber: 1 }, OTHER);
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('You have 30 coins but need 50');
    expect(balanceOf(OTHER)).toBe(30);
    expect(usages).toHaveLength(0);
    expect(timerResets).toHaveLength(0);
  });

  it('a failure while granting rolls the debit back (member is never charged for nothing)', async () => {
    failUsageInsert = true;
    const r = await spend({ amount: 50, taskId: TASK, dayNumber: 1 });
    expect(r.status).toBe(500);
    expect(balanceOf(ME)).toBe(120);
  });

  it('parallel purchases cannot overspend: 120 coins buy exactly two 50-coin lifelines', async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, () => spend({ amount: 50, taskId: TASK, dayNumber: 1 })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(2);
    expect(rs.filter((r) => r.status === 400)).toHaveLength(6);
    expect(balanceOf(ME)).toBe(20);
    expect(usages).toHaveLength(2);
  });

  it("one member's spend never touches another member's wallet", async () => {
    await spend({ amount: 50, taskId: TASK, dayNumber: 1 });
    expect(balanceOf(OTHER)).toBe(30);
  });
});
