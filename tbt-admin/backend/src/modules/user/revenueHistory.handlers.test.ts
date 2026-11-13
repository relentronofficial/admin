import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// GET /api/user/mentorship/revenue/history — read-only list of the member's own
// saved weeks (member_revenue_reports), oldest first, for the dashboard chart's
// Weekly / Monthly / Yearly / Overall views.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000d1';
const OTHER = '50000000-0000-4000-8000-0000000000d2';
const rows = [
  { member_id: ME, week_number: 42, year: 2026, revenue_generated: '457856.00', number_of_orders: 575, daily_revenue: [50000, 60000, null, 70000, 90000, 100000, 87856], daily_orders: [60, 70, null, 85, 110, 130, 120] },
  { member_id: OTHER, week_number: 42, year: 2026, revenue_generated: '999.00', number_of_orders: 1, daily_revenue: null, daily_orders: null },
  { member_id: ME, week_number: 41, year: 2026, revenue_generated: '300000.00', number_of_orders: 400, daily_revenue: null, daily_orders: null },
  { member_id: ME, week_number: 52, year: 2025, revenue_generated: null, number_of_orders: null, daily_revenue: [1, null, null, null, null, null, null], daily_orders: null },
];
const writes: string[] = [];

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (/^(INSERT|UPDATE|DELETE)/i.test(q)) { writes.push(q); return 0; }
  if (q.startsWith('SELECT week_number, year, revenue_generated, number_of_orders, daily_revenue, daily_orders FROM member_revenue_reports WHERE member_id = $1::uuid ORDER BY year ASC, week_number ASC')) {
    return rows.filter((r) => r.member_id === a[0]).sort((x, y) => x.year - y.year || x.week_number - y.week_number);
  }
  return []; // demo-mode lookups etc.: nothing configured
}

async function history(memberId = ME) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(c: number) { sent.status = c; return reply; }, code(c: number) { sent.status = c; return reply; },
    header() { return reply; }, send(b: any) { sent.body = b; return reply; },
  };
  const req: any = {
    memberId, params: {}, query: {}, headers: {}, body: undefined,
    server: { prisma: { $queryRawUnsafe: sql, $executeRawUnsafe: sql, member: { findUnique: async () => null } }, redis: null },
    log: { error() {}, warn() {} },
  };
  await user.getMentorshipRevenueHistoryHandler(req, reply);
  return sent;
}

describe('GET /api/user/mentorship/revenue/history', () => {
  it("returns only the member's own saved weeks, oldest first, with numbers as numbers", async () => {
    const r = await history();
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.weeks).toEqual([
      { weekNumber: 52, year: 2025, revenueGenerated: null, numberOfOrders: null, dailyRevenue: [1, null, null, null, null, null, null], dailyOrders: null },
      { weekNumber: 41, year: 2026, revenueGenerated: 300000, numberOfOrders: 400, dailyRevenue: null, dailyOrders: null },
      { weekNumber: 42, year: 2026, revenueGenerated: 457856, numberOfOrders: 575, dailyRevenue: rows[0].daily_revenue, dailyOrders: rows[0].daily_orders },
    ]);
    expect(r.body.data.currentWeek).toEqual({ weekNumber: expect.any(Number), year: expect.any(Number) });
    expect(writes).toEqual([]); // read-only
  });

  it('a member with nothing saved gets an empty list (no invented weeks)', async () => {
    const r = await history('50000000-0000-4000-8000-0000000000ff');
    expect(r.body.data.weeks).toEqual([]);
  });
});
