import { FastifyInstance } from 'fastify';
import {
  listBatchesHandler,
  getBatchHandler,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
} from './controller.js';

export async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listBatchesHandler);
  fastify.get('/:id', getBatchHandler);
  fastify.post('/', createBatchHandler);
  fastify.put('/:id', updateBatchHandler);
  fastify.delete('/:id', deleteBatchHandler);
}
