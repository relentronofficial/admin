import { FastifyInstance } from 'fastify';
import {
  listTasksHandler,
  createTaskInitiativeHandler,
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from './controller.js';

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listTasksHandler);
  fastify.post('/initiative', createTaskInitiativeHandler);
  fastify.get('/:id', getTaskHandler);
  fastify.put('/:id', updateTaskHandler);
  fastify.delete('/:id', deleteTaskHandler);
}
