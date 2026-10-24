import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real user-auth handlers (signup → OTP → verify, login, resend) against an
// in-memory store and a fake Redis. WhatsApp/SMS senders are stubbed: nothing
// is sent anywhere; the OTP the handler "sends" is captured here.

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', CRON_SECRET: 'x', PROGRAM_TIMEZONE: 'Asia/Kolkata' } }));
const sent = vi.hoisted(() => [] as Array<{ phone: string; otp: string }>);
vi.mock('../../lib/whatsapp.js', () => ({
  sendOtpWhatsapp: vi.fn(async (phone: string, otp: string) => { sent.push({ phone, otp }); return true; }),
  sendOtpWhatsappDiagnostic: vi.fn(),
}));
vi.mock('../../lib/msg91.js', () => ({ sendOtp: vi.fn(async () => false) }));
vi.mock('../../plugins/jwt.js', () => ({
  setAuthCookies: vi.fn(), clearAuthCookies: vi.fn(), generateRefreshToken: () => 'refresh-token',
  storeRefreshToken: vi.fn(async () => {}), consumeRefreshToken: vi.fn(), revokeRefreshToken: vi.fn(),
  revokeRefreshTokenByHash: vi.fn(), revokeAllForMember: vi.fn(async () => 0), hashRefreshToken: () => 'hash',
  setActiveLoginId: vi.fn(async () => {}),
}));

const auth = await import('./controller.js');

interface Member {
  id: string; memberId: string; firstName: string; lastName: string | null; email: string; phone: string;
  passwordHash: string | null; status: string; verificationStatus: string | null; onboardingSubmittedAt: Date | null;
  deletedAt: Date | null; businessName?: string | null; city?: string | null; state?: string | null; productServiceType?: string | null;
  profilePhotoUrl?: string | null;
}
let members: Member[];
let sessions: Array<{ memberId: string }>;
let pending: Map<string, { phone_e164: string; email: string; payload: any; claim_member_id: string | null; expires_at: number }>;
let seq = 0;

const pick = (m: Member | undefined, select: any) => (m ? Object.fromEntries(Object.keys(select ?? m).map((k) => [k, (m as any)[k] ?? null])) : null);
const matches = (m: Member, where: any): boolean => {
  if (where.id && m.id !== where.id) return false;
  if ('deletedAt' in where && where.deletedAt === null && m.deletedAt) return false;
  if (where.phone?.in && !where.phone.in.includes(m.phone)) return false;
  if (where.email?.equals && m.email.toLowerCase() !== String(where.email.equals).toLowerCase()) return false;
  return true;
};

function prisma() {
  return {
    member: {
      findFirst: vi.fn(async ({ where, select }: any) => pick(members.find((m) => matches(m, where)), select)),
      findUnique: vi.fn(async ({ where, select }: any) => pick(members.find((m) => m.id === where.id), select)),
      create: vi.fn(async ({ data }: any) => {
        if (members.some((m) => m.email.toLowerCase() === data.email.toLowerCase() || m.phone === data.phone)) {
          throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        }
        const m: Member = { id: `m${++seq}`, verificationStatus: 'awaiting_kyc', onboardingSubmittedAt: null, deletedAt: null, profilePhotoUrl: null, ...data };
        members.push(m);
        return m;
      }),
      update: vi.fn(async ({ where, data }: any) => { const m = members.find((x) => x.id === where.id)!; Object.assign(m, data); return m; }),
    },
    memberSession: {
      count: vi.fn(async ({ where }: any) => sessions.filter((s) => s.memberId === where.memberId).length),
      findMany: vi.fn(async ({ where }: any) => sessions.filter((s) => s.memberId === where.memberId)),
      create: vi.fn(async ({ data }: any) => { sessions.push({ memberId: data.memberId }); return data; }),
    },
    $executeRawUnsafe: vi.fn(async (sql: string, ...a: any[]) => {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (q.startsWith('DELETE FROM pending_registrations WHERE expires_at < NOW() OR')) {
        for (const [k, r] of pending) if (r.expires_at < Date.now() || (r.email.toLowerCase() === a[0].toLowerCase() && r.phone_e164 !== a[1])) pending.delete(k);
        return 0;
      }
      if (q.startsWith('INSERT INTO pending_registrations')) {
        pending.set(a[0], { phone_e164: a[0], email: a[1], payload: JSON.parse(a[2]), claim_member_id: a[3], expires_at: Date.now() + a[4] * 60_000 });
        return 1;
      }
      if (q.startsWith('DELETE FROM pending_registrations WHERE phone_e164 = $1')) { pending.delete(a[0]); return 1; }
      throw new Error(`Unhandled SQL: ${q.slice(0, 80)}`);
    }),
    $queryRawUnsafe: vi.fn(async (sql: string, ...a: any[]) => {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (q.startsWith('SELECT phone_e164 AS "phoneE164"')) {
        const r = pending.get(a[0]);
        return r && r.expires_at > Date.now() ? [{ phoneE164: r.phone_e164, email: r.email, payload: r.payload, claimMemberId: r.claim_member_id }] : [];
      }
      throw new Error(`Unhandled SQL: ${q.slice(0, 80)}`);
    }),
  };
}

/** Minimal Redis: SET (EX/NX), GET, DEL, INCR, EXPIRE — what lib/otp.ts uses. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (k: string, v: string, ...opts: any[]) => { if (opts.includes('NX') && store.has(k)) return null; store.set(k, v); return 'OK'; }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    incr: vi.fn(async (k: string) => { const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; }),
    expire: vi.fn(async () => 1),
  };
}

let server: any;
async function call(handler: (f: any, req: any, reply: any) => any, body: any) {
  const res: { status: number; body?: any } = { status: 200 };
  const reply: any = {
    status(c: number) { res.status = c; return reply; }, code(c: number) { res.status = c; return reply; },
    header() { return reply; }, setCookie() { return reply; }, clearCookie() { return reply; },
    send(b: any) { res.body = b; return reply; },
  };
  await handler(server, { body, headers: {}, ip: '127.0.0.1' }, reply);
  return res;
}
const lastOtpFor = (e164: string) => [...sent].reverse().find((s) => s.phone === e164)?.otp;
const SIGNUP = { firstName: 'Priya', lastName: 'K', email: 'Priya@Example.com', password: 'secret123', businessName: 'Kolam Co' };

beforeEach(() => {
  members = []; sessions = []; pending = new Map(); sent.length = 0; seq = 0;
  server = { prisma: prisma(), redis: fakeRedis(), jwt: { sign: vi.fn(async () => 'access-token') }, log: { info() {}, warn() {}, error() {} } };
});

describe('international phone numbers', () => {
  it('a complete UK number registers end to end and is stored in E.164', async () => {
    const r = await call(auth.signup, { ...SIGNUP, phone: '+44 7400 123456' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ step: 'otp_required', phone: '+447400123456' });
    expect(sent.at(-1)?.phone).toBe('+447400123456');
    expect(members).toHaveLength(0); // no account before the OTP

    const v = await call(auth.verifyOtp, { phone: '+447400123456', otp: lastOtpFor('+447400123456') });
    expect(v.status).toBe(200);
    expect(v.body.data).toMatchObject({ step: 'done', phone: '+447400123456', email: 'priya@example.com' });
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ phone: '+447400123456', status: 'pending', firstName: 'Priya' });
    expect(pending.size).toBe(0);
  });

  it('an incomplete number is rejected and never reaches OTP', async () => {
    for (const phone of ['+44 7400', '+1 202 555', '98765', '+65 9123']) {
      const r = await call(auth.signup, { ...SIGNUP, phone });
      expect(r.status, phone).toBe(400);
      expect(r.body.field).toBe('phone');
    }
    expect(sent).toHaveLength(0);
    expect(pending.size).toBe(0);
  });

  it('an existing Indian member stored as 10 digits still logs in with the +91 form (same OTP key)', async () => {
    members.push({ id: 'old', memberId: 'TBT-1', firstName: 'Ravi', lastName: null, email: 'ravi@x.com', phone: '9876543210',
      passwordHash: await (await import('bcrypt')).default.hash('pw123456', 4), status: 'active', verificationStatus: 'verified', onboardingSubmittedAt: new Date(), deletedAt: null });
    const l = await call(auth.login, { phone: '+919876543210', password: 'pw123456' });
    expect(l.body.data.step).toBe('otp_required');
    const otp = sent.at(-1)!.otp;
    const v = await call(auth.verifyOtp, { phone: '+91 98765 43210', otp });
    expect(v.status).toBe(200);
    expect(v.body.data.id).toBe('old');
  });
});

describe('pending registrations', () => {
  it('an abandoned sign-up does not block a retry with "email already exists"', async () => {
    await call(auth.signup, { ...SIGNUP, phone: '+919876543210' }); // never verified
    const retry = await call(auth.signup, { ...SIGNUP, phone: '+919812345678' }); // corrected number, same email
    expect(retry.status).toBe(201);
    expect([...pending.keys()]).toEqual(['+919812345678']); // latest attempt wins
    const v = await call(auth.verifyOtp, { phone: '+919812345678', otp: lastOtpFor('+919812345678') });
    expect(v.status).toBe(200);
    expect(members.map((m) => m.phone)).toEqual(['+919812345678']);
  });

  it('a wrong OTP creates nothing; the right one creates exactly one account', async () => {
    await call(auth.signup, { ...SIGNUP, phone: '+971501234567' });
    const bad = await call(auth.verifyOtp, { phone: '+971501234567', otp: '000000' });
    expect(bad.status).toBe(400);
    expect(members).toHaveLength(0);
    const ok = await call(auth.verifyOtp, { phone: '+971501234567', otp: lastOtpFor('+971501234567') });
    expect(ok.status).toBe(200);
    expect(members).toHaveLength(1);
  });

  it('a real (verified) account with the same email still blocks', async () => {
    members.push({ id: 'real', memberId: 'TBT-2', firstName: 'A', lastName: null, email: 'priya@example.com', phone: '+919000000001',
      passwordHash: 'x', status: 'active', verificationStatus: 'verified', onboardingSubmittedAt: new Date(), deletedAt: null });
    const r = await call(auth.signup, { ...SIGNUP, phone: '+447400123456' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/email already exists/);
    expect(sent).toHaveLength(0);
  });

  it('an old never-verified account is taken over by the verified retry, not duplicated or deleted', async () => {
    members.push({ id: 'stale', memberId: 'TBT-3', firstName: 'Old', lastName: null, email: 'priya@example.com', phone: '9123456780',
      passwordHash: 'old', status: 'pending', verificationStatus: 'awaiting_kyc', onboardingSubmittedAt: null, deletedAt: null });
    const r = await call(auth.signup, { ...SIGNUP, phone: '+447400123456' });
    expect(r.status).toBe(201);
    const v = await call(auth.verifyOtp, { phone: '+447400123456', otp: lastOtpFor('+447400123456') });
    expect(v.status).toBe(200);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: 'stale', phone: '+447400123456', firstName: 'Priya', email: 'priya@example.com' });
  });

  it('older clients that call /login right after /signup get the same OTP flow (no 429)', async () => {
    await call(auth.signup, { ...SIGNUP, phone: '+6591234567' });
    const l = await call(auth.login, { phone: '+6591234567', password: 'secret123' });
    expect(l.status).toBe(200);
    expect(l.body.data).toMatchObject({ step: 'otp_required', phone: '+6591234567' });
    expect(sent.filter((s) => s.phone === '+6591234567')).toHaveLength(1); // OTP not resent within the cooldown
    const wrongPw = await call(auth.login, { phone: '+6591234567', password: 'nope' });
    expect(wrongPw.status).toBe(404);
  });

  it('resend works for a pending sign-up and respects the cooldown', async () => {
    await call(auth.signup, { ...SIGNUP, phone: '+447400123456' });
    const r = await call(auth.resendOtp, { phone: '+447400123456' });
    expect(r.status).toBe(429); // still within the 60 s cooldown
    server.redis = fakeRedis(); // cooldown elapsed
    const r2 = await call(auth.resendOtp, { phone: '+447400123456' });
    expect(r2.status).toBe(200);
    expect(sent.filter((s) => s.phone === '+447400123456')).toHaveLength(2);
  });
});
