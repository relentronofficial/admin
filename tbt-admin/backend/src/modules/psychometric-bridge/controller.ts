import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  canUsePsychometric,
  createPsychometricSession,
  resolveUpstreamPath,
  type PsychometricSession,
} from '../../lib/psychometricBridge.js';

// See lib/psychometricBridge.ts for why this bridge exists and how the shared
// Psychometric session works.

const UPSTREAM_TIMEOUT_MS = 60_000;
const DENIED = 'Psychometric Admin is available to Admin and Super Admin only.';
const NOT_CONNECTED = 'Psychometric Admin is not connected yet. Ask a Super Admin to configure the Psychometric service account.';

const apiBase = () => (env.PSYCHOMETRIC_API_URL || '').replace(/\/$/, '');
const isConfigured = () => !!(apiBase() && env.PSYCHOMETRIC_ADMIN_EMAIL && env.PSYCHOMETRIC_ADMIN_PASSWORD);

async function loginToPsychometric(): Promise<string> {
  const res = await fetch(`${apiBase()}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.PSYCHOMETRIC_ADMIN_EMAIL, password: env.PSYCHOMETRIC_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as { token?: string } | null;
  // Never log the response or the credentials — only the status.
  if (!res.ok || !data?.token) throw new Error(`Psychometric service-account sign-in failed (HTTP ${res.status})`);
  return data.token;
}

let session: PsychometricSession | null = null;
function getSession(req: FastifyRequest): PsychometricSession {
  if (!session) session = createPsychometricSession({ store: req.server.redis ?? null, login: loginToPsychometric });
  return session;
}

/** Test hook: forget the cached session between test cases. */
export function resetPsychometricSessionForTests() {
  session = null;
}

/** Only Admin / Super Admin, checked on every request (server-side). */
async function authorise(req: FastifyRequest, reply: FastifyReply) {
  const admin = await getActingAdmin(req);
  if (!admin || !canUsePsychometric(admin.role)) {
    reply.code(403).send({ success: false, message: DENIED });
    return null;
  }
  return admin;
}

/** GET /api/psychometric-bridge/access — lets the admin panel show the right screen. */
export async function accessHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await authorise(req, reply);
  if (!admin) return;
  return reply.send({ success: true, data: { allowed: true, configured: isConfigured() } });
}

const PASS_HEADERS = ['content-type', 'content-disposition', 'cache-control'];

/** /api/psychometric-bridge/admin/* — forwards an allow-listed Psychometric admin call. */
export async function proxyHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await authorise(req, reply);
  if (!admin) return;
  if (!isConfigured()) return reply.code(503).send({ success: false, message: NOT_CONNECTED });

  // The route is /admin/*; the wildcard holds the rest of the path.
  const rawPath = `/admin/${(req.params as { '*'?: string })['*'] ?? ''}`;
  const path = resolveUpstreamPath(rawPath);
  if (!path) return reply.code(404).send({ success: false, message: 'Not found.' });

  const qIndex = req.url.indexOf('?');
  const query = qIndex >= 0 ? req.url.slice(qIndex) : '';
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined;

  const call = (token: string) =>
    fetch(`${apiBase()}${path}${query}`, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
      body: hasBody ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

  const s = getSession(req);
  let upstream: Response;
  try {
    let token = await s.getToken();
    upstream = await call(token);
    if (upstream.status === 401) {
      // Token expired or replaced (e.g. someone signed in as the service account): get a fresh one once.
      token = await s.refresh(token);
      upstream = await call(token);
    }
  } catch (err) {
    req.log.error({ err, path }, 'psychometric bridge request failed');
    return reply.code(502).send({ success: false, message: 'Could not reach the Psychometric service. Please try again.' });
  }

  if (upstream.status === 401) {
    // Not the TBT session's fault — don't send 401 (the admin panel would treat it as a TBT sign-out).
    req.log.error({ path }, 'psychometric bridge: service account rejected after re-login');
    return reply.code(502).send({ success: false, message: 'The Psychometric service account could not sign in.' });
  }

  if (req.method !== 'GET') {
    // In Psychometric every bridged change is attributed to the service account; record who really made it.
    req.log.info({ psychometricAction: `${req.method} ${path}`, adminId: admin.id, status: upstream.status }, 'psychometric bridge write');
  }

  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) reply.header(h, v);
  }
  return reply.code(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
}
