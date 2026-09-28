import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { isLoginRevoked } from '../lib/sessionRevocation.js';

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

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/// Hard-revoke a token by its pre-computed SHA-256 hash (used by session management
/// where the hash is stored in DB but the raw token is no longer available).
export async function revokeRefreshTokenByHash(redis: any, hash: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(`refresh:${hash}`, `refresh_grace:${hash}`);
      return;
    } catch (err) {
      _log('redis.del (by hash) failed:', err);
    }
  }
  _refreshStore.delete(hash);
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

/// Hard-revoke every refresh token belonging to a member. Used when a
/// new login is issued (single-session enforcement), by the admin
/// session-kill endpoint, and by the member "sign out all devices" route.
/// Requires Redis SCAN — in a Redis outage this is a no-op (fails safe).
export async function revokeAllForMember(redis: any, memberId: string): Promise<number> {
  if (!redis) return 0;
  let cursor = '0';
  let deleted = 0;
  try {
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', 'refresh:*', 'COUNT', 200);
      cursor = next;
      if (!batch.length) continue;
      const values = await redis.mget(...batch);
      const toDelete = batch.filter((_: string, i: number) => values[i] === memberId);
      if (toDelete.length) {
        // Also kill any grace-window copies so they can't be used after
        // a new login issues a fresh token for the same member.
        const graceToDelete = toDelete.map((k: string) => k.replace('refresh:', 'refresh_grace:'));
        deleted += await redis.del(...toDelete, ...graceToDelete);
      }
    } while (cursor !== '0');
    // Set REVOKED sentinel so any in-flight access token with the old loginId
    // is rejected immediately (within the 15-min access-token TTL window).
    // issueTokens called right after this will overwrite with the new loginId.
    await redis.set(`active_login:${memberId}`, 'REVOKED', 'EX', 900).catch(() => {});
    _activeLoginCache.delete(memberId);
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

// ── Active login ID cache (single-session enforcement) ──────────────────────────
//
// `active_login:{memberId}` in Redis holds the loginId that the current valid
// session was issued with. authenticateUser rejects any access token whose
// loginId claim doesn't match — this closes the 15-minute window where a
// kicked device's unexpired access token would otherwise still work.
//
// In-memory cache (15 s) keeps hot-path latency low; invalidated immediately
// on every mutation (revokeAllForMember / setActiveLoginId).

const ACTIVE_LOGIN_CACHE_TTL = 15_000;
const _activeLoginCache = new Map<string, { value: string | null; expiresAt: number }>();

async function getCachedActiveLoginId(redis: any, memberId: string): Promise<string | null> {
  const cached = _activeLoginCache.get(memberId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  _activeLoginCache.delete(memberId);
  if (!redis) return null; // Redis unavailable — fail open
  try {
    const raw = await redis.get(`active_login:${memberId}`);
    const value = raw != null ? String(raw) : null;
    _activeLoginCache.set(memberId, { value, expiresAt: Date.now() + ACTIVE_LOGIN_CACHE_TTL });
    return value;
  } catch {
    return null; // Redis error — fail open
  }
}

export function invalidateActiveLoginIdCache(memberId: string): void {
  _activeLoginCache.delete(memberId);
}

/// Store the active loginId for a member. TTL mirrors the refresh token so the
/// key stays alive as long as the session can possibly be refreshed.
export async function setActiveLoginId(redis: any, memberId: string, loginId: string): Promise<void> {
  if (!redis) return;
  _activeLoginCache.delete(memberId);
  await redis.set(`active_login:${memberId}`, loginId, 'EX', REFRESH_TTL).catch(() => {});
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
    let loginId: string | undefined;
    try {
      const decoded = await (fastify as any).jwt.verify(token) as { memberId: string; loginId?: string };
      memberId = decoded.memberId;
      loginId = decoded.loginId;
      if (!memberId) throw new Error('No memberId in token');
    } catch {
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Invalid or expired token' });
    }

    // Single-session check: reject tokens whose loginId no longer matches
    // the active session recorded in Redis. Skipped for pre-migration tokens
    // (no loginId claim) and when Redis is unavailable (fail open).
    const redis = (fastify as any).redis ?? null;
    const activeLoginId = await getCachedActiveLoginId(redis, memberId);
    const verdict = isLoginRevoked(loginId, activeLoginId);
    if (verdict === 'revoked') {
      return reply.status(401).send({
        success: false,
        data: null,
        error: 'Session expired. Please sign in again.',
        code: 'SESSION_REVOKED',
      });
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
