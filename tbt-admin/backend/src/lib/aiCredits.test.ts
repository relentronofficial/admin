import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AI_CREDITS_DDL, aiCreditPackSchema, creditAiOrder, handleAiCreditWebhookEvent, loadAiCreditBalance, rupeesToPaise } from './aiCredits.js';

const MEMBER = '41000000-0000-4000-8000-000000000001';
const OTHER = '41000000-0000-4000-8000-000000000002';

/** In-memory stand-in answering exactly the SQL lib/aiCredits.ts issues. */
function fakeDb(orders: Array<{ id: string; member_id: string; razorpay_order_id: string; credits: number; amount_paise: number; status: string }>) {
  const ledger: Array<{ member_id: string; delta: number; source: string; reference_id: string | null }> = [];
  let chain = Promise.resolve();
  const db: any = {
    ledger,
    orders,
    async $queryRawUnsafe(sql: string, ...v: any[]) {
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
});
