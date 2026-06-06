import { FastifyInstance } from 'fastify';
import { listSecurityLogsHandler, getSecurityLogStatsHandler } from './controller.js';

export async function securityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listSecurityLogsHandler);
  fastify.get('/stats', getSecurityLogStatsHandler);
}
