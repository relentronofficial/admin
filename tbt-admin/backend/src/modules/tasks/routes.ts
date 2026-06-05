import { FastifyInstance } from 'fastify';
import {
  listTasksHandler,
  createTaskHandler,
  createTaskInitiativeHandler,
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  updateTaskStatusHandler,
  assignTaskHandler
} from './controller.js';

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listTasksHandler);
  fastify.post('/', createTaskHandler);
  fastify.post('/initiative', createTaskInitiativeHandler);
  fastify.get('/:id', getTaskHandler);
  fastify.put('/:id', updateTaskHandler);
  fastify.delete('/:id', deleteTaskHandler);
  fastify.put('/:id/status', updateTaskStatusHandler);
  fastify.put('/:id/assign', assignTaskHandler);
}
