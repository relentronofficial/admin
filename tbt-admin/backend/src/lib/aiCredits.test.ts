import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  AI_CREDITS_DDL, DEFAULT_AI_CREDIT_SETTINGS, aiCreditPackSchema, aiCreditSettingsSchema, costCapUsd, creditAiOrder, creditsForCost,
  adjustAiCredits, aiCreditAdjustSchema, handleAiCreditWebhookEvent, holdFor, loadAiCreditBalance, loadAvailableAiCredits, releaseAiCredits, reserveAiCredits, rupeesToPaise, settleAiCredits,
} from './aiCredits.js';

const MEMBER = '41000000-0000-4000-8000-000000000001';
const OTHER = '41000000-0000-4000-8000-000000000002';

/** In-memory stand-in answering exactly the SQL lib/aiCredits.ts issues. */
function fakeDb(orders: Array<{ id: string; member_id: string; razorpay_order_id: string; credits: number; amount_paise: number; status: string }>) {
  const ledger: Array<{ member_id: string; delta: number; source: string; reference_id: string | null }> = [];
  const holds: Array<{ id: string; member_id: string; credits: number; expired?: boolean }> = [];
  const charged: Record<string, number> = {};
  let nextHold = 1;
  let chain = Promise.resolve();
  const db: any = {
    ledger,
    orders,
    holds,
    charged,
    async $queryRawUnsafe(sql: string, ...v: any[]) {
      if (sql.includes('pg_advisory_xact_lock')) return [{}];
      if (sql.startsWith('SELECT 1 FROM members')) return v[0] === MEMBER || v[0] === OTHER ? [{}] : [];
      if (sql.includes('SELECT -delta AS charged')) return ledger.filter((l) => l.source === 'usage' && l.reference_id === v[0] && l.member_id === v[1]).map((l) => ({ charged: -l.delta }));
      if (sql.includes('created_by)')) {
        if (v[3] && ledger.some((l) => l.source === v[2] && l.reference_id === v[3])) return [];
        ledger.push({ member_id: v[0], delta: v[1], source: v[2], reference_id: v[3] });
        return [{ id: 'a' }];
      }
      if (sql.includes('FROM ai_credit_holds WHERE member_id = $1::uuid AND expires_at > NOW()')) {
        return [{
          balance: ledger.filter((l) => l.member_id === v[0]).reduce((a, l) => a + l.delta, 0),
          held: holds.filter((h) => h.member_id === v[0] && !h.expired).reduce((a, h) => a + h.credits, 0),
        }];
      }
      if (sql.includes('INSERT INTO ai_credit_holds')) {
        const h = { id: `h${nextHold++}`, member_id: v[0], credits: v[1] };
        holds.push(h);
        return [{ id: h.id }];
      }
      if (sql.includes("'usage', $3::uuid")) {
        if (ledger.some((l) => l.source === 'usage' && l.reference_id === v[2])) return [];
        ledger.push({ member_id: v[0], delta: v[1], source: 'usage', reference_id: v[2] });
        return [{ id: 'u' }];
      }
      if (sql.includes('SUM(delta)')) return [{ balance: ledger.filter((l) => l.member_id === v[0]).reduce((a, l) => a + l.delta, 0) }];
      if (sql.startsWith('SELECT 1 FROM ai_credit_orders')) return orders.filter((o) => o.razorpay_order_id === v[0]).map(() => ({ '?column?': 1 }));
      if (sql.includes('FROM ai_credit_orders WHERE razorpay_order_id = $1 FOR UPDATE')) return orders.filter((o) => o.razorpay_order_id === v[0]).map((o) => ({ ...o }));
      if (sql.includes('INSERT INTO ai_credit_ledger')) {
        if (ledger.some((l) => l.source === 'purchase' && l.reference_id === v[2])) return [];
        ledger.push({ member_id: v[0], delta: v[1], source: 'purchase', reference_id: v[2] });
        return [{ id: 'x' }];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    async $executeRawUnsafe(sql: string, ...v: any[]) {
      if (sql.includes('DELETE FROM ai_credit_holds WHERE member_id = $1::uuid AND expires_at <= NOW()')) {
        for (let i = holds.length - 1; i >= 0; i--) if (holds[i].member_id === v[0] && holds[i].expired) holds.splice(i, 1);
        return 0;
      }
      if (sql.includes('DELETE FROM ai_credit_holds WHERE id = $1::uuid')) {
        const i = holds.findIndex((h) => h.id === v[0] && h.member_id === v[1]);
        if (i >= 0) holds.splice(i, 1);
        return i >= 0 ? 1 : 0;
      }
      if (sql.includes('UPDATE help_bot_messages SET credits_charged')) { charged[v[0]] = v[1]; return 1; }
      if (sql.includes("SET status = 'paid'")) { const o = orders.find((x) => x.id === v[0])!; o.status = 'paid'; return 1; }
      if (sql.includes("SET status = 'failed'")) {
        const o = orders.find((x) => x.razorpay_order_id === v[0] && x.status === 'created');
        if (o) o.status = 'failed';
        return o ? 1 : 0;
      }
      throw new Error(`unexpected exec: ${sql}`);
    },
    // Transactions run one at a time, as the FOR UPDATE row lock makes them in Postgres.
    $transaction(fn: (tx: any) => Promise<any>) {
      const run = chain.then(() => fn(db));
      chain = run.then(() => {}, () => {});
      return run;
    },
  };
  return db;
}

const order = (over: Partial<{ status: string; member_id: string }> = {}) => ({
  id: '51000000-0000-4000-8000-000000000001', member_id: MEMBER, razorpay_order_id: 'order_AI1', credits: 900, amount_paise: 9900, status: 'created', ...over,
});
const captured = (amount = 9900, orderId = 'order_AI1') => ({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: orderId, amount } } } });
const log = { warn: vi.fn(), error: vi.fn() };

describe('AI credits', () => {
  it('credits a paid order exactly once across verify and the webhook', async () => {
    const db = fakeDb([order()]);
    const [a, b] = await Promise.all([
      creditAiOrder(db, { razorpayOrderId: 'order_AI1', razorpayPaymentId: 'pay_1', memberId: MEMBER }),
      handleAiCreditWebhookEvent(db, captured(), log),
    ]);
    expect(a.status).toBe('credited');
    expect(b).toEqual({ status: 200, payload: { ok: true } });
    expect(await loadAiCreditBalance(db, MEMBER)).toBe(900);
    expect(db.ledger).toHaveLength(1);
    expect((await creditAiOrder(db, { razorpayOrderId: 'order_AI1', razorpayPaymentId: 'pay_1', memberId: MEMBER })).status).toBe('already_credited');
  });

  it("treats another member's order as not found", async () => {
    const db = fakeDb([order()]);
    expect((await creditAiOrder(db, { razorpayOrderId: 'order_AI1', razorpayPaymentId: 'pay_1', memberId: OTHER })).status).toBe('not_found');
    expect(db.ledger).toHaveLength(0);
  });

  it('never credits when the paid amount differs from the order', async () => {
    const db = fakeDb([order()]);
    expect(await handleAiCreditWebhookEvent(db, captured(100), log)).toEqual({ status: 200, payload: { ok: true } });
    expect(db.ledger).toHaveLength(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('leaves other orders to the coin and course logic', async () => {
    const db = fakeDb([order()]);
    expect(await handleAiCreditWebhookEvent(db, captured(9900, 'order_COURSE'), log)).toBeNull();
    expect(await handleAiCreditWebhookEvent(db, { event: 'payment.captured', payload: {} }, log)).toBeNull();
  });

  it('marks a failed payment without crediting, and a later capture still credits', async () => {
    const db = fakeDb([order()]);
    await handleAiCreditWebhookEvent(db, { event: 'payment.failed', payload: { payment: { entity: { order_id: 'order_AI1', error_description: 'declined' } } } }, log);
    expect(db.orders[0].status).toBe('failed');
    expect(db.ledger).toHaveLength(0);
    await handleAiCreditWebhookEvent(db, captured(), log);
    expect(await loadAiCreditBalance(db, MEMBER)).toBe(900);
  });

  it('asks Razorpay to retry when crediting fails', async () => {
    const db = fakeDb([order()]);
    db.$transaction = () => Promise.reject(new Error('db down'));
    expect(await handleAiCreditWebhookEvent(db, captured(), log)).toEqual({ status: 500, payload: { ok: false } });
  });

  it('validates packs and converts rupees to paise', () => {
    expect(aiCreditPackSchema.safeParse({ label: '900 credits', credits: 900, priceInr: 99 }).success).toBe(true);
    expect(aiCreditPackSchema.safeParse({ label: 'x', credits: 0, priceInr: 99 }).success).toBe(false);
    expect(aiCreditPackSchema.safeParse({ label: 'x', credits: 10, priceInr: 9.999 }).success).toBe(false);
    expect(rupeesToPaise(299.99)).toBe(29999);
  });

  it('creates its tables at startup, with one ledger row per order', () => {
    const ddl = AI_CREDITS_DDL.join('\n');
    for (const t of ['ai_credit_packs', 'ai_credit_orders', 'ai_credit_ledger']) expect(ddl).toContain(`EXISTS ${t} `);
    expect(ddl).toContain('ON ai_credit_ledger(source, reference_id) WHERE reference_id IS NOT NULL');
    expect(readFileSync(new URL('../plugins/prisma.ts', import.meta.url), 'utf8')).toContain('for (const sql of AI_CREDITS_DDL)');
  });

  describe('charging for answers', () => {
    const S = { ...DEFAULT_AI_CREDIT_SETTINGS, chargingEnabled: true };
    const MSG = '61000000-0000-4000-8000-000000000001';
    const withBalance = (n: number) => {
      const db = fakeDb([]);
      db.ledger.push({ member_id: MEMBER, delta: n, source: 'purchase', reference_id: 'p' });
      return db;
    };

    it('prices at provider cost plus 10%, rounded up to whole credits', () => {
      // $0.02 → ₹1.80 → ₹1.98 → 19.8 → 20 credits at ₹0.10 each
      expect(creditsForCost(0.02, S)).toBe(20);
      expect(creditsForCost(0, S)).toBe(0);
      expect(creditsForCost(0.000001, S)).toBe(1);
      // The cap is the inverse: 60 credits pay for exactly the cost that prices at 60.
      expect(creditsForCost(costCapUsd(60, S), S)).toBe(60);
    });

    it('needs the minimum to ask, and sets aside at most one question’s worth', () => {
      expect(holdFor(9, S)).toBeNull();
      expect(holdFor(10, S)).toBe(10);
      expect(holdFor(500, S)).toBe(60);
    });

    it('charges what the answer cost, never more than was set aside', async () => {
      const db = withBalance(100);
      const h = await reserveAiCredits(db, MEMBER, S);
      expect(h).toEqual({ ok: true, holdId: 'h1', credits: 60 });
      expect((await loadAvailableAiCredits(db, MEMBER)).available).toBe(40);
      const charged = await settleAiCredits(db, { memberId: MEMBER, holdId: 'h1', held: 60, credits: 75, messageId: MSG });
      expect(charged).toBe(60);
      expect(await loadAiCreditBalance(db, MEMBER)).toBe(40);
      expect(db.holds).toHaveLength(0);
      expect(db.charged[MSG]).toBe(60);
      // The same answer is never charged twice.
      expect(await settleAiCredits(db, { memberId: MEMBER, holdId: 'h1', held: 60, credits: 5, messageId: MSG })).toBe(0);
    });

    it('parallel questions cannot spend the same credits', async () => {
      const db = withBalance(70);
      const [a, b] = await Promise.all([reserveAiCredits(db, MEMBER, S), reserveAiCredits(db, MEMBER, S)]);
      expect(a).toMatchObject({ ok: true, credits: 60 });
      expect(b).toMatchObject({ ok: true, credits: 10 });
      expect(await reserveAiCredits(db, MEMBER, S)).toEqual({ ok: false, available: 0 });
    });

    it('a failed answer or a lapsed hold costs nothing', async () => {
      const db = withBalance(30);
      const h = await reserveAiCredits(db, MEMBER, S);
      if (!h.ok) throw new Error('expected a hold');
      await releaseAiCredits(db, MEMBER, h.holdId);
      expect((await loadAvailableAiCredits(db, MEMBER)).available).toBe(30);
      db.holds.push({ id: 'old', member_id: MEMBER, credits: 30, expired: true });
      expect(await reserveAiCredits(db, MEMBER, S)).toMatchObject({ ok: true, credits: 30 });
      expect(await loadAiCreditBalance(db, MEMBER)).toBe(30);
    });

    it('rejects settings that would charge below provider cost', () => {
      const v = { chargingEnabled: true, usdToInr: 90, rateMultiplier: 1.1, inrPerCredit: 0.1, minCreditsToAsk: 10, maxCreditsPerQuestion: 60 };
      expect(aiCreditSettingsSchema.safeParse(v).success).toBe(true);
      expect(aiCreditSettingsSchema.safeParse({ ...v, rateMultiplier: 0.9 }).success).toBe(false);
      expect(aiCreditSettingsSchema.safeParse({ ...v, minCreditsToAsk: 100 }).success).toBe(false);
    });

    it('charging starts switched off', () => {
      expect(DEFAULT_AI_CREDIT_SETTINGS.chargingEnabled).toBe(false);
      expect(AI_CREDITS_DDL.join(' ')).toContain('charging_enabled          BOOLEAN NOT NULL DEFAULT FALSE');
    });
  });

  describe('admin refunds and grants', () => {
    const S = { ...DEFAULT_AI_CREDIT_SETTINGS, chargingEnabled: true };
    const MSG = '61000000-0000-4000-8000-000000000002';
    const ADMIN = 'admin-1';
    const base = { memberId: MEMBER, note: 'Wrong answer' };
    const charged = async () => {
      const db = fakeDb([]);
      db.ledger.push({ member_id: MEMBER, delta: 100, source: 'purchase', reference_id: 'p' });
      const h = await reserveAiCredits(db, MEMBER, S);
      if (!h.ok) throw new Error('expected a hold');
      await settleAiCredits(db, { memberId: MEMBER, holdId: h.holdId, held: h.credits, credits: 20, messageId: MSG });
      return db;
    };

    it('refunds a charged answer once, and at most what it was charged', async () => {
      const db = await charged();
      expect(await adjustAiCredits(db, { ...base, kind: 'refund', credits: 25, messageId: MSG }, ADMIN)).toEqual({ status: 'over_charged', charged: 20 });
      expect(await adjustAiCredits(db, { ...base, kind: 'refund', credits: 20, messageId: MSG }, ADMIN)).toEqual({ status: 'done', balance: 100, credits: 20 });
      expect(await adjustAiCredits(db, { ...base, kind: 'refund', credits: 20, messageId: MSG }, ADMIN)).toEqual({ status: 'already_refunded' });
      expect(await loadAiCreditBalance(db, MEMBER)).toBe(100);
    });

    it('will not refund an answer that was not charged, or one of another member', async () => {
      const db = await charged();
      const other = '61000000-0000-4000-8000-000000000009';
      expect(await adjustAiCredits(db, { ...base, kind: 'refund', credits: 5, messageId: other }, ADMIN)).toEqual({ status: 'not_charged' });
      expect(await adjustAiCredits(db, { ...base, memberId: OTHER, kind: 'refund', credits: 5, messageId: MSG }, ADMIN)).toEqual({ status: 'not_charged' });
    });

    it('grants free credits, and a correction never takes the balance below 0', async () => {
      const db = await charged();
      expect(await adjustAiCredits(db, { ...base, kind: 'grant', credits: 50 }, ADMIN)).toEqual({ status: 'done', balance: 130, credits: 50 });
      expect(await adjustAiCredits(db, { ...base, kind: 'adjust', credits: -131 }, ADMIN)).toEqual({ status: 'insufficient', balance: 130 });
      expect(await adjustAiCredits(db, { ...base, kind: 'adjust', credits: -130 }, ADMIN)).toEqual({ status: 'done', balance: 0, credits: -130 });
      expect(await adjustAiCredits(db, { ...base, memberId: '41000000-0000-4000-8000-000000000099', kind: 'grant', credits: 5 }, ADMIN))
        .toEqual({ status: 'member_not_found' });
    });

    it('validates the request', () => {
      const ok = (v: object) => aiCreditAdjustSchema.safeParse({ ...base, ...v }).success;
      expect(ok({ kind: 'grant', credits: 10 })).toBe(true);
      expect(ok({ kind: 'grant', credits: -10 })).toBe(false);
      expect(ok({ kind: 'refund', credits: 0 })).toBe(false);
      expect(ok({ kind: 'adjust', credits: -10 })).toBe(true);
      expect(ok({ kind: 'grant', credits: 10, messageId: MSG })).toBe(false);
      expect(ok({ kind: 'grant', credits: 1.5 })).toBe(false);
      expect(ok({ kind: 'grant', credits: 10, note: '' })).toBe(false);
    });
  });
});
