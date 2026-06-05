import { FastifyInstance } from 'fastify';
import { listResourcesHandler, createResourceHandler, updateResourceHandler, deleteResourceHandler, reorderResourcesHandler } from './controller.js';

export async function appResourceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listResourcesHandler);
  fastify.post('/', createResourceHandler);
  fastify.put('/reorder', reorderResourcesHandler);
  fastify.put('/:id', updateResourceHandler);
  fastify.delete('/:id', deleteResourceHandler);
}
