import { FastifyInstance } from 'fastify';
import { listProductsHandler, createProductHandler, updateProductHandler, deleteProductHandler, reorderProductsHandler } from './controller.js';

export async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listProductsHandler);
  fastify.post('/', createProductHandler);
  fastify.put('/reorder', reorderProductsHandler);
  fastify.put('/:id', updateProductHandler);
  fastify.delete('/:id', deleteProductHandler);
}
