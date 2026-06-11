import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

async function clerkPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.decorate('clerk', clerkClient);

  // ── Admin auth (Clerk JWT) ───────────────────────────────────────────────────
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
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    clerk: any;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: string;
    memberId: string;
  }
}

export default fp(clerkPlugin);
