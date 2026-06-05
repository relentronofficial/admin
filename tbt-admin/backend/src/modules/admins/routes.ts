import { FastifyInstance } from 'fastify';
import {
  listAdminsHandler,
  createAdminHandler,
  getAdminHandler,
  updateAdminHandler,
  deleteAdminHandler,
  updateStatusHandler,
  updateRBAChandler,
  generateIdHandler,
  checkUsernameHandler,
  checkEmailHandler,
  searchAdminsHandler
} from './controller.js';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listAdminsHandler);
  fastify.post('/', createAdminHandler);
  fastify.get('/generate-id', generateIdHandler);
  fastify.get('/check-username', checkUsernameHandler);
  fastify.get('/check-email', checkEmailHandler);
  fastify.get('/search', searchAdminsHandler);
  fastify.get('/:id', getAdminHandler);
  fastify.put('/:id', updateAdminHandler);
  fastify.delete('/:id', deleteAdminHandler);
  fastify.put('/:id/status', updateStatusHandler);
  fastify.put('/:id/rbac', updateRBAChandler);
}
