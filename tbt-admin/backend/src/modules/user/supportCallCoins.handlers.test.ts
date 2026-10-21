import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the REAL member + admin handlers for support-call booking, coin
// unlocks and TBT coin purchases against a small in-memory store that answers
// the SQL they issue. $transaction snapshots the store and restores it if the
// callback throws, like Postgres would roll back — so "atomic" claims are
// checked against behaviour, not just code shape. Nothing here touches a real
// database, Razorpay or any member's data.

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

const rzp = vi.hoisted(() => ({
  created: [] as any[],
  fetched: {} as Record<string, any>,
  nextOrderId: 1,
}));
vi.mock('razorpay', () => ({
  default: class {
    orders = {
      create: async (o: any) => {
        const order = { id: `order_T${rzp.nextOrderId++}`, ...o };
        rzp.created.push(order);
        return order;
      },
      fetch: async (id: string) => {
        if (!rzp.fetched[id]) throw new Error('not found');
        return rzp.fetched[id];
      },
    };
  },
}));

const user = await import('./controller.js');
const admin = await import('../support-entitlements/controller.js');
const credits = await import('../credits/controller.js');

const MEMBER = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';
const S1 = '50000000-0000-4000-8000-000000000001';
const S2 = '50000000-0000-4000-8000-000000000002';
const S3 = '50000000-0000-4000-8000-000000000003';
const PKG = '60000000-0000-4000-8000-000000000001';
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
      clerk_admin: { id: '70000000-0000-4000-8000-000000000001', fullName: 'Admin', role: 'admin' },
      clerk_mentor: { id: '70000000-0000-4000-8000-000000000002', fullName: 'Mentor', role: 'mentor' },
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
  if (q.includes('FROM support_usage')) {
    const counts: Record<string, number> = {};
    for (const u of db.usage.filter((u) => u.memberId === a[0])) counts[u.type] = (counts[u.type] ?? 0) + 1;
    return Object.entries(counts).map(([type, cnt]) => ({ type, cnt }));
  }
  if (q.includes('FROM credit_purchases')) return [];
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

  // Sessions
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
  if (q.startsWith("UPDATE support_call_sessions SET status = 'cancelled'")) { sessionOf(a[0]).status = 'cancelled'; return 1; }

  // Bookings
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
  if (q.startsWith("UPDATE support_call_bookings SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE session_id")) {
    const hit = db.bookings.filter((b) => b.sessionId === a[0] && b.status === 'booked');
    for (const b of hit) b.status = 'cancelled';
    return hit.map((b) => ({ id: b.id, member_id: b.memberId, coin_cost: b.coinCost }));
  }

  // Ledger
  if (q.startsWith('INSERT INTO tbt_activity_log')) {
    const source = q.match(/VALUES \(\$1::uuid, \$2, '([a-z_]+)'/)?.[1] ?? 'unknown';
    if (source === 'support_call_unlock' && failNextSpend) { failNextSpend = false; throw new Error('ledger write failed'); }
    const ref = a[2] ?? null;
    if (ref && db.ledger.some((l) => l.memberId === a[0] && l.source === source && l.ref === ref)) return [];
    db.ledger.push({ memberId: a[0], points: a[1], source, ref });
    return [{ id: uuid() }];
  }
  if (q.startsWith('UPDATE members SET total_points')) { db.members[a[1]].totalPoints += a[0]; return 1; }

  // Coin packages + orders
  if (q.startsWith('SELECT id, label, coins, price_inr FROM coin_packages WHERE id')) return db.packages.filter((p) => p.id === a[0] && p.is_active);
  if (q.startsWith('SELECT id, label, coins, price_inr FROM coin_packages WHERE is_active')) return db.packages.filter((p) => p.is_active);
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
  // The shared webhook checks for an Extra Lifeline order first (lifelinePurchase.ts
  // handleLifelineWebhookEvent). These tests create none, so the lookup finds no rows
  // and the event falls through to the coin / course logic — as the real database would.
  if (q.startsWith('SELECT 1 FROM lifeline_razorpay_orders WHERE order_id')) return [];

  unhandled.push(q.slice(0, 120));
  return q.startsWith('SELECT') || q.includes('RETURNING') ? [] : 0;
}

function prisma(): any {
  const client: any = {
    $queryRawUnsafe: sql,
    $executeRawUnsafe: sql,
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const snapshot = structuredClone(db);
      try {
        return await fn(client);
      } catch (err) {
        db = snapshot;
        throw err;
      }
    },
    member: {
      findUnique: async ({ where }: any) => {
        const m = db.members[where.id];
        return m ? { membershipPlan: m.plan, status: m.status, batchId: null, firstName: 'Test', lastName: 'Member' } : null;
      },
    },
    admin: { findUnique: async ({ where }: any) => db.admins[where.clerkId] ?? null },
    appNotification: { create: async () => ({}) },
  };
  return client;
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
const sign = (orderId: string, paymentId: string) => crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
const giveCoins = (memberId: string, points: number) => db.ledger.push({ memberId, points, source: 'task_completion', ref: null });

afterEach(() => {
  // Only fire-and-forget notification writes may fall outside the fake.
  expect(unhandled.filter((q) => !q.includes('admin_notifications') && !q.includes('push_tokens') && !q.includes('fcm'))).toEqual([]);
});

beforeEach(() => {
  db = fresh();
  failNextSpend = false;
  rzp.created = [];
  rzp.fetched = {};
  unhandled.length = 0;
});

describe('booking with free quota', () => {
  it('books while a free call remains and returns the committed confirmation', async () => {
    const r = await book(S1);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'booked', category: 'tech_support', title: 'Tech 1', paidWithCoins: false, coinsSpent: 0 });
    expect(db.bookings).toHaveLength(1);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('refuses to exceed the quota for free (pending booking counts)', async () => {
    await book(S1);
    const r = await book(S2);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('quota_exhausted');
    expect(db.bookings.filter((b) => b.status === 'booked')).toHaveLength(1);
  });

  it('a completed call counts as used; a cancelled one gives the call back', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' }); // attended earlier
    expect((await book(S1)).body.error.code).toBe('quota_exhausted');
    db.usage = [];
    const first = await book(S1);
    await cancel(first.body.data.id);
    expect((await book(S2)).status).toBe(201);
  });

  it('a duplicate request for the same session is refused, not double-booked', async () => {
    db.entitlements.premium.tech_support_days = 3;
    await book(S1);
    const r = await book(S1);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('already_booked');
    expect(db.bookings).toHaveLength(1);
  });
});

describe('booking an extra call with TBT coins', () => {
  beforeEach(() => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' }); // the 1 included call is used
    db.pricing.tech_support = 120;
  });

  it('never spends coins without an explicit payWithCoins request', async () => {
    giveCoins(MEMBER, 500);
    const r = await book(S1);
    expect(r.body.error.code).toBe('quota_exhausted');
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('with enough coins: deducts exactly the price and books in one step', async () => {
    giveCoins(MEMBER, 500);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ paidWithCoins: true, coinsSpent: 120, coinBalance: 380, status: 'booked' });
    expect(balanceOf(MEMBER)).toBe(380);
    expect(db.ledger.find((l) => l.source === 'support_call_unlock')).toMatchObject({ points: -120, ref: r.body.data.id });
    expect(db.bookings[0]).toMatchObject({ coinCost: 120, status: 'booked' });
  });

  it('with too few coins: 402 and nothing changes', async () => {
    giveCoins(MEMBER, 119);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe('insufficient_coins');
    expect(db.bookings).toHaveLength(0);
    expect(balanceOf(MEMBER)).toBe(119);
  });

  it('is atomic: if the coin debit fails, the booking is rolled back too', async () => {
    giveCoins(MEMBER, 500);
    failNextSpend = true;
    await expect(book(S1, { payWithCoins: true, expectedCoinCost: 120 })).rejects.toThrow('ledger write failed');
    expect(db.bookings).toHaveLength(0);
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('refuses a price the member did not confirm', async () => {
    giveCoins(MEMBER, 500);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 100 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('coin_price_changed');
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('refuses when no coin price is configured', async () => {
    delete db.pricing.tech_support;
    giveCoins(MEMBER, 500);
    expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).body.error.code).toBe('coin_unlock_unavailable');
  });

  it('refuses to charge coins while a free call is still available', async () => {
    db.usage = [];
    giveCoins(MEMBER, 500);
    expect((await book(S1, { payWithCoins: true, expectedCoinCost: 120 })).body.error.code).toBe('free_quota_available');
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('a repeated paid request charges once', async () => {
    giveCoins(MEMBER, 500);
    await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    const again = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    expect(again.body.error.code).toBe('already_booked');
    expect(balanceOf(MEMBER)).toBe(380);
  });

  it('a paid booking adds its own call: it never eats an included one, and can be followed by another paid call', async () => {
    giveCoins(MEMBER, 500);
    await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    const second = await book(S2, { payWithCoins: true, expectedCoinCost: 120 });
    expect(second.status).toBe(201);
    expect(balanceOf(MEMBER)).toBe(260);
    const list = await call(user.listSupportCallsHandler, { memberId: MEMBER, query: { category: 'tech_support' } });
    expect(list.body.data.quota).toMatchObject({ included: 1, unlocked: 2, used: 1, reserved: 2, remaining: 0 });
  });

  it('member cancellation refunds the coins once', async () => {
    giveCoins(MEMBER, 500);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    const c = await cancel(r.body.data.id);
    expect(c.body.data).toMatchObject({ status: 'cancelled', coinsRefunded: 120 });
    expect(balanceOf(MEMBER)).toBe(500);
    const again = await cancel(r.body.data.id);
    expect(again.status).toBe(409);
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('an admin cancelling the session refunds paid bookings and leaves free ones as before', async () => {
    giveCoins(MEMBER, 500);
    db.entitlements.premium.tech_support_days = 1;
    await book(S1, { payWithCoins: true, expectedCoinCost: 120 }, MEMBER);
    await book(S1, undefined, OTHER);
    const r = await call(admin.cancelSupportSessionHandler, { clerk: 'clerk_admin', params: { id: S1 } });
    expect(r.body.data).toMatchObject({ status: 'cancelled', cancelledBookings: 2 });
    expect(balanceOf(MEMBER)).toBe(500);
    expect(balanceOf(OTHER)).toBe(0);
  });

  it('another member cannot cancel (or refund) this booking', async () => {
    giveCoins(MEMBER, 500);
    const r = await book(S1, { payWithCoins: true, expectedCoinCost: 120 });
    const c = await cancel(r.body.data.id, OTHER);
    expect(c.status).toBe(404);
    expect(db.bookings[0].status).toBe('booked');
    expect(balanceOf(OTHER)).toBe(0);
  });
});

describe('call card summary', () => {
  it('reports Book Call / Unlock / Purchase / locked from server state', async () => {
    db.pricing.tech_support = 120;
    let s = await call(user.getSupportCallsSummaryHandler, { memberId: MEMBER });
    const tech = () => s.body.data.categories.find((c: any) => c.category === 'tech_support');
    const sales = () => s.body.data.categories.find((c: any) => c.category === 'sales_support');
    expect(tech()).toMatchObject({ action: 'book', coinCost: 120 });
    expect(sales()).toMatchObject({ action: 'locked', lockedReason: 'not_included' });

    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    s = await call(user.getSupportCallsSummaryHandler, { memberId: MEMBER });
    expect(tech().action).toBe('purchase_coins');

    giveCoins(MEMBER, 120);
    s = await call(user.getSupportCallsSummaryHandler, { memberId: MEMBER });
    expect(tech().action).toBe('unlock_with_coins');
    expect(s.body.data.coinBalance).toBe(120);
  });
});

describe('TBT coin purchase (Razorpay)', () => {
  async function order(body?: any, memberId = MEMBER) {
    const r = await call(user.createCoinOrderHandler, { memberId, body });
    return r.body.data as { orderId: string; amount: number; coins: number };
  }
  const verify = (orderId: string, paymentId: string, memberId = MEMBER, signature = sign(orderId, paymentId)) =>
    call(user.verifyCoinPaymentHandler, { memberId, body: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature } });
  function webhook(event: string, entity: any) {
    const rawBody = JSON.stringify({ event, payload: { payment: { entity } } });
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    return call(user.razorpayWebhookHandler, { rawBody, headers: { 'x-razorpay-signature': signature } });
  }

  it('creates the order at the admin package price and records it against the member', async () => {
    const o = await order({ packageId: PKG });
    expect(o).toMatchObject({ amount: 19900, coins: 500 });
    expect(db.coinOrders[0]).toMatchObject({ memberId: MEMBER, coins: 500, amountPaise: 19900, status: 'created' });
  });

  it('keeps the original package when no packageId is sent', async () => {
    const o = await order();
    expect(o).toMatchObject({ amount: 9900, coins: 200 });
  });

  it('rejects an unknown or inactive package', async () => {
    db.packages[0].is_active = false;
    const r = await call(user.createCoinOrderHandler, { memberId: MEMBER, body: { packageId: PKG } });
    expect(r.status).toBe(404);
    expect(rzp.created).toHaveLength(0);
  });

  it('successful payment: verify credits the order coins (not a client-supplied number)', async () => {
    const o = await order({ packageId: PKG });
    const r = await verify(o.orderId, 'pay_A1');
    expect(r.body.data).toMatchObject({ coinsAdded: 500, totalCoins: 500, alreadyProcessed: false });
    expect(db.coinOrders[0]).toMatchObject({ status: 'paid', paymentId: 'pay_A1' });
    // reference is the order UUID, so the UUID ledger column accepts it
    expect(db.ledger[0].ref).toBe(db.coinOrders[0].id);
  });

  it('buying coins does not book a call or spend the coins', async () => {
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    const o = await order({ packageId: PKG });
    await verify(o.orderId, 'pay_A1');
    expect(db.bookings).toHaveLength(0);
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('rejects a bad signature without crediting', async () => {
    const o = await order();
    const r = await verify(o.orderId, 'pay_A1', MEMBER, 'f'.repeat(64));
    expect(r.status).toBe(400);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('duplicate verify, and verify + webhook for the same payment, credit once', async () => {
    const o = await order({ packageId: PKG });
    await verify(o.orderId, 'pay_A1');
    const again = await verify(o.orderId, 'pay_A1');
    expect(again.body.data).toMatchObject({ coinsAdded: 0, alreadyProcessed: true });
    await webhook('payment.captured', { id: 'pay_A1', order_id: o.orderId, amount: 19900 });
    await webhook('payment.captured', { id: 'pay_A1', order_id: o.orderId, amount: 19900 });
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('webhook alone credits when the browser never called verify', async () => {
    const o = await order({ packageId: PKG });
    const r = await webhook('payment.captured', { id: 'pay_W1', order_id: o.orderId, amount: 19900 });
    expect(r.body).toEqual({ ok: true });
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('a failed payment marks the order failed and credits nothing; a later capture still credits', async () => {
    const o = await order({ packageId: PKG });
    await webhook('payment.failed', { id: 'pay_F1', order_id: o.orderId, error_description: 'card declined' });
    expect(db.coinOrders[0].status).toBe('failed');
    expect(balanceOf(MEMBER)).toBe(0);
    await webhook('payment.captured', { id: 'pay_F2', order_id: o.orderId, amount: 19900 });
    expect(balanceOf(MEMBER)).toBe(500);
  });

  it('a cancelled checkout (no payment) leaves the order uncredited', async () => {
    await order({ packageId: PKG });
    expect(db.coinOrders[0].status).toBe('created');
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('a webhook whose amount does not match the order is not credited', async () => {
    const o = await order({ packageId: PKG });
    await webhook('payment.captured', { id: 'pay_M1', order_id: o.orderId, amount: 100 });
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it('a webhook with a bad signature is rejected', async () => {
    const o = await order({ packageId: PKG });
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X', order_id: o.orderId, amount: 19900 } } } });
    const r = await call(user.razorpayWebhookHandler, { rawBody, headers: { 'x-razorpay-signature': 'a'.repeat(64) } });
    expect(r.status).toBe(400);
    expect(balanceOf(MEMBER)).toBe(0);
  });

  it("another member cannot claim someone else's paid order", async () => {
    const o = await order({ packageId: PKG }, MEMBER);
    const r = await verify(o.orderId, 'pay_A1', OTHER);
    expect(r.status).toBe(404);
    expect(balanceOf(OTHER)).toBe(0);
    expect(db.coinOrders[0].status).toBe('created');
  });

  it('accepts an in-flight order created before coin_orders existed, only if Razorpay confirms it', async () => {
    rzp.fetched.order_OLD = { id: 'order_OLD', amount: 9900, notes: { type: 'coin_purchase', memberId: MEMBER, coins: '200' } };
    const r = await verify('order_OLD', 'pay_OLD');
    expect(r.body.data).toMatchObject({ coinsAdded: 200 });
    // …but not for a member it doesn't belong to
    rzp.fetched.order_OLD2 = { id: 'order_OLD2', amount: 9900, notes: { type: 'coin_purchase', memberId: MEMBER } };
    expect((await verify('order_OLD2', 'pay_OLD2', OTHER)).status).toBe(404);
    // …and not for a course-payment order
    rzp.fetched.order_COURSE = { id: 'order_COURSE', amount: 9900, notes: { type: 'course', memberId: MEMBER } };
    expect((await verify('order_COURSE', 'pay_C')).status).toBe(404);
    expect(balanceOf(MEMBER)).toBe(200);
  });
});

describe('admin configuration and authorization', () => {
  it('admin sets and clears the coin price; a mentor cannot', async () => {
    const mentor = await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_mentor', params: { category: 'tech_support' }, body: { coinCost: 1 } });
    expect(mentor.status).toBe(403);
    expect(db.pricing.tech_support).toBeUndefined();

    expect((await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'tech_support' }, body: { coinCost: 150 } })).status).toBe(200);
    expect(db.pricing.tech_support).toBe(150);
    expect((await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'tech_support' }, body: { coinCost: null } })).status).toBe(200);
    expect(db.pricing.tech_support).toBeNull();
  });

  it('rejects invalid prices and unknown categories', async () => {
    for (const coinCost of [0, -5, 1.5, '100']) {
      const r = await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'tech_support' }, body: { coinCost } });
      expect(r.status).toBe(400);
    }
    expect((await call(admin.updateCallCoinPricingHandler, { clerk: 'clerk_admin', params: { category: 'lifeline' }, body: { coinCost: 5 } })).status).toBe(404);
  });

  it('unknown Clerk users and mentors cannot change coin packages', async () => {
    const body = { label: 'Big', coins: 1000, priceInr: 399 };
    expect((await call(credits.createCoinPackageHandler, { clerk: 'clerk_mentor', body })).status).toBe(403);
    expect((await call(credits.createCoinPackageHandler, { clerk: 'nobody', body })).status).toBe(403);
    expect((await call(credits.deleteCoinPackageHandler, { clerk: 'clerk_mentor', params: { id: PKG } })).status).toBe(403);
    expect(db.packages).toHaveLength(1);
  });

  it('members have no route that takes another member id for quota or wallet changes', async () => {
    // The member handlers read identity only from request.memberId; a body
    // memberId is ignored, so a crafted request cannot touch another wallet.
    db.usage.push({ memberId: MEMBER, type: 'tech_support' });
    db.pricing.tech_support = 120;
    giveCoins(OTHER, 500);
    const r = await call(user.bookSupportCallHandler, { memberId: MEMBER, params: { id: S1 }, body: { payWithCoins: true, expectedCoinCost: 120, memberId: OTHER } });
    expect(r.status).toBe(402);
    expect(balanceOf(OTHER)).toBe(500);
  });
});
