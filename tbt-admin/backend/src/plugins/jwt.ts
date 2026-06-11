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
  reply.header('set-cookie', `tbt_refresh=${refreshToken}; ${opts}; Max-Age=${30 * 24 * 3600}`);
}

export function clearAuthCookies(reply: FastifyReply): void {
  const opts = cookieOpts();
  reply.header('set-cookie', `tbt_access=; ${opts}; Max-Age=0`);
  reply.header('set-cookie', `tbt_refresh=; ${opts}; Max-Age=0`);
}

// ── Refresh token (opaque, stored in Redis) ─────────────────────────────────────

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const REFRESH_TTL = 30 * 24 * 3600; // 30 days

export async function storeRefreshToken(
  redis: any,
  refreshToken: string,
  memberId: string,
): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  if (redis) {
    await redis.set(`refresh:${hash}`, memberId, 'EX', REFRESH_TTL);
  } else {
    _refreshStore.set(hash, { memberId, expiresAt: Date.now() + REFRESH_TTL * 1000 });
  }
}

export async function consumeRefreshToken(
  redis: any,
  refreshToken: string,
): Promise<string | null> {
  const hash = hashRefreshToken(refreshToken);
  if (redis) {
    const memberId = await redis.get(`refresh:${hash}`);
    if (memberId) await redis.del(`refresh:${hash}`);
    return memberId ?? null;
  }
  const entry = _refreshStore.get(hash);
  if (entry && Date.now() < entry.expiresAt) {
    _refreshStore.delete(hash);
    return entry.memberId;
  }
  return null;
}

export async function revokeRefreshToken(redis: any, refreshToken: string): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  if (redis) await redis.del(`refresh:${hash}`);
  else _refreshStore.delete(hash);
}

// In-process fallback for dev without Redis
const _refreshStore = new Map<string, { memberId: string; expiresAt: number }>();

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
      if (cached !== 'active') {
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

      if ((member as any).status !== 'active') {
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
