import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/user/courses/:id/request-access — the member asks for access to a
// paid course ("Get Access"). Every new request must reach the admins: one
// admin_notifications row (course_access_request) + the admin socket event.
// A pending Razorpay row (an unpaid / abandoned checkout) is NOT an access
// request and must not swallow the notification.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000a1';
const COURSE = '70000000-0000-4000-8000-000000000001';

let payments: Array<{ id: string; memberId: string; courseId: string; method: string; status: string }>;
let access: Record<string, { id: string; isActive: boolean; accessType: string; expiresAt: Date | null }>;
let course: { id: string; title: string; price: number | null; isPublished: boolean; paymentLinkUrl: string | null } | null;
let adminNotifs: Array<{ title: string; body: string; type: string; metadata: any }>;
let emitted: Array<[string, string, any]>;
let seq = 0;

const matches = (p: any, where: any) =>
  p.memberId === where.memberId && p.courseId === where.courseId && p.status === where.status &&
  (where.method?.not === undefined || p.method !== where.method.not);

const prisma: any = {
  courseAccess: { async findUnique({ where }: any) { return access[`${where.memberId_courseId.memberId}:${where.memberId_courseId.courseId}`] ?? null; } },
  course: { async findUnique() { return course; } },
  coursePayment: {
    async findFirst({ where }: any) { const p = payments.find((x) => matches(x, where)); return p ? { id: p.id } : null; },
    async create({ data }: any) { const p = { id: `pay-${++seq}`, ...data }; payments.push(p); return p; },
  },
  async $executeRawUnsafe(text: string, ...a: any[]) {
    if (/INSERT INTO admin_notifications/.test(text)) {
      adminNotifs.push({ title: a[0], body: a[1], type: a[2], metadata: a[3] ? JSON.parse(a[3]) : null });
      return 1;
    }
    throw new Error(`unhandled SQL: ${text.slice(0, 60)}`);
  },
};

async function requestAccess() {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const io = { to: (room: string) => ({ emit: (event: string, payload: any) => emitted.push([room, event, payload]) }) };
  const req: any = { memberId: ME, params: { id: COURSE }, query: {}, headers: {}, body: {}, server: { prisma, redis: null, io }, log: { error() {}, warn() {} } };
  await user.requestCourseAccessHandler(req, reply);
  await new Promise((r) => setTimeout(r, 0)); // the admin notification write is fire-and-forget
  return sent;
}

beforeEach(() => {
  seq = 0;
  payments = [];
  access = {};
  course = { id: COURSE, title: 'Zero Rupee Marketing', price: 4999, isPublished: true, paymentLinkUrl: null };
  adminNotifs = [];
  emitted = [];
});

describe('POST /api/user/courses/:id/request-access → admin notification', () => {
  it('a new request creates the pending request and notifies the admins once (DB + live socket)', async () => {
    const r = await requestAccess();
    expect(r.status).toBe(200);
    expect(payments).toEqual([expect.objectContaining({ memberId: ME, courseId: COURSE, method: 'external', status: 'pending' })]);
    expect(adminNotifs).toEqual([{
      title: 'Course Access Request',
      body: 'A member requested access to "Zero Rupee Marketing".',
      type: 'course_access_request',
      metadata: { memberId: ME, courseId: COURSE, courseTitle: 'Zero Rupee Marketing' },
    }]);
    expect(emitted).toEqual([['admin', 'admin:course_access_request', { memberId: ME, courseId: COURSE, courseTitle: 'Zero Rupee Marketing' }]]);
  });

  it('asking again reuses the same request — no duplicate row or notification', async () => {
    const first = await requestAccess();
    const second = await requestAccess();
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    expect(payments).toHaveLength(1);
    expect(adminNotifs).toHaveLength(1);
    expect(emitted).toHaveLength(1);
  });

  it('after an abandoned Razorpay checkout, the request still reaches the admins (the bug)', async () => {
    payments.push({ id: 'rzp-pending', memberId: ME, courseId: COURSE, method: 'razorpay', status: 'pending' });
    const r = await requestAccess();
    expect(r.body.data.paymentId).not.toBe('rzp-pending');
    expect(payments.filter((p) => p.method === 'external')).toHaveLength(1);
    expect(adminNotifs).toHaveLength(1);
    expect(adminNotifs[0].type).toBe('course_access_request');
    expect(emitted.map(([room, ev]) => `${room} ${ev}`)).toEqual(['admin admin:course_access_request']);
  });

  it('a member who already has access gets 409 and no notification', async () => {
    access[`${ME}:${COURSE}`] = { id: 'acc', isActive: true, accessType: 'lifetime', expiresAt: null };
    expect((await requestAccess()).status).toBe(409);
    expect(adminNotifs).toEqual([]);
    expect(payments).toEqual([]);
  });

  it('an unpublished course is 404 with no notification', async () => {
    course = { ...course!, isPublished: false };
    expect((await requestAccess()).status).toBe(404);
    expect(adminNotifs).toEqual([]);
  });
});
