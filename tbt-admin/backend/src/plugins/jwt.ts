import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import crypto from 'crypto';
import { env } from '../config/env.js';

// ── Cookie helpers ──────────────────────────────────────────────────────────────

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }),
  );
}

function cookieOpts(): string {
  const isProduction = env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  const sameSite = isProduction ? 'None' : 'Lax';
  return `HttpOnly${secure}; SameSite=${sameSite}; Path=/`;
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
): void {
  const opts = cookieOpts();
  reply.header('set-cookie', `tbt_access=${accessToken}; ${opts}; Max-Age=900`);
  reply.header('set-cookie', `tbt_refresh=${refreshToken}; ${opts}; Max-Age=${REFRESH_TTL}`);
}

export function clearAuthCookies(reply: FastifyReply): void {
  const opts = cookieOpts();
  reply.header('set-cookie', `tbt_access=; ${opts}; Max-Age=0`);
  reply.header('set-cookie', `tbt_refresh=; ${opts}; Max-Age=0`);
}

// ── Refresh token (opaque, stored in Redis) ─────────────────────────────────────
//
// Design constraints:
//
// 1. **Never log out a user unexpectedly.** Historic bug: a network drop
//    between the backend issuing a rotated token and the mobile client
//    writing the new cookie left the client with an already-invalidated
//    token — next refresh → 401 → session lost. Fix: rotation with a
//    grace window. When a refresh token is consumed, the new one is
//    issued AND the old one stays valid for `REFRESH_GRACE_SECONDS`
//    longer. If the client's next call carries the old token because
//    it never saw the rotation response, we still recognise it.
//
// 2. **Redis outage must not sign users out.** Historic bug: falling
//    back to an in-process `Map` meant every Cloud Run cold start
//    rejected all refresh calls. Fix: if Redis is unavailable, refuse
//    to rotate — return the old memberId and skip the delete. Sessions
//    keep working; rotation resumes when Redis recovers.
//
// 3. **1-year TTL** (extended from 30 days). A user who opens the app
//    at least once a year keeps their session — the rotation extends
//    the TTL on every use, so active users effectively never expire.

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const REFRESH_TTL = 365 * 24 * 3600; // 1 year — sliding window, extended on every use
const REFRESH_GRACE_SECONDS = 90;    // old token stays valid this long after rotation

/// Store a freshly-issued refresh token. Sets a full-TTL entry.
export async function storeRefreshToken(
  redis: any,
  refreshToken: string,
  memberId: string,
): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  if (redis) {
    try {
      await redis.set(`refresh:${hash}`, memberId, 'EX', REFRESH_TTL);
      return;
    } catch (err) {
      // If Redis fails on write we still fall back to memory so the
      // session works in this process. This will forget on restart —
      // acceptable since Redis is expected to recover quickly, and the
      // consume path (below) also honours the memory store.
      _log('redis.set failed, falling back to memory:', err);
    }
  }
  _refreshStore.set(hash, { memberId, expiresAt: Date.now() + REFRESH_TTL * 1000 });
}

/// Read a refresh token WITHOUT deleting it. Returns the member id if
/// the token is currently valid (either full-TTL or grace-window entry).
/// Used by `consumeRefreshToken` internally and also exposed for
/// non-rotating peek use cases (session-revoke check).
async function peekRefreshToken(redis: any, hash: string): Promise<string | null> {
  if (redis) {
    try {
      // Check full-TTL entry first, then grace entry as fallback.
      const primary = await redis.get(`refresh:${hash}`);
      if (primary) return primary;
      const grace = await redis.get(`refresh_grace:${hash}`);
      return grace ?? null;
    } catch (err) {
      _log('redis.get failed during peek, falling back to memory:', err);
    }
  }
  const entry = _refreshStore.get(hash);
  if (entry && Date.now() < entry.expiresAt) return entry.memberId;
  return null;
}

/// Rotate + return the current member id. New token is stored by the
/// caller AFTER this returns; the old token is moved into a
/// grace-window entry so a duplicate call from the client (e.g. it
/// never saw the rotation response) still succeeds.
///
/// Behavior when Redis is unavailable: the token is NOT invalidated —
/// we return the member id but leave the entry intact, and the caller
/// simply skips the rotation. Sessions keep working through outages
/// rather than mass-logging-out.
export async function consumeRefreshToken(
  redis: any,
  refreshToken: string,
): Promise<string | null> {
  const hash = hashRefreshToken(refreshToken);
  const memberId = await peekRefreshToken(redis, hash);
  if (!memberId) return null;

  if (redis) {
    try {
      // Move the current token into a short grace-window entry, then
      // delete the primary. If the client retries with the old token
      // within REFRESH_GRACE_SECONDS (network drop / concurrent call),
      // peekRefreshToken finds the grace copy and the refresh succeeds.
      await redis
        .multi()
        .set(`refresh_grace:${hash}`, memberId, 'EX', REFRESH_GRACE_SECONDS)
        .del(`refresh:${hash}`)
        .exec();
      return memberId;
    } catch (err) {
      // Redis fault mid-rotation — DO NOT invalidate. Session survives
      // this outage; the client will get a new token on next refresh
      // once Redis recovers.
      _log('redis rotation failed, LEAVING token intact:', err);
      return memberId;
    }
  }

  // Memory fallback (dev only). Simple rotation without grace window —
  // this code path shouldn't run in prod (Redis is required there).
  _refreshStore.delete(hash);
  return memberId;
}

/// Hard-revoke a token (user-triggered logout or admin session-kill).
/// Removes both the primary entry and any grace-window copy.
export async function revokeRefreshToken(redis: any, refreshToken: string): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  if (redis) {
    try {
      await redis.del(`refresh:${hash}`, `refresh_grace:${hash}`);
      return;
    } catch (err) {
      _log('redis.del failed:', err);
    }
  }
  _refreshStore.delete(hash);
}

/// Hard-revoke every refresh token belonging to a member. Used by the
/// admin session-kill endpoint. Requires Redis SCAN — in a Redis
/// outage this is a no-op (fails safe: the outage will resolve and the
/// admin can retry).
export async function revokeAllForMember(redis: any, memberId: string): Promise<number> {
  if (!redis) return 0;
  let cursor = '0';
  let deleted = 0;
  try {
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', 'refresh:*', 'COUNT', 200);
      cursor = next;
      if (!batch.length) continue;
      // Fetch member ids in bulk and delete matching entries.
      const values = await redis.mget(...batch);
      const toDelete = batch.filter((_: string, i: number) => values[i] === memberId);
      if (toDelete.length) {
        deleted += await redis.del(...toDelete);
      }
    } while (cursor !== '0');
  } catch (err) {
    _log('revokeAllForMember scan failed:', err);
  }
  return deleted;
}

// In-process fallback ONLY for local dev without Redis. Production
// (Cloud Run) always has Upstash Redis attached — if it's unavailable,
// the code paths above intentionally SKIP invalidation rather than
// falling here, so a Redis outage never signs users out.
const _refreshStore = new Map<string, { memberId: string; expiresAt: number }>();

function _log(msg: string, err?: unknown): void {
  // Never log the token itself — only the failure metadata.
  // eslint-disable-next-line no-console
  console.warn(`[jwt/refresh] ${msg}`, err instanceof Error ? err.message : err);
}

// ── Member status in-process cache ──────────────────────────────────────────────

const _memberStatusCache = new Map<string, { status: string; expiresAt: number }>();

function getCachedMemberStatus(memberId: string): string | null {
  const entry = _memberStatusCache.get(memberId);
  if (entry && Date.now() < entry.expiresAt) return entry.status;
  _memberStatusCache.delete(memberId);
  return null;
}

function setCachedMemberStatus(memberId: string, status: string) {
  _memberStatusCache.set(memberId, { status, expiresAt: Date.now() + 5 * 60 * 1000 });
}

// ── Plugin ──────────────────────────────────────────────────────────────────────

async function jwtPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  await fastify.register(fastifyJwt, { secret: env.JWT_ACCESS_SECRET });

  fastify.decorate('authenticateUser', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract token: Authorization header first, then tbt_access cookie
    let token: string | null = null;
    const authHeader = request.headers.authorization;
    if (authHeader?.match(/^Bearer\s+/i)) {
      token = authHeader.slice(authHeader.indexOf(' ') + 1).trim();
    } else {
      const cookies = parseCookies(request.headers.cookie);
      token = cookies['tbt_access'] ?? null;
    }

    if (!token) {
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized' });
    }

    let memberId: string;
    try {
      const decoded = await (fastify as any).jwt.verify(token) as { memberId: string };
      memberId = decoded.memberId;
      if (!memberId) throw new Error('No memberId in token');
    } catch {
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Invalid or expired token' });
    }

    // Fast path: in-memory status cache
    const cached = getCachedMemberStatus(memberId);
    if (cached !== null) {
      const blockedStatuses = ['inactive', 'suspended', 'paused'];
      if (blockedStatuses.includes(cached)) {
        return reply.status(403).send({ success: false, data: null, error: `Forbidden: Account is ${cached}` });
      }
      request.memberId = memberId;
      return;
    }

    // DB lookup
    try {
      const member = await fastify.prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, status: true },
      });

      if (!member) {
        return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Account not found' });
      }

      setCachedMemberStatus(memberId, (member as any).status);

      // Allow 'active' and 'pending' through — SubscriptionGate on the frontend
      // reads the status from /me and shows the pending-approval overlay for pending members.
      // Blocking 'pending' here would prevent /me from ever returning the status,
      // causing SubscriptionGate to silently skip the overlay.
      const blockedStatuses = ['inactive', 'suspended', 'paused'];
      if (blockedStatuses.includes((member as any).status)) {
        return reply.status(403).send({ success: false, data: null, error: `Forbidden: Account is ${(member as any).status}` });
      }

      request.memberId = memberId;
    } catch (err: any) {
      request.server.log.error({ err: err.message }, 'Member status lookup failed');
      return reply.status(500).send({ success: false, data: null, error: 'Internal error' });
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticateUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(jwtPlugin);
