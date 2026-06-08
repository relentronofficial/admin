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
} from './controller.js';

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
  fastify.get('/', listMembersHandler);
  fastify.post('/', createMemberHandler);
  fastify.get('/:id', getMemberHandler);
  fastify.put('/:id', updateMemberHandler);
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
