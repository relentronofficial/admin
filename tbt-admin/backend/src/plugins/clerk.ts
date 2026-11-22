import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// A valid Clerk session is not enough: Clerk sign-up is open, so the caller
// must also be an active, non-deleted row in `admins`. Cached briefly so this
// costs one DB read per admin per minute, not per request.
type AdminAuthRow = { id: string; role: string } | null;
const ADMIN_CACHE_TTL_MS = 60_000;
const adminCache = new Map<string, { row: AdminAuthRow; at: number }>();

async function lookupActiveAdmin(fastify: FastifyInstance, clerkId: string): Promise<AdminAuthRow> {
  const hit = adminCache.get(clerkId);
  if (hit && Date.now() - hit.at < ADMIN_CACHE_TTL_MS) return hit.row;
  const admin = await fastify.prisma.admin.findUnique({
    where: { clerkId },
    select: { id: true, role: true, status: true, deletedAt: true },
  });
  const row: AdminAuthRow =
    admin && admin.status === 'active' && !admin.deletedAt ? { id: admin.id, role: String(admin.role) } : null;
  if (adminCache.size > 1000) adminCache.clear();
  adminCache.set(clerkId, { row, at: Date.now() });
  return row;
}

/** Drop cached admin verdicts — call after changing an admin's role, status or deletion. */
export function invalidateAdminAuthCache(clerkId?: string | null) {
  if (clerkId) adminCache.delete(clerkId);
  else adminCache.clear();
}

async function clerkPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.decorate('clerk', clerkClient);

  // ── Admin auth (Clerk JWT + active admin row) ────────────────────────────────
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: No token provided' });
    }
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Invalid token format' });
    }
    try {
      const verified = await verifyToken(match[1], {
        secretKey: env.CLERK_SECRET_KEY,
        jwtKey: env.CLERK_JWT_PUBLIC_KEY || undefined,
      });
      if (!verified?.sub) throw new Error('Token subject missing');
      request.user = verified.sub;
    } catch (err: any) {
      request.server.log.error({ message: err.message }, 'Clerk JWT verification failed');
      return reply.status(401).send({ success: false, data: null, error: `Unauthorized: ${err.message}` });
    }
    let admin: AdminAuthRow;
    try {
      admin = await lookupActiveAdmin(fastify, request.user);
    } catch (err: any) {
      request.server.log.error({ message: err.message }, 'Admin lookup failed');
      return reply.status(500).send({ success: false, data: null, error: 'Internal error' });
    }
    if (!admin) {
      request.server.log.warn({ clerkId: request.user, url: request.url }, 'Clerk user is not an active admin');
      return reply.status(403).send({ success: false, data: null, error: 'Forbidden: not an active admin account' });
    }
    request.adminId = admin.id;
    request.adminRole = admin.role;
  });

  // ── Admin OR member (shared endpoints such as uploads) ───────────────────────
  // A Bearer token that verifies as a member JWT goes through member auth; any
  // other Bearer token is treated as a Clerk admin token; no Bearer header means
  // the member cookie.
  fastify.decorate('authenticateAdminOrMember', async (request: FastifyRequest, reply: FastifyReply) => {
    const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
      let isMemberToken = false;
      try {
        const decoded: any = await (fastify as any).jwt.verify(bearer);
        isMemberToken = !!decoded?.memberId;
      } catch { /* not a member token */ }
      return isMemberToken ? fastify.authenticateUser(request, reply) : fastify.authenticate(request, reply);
    }
    return fastify.authenticateUser(request, reply);
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    clerk: any;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdminOrMember: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: string;
    memberId: string;
    /** Set by `authenticate`: the active admin's DB id and role. */
    adminId?: string;
    adminRole?: string;
  }
}

export default fp(clerkPlugin);
