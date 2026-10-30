import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real bridge handlers against a fake Psychometric API (global fetch) that
// accepts a request only with a valid HS256 bridge token for the admin
// audience, signed with ITS copy of the shared key — like utils/tbtBridge.js.

const env = vi.hoisted(() => ({
  PSYCHOMETRIC_API_URL: 'https://psy.example/api/v1',
  PSYCHOMETRIC_BRIDGE_SECRET: 'shared-key',
}));
vi.mock('../../config/env.js', () => ({ env }));

const { accessHandler, proxyHandler } = await import('./controller.js');

const ADMINS: Record<string, { id: string; fullName: string; role: string }> = {
  clerk_admin: { id: 'a-1', fullName: 'Admin', role: 'admin' },
  clerk_super: { id: 'a-2', fullName: 'Super', role: 'super_admin' },
  clerk_mentor: { id: 'a-3', fullName: 'Mentor', role: 'mentor' },
  clerk_mod: { id: 'a-4', fullName: 'Mod', role: 'moderator' },
};

// ── fake Psychometric API ────────────────────────────────────────────────
let psychometricKey: string;
let seenClaims: any[];
let upstreamCalls: { method: string; url: string; body: string | undefined }[];

function verify(auth: string | undefined) {
  const t = (auth ?? '').replace('Bearer ', '');
  const [h, p, s] = t.split('.');
  if (!h || !p || !s) return null;
  if (createHmac('sha256', psychometricKey).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (claims.iss !== 'tbt-backend' || claims.aud !== 'psychometric-admin' || claims.exp <= Date.now() / 1000) return null;
  return claims;
}

const fakeFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
  const u = new URL(url);
  const method = init.method ?? 'GET';
  const claims = verify((init.headers as Record<string, string> | undefined)?.Authorization);
  upstreamCalls.push({ method, url: u.pathname + u.search, body: init.body as string | undefined });
  if (!claims) return new Response(JSON.stringify({ success: false, message: 'Invalid or expired token.' }), { status: 401 });
  seenClaims.push(claims);
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
  psychometricKey = 'shared-key';
  seenClaims = [];
  upstreamCalls = [];
  fakeFetch.mockClear();
  vi.stubGlobal('fetch', fakeFetch);
  env.PSYCHOMETRIC_BRIDGE_SECRET = 'shared-key';
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
    server: { prisma: { admin: { findUnique: async ({ where }: any) => ADMINS[where.clerkId] ?? null } } },
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

  it('reports "not connected" (503) until the shared key is set', async () => {
    env.PSYCHOMETRIC_BRIDGE_SECRET = '';
    expect((await call(accessHandler, { clerk: 'clerk_admin' })).body.data.configured).toBe(false);
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    expect(r.status).toBe(503);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('forwarding', () => {
  it('signs every call (no login) as the acting TBT admin, and keeps the query string', async () => {
    const a = await call(proxyHandler, { clerk: 'clerk_admin', path: 'results', query: '?page=2&search=ravi' });
    const b = await call(proxyHandler, { clerk: 'clerk_super', path: 'dashboard' });
    expect(a.status).toBe(200);
    expect(a.json.data.echo).toBe('/api/v1/admin/results?page=2&search=ravi');
    expect(b.status).toBe(200);
    expect(seenClaims.map((c) => [c.sub, c.name])).toEqual([['a-1', 'Admin'], ['a-2', 'Super']]);
    expect(upstreamCalls.some((c) => c.url.includes('/login'))).toBe(false);
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

  it('a key mismatch is a 502 (never a 401, which the panel would treat as a TBT sign-out)', async () => {
    psychometricKey = 'different-key';
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain('shared-key');
  });

  it.each(['login', 'logout', 'change-password', 'profile', 'users/../login', 'unknown'])(
    'refuses /admin/%s without calling Psychometric', async (path) => {
      const r = await call(proxyHandler, { clerk: 'clerk_super', method: 'POST', path });
      expect(r.status).toBe(404);
      expect(fakeFetch).not.toHaveBeenCalled();
    },
  );

  it('never sends the key or the signed token back to the browser', async () => {
    const r = await call(proxyHandler, { clerk: 'clerk_admin' });
    const out = JSON.stringify(r.json) + JSON.stringify(r.headers);
    expect(out).not.toContain('shared-key');
    expect(out).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
  });
});
