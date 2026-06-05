import { FastifyInstance } from 'fastify';
import { listTiersHandler, createTierHandler, updateTierHandler, deleteTierHandler } from './controller.js';

export async function tierRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listTiersHandler);
  fastify.post('/', createTierHandler);
  fastify.put('/:id', updateTierHandler);
  fastify.delete('/:id', deleteTierHandler);
}
