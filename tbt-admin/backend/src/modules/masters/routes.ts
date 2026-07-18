import { FastifyInstance } from 'fastify';
import { listMasterHandler, createMasterHandler } from './controller.js';

/**
 * Master-data routes: `/api/masters/{cities|states|business-types}`.
 * Protected by the admin panel's Clerk auth so only signed-in admins
 * can list or create. The user-web / mobile don't need these — user
 * fields go through the members API which does its own master-add.
 */
export async function mastersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/:kind', listMasterHandler);
  fastify.post('/:kind', createMasterHandler);
}
