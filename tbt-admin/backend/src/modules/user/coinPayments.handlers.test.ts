import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Payment-safety checks for TBT coins and paid support calls, driving the REAL
// handlers (verify, webhook, create-order, coin booking, quota, credit
// approval, admin pricing) against an in-memory store that answers the SQL
// they issue. Unlike supportCallCoins.handlers.test.ts, transactions here hold
// row (FOR UPDATE) and advisory locks until they finish, so duplicate webhooks
// and racing coin spends interleave the way they would against Postgres.
// Nothing here touches a real database, Razorpay or any member's data.

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

const envMock = vi.hoisted(() => ({
  env: {
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'test_key_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    PROGRAM_TIMEZONE: 'Asia/Kolkata',
    MENTORSHIP_DEMO_MEMBER_ID: '',
    MENTORSHIP_DEMO_EMAIL: '',
  } as Record<string, string | undefined>,
}));
vi.mock('../../config/env.js', () => envMock);
vi.mock('../../lib/pushNotifications.js', () => ({ sendPushToMember: async () => {} }));

const rzp = vi.hoisted(() => ({ created: [] as any[], nextOrderId: 1, failCreate: false }));
vi.mock('razorpay', () => ({
  default: class {
    orders = {
      create: async (o: any) => {
        if (rzp.failCreate) throw new Error('Razorpay API unavailable');
        const order = { id: `order_P${rzp.nextOrderId++}`, ...o };
        rzp.created.push(order);
        return order;
      },
      fetch: async () => { throw new Error('not found'); },
    };
  },
}));

const user = await import('./controller.js');
const admin = await import('../support-entitlements/controller.js');
const credits = await import('../credits/controller.js');
const userRouteModule = await import('./routes.js');
const creditsRouteModule = await import('../credits/routes.js');
const entitlementRouteModule = await import('../support-entitlements/routes.js');
const razorpayLib = await import('../../lib/razorpay.js');

const MEMBER = '31000000-0000-4000-8000-000000000001';
const OTHER = '31000000-0000-4000-8000-000000000002';
const S1 = '51000000-0000-4000-8000-000000000001';
const S2 = '51000000-0000-4000-8000-000000000002';
const S3 = '51000000-0000-4000-8000-000000000003';
const PKG = '61000000-0000-4000-8000-000000000001';
const CP1 = '81000000-0000-4000-8000-000000000001';
const MBS = '82000000-0000-4000-8000-000000000001';
const HOUR = 3_600_000;

let seq = 0;
const uuid = () => `9${String(++seq).padStart(7, '0')}-0000-4000-8000-000000000000`;

interface Store {
  members: Record<string, { plan: string; status: string; totalPoints: number }>;
  admins: Record<string, { id: string; fullName: string; role: string }>;
  entitlements: Record<string, { tech_support_days: number; ad_support_days: number; group_call_count: number; call_credit_count: number; one_to_one_enabled: boolean; sales_call_count: number; content_call_count: number }>;
  sessions: Array<{ id: string; category: string; title: string; startsAt: Date; durationMinutes: number; capacity: number; status: string; hostAdminId: string | null }>;
  bookings: Array<{ id: string; sessionId: string; memberId: string; status: string; coinCost: number | null; bookedAt: Date }>;
  usage: Array<{ memberId: string; type: string }>;
  ledger: Array<{ memberId: string; points: number; source: string; ref: string | null }>;
  pricing: Record<string, number | null>;
  packages: Array<{ id: string; label: string; coins: number; price_inr: number; is_active: boolean; sort_order: number }>;
  coinOrders: Array<{ id: string; memberId: string; rzpOrderId: string; packageId: string | null; coins: number; amountPaise: number; status: string; paymentId: string | null }>;
  creditPurchases: Array<{ id: string; memberId: string; creditType: string; quantity: number; status: string }>;
  batchSettings: Array<{ id: string; memberId: string; lifelinesTotal: number }>;
}
let db: Store;
let failNextSpend = false;

function fresh(): Store {
  const future = new Date(Date.now() + 48 * HOUR);
  return {
    members: {
      [MEMBER]: { plan: 'premium', status: 'active', totalPoints: 0 },
      [OTHER]: { plan: 'premium', status: 'active', totalPoints: 0 },
    },
    admins: {
      clerk_admin: { id: '71000000-0000-4000-8000-000000000001', fullName: 'Admin', role: 'admin' },
      clerk_mentor: { id: '71000000-0000-4000-8000-000000000002', fullName: 'Mentor', role: 'mentor' },
    },
    entitlements: {
      premium: { tech_support_days: 1, ad_support_days: 0, group_call_count: 0, call_credit_count: 0, one_to_one_enabled: false, sales_call_count: 0, content_call_count: 0 },
    },
    sessions: [S1, S2, S3].map((id, i) => ({
      id, category: 'tech_support', title: `Tech ${i + 1}`, startsAt: new Date(future.getTime() + i * HOUR),
      durationMinutes: 45, capacity: 5, status: 'scheduled', hostAdminId: null,
    })),
    bookings: [],
    usage: [],
    ledger: [],
    pricing: {},
    packages: [{ id: PKG, label: 'Starter', coins: 500, price_inr: 199, is_active: true, sort_order: 0 }],
    coinOrders: [],
    creditPurchases: [],
    batchSettings: [],
  };
}

const sessionRow = (s: Store['sessions'][number]) => ({
  id: s.id, category: s.category, title: s.title, description: null, host_admin_id: s.hostAdminId, host_name: null,
  starts_at: s.startsAt, duration_minutes: s.durationMinutes, capacity: s.capacity, status: s.status,
  created_at: s.startsAt, updated_at: s.startsAt, has_meeting_url: false, meeting_url: null, created_by: null,
  active_count: db.bookings.filter((b) => b.sessionId === s.id && b.status !== 'cancelled').length,
  booked_count: db.bookings.filter((b) => b.sessionId === s.id && b.status === 'booked').length,
});
const sessionOf = (id: string) => db.sessions.find((s) => s.id === id)!;
const balanceOf = (m: string) => db.ledger.filter((l) => l.memberId === m).reduce((a, l) => a + l.points, 0);

/** Answers exactly the statements these handlers issue; anything else is recorded. */
const unhandled: string[] = [];
async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT pg_advisory_xact_lock')) return [];
  if (q.includes('FROM plan_entitlements WHERE plan = $1')) return db.entitlements[a[0]] ? [db.entitlements[a[0]]] : [];
  // Upfront call-quota purchases (lib/supportQuota.ts): none are made in these tests.
  if (q.includes('FROM support_call_coin_purchases')) return [];
  if (q.includes('FROM support_usage')) {
    const counts: Record<string, number> = {};
    for (const u of db.usage.filter((u) => u.memberId === a[0])) counts[u.type] = (counts[u.type] ?? 0) + 1;
    return Object.entries(counts).map(([type, cnt]) => ({ type, cnt }));
  }
  // Credit purchases (MG-05)
  if (q.includes('FROM credit_purchases cp')) {
    return db.creditPurchases.filter((c) => c.id === a[0]).map((c) => {
      const mbs = db.batchSettings.find((s) => s.memberId === c.memberId);
      return { id: c.id, member_id: c.memberId, credit_type: c.creditType, quantity: c.quantity, status: c.status, mbs_id: mbs?.id ?? null, batch_id: null, lifelines_total: mbs?.lifelinesTotal ?? null };
    });
  }
  if (q.includes('FROM credit_purchases WHERE member_id = $1::uuid')) {
    const sums: Record<string, number> = {};
    for (const c of db.creditPurchases.filter((c) => c.memberId === a[0] && c.status === 'approved')) sums[c.creditType] = (sums[c.creditType] ?? 0) + c.quantity;
    return Object.entries(sums).map(([credit_type, qty]) => ({ credit_type, qty }));
  }
  if (q.startsWith("UPDATE credit_purchases SET status = 'approved'")) {
    const c = db.creditPurchases.find((x) => x.id === a[1] && (!q.includes("status = 'pending'") || x.status === 'pending'));
    if (c) c.status = 'approved';
    return q.includes('RETURNING') ? (c ? [{ id: c.id }] : []) : c ? 1 : 0;
  }
  if (q.startsWith('UPDATE member_batch_settings SET lifelines_total = lifelines_total + $1')) {
    const s = db.batchSettings.find((x) => x.id === a[1]);
    if (s) s.lifelinesTotal += a[0];
    return s ? 1 : 0;
  }
  if (q.includes('b.coin_cost IS NOT NULL') && q.includes('GROUP BY s.category')) {
    const counts: Record<string, number> = {};
    for (const b of db.bookings.filter((b) => b.memberId === a[0] && b.coinCost != null && b.status !== 'cancelled')) {
      const c = sessionOf(b.sessionId).category;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return Object.entries(counts).map(([type, cnt]) => ({ type, cnt }));
  }
  if (q.startsWith('SELECT s.category, COUNT(*)::int AS n FROM support_call_bookings b')) {
    const counts: Record<string, number> = {};
    for (const b of db.bookings.filter((b) => b.memberId === a[0] && b.status === 'booked' && sessionOf(b.sessionId).status === 'scheduled')) {
      const c = sessionOf(b.sessionId).category;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return Object.entries(counts).map(([category, n]) => ({ category, n }));
  }
  if (q.startsWith('SELECT COUNT(*)::int AS n FROM support_call_bookings b JOIN support_call_sessions s')) {
    return [{ n: db.bookings.filter((b) => b.memberId === a[0] && b.status === 'booked' && sessionOf(b.sessionId).status === 'scheduled' && sessionOf(b.sessionId).category === a[1]).length }];
  }
  if (q.startsWith('SELECT coin_cost FROM support_call_coin_pricing')) return a[0] in db.pricing ? [{ coin_cost: db.pricing[a[0]] }] : [];
  if (q.startsWith('SELECT category, coin_cost FROM support_call_coin_pricing')) return Object.entries(db.pricing).map(([category, coin_cost]) => ({ category, coin_cost }));
  if (q.startsWith('INSERT INTO support_call_coin_pricing')) { db.pricing[a[0]] = a[1]; return 1; }
  if (q.includes('FROM tbt_activity_log WHERE member_id = $1::uuid')) return [{ balance: BigInt(balanceOf(a[0])) }];

  // Sessions + bookings
  if (q.includes('FROM support_call_sessions s WHERE s.id = $1::uuid')) {
    const s = db.sessions.find((x) => x.id === a[0]);
    return s ? [sessionRow(s)] : [];
  }
  if (q.includes('FROM support_call_sessions s LEFT JOIN support_call_bookings mb')) {
    return db.sessions.filter((s) => s.category === a[1] && s.status === 'scheduled').map((s) => {
      const mine = db.bookings.find((b) => b.sessionId === s.id && b.memberId === a[0] && b.status !== 'cancelled');
      return { ...sessionRow(s), my_booking_id: mine?.id ?? null, my_booking_status: mine?.status ?? null, my_booking_coin_cost: mine?.coinCost ?? null };
    });
  }
  if (q.startsWith('SELECT b.id, b.status, b.booked_at, b.coin_cost, s.title')) {
    return db.bookings.filter((b) => b.memberId === a[0] && sessionOf(b.sessionId).category === a[1]).map((b) => {
      const s = sessionOf(b.sessionId);
      return { id: b.id, status: b.status, booked_at: b.bookedAt, coin_cost: b.coinCost, title: s.title, starts_at: s.startsAt, duration_minutes: s.durationMinutes, session_status: s.status };
    });
  }
  if (q.startsWith("SELECT COUNT(*)::int AS n FROM support_call_bookings WHERE session_id = $1::uuid AND status <> 'cancelled'")) {
    return [{ n: db.bookings.filter((b) => b.sessionId === a[0] && b.status !== 'cancelled').length }];
  }
  if (q.startsWith('SELECT id FROM support_call_bookings WHERE session_id = $1::uuid AND member_id = $2::uuid')) {
    return db.bookings.filter((b) => b.sessionId === a[0] && b.memberId === a[1] && b.status !== 'cancelled').map((b) => ({ id: b.id }));
  }
  if (q.startsWith('INSERT INTO support_call_bookings')) {
    if (db.bookings.some((b) => b.sessionId === a[0] && b.memberId === a[1] && b.status !== 'cancelled')) {
      throw Object.assign(new Error('duplicate key value violates unique constraint "uq_support_call_bookings_active"'), { meta: { code: '23505' } });
    }
    const b = { id: uuid(), sessionId: a[0], memberId: a[1], status: 'booked', coinCost: q.includes('coin_cost) VALUES') ? a[2] : null, bookedAt: new Date() };
    db.bookings.push(b);
    return [{ id: b.id, status: b.status, booked_at: b.bookedAt, coin_cost: b.coinCost }];
  }
  if (q.includes('FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id WHERE b.id = $1::uuid AND b.member_id = $2::uuid')) {
    const b = db.bookings.find((x) => x.id === a[0] && x.memberId === a[1]);
    return b ? [{ ...sessionRow(sessionOf(b.sessionId)), id: b.id, booking_status: b.status, coin_cost: b.coinCost }] : [];
  }
  if (q.startsWith("UPDATE support_call_bookings SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id")) {
    db.bookings.find((b) => b.id === a[0])!.status = 'cancelled';
    return 1;
  }

  // Ledger
  if (q.startsWith('INSERT INTO tbt_activity_log')) {
    const source = q.match(/VALUES \(\$1::uuid, \$2, '([a-z_]+)'/)?.[1] ?? 'unknown';
    if (source === 'support_call_unlock' && failNextSpend) { failNextSpend = false; throw new Error('ledger write failed'); }
    const ref = a[2] ?? null;
    // The (member_id, source, reference_id) unique index.
    if (ref && db.ledger.some((l) => l.memberId === a[0] && l.source === source && l.ref === ref)) return [];
    db.ledger.push({ memberId: a[0], points: a[1], source, ref });
    return [{ id: uuid() }];
  }
  if (q.startsWith('UPDATE members SET total_points')) { db.members[a[1]].totalPoints += a[0]; return 1; }

  // Coin packages + orders
  if (q.startsWith('SELECT id, label, coins, price_inr FROM coin_packages WHERE id')) return db.packages.filter((p) => p.id === a[0] && p.is_active);
  if (q.startsWith('SELECT id, label, coins, price_inr FROM coin_packages WHERE is_active')) return db.packages.filter((p) => p.is_active);
  if (q.startsWith('SELECT id, label, coins, price_inr, is_active, sort_order FROM coin_packages ORDER BY')) return [...db.packages];
  if (q.startsWith('INSERT INTO coin_packages')) {
    const p = { id: uuid(), label: a[0], coins: a[1], price_inr: a[2], is_active: a[3], sort_order: a[4] };
    db.packages.push(p);
    return [p];
  }
  if (q.startsWith('INSERT INTO coin_orders')) {
    if (db.coinOrders.some((o) => o.rzpOrderId === a[1])) return 0;
    const withPackage = q.includes('package_id');
    db.coinOrders.push({
      id: uuid(), memberId: a[0], rzpOrderId: a[1], packageId: withPackage ? a[2] : null,
      coins: withPackage ? a[3] : a[2], amountPaise: withPackage ? a[4] : a[3], status: 'created', paymentId: null,
    });
    return 1;
  }
  if (q.startsWith('SELECT id, member_id, coins, amount_paise, status FROM coin_orders')) {
    return db.coinOrders.filter((o) => o.rzpOrderId === a[0]).map((o) => ({ id: o.id, member_id: o.memberId, coins: o.coins, amount_paise: o.amountPaise, status: o.status }));
  }
  if (q.startsWith("UPDATE coin_orders SET status = 'paid'")) {
    const o = db.coinOrders.find((x) => x.id === a[0])!;
    o.status = 'paid';
    o.paymentId = a[1];
    return 1;
  }
  if (q.startsWith("UPDATE coin_orders SET status = 'failed'")) {
    const o = db.coinOrders.find((x) => x.rzpOrderId === a[0] && x.status === 'created');
    if (o) o.status = 'failed';
    return o ? 1 : 0;
  }
  if (q.includes('FROM course_payments') || q.startsWith('UPDATE course_payments')) return q.startsWith('UPDATE') ? 0 : [];
  // The shared webhook looks for an Extra Lifeline order first; none exist here.
  if (q.startsWith('SELECT 1 FROM lifeline_razorpay_orders WHERE order_id')) return [];
  // Fire-and-forget admin bell entry written after a booking.
  if (q.startsWith('INSERT INTO admin_notifications')) return 1;

  unhandled.push(q.slice(0, 120));
  return q.startsWith('SELECT') || q.includes('RETURNING') ? [] : 0;
}

// Row locks (FOR UPDATE) and advisory xact locks are held until the transaction
// ends, so parallel handler calls interleave as they would against Postgres.
const heldLocks = new Map<string, Promise<void>>();
async function acquire(key: string, owned: Map<string, () => void>) {
  if (owned.has(key)) return;
  while (heldLocks.has(key)) await heldLocks.get(key);
  let release!: () => void;
  heldLocks.set(key, new Promise<void>((r) => (release = r)));
  owned.set(key, () => { heldLocks.delete(key); release(); });
}
function lockKey(q: string, a: any[]): string | null {
  if (q.startsWith('SELECT pg_advisory_xact_lock')) return `advisory:${a[0]}`;
  if (q.includes('FOR UPDATE') && typeof a[0] === 'string') return `row:${a[0]}`;
  return null;
}

function prisma(owned?: Map<string, () => void>): any {
  const run = async (text: string, ...a: any[]) => {
    const key = owned ? lockKey(text.replace(/\s+/g, ' ').trim(), a) : null;
    if (key) await acquire(key, owned!);
    // Yield once per statement so concurrent requests really interleave.
    await Promise.resolve();
    return sql(text, ...a);
  };
  return {
    $queryRawUnsafe: run,
    $executeRawUnsafe: run,
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const locks = new Map<string, () => void>();
      const snapshot = structuredClone(db);
      try {
        return await fn(prisma(locks));
      } catch (err) {
        db = snapshot;
        throw err;
      } finally {
        for (const release of locks.values()) release();
      }
    },
    member: {
      findUnique: async ({ where }: any) => {
        const m = db.members[where.id];
        return m ? { membershipPlan: m.plan, status: m.status, batchId: null, firstName: 'Test', lastName: 'Member' } : null;
      },
    },
    admin: { findUnique: async ({ where }: any) => (where.clerkId ? db.admins[where.clerkId] ?? null : null) },
    appNotification: { create: async () => ({}) },
  };
}

async function call(handler: any, opts: { memberId?: string; clerk?: string; params?: any; body?: any; query?: any; headers?: any; rawBody?: string } = {}) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    header() { return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = {
    memberId: opts.memberId, user: opts.clerk, params: opts.params ?? {}, body: opts.body, query: opts.query ?? {},
    headers: opts.headers ?? {}, rawBody: opts.rawBody,
    server: { prisma: prisma(), redis: null, io: undefined, log: { error() {}, warn() {} } },
    log: { error() {}, warn() {} },
  };
  await handler(req, reply);
  return sent;
}

const book = (sessionId: string, body?: any, memberId = MEMBER) => call(user.bookSupportCallHandler, { memberId, params: { id: sessionId }, body });
const cancel = (bookingId: string, memberId = MEMBER) => call(user.cancelSupportCallBookingHandler, { memberId, params: { id: bookingId } });
const quotaOf = async (memberId = MEMBER) => (await call(user.getSupportQuotaHandler, { memberId })).body.data;
const summaryOf = async (memberId = MEMBER) => (await call(user.getSupportCallsSummaryHandler, { memberId })).body.data;
const cardOf = async (category: string, memberId = MEMBER) => (await summaryOf(memberId)).categories.find((c: any) => c.category === category);
const sign = (orderId: string, paymentId: string, secret = KEY_SECRET) => crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
const giveCoins = (memberId: string, points: number) => db.ledger.push({ memberId, points, source: 'task_completion', ref: null });

async function order(body?: any, memberId = MEMBER) {
  const r = await call(user.createCoinOrderHandler, { memberId, body });
  return r.body.data as { orderId: string; amount: number; coins: number };
}
const verify = (orderId: string, paymentId: string, memberId = MEMBER, signature: unknown = sign(orderId, paymentId)) =>
  call(user.verifyCoinPaymentHandler, { memberId, body: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature } });
function webhook(event: string, entity: any, signWith = WEBHOOK_SECRET) {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity } } });
  const signature = crypto.createHmac('sha256', signWith).update(rawBody).digest('hex');
  return call(user.razorpayWebhookHandler, { rawBody, headers: { 'x-razorpay-signature': signature } });
}
const rawWebhook = (rawBody: string | undefined, signature?: string) =>
  call(user.razorpayWebhookHandler, { rawBody, headers: signature === undefined ? {} : { 'x-razorpay-signature': signature } });

/** Runs `fn` with some env values changed, restoring them afterwards. */
async function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(overrides).map((k) => [k, envMock.env[k]]));
  Object.assign(envMock.env, overrides);
  try { await fn(); } finally { Object.assign(envMock.env, saved); }
}

afterEach(() => {
  expect(unhandled).toEqual([]);
});

beforeEach(() => {
  db = fresh();
  failNextSpend = false;
  rzp.created = [];
  rzp.failCreate = false;
  unhandled.length = 0;
});

// ── Razorpay payments ────────────────────────────────────────────────────────

describe('successful payments', () => {
  it('verify credits the ledger, the cached total and the order exactly once', async () => {
    const o = await order({ packageId: PKG });
    const r = await verify(o.orderId, 'pay_S1');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ coinsAdded: 500, totalCoins: 500, alreadyProcessed: false });
    expect(db.ledger).toEqual([{ memberId: MEMBER, points: 500, source: 'coin_purchase', ref: db.coinOrders[0].id }]);
    expect(db.members[MEMBER].totalPoints).toBe(500);
    expect(db.coinOrders[0]).toMatchObject({ status: 'paid', paymentId: 'pay_S1' });
  });

  it('the amount charged comes from the package, never the request', async () => {
    const o = await order({ packageId: PKG, coins: 999_999, priceInr: 1, amount: 1 });
    expect(o).toMatchObject({ amount: 19900, coins: 500 });
    expect(rzp.created[0]).toMatchObject({ amount: 19900, currency: 'INR' });
  });

  it('two orders from the same member each credit their own coins', async () => {
    const a = await order({ packageId: PKG });
    const b = await order();
    await verify(a.orderId, 'pay_S3');
    await verify(b.orderId, 'pay_S4');
    expect(balanceOf(MEMBER)).toBe(700);
    expect(db.coinOrders.map((x) => x.status)).toEqual(['paid', 'paid']);
  });
});

describe('failed payments', () => {
  it('payment.failed marks the order failed and credits nothing', async () => {
    const o = await order({ packageId: PKG });
    expect((await webhook('payment.failed', { id: 'pay_F1', order_id: o.orderId, error_description: 'card declined' })).body).toEqual({ ok: true });
    expect(db.coinOrders[0].status).toBe('failed');
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('payment.failed never downgrades an order that was already paid', async () => {
    const o = await order({ packageId: PKG });
    await verify(o.orderId, 'pay_P1');
    await webhook('payment.failed', { id: 'pay_P2', order_id: o.orderId, error_description: 'late failure event' });
    expect(db.coinOrders[0].status).toBe('paid');
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('after a failed attempt, a successful retry on the same order credits once', async () => {
    const o = await order({ packageId: PKG });
    await webhook('payment.failed', { id: 'pay_R1', order_id: o.orderId, error_description: 'insufficient funds' });
    expect((await verify(o.orderId, 'pay_R2')).body.data).toMatchObject({ coinsAdded: 500 });
    await webhook('payment.captured', { id: 'pay_R2', order_id: o.orderId, amount: 19900 });
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.coinOrders[0]).toMatchObject({ status: 'paid', paymentId: 'pay_R2' });
  });

  it('a failure event for an unknown order changes nothing', async () => {
    expect((await webhook('payment.failed', { id: 'pay_U1', order_id: 'order_UNKNOWN', error_description: 'x' })).body).toEqual({ ok: true });
    expect(db.coinOrders).toHaveLength(0);
    expect(db.ledger).toHaveLength(0);
  });

  it('verify for an order that was never created is 404', async () => {
    expect((await verify('order_NEVER', 'pay_N1')).status).toBe(404);
    expect(db.ledger).toHaveLength(0);
  });

  it('a captured amount that does not match the order is not credited', async () => {
    const o = await order({ packageId: PKG });
    expect((await webhook('payment.captured', { id: 'pay_M1', order_id: o.orderId, amount: 100 })).body).toEqual({ ok: true });
    expect(balanceOf(MEMBER)).toBe(0);
    expect(db.coinOrders[0].status).toBe('created');
  });

  it('when Razorpay cannot create the order, nothing is recorded', async () => {
    rzp.failCreate = true;
    const r = await call(user.createCoinOrderHandler, { memberId: MEMBER, body: { packageId: PKG } });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatchObject({ message: 'ORDER_CREATE_FAILED' });
    expect(db.coinOrders).toHaveLength(0);
  });
});

describe('invalid signatures', () => {
  it('verify rejects a signature for a different payment id, order id, or secret', async () => {
    const a = await order({ packageId: PKG });
    const b = await order({ packageId: PKG });
    expect((await verify(a.orderId, 'pay_REAL', MEMBER, sign(a.orderId, 'pay_OTHER'))).status).toBe(400);
    expect((await verify(b.orderId, 'pay_1', MEMBER, sign(a.orderId, 'pay_1'))).status).toBe(400);
    expect((await verify(a.orderId, 'pay_1', MEMBER, sign(a.orderId, 'pay_1', 'attacker_secret'))).status).toBe(400);
    expect((await verify(a.orderId, 'pay_1', MEMBER, sign(a.orderId, 'pay_1', WEBHOOK_SECRET))).status).toBe(400);
    expect(db.ledger).toHaveLength(0);
    expect(db.coinOrders.map((o) => o.status)).toEqual(['created', 'created']);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a string', 12345],
    ['an object', { sig: 'x' }],
    ['truncated', 'abc123'],
    ['upper-cased', 'UPPER'],
    ['multi-byte characters of the right length', 'é'.repeat(64)],
  ])('verify rejects a %s signature with 400, never 500', async (_label, sig) => {
    const o = await order({ packageId: PKG });
    const signature = sig === 'UPPER' ? sign(o.orderId, 'pay_1').toUpperCase() : sig;
    // Called directly: the verify() helper would replace an undefined signature with a valid one.
    const r = await call(user.verifyCoinPaymentHandler, { memberId: MEMBER, body: { razorpayOrderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: signature } });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ message: 'SIGNATURE_INVALID' });
    expect(db.ledger).toHaveLength(0);
  });

  it('webhook rejects a missing header, missing body, forged or multi-byte signature', async () => {
    const o = await order({ packageId: PKG });
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X', order_id: o.orderId, amount: 19900 } } } });
    expect((await rawWebhook(rawBody)).status).toBe(400);
    expect((await rawWebhook(undefined, 'a'.repeat(64))).status).toBe(400);
    expect((await rawWebhook(rawBody, 'a'.repeat(64))).status).toBe(400);
    expect((await rawWebhook(rawBody, 'é'.repeat(64))).status).toBe(400);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('webhook rejects a body changed after signing (amount raised)', async () => {
    const o = await order({ packageId: PKG });
    const signed = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_T', order_id: o.orderId, amount: 100 } } } });
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(signed).digest('hex');
    expect((await rawWebhook(signed.replace('"amount":100', '"amount":19900'), signature)).status).toBe(400);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('webhook signed with the API key secret instead of the webhook secret is rejected', async () => {
    const o = await order({ packageId: PKG });
    expect((await webhook('payment.captured', { id: 'pay_K', order_id: o.orderId, amount: 19900 }, KEY_SECRET)).status).toBe(400);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('a forged payment.failed webhook cannot mark an order failed', async () => {
    const o = await order({ packageId: PKG });
    expect((await webhook('payment.failed', { id: 'pay_FF', order_id: o.orderId }, 'attacker_secret')).status).toBe(400);
    expect(db.coinOrders[0].status).toBe('created');
  });
});

describe('duplicate webhooks', () => {
  it('the same payment.captured delivered three times credits once', async () => {
    const o = await order({ packageId: PKG });
    for (let i = 0; i < 3; i++) {
      expect((await webhook('payment.captured', { id: 'pay_D1', order_id: o.orderId, amount: 19900 })).body).toEqual({ ok: true });
    }
    expect(db.ledger.filter((l) => l.source === 'coin_purchase')).toHaveLength(1);
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.members[MEMBER].totalPoints).toBe(500);
  });

  it('five simultaneous deliveries of the same capture credit once', async () => {
    const o = await order({ packageId: PKG });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => webhook('payment.captured', { id: 'pay_D2', order_id: o.orderId, amount: 19900 })),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.members[MEMBER].totalPoints).toBe(500);
  });

  it('verify and the webhook racing for the same payment credit once', async () => {
    const o = await order({ packageId: PKG });
    const [v] = await Promise.all([
      verify(o.orderId, 'pay_D3'),
      webhook('payment.captured', { id: 'pay_D3', order_id: o.orderId, amount: 19900 }),
      verify(o.orderId, 'pay_D3'),
    ]);
    expect(v.status).toBe(200);
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.members[MEMBER].totalPoints).toBe(500);
  });

  it('duplicate failure events, then the capture, credit exactly once', async () => {
    const o = await order({ packageId: PKG });
    await webhook('payment.failed', { id: 'pay_D4', order_id: o.orderId, error_description: 'declined' });
    await webhook('payment.failed', { id: 'pay_D4', order_id: o.orderId, error_description: 'declined' });
    await webhook('payment.captured', { id: 'pay_D5', order_id: o.orderId, amount: 19900 });
    await webhook('payment.captured', { id: 'pay_D5', order_id: o.orderId, amount: 19900 });
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.coinOrders[0]).toMatchObject({ status: 'paid', paymentId: 'pay_D5' });
  });

  it('a second, different payment captured on an already-paid order credits nothing more and keeps the first payment id', async () => {
    // Razorpay can capture two payments on one order (e.g. a double tap). The member
    // gets the coins once; the extra payment has to be refunded from the dashboard.
    const o = await order({ packageId: PKG });
    await webhook('payment.captured', { id: 'pay_D6', order_id: o.orderId, amount: 19900 });
    await webhook('payment.captured', { id: 'pay_D7', order_id: o.orderId, amount: 19900 });
    expect(balanceOf(MEMBER)).toBe(500);
    expect(db.coinOrders[0].paymentId).toBe('pay_D6');
  });
});

// ── Spending coins on extra calls ────────────────────────────────────────────

describe('insufficient coin balances', () => {
  beforeEach(() => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' }); // the 1 included call is used
    db.pricing.tech_support = 120;
  });

  it('a balance exactly equal to the price books and leaves 0', async () => {
    giveCoins(MEMBER, 120);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ coinsSpent: 120, coinBalance: 0 });
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('one coin short: 402 with the real numbers, no booking and no ledger row', async () => {
    giveCoins(MEMBER, 119);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(402);
    expect(r.body.error).toMatchObject({ code: 'insufficient_coins', message: 'You need 120 TBT coins but have 119.' });
    expect(db.bookings).toHaveLength(0);
    expect(db.ledger.filter((l) => l.source === 'support_call_unlock')).toHaveLength(0);
  });

  it('a zero or negative balance is refused and never goes further below zero', async () => {
    giveCoins(MEMBER, -30);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(402);
    expect(r.body.error.message).toBe('You need 120 TBT coins but have 0.');
    expect(balanceOf(MEMBER)).toBe(-30);
  });

  it('two simultaneous paid bookings with coins for only one: exactly one succeeds, balance never negative', async () => {
    giveCoins(MEMBER, 150);
    const results = await Promise.all([
      book(S1, { payWithCoins: true, expectedCoinCost: 120 }),
      book(S2, { payWithCoins: true, expectedCoinCost: 120 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 402]);
    expect(balanceOf(MEMBER)).toBe(30);
    expect(db.bookings.filter((b) => b.status === 'booked')).toHaveLength(1);
  });

  it('three simultaneous paid bookings with coins for two: exactly two succeed', async () => {
    giveCoins(MEMBER, 240);
    const results = await Promise.all([S1, S2, S3].map((s) => book(s, { payWithCoins: true, expectedCoinCost: 120 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 402)).toHaveLength(1);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('the card offers Purchase TBT Coins while short, and Unlock once a purchase covers it', async () => {
    giveCoins(MEMBER, 50);
    expect(await cardOf('tech_support')).toMatchObject({ action: 'purchase_coins', coinCost: 120 });
    const o = await order({ packageId: PKG });
    await verify(o.orderId, 'pay_I1');
    expect(await cardOf('tech_support')).toMatchObject({ action: 'unlock_with_coins' });
    expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).body.data).toMatchObject({ coinBalance: 430 });
  });
});

describe('extra-call purchase and entitlement granting', () => {
  it('a coin-paid call adds exactly one allocation on top of the plan, and attending it keeps the books balanced', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    giveCoins(MEMBER, 500);
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 1, used: 1, remaining: 0, unlocked: 0 });

    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 2, used: 1, unlocked: 1 });

    // Admin marks it attended: one support_usage row, booking stays coin-paid.
    db.bookings.find((b) => b.id === r.body.data.id)!.status = 'attended';
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 2, used: 2, remaining: 0, unlocked: 1 });
    // No free call appeared out of the paid one.
    expect((await book(S2)).body.error.code).toBe('quota_exhausted');
  });

  it('cancelling a coin-paid call removes the extra allocation and refunds once', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    giveCoins(MEMBER, 500);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    await cancel(r.body.data.id);
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 1, unlocked: 0 });
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('an approved support-credit purchase adds included calls that book without coins', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.creditPurchases.push({ id: CP1, memberId: MEMBER, creditType: 'tech_support', quantity: 2, status: 'pending' });
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 1, remaining: 0 });

    const r = await call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } });
    expect(r.status).toBe(200);
    expect((await quotaOf()).techSupport).toMatchObject({ allocated: 3, used: 1, remaining: 2 });
    const b = await book(S1);
    expect(b.status).toBe(201);
    expect(b.body.data).toMatchObject({ paidWithCoins: false, coinsSpent: 0 });
  });

  it('pending and rejected purchases grant nothing', async () => {
    db.creditPurchases.push(
      { id: CP1, memberId: MEMBER, creditType: 'tech_support', quantity: 5, status: 'pending' },
      { id: uuid(), memberId: MEMBER, creditType: 'tech_support', quantity: 5, status: 'rejected' },
    );
    expect((await quotaOf()).techSupport.allocated).toBe(1);
  });

  it("one member's approved purchase never changes another member's quota", async () => {
    db.creditPurchases.push({ id: CP1, memberId: OTHER, creditType: 'tech_support', quantity: 4, status: 'pending' });
    await call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } });
    expect((await quotaOf(MEMBER)).techSupport.allocated).toBe(1);
    expect((await quotaOf(OTHER)).techSupport.allocated).toBe(5);
  });

  it('approving the same purchase twice grants it once (second is 409)', async () => {
    db.batchSettings.push({ id: MBS, memberId: MEMBER, lifelinesTotal: 3 });
    db.creditPurchases.push({ id: CP1, memberId: MEMBER, creditType: 'lifeline', quantity: 2, status: 'pending' });
    expect((await call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } })).status).toBe(200);
    expect((await call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } })).status).toBe(409);
    expect(db.batchSettings[0].lifelinesTotal).toBe(5);
  });

  it('two admins approving the same lifeline purchase at the same moment grant it once', async () => {
    db.batchSettings.push({ id: MBS, memberId: MEMBER, lifelinesTotal: 3 });
    db.creditPurchases.push({ id: CP1, memberId: MEMBER, creditType: 'lifeline', quantity: 2, status: 'pending' });
    const results = await Promise.all([
      call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } }),
      call(credits.approvePurchaseHandler, { clerk: 'clerk_admin', params: { id: CP1 } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(db.batchSettings[0].lifelinesTotal).toBe(5);
  });
});

describe('missing category pricing', () => {
  beforeEach(() => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    giveCoins(MEMBER, 1000);
  });

  it('with no price row the card is locked and a coin booking is refused without charging', async () => {
    expect(await cardOf('tech_support')).toMatchObject({ action: 'locked', lockedReason: 'quota_exhausted', coinCost: null });
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('coin_unlock_unavailable');
    expect(balanceOf(MEMBER)).toBe(1000);
    expect(db.bookings).toHaveLength(0);
  });

  it('a price the admin cleared (null) behaves the same as no row', async () => {
    db.pricing.tech_support = null;
    expect(await cardOf('tech_support')).toMatchObject({ action: 'locked', coinCost: null });
    expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).body.error.code).toBe('coin_unlock_unavailable');
  });

  it('a price for one category never applies to another', async () => {
    db.pricing.group_call = 80;
    expect(await cardOf('tech_support')).toMatchObject({ action: 'locked', coinCost: null });
    expect(await cardOf('group_call')).toMatchObject({ action: 'locked', lockedReason: 'not_included', coinCost: 80 });
  });

  it('a price cleared after the member saw it is refused, not charged', async () => {
    db.pricing.tech_support = 120;
    expect((await cardOf('tech_support')).action).toBe('unlock_with_coins');
    await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'tech_support' }, body: { coinCost: null } });
    expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).body.error.code).toBe('coin_unlock_unavailable');
    expect(balanceOf(MEMBER)).toBe(1000);
  });

  it('a price raised after booking: the booking keeps and refunds the price it was paid at', async () => {
    db.pricing.tech_support = 120;
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'tech_support' }, body: { coinCost: 200 } });
    expect((await book(S2, { payWithCoins: true, expectedCoinCost: 120 })).body.error.code).toBe('coin_price_changed');
    expect((await cancel(r.body.data.id)).body.data.coinsRefunded).toBe(120);
    expect(balanceOf(MEMBER)).toBe(1000);
  });

  it('the admin price list reports every category, null where unset', async () => {
    db.pricing.tech_support = 120;
    const r = await call(admin.listCallCoinPricingHandler, { clerk: 'clerk_admin' });
    expect(r.body.data).toHaveLength(6);
    expect(r.body.data.find((c: any) => c.category === 'tech_support').coinCost).toBe(120);
    expect(r.body.data.filter((c: any) => c.coinCost === null)).toHaveLength(5);
  });
});

// ── Authentication and isolation ─────────────────────────────────────────────

/** A minimal Fastify stand-in that records hooks and routes in registration order. */
function recordRoutes() {
  const events: Array<{ kind: 'hook' | 'route'; detail: string; handler?: unknown }> = [];
  const authenticateUser = Symbol('authenticateUser');
  const authenticate = Symbol('authenticate');
  const route = (method: string) => (path: string, ...rest: unknown[]) => { events.push({ kind: 'route', detail: `${method} ${path}`, handler: rest[rest.length - 1] }); };
  const fake: any = {
    authenticateUser, authenticate,
    addHook: (name: string, fn: unknown) => events.push({ kind: 'hook', detail: name, handler: fn }),
    get: route('GET'), post: route('POST'), put: route('PUT'), patch: route('PATCH'), delete: route('DELETE'),
    register: async (plugin: any) => { await plugin(fake); },
    removeContentTypeParser: () => {}, addContentTypeParser: () => {},
  };
  return { fake, events, authenticateUser, authenticate };
}

describe('authentication and user isolation', () => {
  it('every member coin, quota and support-call route sits behind the member JWT hook', async () => {
    const { fake, events, authenticateUser } = recordRoutes();
    await userRouteModule.userRoutes(fake);
    expect(events[0]).toMatchObject({ kind: 'hook', detail: 'preHandler', handler: authenticateUser });
    const routes = events.filter((e) => e.kind === 'route').map((e) => e.detail);
    for (const r of [
      'GET /support-quota', 'GET /support-calls', 'GET /support-calls/summary', 'POST /support-calls/sessions/:id/book',
      'POST /support-calls/bookings/:id/cancel', 'GET /support-calls/bookings/:id/join',
      'GET /coins/balance', 'GET /coins/packages', 'POST /coins/razorpay/create-order', 'POST /coins/razorpay/verify',
      'POST /credits/purchase',
    ]) expect(routes).toContain(r);
  });

  it('the only unauthenticated payment route is the signed webhook', async () => {
    const { fake, events } = recordRoutes();
    await userRouteModule.userWebhookRoutes(fake);
    expect(events.filter((e) => e.kind === 'route').map((e) => e.detail)).toEqual(['POST /courses/razorpay/webhook']);
  });

  it('admin pricing, package and credit-approval routes sit behind the Clerk hook', async () => {
    for (const plugin of [creditsRouteModule.creditsRoutes, entitlementRouteModule.supportEntitlementsRoutes]) {
      const { fake, events, authenticate } = recordRoutes();
      await plugin(fake);
      expect(events[0]).toMatchObject({ kind: 'hook', detail: 'preHandler', handler: authenticate });
    }
  });

  it('pricing and package writes need an Admin/Super Admin account, not a mentor or a member', async () => {
    const body = { coinCost: 1 };
    expect((await call(admin.updateCallCoinPricingHandler, { params: { category: 'tech_support' }, body })).status).toBe(403);
    expect((await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_mentor', params: { category: 'tech_support' }, body })).status).toBe(403);
    expect((await call(credits.createCoinPackageHandler, { body: { label: 'X', coins: 1, priceInr: 1 } })).status).toBe(403);
    expect(db.pricing).toEqual({});
    expect(db.packages).toHaveLength(1);
  });

  it("a member cannot verify, see or join another member's purchases and bookings", async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    const o = await order({ packageId: PKG }, MEMBER);
    expect((await verify(o.orderId, 'pay_ISO', OTHER)).status).toBe(404);
    expect((await verify(o.orderId, 'pay_ISO', MEMBER)).body.data.coinsAdded).toBe(500);
    const b = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });

    expect((await call(user.joinSupportCallHandler, { memberId: OTHER, params: { id: b.body.data.id } })).status).toBe(404);
    expect((await cancel(b.body.data.id, OTHER)).status).toBe(404);
    const list = await call(user.listSupportCallsHandler, { memberId: OTHER, query: { category: 'tech_support' } });
    expect(list.body.data.sessions.every((s: any) => s.myBooking === null)).toBe(true);
    expect(list.body.data.history).toEqual([]);
    expect((await summaryOf(OTHER)).coinBalance).toBe(0);
    expect((await quotaOf(OTHER)).techSupport).toMatchObject({ used: 0, unlocked: 0 });
  });

  it('identity comes only from the session: body or webhook memberIds are ignored', async () => {
    const r = await call(user.createCoinOrderHandler, { memberId: MEMBER, body: { packageId: PKG, memberId: OTHER } });
    expect(db.coinOrders[0].memberId).toBe(MEMBER);
    expect(rzp.created[0].notes.memberId).toBe(MEMBER);
    // A webhook whose payload names another member still credits the order's owner.
    await webhook('payment.captured', { id: 'pay_W', order_id: r.body.data.orderId, amount: 19900, notes: { memberId: OTHER } });
    expect(balanceOf(MEMBER)).toBe(500);
    expect(balanceOf(OTHER)).toBe(0);
  });
});

// ── Razorpay configuration missing ───────────────────────────────────────────

describe('safe behavior when Razorpay configuration is missing', () => {
  it.each([
    ['both keys', { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }],
    ['the key id', { RAZORPAY_KEY_ID: undefined }],
    ['the key secret', { RAZORPAY_KEY_SECRET: undefined }],
  ])('without %s: packages say unavailable, create-order and verify refuse with 503, nothing is charged', async (_label, overrides) => {
    await withEnv(overrides, async () => {
      const p = await call(user.listCoinPackagesHandler, { memberId: MEMBER });
      expect(p.body.data.purchaseAvailable).toBe(false);
      const c = await call(user.createCoinOrderHandler, { memberId: MEMBER, body: { packageId: PKG } });
      expect(c.status).toBe(503);
      expect(c.body.error).toMatchObject({ message: 'RAZORPAY_NOT_CONFIGURED' });
      expect(rzp.created).toHaveLength(0);
      expect(db.coinOrders).toHaveLength(0);
      const v = await verify('order_X', 'pay_X');
      expect(v.status).toBe(503);
      expect(db.ledger).toHaveLength(0);
    });
  });

  it('cards never offer Purchase TBT Coins without Razorpay; coins already held still unlock calls', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    await withEnv({ RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, async () => {
      const s = await summaryOf();
      expect(s.coinPurchaseAvailable).toBe(false);
      expect(s.categories.find((c: any) => c.category === 'tech_support')).toMatchObject({ action: 'locked', lockedReason: 'quota_exhausted' });
      giveCoins(MEMBER, 120);
      expect(await cardOf('tech_support')).toMatchObject({ action: 'unlock_with_coins' });
      expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).status).toBe(201);
    });
  });

  it('without a webhook secret, webhooks are acknowledged but never credit; verify still does', async () => {
    const o = await order({ packageId: PKG });
    await withEnv({ RAZORPAY_WEBHOOK_SECRET: undefined }, async () => {
      expect((await rawWebhook(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_NS', order_id: o.orderId, amount: 19900 } } } }), 'c'.repeat(64))).body).toEqual({ ok: true });
      expect(balanceOf(MEMBER)).toBe(0);
      expect(db.coinOrders[0].status).toBe('created');
      expect((await verify(o.orderId, 'pay_NS')).body.data.coinsAdded).toBe(500);
    });
  });

  it('signature helpers fail closed when their secret is missing', async () => {
    await withEnv({ RAZORPAY_KEY_SECRET: undefined, RAZORPAY_WEBHOOK_SECRET: undefined }, async () => {
      expect(razorpayLib.verifyPaymentSignature('order_1', 'pay_1', sign('order_1', 'pay_1'))).toBe(false);
      expect(razorpayLib.verifyWebhookSignature('{}', crypto.createHmac('sha256', WEBHOOK_SECRET).update('{}').digest('hex'))).toBe(false);
    });
    expect(razorpayLib.verifyPaymentSignature('order_1', 'pay_1', sign('order_1', 'pay_1'))).toBe(true);
  });
});
