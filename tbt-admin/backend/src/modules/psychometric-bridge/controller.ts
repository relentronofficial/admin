import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import { ADMIN_AUDIENCE, canUsePsychometric, resolveUpstreamPath, signBridgeToken } from '../../lib/psychometricBridge.js';

// See lib/psychometricBridge.ts: every forwarded call is signed with the key
// shared with the Psychometric server — no Psychometric account or login.

const UPSTREAM_TIMEOUT_MS = 60_000;
const DENIED = 'Psychometric Admin is available to Admin and Super Admin only.';
const NOT_CONNECTED = 'Psychometric Admin is not connected yet. Ask a Super Admin to set the Psychometric bridge key.';

export const apiBase = () => (env.PSYCHOMETRIC_API_URL || '').replace(/\/$/, '');
export const isConfigured = () => !!(apiBase() && env.PSYCHOMETRIC_BRIDGE_SECRET);

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

export const PASS_HEADERS = ['content-type', 'content-disposition', 'cache-control'];

/** /api/psychometric-bridge/admin/* — forwards an allow-listed Psychometric admin call. */
export async function proxyHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await authorise(req, reply);
  if (!admin) return;
  if (!isConfigured()) return reply.code(503).send({ success: false, message: NOT_CONNECTED });

  // The route is /admin/*; the wildcard holds the rest of the path.
  const path = resolveUpstreamPath(`/admin/${(req.params as { '*'?: string })['*'] ?? ''}`);
  if (!path) return reply.code(404).send({ success: false, message: 'Not found.' });

  const qIndex = req.url.indexOf('?');
  const query = qIndex >= 0 ? req.url.slice(qIndex) : '';
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined;
  const token = signBridgeToken(env.PSYCHOMETRIC_BRIDGE_SECRET!, ADMIN_AUDIENCE, { sub: admin.id, name: admin.fullName });

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase()}${path}${query}`, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
      body: hasBody ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    req.log.error({ err, path }, 'psychometric bridge request failed');
    return reply.code(502).send({ success: false, message: 'Could not reach the Psychometric service. Please try again.' });
  }

  if (upstream.status === 401) {
    // The Psychometric server rejected our signature (key mismatch, or its bridge
    // is off). Not a TBT sign-out, so never pass the 401 on.
    req.log.error({ path }, 'psychometric bridge: signed request rejected — check PSYCHOMETRIC_BRIDGE_SECRET / TBT_BRIDGE_SECRET');
    return reply.code(502).send({ success: false, message: 'The Psychometric service did not accept the TBT connection.' });
  }

  if (req.method !== 'GET') {
    // In Psychometric these changes are attributed to the TBT actor record; record who really made them.
    req.log.info({ psychometricAction: `${req.method} ${path}`, adminId: admin.id, status: upstream.status }, 'psychometric bridge write');
  }

  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) reply.header(h, v);
  }
  return reply.code(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
}
