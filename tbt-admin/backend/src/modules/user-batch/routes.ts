import { FastifyInstance } from 'fastify';
import { getMyBatchHandler, saveDraftHandler, submitDayHandler } from './controller.js';

export async function userBatchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticateUser);

  fastify.get('/', getMyBatchHandler);
  fastify.put('/:dayNumber', saveDraftHandler);
  fastify.post('/:dayNumber/submit', submitDayHandler);
}
