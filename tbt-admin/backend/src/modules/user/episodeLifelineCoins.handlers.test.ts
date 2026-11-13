import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/user/episodes/:id/lifelines/use { type: 'coin' } against an in-memory
// ledger + episode_lifeline_state. The episode's own coin price is charged, the
// purchase cap is re-checked under the wallet lock, and parallel requests can
// neither overspend nor pass max_purchased_lifelines. The fake transaction
// honours pg_advisory_xact_lock with a mutex held until commit.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000e1';
const OTHER = '50000000-0000-4000-8000-0000000000e2';
const EP = '50000000-0000-4000-8000-0000000000f1';

let ledger: Array<{ memberId: string; points: number }>;
let purchased: Map<string, number>;
let cfg: { lifelineEnabled: boolean; lifelineCount: number; lifelineCoinCost: number; maxPurchasedLifelines: number };
const locks = new Map<string, Promise<void>>();

function runner(held: Array<() => void> | null, pending: { ledger: typeof ledger; bought: Map<string, number> } | null) {
  const mine = new Set<string>();
  return async (text: string, ...a: any[]): Promise<any> => {
    const q = text.replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT lifeline_enabled AS "lifelineEnabled"')) return [cfg];
    if (q.startsWith('SELECT free_used AS "freeUsed", purchased_used AS "purchasedUsed"')) {
      return [{ freeUsed: 0, purchasedUsed: purchased.get(a[0]) ?? 0, totalUsed: purchased.get(a[0]) ?? 0 }];
    }
    if (q.startsWith('SELECT pg_advisory_xact_lock(hashtext($1))')) {
      if (mine.has(a[0])) return []; // re-entrant within one transaction, as in Postgres
      while (locks.has(a[0])) await locks.get(a[0]);
      mine.add(a[0]);
      let release!: () => void;
      locks.set(a[0], new Promise<void>((r) => { release = r; }));
      held!.push(() => { locks.delete(a[0]); release(); });
      return [];
    }
    if (q.startsWith('SELECT purchased_used AS "purchasedUsed" FROM episode_lifeline_state')) {
      await Promise.resolve();
      return [{ purchasedUsed: (purchased.get(a[0]) ?? 0) + (pending!.bought.get(a[0]) ?? 0) }];
    }
    if (q.startsWith('SELECT COALESCE(SUM(points), 0)::bigint AS balance FROM tbt_activity_log')) {
      await Promise.resolve();
      const sum = [...ledger, ...pending!.ledger].filter((r) => r.memberId === a[0]).reduce((n, r) => n + r.points, 0);
      return [{ balance: BigInt(sum) }];
    }
    if (q.startsWith('INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)')) {
      pending!.ledger.push({ memberId: a[0], points: a[1] });
      return 1;
    }
    if (q.startsWith('INSERT INTO episode_lifeline_state (member_id, episode_id, purchased_used, total_used, updated_at)')) {
      const n = (purchased.get(a[0]) ?? 0) + (pending!.bought.get(a[0]) ?? 0) + 1;
      pending!.bought.set(a[0], (pending!.bought.get(a[0]) ?? 0) + 1);
      return [{ freeUsed: 0, totalUsed: n }];
    }
    throw new Error(`unhandled SQL: ${q.slice(0, 90)}`);
  };
}

const prisma: any = {
  $queryRawUnsafe: runner(null, null),
  $executeRawUnsafe: runner(null, null),
  async $transaction(fn: (tx: any) => Promise<any>) {
    const held: Array<() => void> = [];
    const pending = { ledger: [] as typeof ledger, bought: new Map<string, number>() };
    const run = runner(held, pending);
    try {
      const out = await fn({ $queryRawUnsafe: run, $executeRawUnsafe: run });
      ledger.push(...pending.ledger);
      for (const [m, n] of pending.bought) purchased.set(m, (purchased.get(m) ?? 0) + n);
      return out;
    } finally {
      held.forEach((release) => release());
    }
  },
};

async function buy(memberId = ME, type: string = 'coin') {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { memberId, params: { id: EP }, body: { type }, server: { prisma, redis: null }, log: { error() {} } };
  await user.useEpisodeLifelineHandler(req, reply);
  return sent;
}
const balanceOf = (m: string) => ledger.filter((r) => r.memberId === m).reduce((n, r) => n + r.points, 0);

beforeEach(() => {
  locks.clear();
  cfg = { lifelineEnabled: true, lifelineCount: 3, lifelineCoinCost: 30, maxPurchasedLifelines: 2 };
  purchased = new Map();
  ledger = [{ memberId: ME, points: 100 }, { memberId: OTHER, points: 10 }];
});

describe('POST /api/user/episodes/:id/lifelines/use (coin)', () => {
  it("charges the episode's configured price and grants one lifeline", async () => {
    const r = await buy();
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ coinsDeducted: 30, remainingCoins: 70, totalUsed: 1 });
    expect(balanceOf(ME)).toBe(70);
    expect(purchased.get(ME)).toBe(1);
  });

  it('insufficient balance: 400, no debit, no lifeline', async () => {
    const r = await buy(OTHER);
    expect(r.status).toBe(400);
    expect(balanceOf(OTHER)).toBe(10);
    expect(purchased.get(OTHER)).toBeUndefined();
  });

  it('parallel purchases stop at the cap and never overspend', async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => buy()));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(2);
    expect(purchased.get(ME)).toBe(2);
    expect(balanceOf(ME)).toBe(40);
  });

  it('parallel purchases on a thin balance never go negative', async () => {
    cfg.maxPurchasedLifelines = 10;
    const rs = await Promise.all(Array.from({ length: 6 }, () => buy()));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(3);
    expect(balanceOf(ME)).toBe(10);
  });

  it('an unknown lifeline type is rejected rather than treated as a coin purchase', async () => {
    const r = await buy(ME, 'gift');
    expect(r.status).toBe(400);
    expect(balanceOf(ME)).toBe(100);
  });
});
