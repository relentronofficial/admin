import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real Extra Lifeline purchase handlers against a small in-memory store that
// answers the SQL they issue, with Razorpay replaced by a fake whose orders and
// payments the test controls. Signature checking is mocked as a deterministic
// "sig:<order>|<payment>" token (the HMAC itself lives in lib/razorpay.ts).

const env = vi.hoisted(() => ({ RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'secret' as string | undefined }));
const rzp = vi.hoisted(() => ({
  orders: new Map<string, any>(),
  payments: new Map<string, any>(),
  seq: 0,
  down: false,
}));
vi.mock('../../config/env.js', () => ({ env }));
vi.mock('../../lib/razorpay.js', () => ({
  verifyPaymentSignature: (o: string, p: string, s: string) => s === `sig:${o}|${p}`,
  getRazorpay: () => ({
    orders: {
      create: async (o: any) => {
        const order = { id: `order_${++rzp.seq}`, status: 'created', ...o };
        rzp.orders.set(order.id, order);
        return order;
      },
      fetch: async (id: string) => {
        if (rzp.down) throw new Error('network');
        return rzp.orders.get(id);
      },
    },
    payments: {
      fetch: async (id: string) => {
        if (rzp.down) throw new Error('network');
        return rzp.payments.get(id);
      },
    },
  }),
}));

const { createLifelineOrderHandler, verifyLifelinePaymentHandler } = await import('./lifelinePurchase.js');

const ME = '30000000-0000-0000-0000-000000000001';
const OTHER = '30000000-0000-0000-0000-000000000002';
const BATCH = '20000000-0000-0000-0000-000000000001';

interface Store {
  members: Record<string, { batchId: string | null }>;
  pricing: Record<string, { price_inr: string; label: string }>;
  orders: Array<{ orderId: string; memberId: string; batchId: string; amountPaise: number; currency: string; status: string; paymentId: string | null }>;
  settings: Array<{ memberId: string; batchId: string; total: number; used: number }>;
}
let db: Store;

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT batch_id::text AS "batchId" FROM members')) {
    const m = db.members[a[0]];
    return m ? [{ batchId: m.batchId }] : [];
  }
  if (q.startsWith('SELECT price_inr, label FROM credit_pricing')) return db.pricing[a[0]] ? [db.pricing[a[0]]] : [];
  if (q.startsWith('INSERT INTO lifeline_razorpay_orders')) {
    db.orders.push({ orderId: a[0], memberId: a[1], batchId: a[2], amountPaise: a[3], currency: 'INR', status: 'created', paymentId: null });
    return 1;
  }
  if (q.startsWith('SELECT order_id AS "orderId"')) {
    return db.orders.filter((o) => o.orderId === a[0]).map((o) => ({ ...o, amountPaise: String(o.amountPaise) }));
  }
  if (q.startsWith('UPDATE lifeline_razorpay_orders SET status = \'paid\'')) {
    if (db.orders.some((o) => o.paymentId === a[2])) throw new Error('duplicate key value violates unique constraint');
    const o = db.orders.find((x) => x.orderId === a[0] && x.memberId === a[1] && x.status === 'created');
    if (!o) return [];
    o.status = 'paid';
    o.paymentId = a[2];
    return [{ batchId: o.batchId }];
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
  if (q.startsWith('SELECT lifelines_total, lifelines_used FROM member_batch_settings')) {
    return db.settings.filter((s) => s.memberId === a[0] && s.batchId === a[1]).map((s) => ({ lifelines_total: s.total, lifelines_used: s.used }));
  }
  throw new Error(`Unhandled SQL: ${q}`);
}

const prisma = {
  $queryRawUnsafe: sql,
  $executeRawUnsafe: sql,
  $transaction: async (fn: (tx: any) => Promise<any>) => fn({ $queryRawUnsafe: sql, $executeRawUnsafe: sql }),
};

function call(handler: (req: any, reply: any) => Promise<any>, memberId: string, body?: unknown) {
  const res = { status: 200, body: undefined as any };
  const reply: any = {
    status(code: number) { res.status = code; return reply; },
    send(payload: unknown) { res.body = payload; return reply; },
  };
  return handler({ memberId, body, server: { prisma } }, reply).then(() => res);
}
const createOrder = (memberId = ME) => call(createLifelineOrderHandler, memberId);
const verify = (memberId: string, orderId: string, paymentId: string, signature = `sig:${orderId}|${paymentId}`) =>
  call(verifyLifelinePaymentHandler, memberId, { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
const lifelines = (memberId = ME) => db.settings.find((s) => s.memberId === memberId && s.batchId === BATCH)?.total ?? 3;

/** Simulate the member paying in Razorpay checkout: the order becomes paid and the payment captured. */
function pay(orderId: string, over: Record<string, unknown> = {}, orderStatus = 'paid') {
  const order = rzp.orders.get(orderId);
  order.status = orderStatus;
  const id = `pay_${++rzp.seq}`;
  rzp.payments.set(id, { id, order_id: orderId, amount: order.amount, currency: 'INR', status: 'captured', ...over });
  return id;
}

beforeEach(() => {
  env.RAZORPAY_KEY_SECRET = 'secret';
  rzp.orders.clear();
  rzp.payments.clear();
  rzp.down = false;
  db = {
    members: { [ME]: { batchId: BATCH }, [OTHER]: { batchId: BATCH } },
    pricing: { lifeline: { price_inr: '199.00', label: 'Extra Lifeline' } },
    orders: [],
    settings: [{ memberId: ME, batchId: BATCH, total: 3, used: 2 }],
  };
});

describe('POST /api/user/lifelines/razorpay/create-order', () => {
  it('creates a Razorpay order for exactly one Extra Lifeline at the configured credit_pricing price', async () => {
    const res = await createOrder();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ amount: 19900, currency: 'INR', keyId: 'rzp_test_key', label: 'Extra Lifeline' });
    const order = rzp.orders.get(res.body.data.orderId);
    expect(order).toMatchObject({ amount: 19900, currency: 'INR', notes: { memberId: ME, batchId: BATCH, type: 'lifeline_purchase' } });
    expect(db.orders).toEqual([{ orderId: order.id, memberId: ME, batchId: BATCH, amountPaise: 19900, currency: 'INR', status: 'created', paymentId: null }]);
  });

  it('follows an admin price change — the price is never hardcoded', async () => {
    db.pricing.lifeline.price_inr = '249.00';
    expect((await createOrder()).body.data.amount).toBe(24900);
  });

  it('refuses when no price is configured, the member is not in a batch, or Razorpay is not configured', async () => {
    delete (db.pricing as any).lifeline;
    expect(await createOrder()).toMatchObject({ status: 503, body: { error: { message: 'PRICE_NOT_CONFIGURED' } } });
    db.pricing.lifeline = { price_inr: '199.00', label: 'Extra Lifeline' };
    db.members[ME].batchId = null;
    expect(await createOrder()).toMatchObject({ status: 400, body: { error: { message: 'NOT_IN_BATCH' } } });
    db.members[ME].batchId = BATCH;
    env.RAZORPAY_KEY_SECRET = undefined;
    expect(await createOrder()).toMatchObject({ status: 503, body: { error: { message: 'RAZORPAY_NOT_CONFIGURED' } } });
    expect(rzp.orders.size).toBe(0);
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

  it('rejects an invalid signature without touching Razorpay or the lifelines', async () => {
    const { orderId } = (await createOrder()).body.data;
    const paymentId = pay(orderId);
    const res = await verify(ME, orderId, paymentId, 'forged');
    expect(res).toMatchObject({ status: 400, body: { error: { message: 'SIGNATURE_INVALID' } } });
    expect(lifelines()).toBe(3);
    expect(db.orders[0].status).toBe('created');
  });

  it("another member can't verify (or be credited for) someone else's order", async () => {
    const { orderId } = (await createOrder(ME)).body.data;
    const paymentId = pay(orderId);
    const res = await verify(OTHER, orderId, paymentId);
    expect(res).toMatchObject({ status: 403, body: { error: { message: 'ORDER_NOT_YOURS' } } });
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

  it('rejects missing payment details', async () => {
    expect((await call(verifyLifelinePaymentHandler, ME, {})).status).toBe(400);
  });
});
