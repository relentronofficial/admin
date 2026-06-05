import { FastifyInstance } from 'fastify';
import { listBatchesHandler } from './controller.js';

export async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listBatchesHandler);
}
