import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real bridge handlers against a fake Psychometric API (global fetch) that
// behaves like the real one: POST /admin/login issues a token and invalidates
// the previous one (single active session); admin routes need the current token.

const env = vi.hoisted(() => ({
  PSYCHOMETRIC_API_URL: 'https://psy.example/api/v1',
  PSYCHOMETRIC_ADMIN_EMAIL: 'bridge@example.com',
  PSYCHOMETRIC_ADMIN_PASSWORD: 'pw-not-real',
}));
vi.mock('../../config/env.js', () => ({ env }));

const { accessHandler, proxyHandler, resetPsychometricSessionForTests } = await import('./controller.js');

const ADMINS: Record<string, { id: string; fullName: string; role: string }> = {
  clerk_admin: { id: 'a-1', fullName: 'Admin', role: 'admin' },
  clerk_super: { id: 'a-2', fullName: 'Super', role: 'super_admin' },
  clerk_mentor: { id: 'a-3', fullName: 'Mentor', role: 'mentor' },
  clerk_mod: { id: 'a-4', fullName: 'Mod', role: 'moderator' },
};

let redisData: Map<string, string>;
const redis = {
  async get(k: string) { return redisData.get(k) ?? null; },
  async set(k: string, v: string, ...args: unknown[]) {
    if (args.includes('NX') && redisData.has(k)) return null;
    redisData.set(k, v);
    return 'OK';
  },
  async del(k: string) { return redisData.delete(k) ? 1 : 0; },
};

// ── fake Psychometric API ────────────────────────────────────────────────
let activeToken: string | null;
let logins: number;
let upstreamCalls: { method: string; url: string; auth: string | null; body: string | undefined }[];
const fakeFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
  const u = new URL(url);
  const method = init.method ?? 'GET';
  const auth = (init.headers as Record<string, string> | undefined)?.Authorization ?? null;
  if (u.pathname === '/api/v1/admin/login') {
    const body = JSON.parse(String(init.body));
    // The account as it exists on the Psychometric side (independent of what TBT's env says).
    if (body.email !== 'bridge@example.com' || body.password !== 'pw-not-real') {
      return new Response(JSON.stringify({ success: false, message: 'Invalid credentials.' }), { status: 401 });
    }
    activeToken = `tok-${++logins}`;
    return new Response(JSON.stringify({ success: true, token: activeToken }), { status: 200 });
  }
  upstreamCalls.push({ method, url: u.pathname + u.search, auth, body: init.body as string | undefined });
  if (auth !== `Bearer ${activeToken}`) return new Response(JSON.stringify({ success: false, message: 'Session expired.' }), { status: 401 });
  if (u.pathname === '/api/v1/admin/export/pdf') {
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="r.pdf"' },
    });
  }
  return new Response(JSON.stringify({ success: true, data: { echo: u.pathname + u.search, method } }), {
    status: method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json; charset=utf-8' },
  });
});

beforeEach(() => {
  redisData = new Map();
  activeToken = null;
  logins = 0;
  upstreamCalls = [];
  fakeFetch.mockClear();
  vi.stubGlobal('fetch', fakeFetch);
  resetPsychometricSessionForTests();
  Object.assign(env, { PSYCHOMETRIC_ADMIN_EMAIL: 'bridge@example.com', PSYCHOMETRIC_ADMIN_PASSWORD: 'pw-not-real' });
});
afterEach(() => vi.unstubAllGlobals());

const logs: any[] = [];
async function call(handler: any, opts: { clerk?: string; method?: string; path?: string; query?: string; body?: any } = {}) {
  const sent: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
  const reply: any = {
    code(c: number) { sent.status = c; return reply; },
    header(k: string, v: string) { sent.headers[k] = v; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const path = opts.path ?? 'dashboard';
  const req: any = {
    user: opts.clerk,
    method: opts.method ?? 'GET',
    url: `/api/psychometric-bridge/admin/${path}${opts.query ?? ''}`,
    params: { '*': path },
    body: opts.body,
    server: {
      redis,
      prisma: { admin: { findUnique: async ({ where }: any) => ADMINS[where.clerkId] ?? null } },
    },
    log: { error: (...a: any[]) => logs.push(['error', ...a]), info: (...a: any[]) => logs.push(['info', ...a]) },
  };
  await handler(req, reply);
  const json = Buffer.isBuffer(sent.body) && sent.headers['content-type']?.includes('json') ? JSON.parse(sent.body.toString()) : sent.body;
  return { ...sent, json };
}

describe('access control', () => {
  it.each(['clerk_admin', 'clerk_super'])('%s can use the bridge', async (clerk) => {
    const r = await call(accessHandler, { clerk });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ allowed: true, configured: true });
  });

  it.each(['clerk_mentor', 'clerk_mod', 'clerk_unknown', undefined])('%s is denied (403) and nothing reaches Psychometric', async (clerk) => {
    for (const h of [accessHandler, proxyHandler]) {
      const r = await call(h, { clerk });
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/Admin and Super Admin only/);
    }
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('reports "not connected" (503) until the service account is configured', async () => {
    env.PSYCHOMETRIC_ADMIN_PASSWORD = '';
    expect((await call(accessHandler, { clerk: 'clerk_admin' })).body.data.configured).toBe(false);
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    expect(r.status).toBe(503);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('forwarding', () => {
  it('signs in server-side once and forwards GETs with query string', async () => {
    const a = await call(proxyHandler, { clerk: 'clerk_admin', path: 'results', query: '?page=2&search=ravi' });
    const b = await call(proxyHandler, { clerk: 'clerk_super', path: 'dashboard' });
    expect(a.status).toBe(200);
    expect(a.json.data.echo).toBe('/api/v1/admin/results?page=2&search=ravi');
    expect(b.status).toBe(200);
    expect(logins).toBe(1);
    expect(upstreamCalls.every((c) => c.auth === 'Bearer tok-1')).toBe(true);
    expect(redisData.get('psychometric:bridge:token')).toBe('tok-1');
  });

  it('forwards JSON bodies and status for writes, and logs which TBT admin made them', async () => {
    logs.length = 0;
    const r = await call(proxyHandler, { clerk: 'clerk_admin', method: 'POST', path: 'questions', body: { text: 'Q?' } });
    expect(r.status).toBe(201);
    expect(upstreamCalls[0]).toMatchObject({ method: 'POST', url: '/api/v1/admin/questions', body: JSON.stringify({ text: 'Q?' }) });
    expect(logs.some(([lvl, o]) => lvl === 'info' && o.adminId === 'a-1' && o.psychometricAction === 'POST /admin/questions')).toBe(true);
  });

  it('passes binary downloads through with their headers', async () => {
    const r = await call(proxyHandler, { clerk: 'clerk_admin', path: 'export/pdf' });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toContain('r.pdf');
    expect([...r.body]).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('re-signs in once when the token was replaced (single-session), then succeeds', async () => {
    await call(proxyHandler, { clerk: 'clerk_admin' });
    activeToken = 'someone-else-logged-in';
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    expect(r.status).toBe(200);
    expect(logins).toBe(2);
  });

  it('never returns 401 for a Psychometric-side auth failure (it is not a TBT sign-out)', async () => {
    env.PSYCHOMETRIC_ADMIN_PASSWORD = 'wrong';
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain('wrong');
  });

  it.each(['login', 'logout', 'change-password', 'profile', 'users/../login', 'unknown'])(
    'refuses /admin/%s without calling Psychometric', async (path) => {
      const r = await call(proxyHandler, { clerk: 'clerk_super', method: 'POST', path });
      expect(r.status).toBe(404);
      expect(fakeFetch).not.toHaveBeenCalled();
    },
  );

  it('never sends the service-account credentials or token back to the browser', async () => {
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    const out = JSON.stringify(r.json) + JSON.stringify(r.headers);
    expect(out).not.toContain('pw-not-real');
    expect(out).not.toContain('tok-1');
  });
});
