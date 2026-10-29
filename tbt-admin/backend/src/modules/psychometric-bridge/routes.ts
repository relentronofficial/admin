import type { FastifyInstance } from 'fastify';
import { accessHandler, proxyHandler } from './controller.js';

// Clerk-protected; Admin / Super Admin only (checked in the handlers). The
// Psychometric pages in the admin panel call these instead of the Psychometric
// API directly, so no second login is needed.
export async function psychometricBridgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/access', accessHandler);
  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/admin/*',
    // Question audio is uploaded as a base64 data URI (capped at ~4 MB client-side).
    bodyLimit: 8 * 1024 * 1024,
    handler: proxyHandler,
  });
}
