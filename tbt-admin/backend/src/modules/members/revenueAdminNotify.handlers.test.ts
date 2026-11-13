import { beforeEach, describe, expect, it, vi } from 'vitest';

// PUT /api/members/:id/mentorship/revenue (admin saves a member's revenue) must
// tell the member's open dashboard to refetch — the same notification the
// member's own revenue save sends (batch:graph_updated to user:<id>).

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));
const notify = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}));
vi.mock('../../lib/weeklyGraphNotify.js', () => ({ notifyWeeklyGraphChanged: notify }));

const members = await import('./controller.js');

const MEMBER = '50000000-0000-4000-8000-0000000000e1';
let writes: any[][];

async function save(body: Record<string, unknown>, fail = false) {
  const sent: { status: number; body?: any } = { status: 200 };
  const reply: any = { status(c: number) { sent.status = c; return reply; }, code(c: number) { sent.status = c; return reply; }, send(b: any) { sent.body = b; return reply; } };
  const server = {
    redis: null,
    prisma: {
      $queryRawUnsafe: vi.fn(async (_q: string, ...a: any[]) => {
        if (fail) throw new Error('db down');
        writes.push(a);
        return [{ member_id: a[0], week_number: a[1], year: a[2], revenue_generated: a[3], number_of_orders: a[5], daily_revenue: null, daily_orders: null, updated_at: new Date() }];
      }),
    },
  };
  const req: any = { params: { id: MEMBER }, body, server, log: { error() {}, warn() {} } };
  try { await members.upsertMemberRevenueAdminHandler(req, reply); } catch { sent.status = 500; }
  return sent;
}

beforeEach(() => { writes = []; notify.mockClear(); });

describe('admin revenue save → member refresh', () => {
  it('saves the revenue and notifies that member (revenue_updated)', async () => {
    const r = await save({ weekNumber: 44, year: 2026, revenueGenerated: 10000000, numberOfOrders: 12 });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(writes[0].slice(0, 4)).toEqual([MEMBER, 44, 2026, 10000000]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][1]).toEqual({ memberIds: [MEMBER] });
    expect(notify.mock.calls[0][2]).toBe('revenue_updated');
  });

  it('a failed save notifies no one', async () => {
    await save({ revenueGenerated: 1 }, true);
    expect(notify).not.toHaveBeenCalled();
  });
});
