import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Extra Lifeline crediting against a REAL PostgreSQL — the transaction,
// conditional-UPDATE and UNIQUE(payment_id) semantics the fake-store tests
// (lifelinePurchase.handlers.test.ts) can only imitate, plus the exact SQL of
// the reconciliation claim (FOR UPDATE SKIP LOCKED) and expiry.
//
// Opt-in and LOCAL ONLY: set LIFELINE_PG_TEST_URL to a throwaway local
// database, e.g. postgresql://postgres@localhost:55433/tbt. Everything runs in
// its own schema (lifeline_it), created and dropped by this file. Any host other
// than localhost/127.0.0.1 is refused, so it can never touch a shared database.
// Without the variable the suite is skipped (CI has no database).

vi.mock('../config/env.js', () => ({ env: { RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'test-key-secret' } }));
const rzp = vi.hoisted(() => ({ orders: new Map<string, any>(), payments: new Map<string, any>() }));
vi.mock('./razorpay.js', () => ({
  getRazorpay: () => ({
    orders: {
      fetch: async (id: string) => rzp.orders.get(id),
      fetchPayments: async (id: string) => ({ items: [...rzp.payments.values()].filter((p) => p.order_id === id) }),
    },
    payments: { fetch: async (id: string) => rzp.payments.get(id) },
  }),
}));

const { creditLifelineOrder, liveLifelineRazorpayReader } = await import('./lifelineCredit.js');
const { LIFELINE_ORDERS_DDL } = await import('./lifelineOrdersSchema.js');
const { runLifelineReconciliation } = await import('../jobs/lifelineReconcile.js');
const { handleLifelineWebhookEvent } = await import('../modules/user/lifelinePurchase.js');

const RAW_URL = process.env.LIFELINE_PG_TEST_URL ?? '';
const isLocal = (() => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(RAW_URL).hostname);
  } catch {
    return false;
  }
})();
if (RAW_URL && !isLocal) throw new Error('LIFELINE_PG_TEST_URL must point at localhost — refusing to run against a shared database.');

const SCHEMA = 'lifeline_it';
const MEMBER = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';
const BATCH = '20000000-0000-4000-8000-000000000001';
const quietLog = { info: () => {}, warn: () => {}, error: () => {} };

let prisma: PrismaClient;
let seq = 0;

async function newOrder(over: { memberId?: string; amount?: number; ageMinutes?: number } = {}) {
  const orderId = `order_it_${++seq}`;
  const amount = over.amount ?? 19900;
  await prisma.$executeRawUnsafe(
    `INSERT INTO lifeline_razorpay_orders (order_id, member_id, batch_id, amount_paise, currency, created_at)
     VALUES ($1, $2::uuid, $3::uuid, $4, 'INR', NOW() - make_interval(mins => $5::int))`,
    orderId, over.memberId ?? MEMBER, BATCH, amount, over.ageMinutes ?? 0,
  );
  rzp.orders.set(orderId, { id: orderId, amount, currency: 'INR', status: 'created', notes: { memberId: over.memberId ?? MEMBER, type: 'lifeline_purchase' } });
  return orderId;
}
function pay(orderId: string, over: Record<string, unknown> = {}, orderStatus = 'paid') {
  const order = rzp.orders.get(orderId);
  order.status = orderStatus;
  const id = `pay_it_${++seq}`;
  rzp.payments.set(id, { id, order_id: orderId, amount: order.amount, currency: 'INR', status: 'captured', ...over });
  return id;
}
async function lifelines(memberId = MEMBER) {
  const [row] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT lifelines_total FROM member_batch_settings WHERE member_id = $1::uuid AND batch_id = $2::uuid`, memberId, BATCH,
  );
  return Number(row?.lifelines_total ?? 3);
}
async function orderRow(orderId: string) {
  const [row] = await prisma.$queryRawUnsafe<any[]>(`SELECT status, payment_id FROM lifeline_razorpay_orders WHERE order_id = $1`, orderId);
  return row;
}

describe.skipIf(!RAW_URL)('creditLifelineOrder — real PostgreSQL', () => {
  beforeAll(async () => {
    const url = new URL(RAW_URL);
    url.searchParams.set('schema', SCHEMA);
    url.searchParams.set('connection_limit', '12');
    prisma = new PrismaClient({ datasourceUrl: url.toString() });
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA ${SCHEMA}`);
    // Minimal parents for the foreign keys, then the production DDL itself.
    await prisma.$executeRawUnsafe(`CREATE TABLE members (id UUID PRIMARY KEY)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE batches (id UUID PRIMARY KEY)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE member_batch_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_id UUID NOT NULL, batch_id UUID NOT NULL,
      lifelines_total INT NOT NULL DEFAULT 3, lifelines_used INT NOT NULL DEFAULT 0, UNIQUE (member_id, batch_id))`);
    for (const ddl of LIFELINE_ORDERS_DDL) await prisma.$executeRawUnsafe(ddl);
    for (const ddl of LIFELINE_ORDERS_DDL) await prisma.$executeRawUnsafe(ddl); // idempotent re-run (startup on every boot)
    await prisma.$executeRawUnsafe(`INSERT INTO members (id) VALUES ($1::uuid), ($2::uuid)`, MEMBER, OTHER);
    await prisma.$executeRawUnsafe(`INSERT INTO batches (id) VALUES ($1::uuid)`, BATCH);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    rzp.orders.clear();
    rzp.payments.clear();
    await prisma.$executeRawUnsafe(`DELETE FROM lifeline_razorpay_orders`);
    await prisma.$executeRawUnsafe(`DELETE FROM member_batch_settings`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO member_batch_settings (member_id, batch_id, lifelines_total, lifelines_used) VALUES ($1::uuid, $2::uuid, 3, 2)`, MEMBER, BATCH,
    );
  });

  it('12 concurrent credits of the same payment add exactly one lifeline', async () => {
    const orderId = await newOrder();
    const paymentId = pay(orderId);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId, paymentId })),
    );
    expect(results.filter((r) => r.kind === 'credited')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'already')).toHaveLength(11);
    expect(await lifelines()).toBe(4);
    expect(await orderRow(orderId)).toMatchObject({ status: 'paid', payment_id: paymentId });
  });

  it('verify (with acting member) racing the webhook and reconciliation paths credits once', async () => {
    const orderId = await newOrder({ ageMinutes: 30 });
    const paymentId = pay(orderId);
    const [verify, hook, recon] = await Promise.all([
      creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId, paymentId, actingMemberId: MEMBER }),
      handleLifelineWebhookEvent(prisma, { event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } }),
      runLifelineReconciliation(prisma, liveLifelineRazorpayReader, quietLog, { delayMs: 0 }),
    ]);
    expect(['credited', 'already']).toContain(verify.kind);
    expect(hook).toEqual({ status: 200, payload: { ok: true } });
    expect(recon.errors).toBe(0);
    expect(await lifelines()).toBe(4);
  });

  it('UNIQUE(payment_id): one payment can never pay a second order — the whole transaction rolls back', async () => {
    const a = await newOrder();
    const paymentId = pay(a);
    expect((await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: a, paymentId })).kind).toBe('credited');
    const b = await newOrder();
    // Make Razorpay agree the payment belongs to B so only the database constraint can stop it.
    rzp.payments.get(paymentId).order_id = b;
    rzp.orders.get(b).status = 'paid';
    const res = await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: b, paymentId });
    expect(res).toEqual({ kind: 'rejected', httpStatus: 409, code: 'PAYMENT_ALREADY_USED' });
    expect(await orderRow(b)).toMatchObject({ status: 'created', payment_id: null });
    expect(await lifelines()).toBe(4);
  });

  it('wrong member/amount/currency/state never credit', async () => {
    const wrongAmount = await newOrder();
    const p1 = pay(wrongAmount, { amount: 100 });
    const failed = await newOrder();
    const p2 = pay(failed, { status: 'failed' }, 'attempted');
    const notMine = await newOrder({ memberId: OTHER });
    const p3 = pay(notMine);
    expect((await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: wrongAmount, paymentId: p1 })).kind).toBe('rejected');
    expect((await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: failed, paymentId: p2 })).kind).toBe('rejected');
    expect((await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: notMine, paymentId: p3, actingMemberId: MEMBER })).kind).toBe('rejected');
    expect(await lifelines()).toBe(3);
  });

  it('reconciliation: overlapping runs claim disjoint orders (SKIP LOCKED) and credit each once', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const id = await newOrder({ ageMinutes: 30 });
      pay(id);
      ids.push(id);
    }
    const young = await newOrder({ ageMinutes: 2 });
    pay(young);
    const runs = await Promise.all([1, 2, 3].map(() => runLifelineReconciliation(prisma, liveLifelineRazorpayReader, quietLog, { batchSize: 4, delayMs: 0 })));
    expect(runs.reduce((n, r) => n + r.claimed, 0)).toBe(6);
    expect(runs.reduce((n, r) => n + r.credited, 0)).toBe(6);
    expect(await lifelines()).toBe(9);
    expect((await orderRow(young)).status).toBe('created'); // under 10 minutes — left alone
    // just checked → not claimed again inside the re-check window
    expect((await runLifelineReconciliation(prisma, liveLifelineRazorpayReader, quietLog, { delayMs: 0 })).claimed).toBe(0);
  });

  it('reconciliation expires unpaid orders after 7 days; a late capture still credits the expired order', async () => {
    const stale = await newOrder({ ageMinutes: 8 * 24 * 60 });
    const recent = await newOrder({ ageMinutes: 3 * 24 * 60 });
    const summary = await runLifelineReconciliation(prisma, liveLifelineRazorpayReader, quietLog, { delayMs: 0 });
    expect(summary).toMatchObject({ claimed: 2, expired: 1, unpaid: 1 });
    expect((await orderRow(stale)).status).toBe('expired');
    expect((await orderRow(recent)).status).toBe('created');
    const late = pay(stale);
    expect((await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId: stale, paymentId: late })).kind).toBe('credited');
    expect(await lifelines()).toBe(4);
  });

  it('the webhook lookup ignores orders that are not lifeline orders', async () => {
    expect(await handleLifelineWebhookEvent(prisma, { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_c', order_id: 'order_course' } } } })).toBeNull();
  });

  it('if the lifeline table does not exist, webhooks fall through to the course logic (real Postgres error)', async () => {
    const url = new URL(RAW_URL);
    url.searchParams.set('schema', `${SCHEMA}_empty`);
    const empty = new PrismaClient({ datasourceUrl: url.toString() });
    try {
      await empty.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}_empty`);
      expect(await handleLifelineWebhookEvent(empty, { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_c', order_id: 'order_x' } } } })).toBeNull();
    } finally {
      await empty.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA}_empty CASCADE`);
      await empty.$disconnect();
    }
  });
});
