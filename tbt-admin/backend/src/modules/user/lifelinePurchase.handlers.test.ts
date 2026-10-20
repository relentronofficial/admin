import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real Extra Lifeline handlers — create-order, verify, the Razorpay webhook
// (through the real razorpayWebhookHandler in controller.ts) and the
// reconciliation pass — against a small in-memory store that answers the SQL
// they issue, with the Razorpay SDK replaced by a fake whose orders and
// payments the test controls. Signatures are the REAL HMAC checks from
// lib/razorpay.ts with test secrets. Database transaction/constraint semantics
// are covered against real Postgres in lib/lifelineCredit.pg.test.ts.

const env = vi.hoisted(() => ({
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test-key-secret' as string | undefined,
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret' as string | undefined,
  MENTORSHIP_DEMO_MEMBER_ID: '',
  MENTORSHIP_DEMO_EMAIL: '',
  PROGRAM_TIMEZONE: 'Asia/Kolkata',
}));
const rzp = vi.hoisted(() => ({
  orders: new Map<string, any>(),
  payments: new Map<string, any>(),
  seq: 0,
  down: false,
  rateLimited: false,
}));
vi.mock('../../config/env.js', () => ({ env }));
vi.mock('../../lib/razorpay.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/razorpay.js')>();
  const unavailable = () => {
    if (rzp.rateLimited) throw Object.assign(new Error('Too many requests'), { statusCode: 429 });
    if (rzp.down) throw new Error('network');
  };
  return {
    ...real, // real verifyPaymentSignature / verifyWebhookSignature
    getRazorpay: () => ({
      orders: {
        create: async (o: any) => {
          const order = { id: `order_${++rzp.seq}`, status: 'created', ...o };
          rzp.orders.set(order.id, order);
          return order;
        },
        fetch: async (id: string) => {
          unavailable();
          return rzp.orders.get(id);
        },
        fetchPayments: async (id: string) => {
          unavailable();
          return { items: [...rzp.payments.values()].filter((p) => p.order_id === id) };
        },
      },
      payments: {
        fetch: async (id: string) => {
          unavailable();
          return rzp.payments.get(id);
        },
      },
    }),
  };
});

const { Prisma } = await import('@prisma/client');
const { createLifelineOrderHandler, verifyLifelinePaymentHandler } = await import('./lifelinePurchase.js');
const { razorpayWebhookHandler } = await import('./controller.js');
const { runLifelineReconciliation } = await import('../../jobs/lifelineReconcile.js');
const { liveLifelineRazorpayReader } = await import('../../lib/lifelineCredit.js');

const ME = '30000000-0000-0000-0000-000000000001';
const OTHER = '30000000-0000-0000-0000-000000000002';
const BATCH = '20000000-0000-0000-0000-000000000001';
const MIN = 60_000;
const DAY = 86_400_000;

interface Order {
  orderId: string; memberId: string; batchId: string; amountPaise: number; currency: string;
  status: string; paymentId: string | null; createdAt: number; lastCheckedAt: number | null;
}
interface Store {
  members: Record<string, { batchId: string | null }>;
  /** price_inr as Prisma returns a raw DECIMAL column: a Prisma.Decimal object. */
  pricing: Record<string, { price_inr: unknown; label: string }>;
  /** Simulate a table missing in the database (Postgres 42P01). */
  missingTable: string | null;
  orders: Order[];
  settings: Array<{ memberId: string; batchId: string; total: number; used: number }>;
  /** SQL fragment that fails once (transient DB error). */
  failOnce: string | null;
  courseSql: string[];
}
let db: Store;

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (db.missingTable && q.includes(db.missingTable)) {
    throw Object.assign(new Error(`relation "${db.missingTable}" does not exist`), { code: 'P2010', meta: { code: '42P01' } });
  }
  if (db.failOnce && q.includes(db.failOnce)) {
    db.failOnce = null;
    throw new Error('connection terminated unexpectedly');
  }
  if (q.includes('course_payments')) {
    db.courseSql.push(q.slice(0, 40));
    return q.startsWith('UPDATE') ? 0 : [];
  }
  if (q.startsWith('SELECT batch_id::text AS "batchId" FROM members')) {
    const m = db.members[a[0]];
    return m ? [{ batchId: m.batchId }] : [];
  }
  if (q.startsWith('SELECT price_inr, label FROM credit_pricing')) return db.pricing[a[0]] ? [db.pricing[a[0]]] : [];
  if (q.startsWith('INSERT INTO lifeline_razorpay_orders')) {
    db.orders.push({ orderId: a[0], memberId: a[1], batchId: a[2], amountPaise: a[3], currency: 'INR', status: 'created', paymentId: null, createdAt: Date.now(), lastCheckedAt: null });
    return 1;
  }
  if (q.startsWith('SELECT 1 FROM lifeline_razorpay_orders WHERE order_id')) return db.orders.filter((o) => o.orderId === a[0]).map(() => ({ '?column?': 1 }));
  if (q.startsWith('SELECT order_id AS "orderId"')) {
    return db.orders.filter((o) => o.orderId === a[0]).map((o) => ({
      orderId: o.orderId, memberId: o.memberId, batchId: o.batchId, amountPaise: String(o.amountPaise),
      currency: o.currency, status: o.status, paymentId: o.paymentId,
    }));
  }
  if (q.startsWith("UPDATE lifeline_razorpay_orders SET status = 'paid'")) {
    const o = db.orders.find((x) => x.orderId === a[0] && x.memberId === a[1] && (x.status === 'created' || x.status === 'expired'));
    if (!o) return []; // like Postgres: no row written → no constraint checked
    if (db.orders.some((x) => x !== o && x.paymentId === a[2])) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    o.status = 'paid';
    o.paymentId = a[2];
    return [{ order_id: o.orderId }];
  }
  if (q.startsWith('UPDATE lifeline_razorpay_orders SET last_checked_at = NOW()')) {
    const [minAge, recheck, limit] = a;
    const now = Date.now();
    const due = db.orders
      .filter((o) => o.status === 'created' && o.createdAt < now - minAge * MIN && (o.lastCheckedAt === null || o.lastCheckedAt < now - recheck * MIN))
      .sort((x, y) => (x.lastCheckedAt ?? -Infinity) - (y.lastCheckedAt ?? -Infinity) || x.createdAt - y.createdAt)
      .slice(0, limit);
    for (const o of due) o.lastCheckedAt = now;
    return due.map((o) => ({ orderId: o.orderId, ageDays: (now - o.createdAt) / DAY }));
  }
  if (q.startsWith("UPDATE lifeline_razorpay_orders SET status = 'expired'")) {
    const o = db.orders.find((x) => x.orderId === a[0] && x.status === 'created');
    if (!o) return 0;
    o.status = 'expired';
    return 1;
  }
  if (q.startsWith('INSERT INTO member_batch_settings')) {
    if (!db.settings.some((s) => s.memberId === a[0] && s.batchId === a[1])) db.settings.push({ memberId: a[0], batchId: a[1], total: 3, used: 0 });
    return 1;
  }
  if (q.startsWith('UPDATE member_batch_settings SET lifelines_total = lifelines_total + 1')) {
    const s = db.settings.find((x) => x.memberId === a[0] && x.batchId === a[1])!;
    s.total += 1;
    return [{ lifelines_total: s.total, lifelines_used: s.used }];
  }
  // The shared webhook also runs the TBT coin-order branch (controller.ts →
  // lib/coinOrders.ts). These tests create no coin orders: the lookup finds none
  // and the payment.failed update touches no rows — as the real database would.
  if (q.startsWith('SELECT id, member_id, coins, amount_paise, status FROM coin_orders WHERE razorpay_order_id')) return [];
  if (q.startsWith("UPDATE coin_orders SET status = 'failed'")) return 0;
  if (q.startsWith('SELECT lifelines_total, lifelines_used FROM member_batch_settings')) {
    return db.settings.filter((s) => s.memberId === a[0] && s.batchId === a[1]).map((s) => ({ lifelines_total: s.total, lifelines_used: s.used }));
  }
  throw new Error(`Unhandled SQL: ${q}`);
}

/**
 * Fake Prisma. A transaction that throws rolls back its own writes (the order
 * flip and the lifeline increment it made) — not other requests' writes.
 */
const prisma = {
  $queryRawUnsafe: sql,
  $executeRawUnsafe: sql,
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    const undo: Array<() => void> = [];
    const tx = async (text: string, ...a: any[]) => {
      const q = text.replace(/\s+/g, ' ').trim();
      const order = q.startsWith("UPDATE lifeline_razorpay_orders SET status = 'paid'") ? db.orders.find((o) => o.orderId === a[0]) : undefined;
      const before = order ? { status: order.status, paymentId: order.paymentId } : null;
      const result = await sql(text, ...a);
      if (order && before && order.status !== before.status) undo.push(() => Object.assign(order, before));
      if (q.startsWith('UPDATE member_batch_settings SET lifelines_total = lifelines_total + 1')) {
        const s = db.settings.find((x) => x.memberId === a[0] && x.batchId === a[1]);
        if (s) undo.push(() => { s.total -= 1; });
      }
      return result;
    };
    try {
      return await fn({ $queryRawUnsafe: tx, $executeRawUnsafe: tx });
    } catch (err) {
      for (const u of undo.reverse()) u();
      throw err;
    }
  },
};
const quietLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function call(handler: (req: any, reply: any) => Promise<any>, req: Record<string, unknown>) {
  const res = { status: 200, body: undefined as any };
  const reply: any = {
    status(code: number) { res.status = code; return reply; },
    send(payload: unknown) { res.body = payload; return reply; },
  };
  return handler({ server: { prisma }, log: quietLog, headers: {}, ...req }, reply).then(() => res);
}
const hmac = (secret: string, data: string) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const createOrder = (memberId = ME) => call(createLifelineOrderHandler, { memberId });
const verify = (memberId: string, orderId: string, paymentId: string, signature = hmac('test-key-secret', `${orderId}|${paymentId}`)) =>
  call(verifyLifelinePaymentHandler, { memberId, body: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature } });

/** Deliver a webhook through the real handler; the raw body is signed with the webhook secret unless `signature` is given. */
function webhook(event: string, payment: Record<string, unknown>, signature?: string) {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity: payment } } });
  return call(razorpayWebhookHandler, {
    rawBody,
    body: JSON.parse(rawBody),
    headers: { 'x-razorpay-signature': signature ?? hmac('test-webhook-secret', rawBody) },
  });
}
const lifelines = (memberId = ME) => db.settings.find((s) => s.memberId === memberId && s.batchId === BATCH)?.total ?? 3;
const reconcile = (opts = {}) => runLifelineReconciliation(prisma, liveLifelineRazorpayReader, quietLog, { delayMs: 0, ...opts });
const age = (orderId: string, ms: number) => {
  db.orders.find((o) => o.orderId === orderId)!.createdAt = Date.now() - ms;
};

/** Simulate the member paying in Razorpay checkout: the order becomes paid and the payment captured. */
function pay(orderId: string, over: Record<string, unknown> = {}, orderStatus = 'paid') {
  const order = rzp.orders.get(orderId);
  order.status = orderStatus;
  const id = `pay_${++rzp.seq}`;
  rzp.payments.set(id, { id, order_id: orderId, amount: order.amount, currency: 'INR', status: 'captured', ...over });
  return id;
}

beforeEach(() => {
  env.RAZORPAY_KEY_SECRET = 'test-key-secret';
  env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  rzp.orders.clear();
  rzp.payments.clear();
  rzp.down = false;
  rzp.rateLimited = false;
  db = {
    members: { [ME]: { batchId: BATCH }, [OTHER]: { batchId: BATCH } },
    pricing: { lifeline: { price_inr: new Prisma.Decimal('199.00'), label: 'Extra Lifeline' } },
    missingTable: null,
    orders: [],
    settings: [{ memberId: ME, batchId: BATCH, total: 3, used: 2 }],
    failOnce: null,
    courseSql: [],
  };
});

describe('POST /api/user/lifelines/razorpay/create-order', () => {
  it('creates a Razorpay order for exactly one Extra Lifeline at the configured credit_pricing price', async () => {
    const res = await createOrder();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ amount: 19900, currency: 'INR', keyId: 'rzp_test_key', label: 'Extra Lifeline' });
    const order = rzp.orders.get(res.body.data.orderId);
    expect(order).toMatchObject({ amount: 19900, currency: 'INR', notes: { memberId: ME, batchId: BATCH, type: 'lifeline_purchase' } });
    expect(db.orders[0]).toMatchObject({ orderId: order.id, memberId: ME, batchId: BATCH, amountPaise: 19900, currency: 'INR', status: 'created', paymentId: null });
  });

  it('follows an admin price change — the price is never hardcoded', async () => {
    db.pricing.lifeline.price_inr = new Prisma.Decimal('249.00');
    expect((await createOrder()).body.data.amount).toBe(24900);
  });

  it('refuses when no price is configured, the member is not in a batch, or Razorpay is not configured', async () => {
    delete (db.pricing as any).lifeline;
    expect(await createOrder()).toMatchObject({ status: 503, body: { error: { message: 'PRICE_NOT_CONFIGURED' } } });
    db.pricing.lifeline = { price_inr: new Prisma.Decimal('199.00'), label: 'Extra Lifeline' };
    db.members[ME].batchId = null;
    expect(await createOrder()).toMatchObject({ status: 400, body: { error: { message: 'NOT_IN_BATCH' } } });
    db.members[ME].batchId = BATCH;
    env.RAZORPAY_KEY_SECRET = undefined;
    expect(await createOrder()).toMatchObject({ status: 503, body: { error: { message: 'RAZORPAY_NOT_CONFIGURED' } } });
    expect(rzp.orders.size).toBe(0);
  });
});

describe('create-order failures are diagnosable (safe reason codes in the response and the log)', () => {
  beforeEach(() => quietLog.warn.mockClear());

  it('the configured DECIMAL price (Prisma.Decimal) creates an order — the production 503 regression', async () => {
    const res = await createOrder();
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(19900);
    expect(quietLog.warn).not.toHaveBeenCalled();
  });

  it('each failure returns and logs its own code — never secrets or member data', async () => {
    const cases: Array<[() => void, number, string]> = [
      [() => { env.RAZORPAY_KEY_SECRET = undefined; }, 503, 'RAZORPAY_NOT_CONFIGURED'],
      [() => { db.members[ME].batchId = null; }, 400, 'NOT_IN_BATCH'],
      [() => { db.pricing.lifeline.price_inr = new Prisma.Decimal(0); }, 503, 'PRICE_NOT_CONFIGURED'],
      [() => { db.missingTable = 'credit_pricing'; }, 503, 'PRICING_TABLE_MISSING'],
      [() => { db.failOnce = 'FROM credit_pricing'; }, 503, 'PRICE_LOOKUP_FAILED'],
      [() => { db.missingTable = 'INSERT INTO lifeline_razorpay_orders'; }, 503, 'LIFELINE_TABLE_MISSING'],
      [() => { db.failOnce = 'INSERT INTO lifeline_razorpay_orders'; }, 503, 'ORDER_SAVE_FAILED'],
    ];
    for (const [setup, status, code] of cases) {
      quietLog.warn.mockClear();
      setup();
      const res = await createOrder();
      expect(res).toMatchObject({ status, body: { success: false, error: { message: code } } });
      expect(quietLog.warn).toHaveBeenCalledWith({ code }, '[lifeline-order] create-order failed');
      const logged = JSON.stringify(quietLog.warn.mock.calls);
      for (const secret of ['test-key-secret', 'test-webhook-secret', ME, BATCH]) expect(logged).not.toContain(secret);
      // reset for the next case
      env.RAZORPAY_KEY_SECRET = 'test-key-secret';
      db.members[ME].batchId = BATCH;
      db.pricing.lifeline.price_inr = new Prisma.Decimal('199.00');
      db.missingTable = null;
      db.failOnce = null;
    }
    expect(db.orders).toEqual([]);
  });
});

describe('POST /api/user/lifelines/razorpay/verify', () => {
  it('adds exactly one lifeline after a verified, captured payment', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    const res = await verify(ME, orderId, paymentId);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ lifelineAdded: true, alreadyProcessed: false, lifelinesTotal: 4, lifelinesUsed: 2, lifelinesRemaining: 2 });
    expect(lifelines()).toBe(4);
    expect(db.orders[0]).toMatchObject({ status: 'paid', paymentId });
  });

  it('repeated verification of the same payment adds only one lifeline', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    await verify(ME, orderId, paymentId);
    const again = await verify(ME, orderId, paymentId);
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ lifelineAdded: false, alreadyProcessed: true, lifelinesTotal: 4 });
    expect(lifelines()).toBe(4);
  });

  it('concurrent duplicate verifications add only one lifeline', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    const results = await Promise.all([verify(ME, orderId, paymentId), verify(ME, orderId, paymentId), verify(ME, orderId, paymentId)]);
    expect(results.filter((r) => r.body.data?.lifelineAdded)).toHaveLength(1);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(lifelines()).toBe(4);
  });

  it('one payment cannot pay for a second order, and a paid order rejects a different payment', async () => {
    const first = (await createOrder()).body.data.orderId;
    const paymentId = pay(first);
    await verify(ME, first, paymentId);
    const second = (await createOrder()).body.data.orderId;
    expect((await verify(ME, second, paymentId)).body.error.message).toBe('PAYMENT_ORDER_MISMATCH');
    expect((await verify(ME, first, pay(first))).status).toBe(409);
    expect(lifelines()).toBe(4);
  });

  it('rejects an invalid signature (real HMAC check) without touching Razorpay or the lifelines', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    for (const sig of ['forged', hmac('wrong-secret', `${orderId}|${paymentId}`), hmac('test-key-secret', `${orderId}|pay_other`)]) {
      expect(await verify(ME, orderId, paymentId, sig)).toMatchObject({ status: 400, body: { error: { message: 'SIGNATURE_INVALID' } } });
    }
    expect(lifelines()).toBe(3);
    expect(db.orders[0].status).toBe('created');
  });

  it("another member can't verify (or be credited for) someone else's order", async () => {
    const { orderId } = (await createOrder(ME)).body.data;
    const paymentId = pay(orderId);
    expect(await verify(OTHER, orderId, paymentId)).toMatchObject({ status: 403, body: { error: { message: 'ORDER_NOT_YOURS' } } });
    expect(lifelines(ME)).toBe(3);
    expect(lifelines(OTHER)).toBe(3);
  });

  it('an unknown order is rejected (e.g. a coin or course order id)', async () => {
    expect((await verify(ME, 'order_unknown', 'pay_x')).status).toBe(404);
  });

  it('a failed payment adds nothing', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId, { status: 'failed' }, 'attempted');
    expect(await verify(ME, orderId, paymentId)).toMatchObject({ status: 402, body: { error: { message: 'PAYMENT_FAILED' } } });
    expect(lifelines()).toBe(3);
    expect(db.orders[0].status).toBe('created');
  });

  it('a pending (authorized, not captured) payment adds nothing yet, and is credited once it is captured', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId, { status: 'authorized' }, 'attempted');
    expect(await verify(ME, orderId, paymentId)).toMatchObject({ status: 202, body: { error: { message: 'PAYMENT_PENDING' } } });
    expect(lifelines()).toBe(3);
    rzp.payments.get(paymentId).status = 'captured';
    rzp.orders.get(orderId).status = 'paid';
    expect((await verify(ME, orderId, paymentId)).body.data.lifelineAdded).toBe(true);
    expect(lifelines()).toBe(4);
  });

  it('a payment for a different amount adds nothing', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId, { amount: 100 });
    expect((await verify(ME, orderId, paymentId)).body.error.message).toBe('AMOUNT_MISMATCH');
    expect(lifelines()).toBe(3);
  });

  it('Razorpay unreachable → nothing credited, can retry', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    rzp.down = true;
    expect((await verify(ME, orderId, paymentId)).status).toBe(502);
    expect(lifelines()).toBe(3);
    rzp.down = false;
    expect((await verify(ME, orderId, paymentId)).body.data.lifelineAdded).toBe(true);
  });

  it('a database failure mid-credit rolls back and can be retried', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    db.failOnce = 'UPDATE member_batch_settings SET lifelines_total';
    expect(await verify(ME, orderId, paymentId)).toMatchObject({ status: 503, body: { error: { message: 'DB_UNAVAILABLE' } } });
    expect(db.orders[0].status).toBe('created'); // the paid flip was rolled back with the failed increment
    expect(lifelines()).toBe(3);
    expect((await verify(ME, orderId, paymentId)).body.data.lifelineAdded).toBe(true);
    expect(lifelines()).toBe(4);
  });

  it('rejects missing payment details', async () => {
    expect((await call(verifyLifelinePaymentHandler, { memberId: ME, body: {} })).status).toBe(400);
  });
});

describe('Razorpay webhook — lifeline orders', () => {
  const captured = (orderId: string, paymentId: string) => ({ id: paymentId, order_id: orderId, status: 'captured', amount: 19900, currency: 'INR' });

  it('a valid payment.captured webhook credits exactly one lifeline', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    expect(await webhook('payment.captured', captured(orderId, paymentId))).toMatchObject({ status: 200, body: { ok: true } });
    expect(lifelines()).toBe(4);
    expect(db.orders[0]).toMatchObject({ status: 'paid', paymentId });
    expect(db.courseSql).toEqual([]); // never reached the course-payment logic
  });

  it('order.paid works the same way', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    expect((await webhook('order.paid', captured(orderId, paymentId))).status).toBe(200);
    expect(lifelines()).toBe(4);
  });

  it('an invalid webhook signature credits nothing', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    expect((await webhook('payment.captured', captured(orderId, paymentId), 'forged')).status).toBe(400);
    expect((await webhook('payment.captured', captured(orderId, paymentId), hmac('other-secret', 'x'))).status).toBe(400);
    expect(lifelines()).toBe(3);
    expect(db.orders[0].status).toBe('created');
  });

  it('duplicate webhook deliveries (sequential and concurrent) credit once and are acknowledged', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    const evt = captured(orderId, paymentId);
    const results = [await webhook('payment.captured', evt), ...(await Promise.all([webhook('payment.captured', evt), webhook('payment.captured', evt)]))];
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(lifelines()).toBe(4);
  });

  it('browser verification and the webhook racing each other credit exactly once', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    const [v, w] = await Promise.all([verify(ME, orderId, paymentId), webhook('payment.captured', captured(orderId, paymentId))]);
    expect(v.status).toBe(200);
    expect(w.status).toBe(200);
    expect(lifelines()).toBe(4);
    // whichever lost the race, a later verify still reports success without adding
    expect((await verify(ME, orderId, paymentId)).body.data).toMatchObject({ alreadyProcessed: true, lifelinesTotal: 4 });
  });

  it('never trusts the event payload: Razorpay is re-checked, so a forged "captured" for an unpaid payment credits nothing', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId, { status: 'failed' }, 'attempted'); // Razorpay says failed
    const res = await webhook('payment.captured', captured(orderId, paymentId)); // event claims captured
    expect(res.status).toBe(200); // acknowledged — retrying won't change a failed payment
    expect(lifelines()).toBe(3);
  });

  it('mismatched payments are acknowledged without credit: wrong amount, currency, order, member', async () => {
    for (const over of [{ amount: 100 }, { currency: 'USD' }]) {
      const { orderId } = (await createOrder()).body.data;
      const paymentId = pay(orderId, over);
      expect((await webhook('payment.captured', captured(orderId, paymentId))).status).toBe(200);
    }
    const { orderId: a } = (await createOrder()).body.data;
    const { orderId: b } = (await createOrder()).body.data;
    const paidForB = pay(b);
    expect((await webhook('payment.captured', captured(a, paidForB))).status).toBe(200); // payment belongs to another order
    rzp.orders.get(a).notes = { memberId: OTHER, type: 'lifeline_purchase' };
    const paidForA = pay(a);
    expect((await webhook('payment.captured', captured(a, paidForA))).status).toBe(200); // Razorpay order for another member
    expect(lifelines()).toBe(3);
    expect(db.orders.filter((o) => o.status === 'paid')).toEqual([]);
  });

  it('a not-yet-captured payment or a transient failure returns 503 so Razorpay retries, then credits once', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId, { status: 'authorized' }, 'attempted');
    expect((await webhook('payment.captured', captured(orderId, paymentId))).status).toBe(503);
    rzp.payments.get(paymentId).status = 'captured';
    rzp.orders.get(orderId).status = 'paid';
    rzp.down = true;
    expect((await webhook('payment.captured', captured(orderId, paymentId))).status).toBe(503);
    rzp.down = false;
    db.failOnce = 'SELECT 1 FROM lifeline_razorpay_orders';
    expect((await webhook('payment.captured', captured(orderId, paymentId))).status).toBe(503);
    expect(lifelines()).toBe(3);
    expect((await webhook('payment.captured', captured(orderId, paymentId))).status).toBe(200);
    expect(lifelines()).toBe(4);
  });

  it('other events for a lifeline order (failed, refund) are acknowledged and change nothing', async () => {
    const { orderId } = (await createOrder()).body.data;
    expect((await webhook('payment.failed', { id: 'pay_f', order_id: orderId, status: 'failed' })).status).toBe(200);
    expect(lifelines()).toBe(3);
    expect(db.courseSql).toEqual([]);
  });
});

describe('Razorpay webhook — course payments unchanged', () => {
  it('a course order still goes through the course-payment logic', async () => {
    expect(await webhook('payment.captured', { id: 'pay_c', order_id: 'order_course_1', status: 'captured' })).toMatchObject({ status: 200, body: { ok: true } });
    expect(await webhook('payment.failed', { id: 'pay_c2', order_id: 'order_course_2', status: 'failed' })).toMatchObject({ status: 200, body: { ok: true } });
    expect(db.courseSql.length).toBe(2);
    expect(db.courseSql[1]).toMatch(/^UPDATE course_payments/);
    expect(lifelines()).toBe(3);
  });

  it('keeps working for course orders even if the lifeline table is missing in the database', async () => {
    const realSql = sql;
    // make the lookup fail the way Postgres does for a missing relation
    prisma.$queryRawUnsafe = (async (text: string, ...a: any[]) => {
      if (text.includes('SELECT 1 FROM lifeline_razorpay_orders')) {
        throw Object.assign(new Error('relation "lifeline_razorpay_orders" does not exist'), { code: 'P2010', meta: { code: '42P01' } });
      }
      return realSql(text, ...a);
    }) as any;
    try {
      expect(await webhook('payment.failed', { id: 'pay_c3', order_id: 'order_course_3', status: 'failed' })).toMatchObject({ status: 200 });
      expect(db.courseSql).toHaveLength(1); // fell through to the course logic
    } finally {
      prisma.$queryRawUnsafe = realSql;
    }
  });

  it('signature checks and the no-secret acknowledgement are unchanged', async () => {
    expect((await webhook('payment.captured', { id: 'pay_c', order_id: 'order_course_1' }, 'forged')).status).toBe(400);
    env.RAZORPAY_WEBHOOK_SECRET = undefined;
    expect(await webhook('payment.captured', { id: 'pay_c', order_id: 'order_course_1' })).toMatchObject({ status: 200, body: { ok: true } });
    expect(db.courseSql).toEqual([]);
  });
});

describe('Reconciliation job', () => {
  it('recovers a captured payment whose browser verification never completed', async () => {
    const { orderId } = (await createOrder()).body.data;
    pay(orderId); // member paid, then closed the tab — no verify, no webhook
    age(orderId, 11 * MIN);
    const summary = await reconcile();
    expect(summary).toMatchObject({ claimed: 1, credited: 1 });
    expect(lifelines()).toBe(4);
    expect(db.orders[0].status).toBe('paid');
  });

  it('leaves orders younger than 10 minutes to the browser/webhook', async () => {
    const { orderId } = (await createOrder()).body.data;
    pay(orderId);
    expect((await reconcile()).claimed).toBe(0);
    expect(lifelines()).toBe(3);
  });

  it('never credits failed, authorized, refunded or wrong-amount/currency payments, or unpaid orders', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ status: 'failed' }, 'attempted'],
      [{ status: 'authorized' }, 'attempted'],
      [{ status: 'refunded' }, 'paid'],
      [{ amount: 100 }, 'paid'],
      [{ currency: 'USD' }, 'paid'],
    ];
    for (const [over, orderStatus] of cases) {
      const { orderId } = (await createOrder()).body.data;
      pay(orderId, over, orderStatus);
      age(orderId, 20 * MIN);
    }
    const { orderId: unpaid } = (await createOrder()).body.data;
    age(unpaid, 20 * MIN);
    const summary = await reconcile();
    expect(summary.claimed).toBe(6);
    expect(summary.credited).toBe(0);
    expect(summary.rejected).toBe(2); // captured but wrong amount / currency
    expect(lifelines()).toBe(3);
    expect(db.orders.some((o) => o.status === 'paid')).toBe(false);
  });

  it('a payment already credited by verify is not credited again', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    await verify(ME, orderId, paymentId);
    age(orderId, 20 * MIN);
    expect((await reconcile()).claimed).toBe(0); // paid orders are never claimed
    expect(lifelines()).toBe(4);
  });

  it('overlapping runs claim disjoint orders and credit each order once', async () => {
    for (let i = 0; i < 4; i++) {
      const { orderId } = (await createOrder()).body.data;
      pay(orderId);
      age(orderId, 20 * MIN);
    }
    const [r1, r2] = await Promise.all([reconcile({ batchSize: 3 }), reconcile({ batchSize: 3 })]);
    expect(r1.claimed + r2.claimed).toBe(4);
    expect(r1.credited + r2.credited).toBe(4);
    expect(lifelines()).toBe(7);
  });

  it('a just-checked order is not re-checked within 10 minutes; the batch size bounds each run', async () => {
    for (let i = 0; i < 3; i++) {
      const { orderId } = (await createOrder()).body.data;
      age(orderId, 20 * MIN);
    }
    expect((await reconcile({ batchSize: 2 })).claimed).toBe(2);
    expect((await reconcile({ batchSize: 2 })).claimed).toBe(1);
    expect((await reconcile({ batchSize: 2 })).claimed).toBe(0);
  });

  it('Razorpay failures are retried on a later run; a rate limit stops the run early', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { orderId } = (await createOrder()).body.data;
      pay(orderId);
      age(orderId, 20 * MIN);
      ids.push(orderId);
    }
    rzp.rateLimited = true;
    const limited = await reconcile();
    expect(limited).toMatchObject({ rateLimited: true, credited: 0, errors: 1 });
    rzp.rateLimited = false;
    for (const o of db.orders) o.lastCheckedAt = Date.now() - 11 * MIN; // re-check window passed
    expect((await reconcile()).credited).toBe(2);
    expect(lifelines()).toBe(5);
  });

  it('expires unpaid orders after 7 days; a capture arriving later is still credited', async () => {
    const { orderId: stale } = (await createOrder()).body.data;
    age(stale, 8 * DAY);
    const { orderId: young } = (await createOrder()).body.data;
    age(young, 2 * DAY);
    const { orderId: authorizedOld } = (await createOrder()).body.data;
    pay(authorizedOld, { status: 'authorized' }, 'attempted');
    age(authorizedOld, 8 * DAY);
    const summary = await reconcile();
    expect(summary).toMatchObject({ expired: 1, unpaid: 1, pending: 1 });
    expect(db.orders.find((o) => o.orderId === stale)!.status).toBe('expired');
    expect(db.orders.find((o) => o.orderId === young)!.status).toBe('created');
    expect(db.orders.find((o) => o.orderId === authorizedOld)!.status).toBe('created'); // could still be captured
    // a late capture of the expired order is still honoured (money taken → lifeline added)
    const latePayment = pay(stale);
    expect((await verify(ME, stale, latePayment)).body.data.lifelineAdded).toBe(true);
    expect(lifelines()).toBe(4);
  });
});
