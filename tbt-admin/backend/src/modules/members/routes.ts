import { FastifyInstance } from 'fastify';
import {
  listMembersHandler,
  createMemberHandler,
  getMemberHandler,
  updateMemberHandler,
  deleteMemberHandler,
  getManagersHandler,
  createManagerHandler,
  getMemberProgressHandler,
  listMemberBadgesHandler,
  listAllBadgesHandler,
  assignBadgeHandler,
  removeBadgeHandler,
  listMemberEnrollmentsHandler,
  enrollMemberInWorkshopHandler,
  removeMemberEnrollmentHandler,
} from './controller.js';

export async function memberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/managers', getManagersHandler);
  fastify.post('/managers', createManagerHandler);
  fastify.get('/', listMembersHandler);
  fastify.post('/', createMemberHandler);
  fastify.get('/:id', getMemberHandler);
  fastify.put('/:id', updateMemberHandler);
  fastify.delete('/:id', deleteMemberHandler);
  fastify.get('/:id/progress', getMemberProgressHandler);
  fastify.get('/badges/all', listAllBadgesHandler);
  fastify.get('/:id/badges', listMemberBadgesHandler);
  fastify.post('/:id/badges', assignBadgeHandler);
  fastify.delete('/:id/badges/:badgeId', removeBadgeHandler);
  fastify.get('/:id/enrollments', listMemberEnrollmentsHandler);
  fastify.post('/:id/enrollments', enrollMemberInWorkshopHandler);
  fastify.delete('/:id/enrollments/:workshopId', removeMemberEnrollmentHandler);
}
