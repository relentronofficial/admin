import { FastifyInstance } from 'fastify';
import { listSlidesHandler, createSlideHandler, updateSlideHandler, deleteSlideHandler, reorderSlidesHandler } from './controller.js';

export async function heroRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listSlidesHandler);
  fastify.post('/', createSlideHandler);
  fastify.put('/reorder', reorderSlidesHandler);
  fastify.put('/:id', updateSlideHandler);
  fastify.delete('/:id', deleteSlideHandler);
}
