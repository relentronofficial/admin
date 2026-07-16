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
  getMemberWatchAnalyticsHandler,
  getMemberActivityTimelineHandler,
  getAnalyticsOverviewHandler,
  getAtRiskMembersHandler,
  getCompletionMatrixHandler,
  reviewAssignmentHandler,
  listAllAssignmentSubmissionsHandler,
  approveMemberHandler,
  exportMembersHandler,
} from './controller.js';
import { adminRevokeMemberSessions } from '../user-auth/controller.js';

export async function memberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Analytics (overview routes first to avoid :id capture)
  fastify.get('/analytics/overview', getAnalyticsOverviewHandler);
  fastify.get('/analytics/at-risk', getAtRiskMembersHandler);
  fastify.get('/analytics/workshop/:workshopId/matrix', getCompletionMatrixHandler);
  fastify.get('/assignments', listAllAssignmentSubmissionsHandler);
  fastify.patch('/assignments/:submissionId/review', reviewAssignmentHandler);

  fastify.get('/managers', getManagersHandler);
  fastify.post('/managers', createManagerHandler);
  fastify.get('/badges/all', listAllBadgesHandler);
  // CSV export — accepts the same filter query params as the list
  // endpoint. Placed BEFORE `/` so no capture conflict.
  fastify.get('/export', exportMembersHandler);
  fastify.get('/', listMembersHandler);
  fastify.post('/', createMemberHandler);
  fastify.get('/:id', getMemberHandler);
  fastify.put('/:id', updateMemberHandler);
  fastify.post('/:id/approve', approveMemberHandler);
  // Admin can force-sign-out every device this member is signed in on.
  // Useful when disabling a leaked account or after a support handoff.
  fastify.post('/:id/sessions/revoke', (req, reply) =>
    adminRevokeMemberSessions(fastify, req, reply));
  fastify.delete('/:id', deleteMemberHandler);
  fastify.get('/:id/progress', getMemberProgressHandler);
  fastify.get('/:id/badges', listMemberBadgesHandler);
  fastify.post('/:id/badges', assignBadgeHandler);
  fastify.delete('/:id/badges/:badgeId', removeBadgeHandler);
  fastify.get('/:id/enrollments', listMemberEnrollmentsHandler);
  fastify.post('/:id/enrollments', enrollMemberInWorkshopHandler);
  fastify.delete('/:id/enrollments/:workshopId', removeMemberEnrollmentHandler);
  fastify.get('/:id/watch-analytics', getMemberWatchAnalyticsHandler);
  fastify.get('/:id/activity-timeline', getMemberActivityTimelineHandler);
}
