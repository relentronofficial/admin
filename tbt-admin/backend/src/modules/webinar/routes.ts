import { FastifyInstance } from 'fastify';
import {
  listWebinarsHandler,
  createWebinarHandler,
  getWebinarHandler,
  updateWebinarHandler,
  deleteWebinarHandler,
  startWebinarHandler,
  endWebinarHandler,
  listAttendeesHandler
} from './controller.js';

export async function webinarRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listWebinarsHandler);
  fastify.post('/', createWebinarHandler);
  fastify.get('/:id', getWebinarHandler);
  fastify.put('/:id', updateWebinarHandler);
  fastify.delete('/:id', deleteWebinarHandler);
  fastify.post('/:id/start', startWebinarHandler);
  fastify.post('/:id/end', endWebinarHandler);
  fastify.get('/:id/attendees', listAttendeesHandler);
}
