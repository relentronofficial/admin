import { FastifyInstance } from 'fastify';
import {
  getMeHandler,
  updateMeHandler,
  listUserCoursesHandler,
  getUserCourseHandler,
  enrollCourseHandler,
  getEnrollmentsHandler,
  getLessonProgressHandler,
  markLessonCompleteHandler,
  getDashboardStatsHandler,
  getContinueLearningHandler,
  listUserEventsHandler,
  getUserEventHandler,
  registerForEventHandler,
  listUserWebinarsHandler,
  getUserWebinarHandler,
  getWebinarTokenHandler,
  getUserNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
  getUserMessagesHandler,
  markMessageReadHandler,
  markAllMessagesReadHandler,
  getHomeHeroHandler,
  getHomeSectionsHandler,
  listWorkshopsHandler,
  getMyWorkshopsHandler,
  getWorkshopDetailHandler,
  getWorkshopFlowHandler,
  getWorkshopQaHandler,
  postWorkshopQaHandler,
  postQaReplyHandler,
  getWorkshopAssignmentsHandler,
  submitAssignmentHandler,
  getEpisodePlaybackHandler,
  postEpisodeProgressHandler,
  getUserProductsHandler,
  getUserResourcesHandler,
  startConversationHandler,
  listMemberConversationsHandler,
  getMemberConversationMessagesHandler,
  sendMemberChatMessageHandler,
  getWorkshopChallengesHandler,
  completeChallengeHandler,
  completeWorkshopEpisodeHandler,
} from './controller.js';

export async function userRoutes(fastify: FastifyInstance) {
  // All routes in this module require member authentication.
  fastify.addHook('preHandler', fastify.authenticateUser);

  // ── Profile ────────────────────────────────────────────────────────────────
  fastify.get('/me', getMeHandler);
  fastify.patch('/me', updateMeHandler);

  // ── Courses ────────────────────────────────────────────────────────────────
  fastify.get('/courses', listUserCoursesHandler);
  fastify.get('/courses/:id', getUserCourseHandler);
  fastify.post('/courses/:id/enroll', enrollCourseHandler);

  // ── Enrollments & lesson progress ─────────────────────────────────────────
  fastify.get('/enrollments', getEnrollmentsHandler);
  fastify.get('/enrollments/:courseId/progress', getLessonProgressHandler);
  fastify.post('/enrollments/:courseId/progress/:lessonId', markLessonCompleteHandler);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  fastify.get('/dashboard/stats', getDashboardStatsHandler);
  fastify.get('/dashboard/continue-learning', getContinueLearningHandler);

  // ── Events ────────────────────────────────────────────────────────────────
  fastify.get('/events', listUserEventsHandler);
  fastify.get('/events/:id', getUserEventHandler);
  fastify.post('/events/:id/register', registerForEventHandler);

  // ── Webinars ──────────────────────────────────────────────────────────────
  fastify.get('/webinars', listUserWebinarsHandler);
  fastify.get('/webinars/:id', getUserWebinarHandler);
  fastify.post('/webinars/:id/token', getWebinarTokenHandler);

  // ── Notifications ─────────────────────────────────────────────────────────
  fastify.get('/notifications', getUserNotificationsHandler);
  fastify.patch('/notifications/:id/read', markNotificationReadHandler);
  fastify.post('/notifications/read-all', markAllNotificationsReadHandler);

  // ── Messages ──────────────────────────────────────────────────────────────
  fastify.get('/messages', getUserMessagesHandler);
  fastify.patch('/messages/:id/read', markMessageReadHandler);
  fastify.post('/messages/read-all', markAllMessagesReadHandler);

  // ── Home ──────────────────────────────────────────────────────────────────
  fastify.get('/home/hero', getHomeHeroHandler);
  fastify.get('/home/sections', getHomeSectionsHandler);

  // ── Workshops (user-facing) ───────────────────────────────────────────────
  fastify.get('/workshops', listWorkshopsHandler);
  fastify.get('/workshops/my', getMyWorkshopsHandler);
  fastify.get('/workshops/:slug/detail', getWorkshopDetailHandler);
  fastify.get('/workshops/:slug/flow', getWorkshopFlowHandler);
  fastify.get('/workshops/:slug/qa', getWorkshopQaHandler);
  fastify.post('/workshops/:slug/qa', postWorkshopQaHandler);
  fastify.post('/qa/:postId/reply', postQaReplyHandler);
  fastify.get('/workshops/:slug/assignments', getWorkshopAssignmentsHandler);
  fastify.post('/assignments/:id/submit', submitAssignmentHandler);

  // ── Challenges ────────────────────────────────────────────────────────────
  fastify.get('/workshops/:slug/challenges', getWorkshopChallengesHandler);
  fastify.post('/challenges/:id/complete', completeChallengeHandler);
  fastify.post('/workshop-episodes/:id/complete', completeWorkshopEpisodeHandler);

  // ── Episodes ──────────────────────────────────────────────────────────────
  fastify.get('/episodes/:id/playback', getEpisodePlaybackHandler);
  fastify.post('/episodes/:id/progress', postEpisodeProgressHandler);

  // ── Products & Resources ──────────────────────────────────────────────────
  fastify.get('/products', getUserProductsHandler);
  fastify.get('/resources', getUserResourcesHandler);

  // ── Conversations (live chat) ─────────────────────────────────────────────
  fastify.post('/conversations',                      startConversationHandler);
  fastify.get('/conversations',                       listMemberConversationsHandler);
  fastify.get('/conversations/:id/messages',          getMemberConversationMessagesHandler);
  fastify.post('/conversations/:id/messages',         sendMemberChatMessageHandler);
}
