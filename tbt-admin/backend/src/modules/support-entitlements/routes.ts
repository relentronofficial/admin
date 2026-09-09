import { FastifyInstance } from 'fastify';
import {
  listEntitlementsHandler,
  updateEntitlementHandler,
  listUsageHandler,
  recordUsageHandler,
  deleteUsageHandler,
  getMemberSupportQuotaHandler,
} from './controller.js';

export async function supportEntitlementsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listEntitlementsHandler);
  fastify.put('/:plan', updateEntitlementHandler);
  fastify.get('/usage', listUsageHandler);
  fastify.post('/usage', recordUsageHandler);
  fastify.delete('/usage/:id', deleteUsageHandler);
  fastify.get('/member/:memberId', getMemberSupportQuotaHandler);
}
