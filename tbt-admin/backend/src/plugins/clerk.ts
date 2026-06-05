import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// In-memory cache: clerkId → { memberId, status } for 5 minutes.
// Eliminates a Supabase round-trip on every authenticated request.
const _memberCache = new Map<string, { memberId: string; status: string; expiresAt: number }>();
const MEMBER_CACHE_TTL = 5 * 60 * 1000;

function getCachedMember(clerkId: string) {
  const entry = _memberCache.get(clerkId);
  if (entry && Date.now() < entry.expiresAt) return entry;
  _memberCache.delete(clerkId);
  return null;
}

function setCachedMember(clerkId: string, memberId: string, status: string) {
  _memberCache.set(clerkId, { memberId, status, expiresAt: Date.now() + MEMBER_CACHE_TTL });
}

// Shared JWT extraction + verification logic used by both decorators.
async function extractAndVerifyClerkToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.status(401).send({ success: false, data: null, error: 'Unauthorized: No token provided' });
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Invalid token format' });
    return null;
  }

  try {
    const verifiedToken = await verifyToken(match[1], {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_PUBLIC_KEY || undefined,
    });

    if (!verifiedToken?.sub) {
      throw new Error('Token subject (sub) is missing');
    }

    return verifiedToken.sub;
  } catch (err: any) {
    request.server.log.error({ message: err.message }, 'Clerk JWT verification failed');
    reply.status(401).send({ success: false, data: null, error: `Unauthorized: ${err.message}` });
    return null;
  }
}

async function clerkPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.decorate('clerk', clerkClient);

  // ── Admin auth ─────────────────────────────────────────────────────────────
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const clerkId = await extractAndVerifyClerkToken(request, reply);
      if (!clerkId) return;
      request.user = clerkId;
    } catch (error: any) {
      request.server.log.error({ err: error.message }, 'Unexpected authentication error');
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Authentication failed' });
    }
  });

  // ── Member (user web app) auth ─────────────────────────────────────────────
  fastify.decorate('authenticateUser', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const clerkId = await extractAndVerifyClerkToken(request, reply);
      if (!clerkId) return;

      // Fast path: serve from in-memory cache (avoids DB round-trip per request).
      const cached = getCachedMember(clerkId);
      if (cached) {
        if (cached.status !== 'active') {
          return reply.status(403).send({ success: false, data: null, error: `Forbidden: Account is ${cached.status}` });
        }
        request.user = clerkId;
        request.memberId = cached.memberId;
        return;
      }

      // Look up the Member record linked to this Clerk user.
      const member = await fastify.prisma.member.findFirst({
        where: { clerkId } as any,
        select: { id: true, status: true },
      });

      if (!member) {
        // First sign-in: auto-create the Member record from Clerk profile.
        let clerkUser: any = null;
        try {
          clerkUser = await fastify.clerk.users.getUser(clerkId);
        } catch { /* use fallback values below */ }

        const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.tbt`;
        const firstName = clerkUser?.firstName ?? email.split('@')[0] ?? 'Member';
        const lastName  = clerkUser?.lastName ?? '';
        const phone     = clerkUser?.phoneNumbers?.[0]?.phoneNumber || `clerk:${clerkId}`;
        const memberId  = `TBT-${Math.floor(1000 + Math.random() * 9000)}`;

        try {
          const created = await fastify.prisma.member.create({
            data: { clerkId, memberId, firstName, lastName, email, phone } as any,
            select: { id: true, status: true },
          });
          // Give new members a 1-year active subscription so they can access the platform
          await fastify.prisma.subscription.create({
            data: {
              memberId: created.id,
              plan: 'premium',
              status: 'active',
              startsAt: new Date(),
              endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              amount: 0,
            } as any,
          }).catch(() => { /* non-fatal */ });
          setCachedMember(clerkId, created.id, (created as any).status ?? 'active');
          request.user = clerkId;
          request.memberId = created.id;
          return;
        } catch {
          return reply.status(401).send({
            success: false,
            data: null,
            error: 'Unauthorized: Could not provision member account',
          });
        }
      }

      if (member.status !== 'active') {
        return reply.status(403).send({
          success: false,
          data: null,
          error: `Forbidden: Account is ${member.status}`,
        });
      }

      setCachedMember(clerkId, member.id, member.status);
      request.user = clerkId;
      request.memberId = member.id;
    } catch (error: any) {
      request.server.log.error({ err: error.message }, 'Unexpected user authentication error');
      return reply.status(401).send({ success: false, data: null, error: 'Unauthorized: Authentication failed' });
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    clerk: any;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: string;
    memberId: string;
  }
}

export default fp(clerkPlugin);
