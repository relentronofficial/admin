import { FastifyInstance } from 'fastify';
import {
  listCoursesHandler, createCourseHandler, getCourseHandler,
  updateCourseHandler, deleteCourseHandler, publishCourseHandler,
  listEnrollmentsHandler, updateCurriculumHandler,
  listCourseEpisodesHandler, createCourseEpisodeHandler,
  updateCourseEpisodeHandler, deleteCourseEpisodeHandler, reorderCourseEpisodesHandler,
  listCoursePaymentsHandler,
  listCourseAccessHandler, grantCourseAccessHandler, revokeCourseAccessHandler,
  approveCoursePaymentHandler,
  getCourseAnalyticsHandler, getCourseLeaderboardAdminHandler,
  listCourseBadgesHandler, createCourseBadgeHandler, updateCourseBadgeHandler,
  deleteCourseBadgeHandler, awardCourseBadgeHandler,
  resetMemberCourseProgressHandler, unlockAllLessonsForMemberHandler,
  listEpisodeResourcesHandler, createEpisodeResourceHandler,
  updateEpisodeResourceHandler, deleteEpisodeResourceHandler, reorderEpisodeResourcesHandler,
  listEpisodeTasksHandler, createEpisodeTaskHandler,
  updateEpisodeTaskHandler, deleteEpisodeTaskHandler, reorderEpisodeTasksHandler,
} from './controller.js';

export async function courseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Static paths before /:id to prevent param capture
  fastify.get('/payments', listCoursePaymentsHandler);

  fastify.get('/', listCoursesHandler);
  fastify.post('/', createCourseHandler);
  fastify.get('/:id', getCourseHandler);
  fastify.put('/:id', updateCourseHandler);
  fastify.delete('/:id', deleteCourseHandler);
  fastify.post('/:id/publish', publishCourseHandler);
  fastify.get('/:id/enrollments', listEnrollmentsHandler);
  fastify.post('/:id/curriculum', updateCurriculumHandler);

  // Access management
  fastify.get('/:id/access', listCourseAccessHandler);
  fastify.post('/:id/grant-access', grantCourseAccessHandler);
  fastify.delete('/:id/access/:accessId', revokeCourseAccessHandler);
  fastify.post('/:id/payments/:paymentId/approve', approveCoursePaymentHandler);

  // Analytics & leaderboard
  fastify.get('/:id/analytics', getCourseAnalyticsHandler);
  fastify.get('/:id/leaderboard', getCourseLeaderboardAdminHandler);

  // Badges
  fastify.get('/:id/badges', listCourseBadgesHandler);
  fastify.post('/:id/badges', createCourseBadgeHandler);
  fastify.put('/:id/badges/:badgeId', updateCourseBadgeHandler);
  fastify.delete('/:id/badges/:badgeId', deleteCourseBadgeHandler);
  fastify.post('/:id/badges/:badgeId/award', awardCourseBadgeHandler);

  // Per-member progression controls (sequential-unlock admin overrides)
  fastify.post('/:id/members/:memberId/reset-progress', resetMemberCourseProgressHandler);
  fastify.post('/:id/members/:memberId/unlock-all', unlockAllLessonsForMemberHandler);

  // Episodes
  fastify.get('/:id/episodes', listCourseEpisodesHandler);
  fastify.post('/:id/episodes', createCourseEpisodeHandler);
  fastify.put('/:id/episodes/reorder', reorderCourseEpisodesHandler);
  fastify.put('/episodes/:eid', updateCourseEpisodeHandler);
  fastify.delete('/episodes/:eid', deleteCourseEpisodeHandler);

  // Per-episode resources (static 'reorder' before /:rid to avoid param capture)
  fastify.get('/episodes/:eid/resources', listEpisodeResourcesHandler);
  fastify.post('/episodes/:eid/resources', createEpisodeResourceHandler);
  fastify.put('/episodes/:eid/resources/reorder', reorderEpisodeResourcesHandler);
  fastify.put('/episodes/:eid/resources/:rid', updateEpisodeResourceHandler);
  fastify.delete('/episodes/:eid/resources/:rid', deleteEpisodeResourceHandler);

  // Per-episode tasks
  fastify.get('/episodes/:eid/tasks', listEpisodeTasksHandler);
  fastify.post('/episodes/:eid/tasks', createEpisodeTaskHandler);
  fastify.put('/episodes/:eid/tasks/reorder', reorderEpisodeTasksHandler);
  fastify.put('/episodes/:eid/tasks/:tid', updateEpisodeTaskHandler);
  fastify.delete('/episodes/:eid/tasks/:tid', deleteEpisodeTaskHandler);
}
