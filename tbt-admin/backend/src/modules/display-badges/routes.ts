import { FastifyInstance } from 'fastify';
import { listBadgesHandler, createBadgeHandler, updateBadgeHandler, deleteBadgeHandler, assignBadgeHandler, removeBadgeHandler } from './controller.js';

export async function displayBadgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listBadgesHandler);
  fastify.post('/', createBadgeHandler);
  fastify.put('/:id', updateBadgeHandler);
  fastify.delete('/:id', deleteBadgeHandler);
  fastify.post('/members/:memberId/assign', assignBadgeHandler);
  fastify.delete('/members/:memberId/badges/:badgeId', removeBadgeHandler);
}
