import { FastifyInstance } from 'fastify';
import {
  getMeHandler,
  updateMeHandler,
  updateAvatarHandler,
  avatarPresignHandler,
  assignmentImagePresignHandler,
  assignmentFilePresignHandler,
  revokeDeviceHandler,
  registerFcmTokenHandler,
  removeFcmTokenHandler,
  getNotificationPrefsHandler,
  updateNotificationPrefsHandler,
  listUserCourseCategories,
  listUserCoursesHandler,
  getUserCourseHandler,
  enrollCourseHandler,
  getCertificateEligibilityHandler,
  getCourseCertificateHandler,
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
  getNotificationUnreadCountHandler,
  dismissNotificationHandler,
  clearReadNotificationsHandler,
  getUserMessagesHandler,
  markMessageReadHandler,
  markAllMessagesReadHandler,
  getHomeHeroHandler,
  getHomeSectionsHandler,
  listWorkshopsHandler,
  getMyWorkshopsHandler,
  requestWorkshopAccessHandler,
  getWorkshopDetailHandler,
  getWorkshopFlowHandler,
  getWorkshopQaHandler,
  postWorkshopQaHandler,
  postQaReplyHandler,
  getWorkshopAssignmentsHandler,
  submitAssignmentHandler,
  getEpisodePlaybackHandler,
  postEpisodeProgressHandler,
  getUserEpisodeResourcesHandler,
  getUserEpisodeTasksHandler,
  getUserProductsHandler,
  submitProductInquiryHandler,
  getUserResourcesHandler,
  startConversationHandler,
  listMemberConversationsHandler,
  getMemberConversationMessagesHandler,
  sendMemberChatMessageHandler,
  getConversationUnreadCountHandler,
  archiveConversationHandler,
  getWorkshopChallengesHandler,
  getWorkshopOverviewHandler,
  completeChallengeHandler,
  completeWorkshopEpisodeHandler,
  getWatchHistoryHandler,
  removeFromHistoryHandler,
  getMyDevicesHandler,
  getWorkshopCertificateHandler,
  joinLiveCallHandler,
  getLiveCallStatusUserHandler,
  getUserPollsHandler,
  votePollHandler,
  upsertRsvpHandler,
  getRsvpStatusHandler,
  getLiveCallResourcesHandler,
  postLiveCallQuestionHandler,
  getLiveCallQuestionsHandler,
  getLiveCallChaptersHandler,
  postLiveCallFeedbackHandler,
  getMyLiveCallFeedbackHandler,
  getMyLiveCallCertificateHandler,
  getResourceDownloadHandler,
  submitCourseQuizHandler,
  getCourseXpHandler,
  getUserCourseLeaderboardHandler,
  getUserBadgesHandler,
  requestCourseAccessHandler,
  upsertReflectionHandler,
  listReflectionsHandler,
  searchHandler,
  getMyInquiredProductsHandler,
  listUserProgramsHandler,
  getUserProgramHandler,
  enrollInProgramHandler,
  getMyConnectionsHandler,
  getMyPostsHandler,
} from './controller.js';

export async function userRoutes(fastify: FastifyInstance) {
  // All routes in this module require member authentication.
  fastify.addHook('preHandler', fastify.authenticateUser);

  // ── Profile ────────────────────────────────────────────────────────────────
  fastify.get('/me', getMeHandler);
  fastify.patch('/me', updateMeHandler);
  fastify.patch('/me/avatar', updateAvatarHandler);
  fastify.post('/me/avatar-presign', avatarPresignHandler);
  fastify.get('/me/connections', getMyConnectionsHandler);
  fastify.get('/me/posts', getMyPostsHandler);

  // ── Courses ────────────────────────────────────────────────────────────────
  fastify.get('/courses/categories', listUserCourseCategories);
  fastify.get('/courses', listUserCoursesHandler);
  fastify.get('/courses/:id', getUserCourseHandler);
  fastify.post('/courses/:id/enroll', enrollCourseHandler);
  fastify.post('/courses/:id/request-access', requestCourseAccessHandler);
  fastify.get('/courses/:courseId/certificate-eligibility', getCertificateEligibilityHandler);
  fastify.get('/courses/:courseId/certificate', getCourseCertificateHandler);
  fastify.put('/courses/:courseId/reflections/:lessonId', upsertReflectionHandler);
  fastify.get('/courses/:courseId/reflections', listReflectionsHandler);

  // ── Enrollments & lesson progress ─────────────────────────────────────────
  fastify.get('/enrollments', getEnrollmentsHandler);
  fastify.get('/enrollments/:courseId/progress', getLessonProgressHandler);
  fastify.post('/enrollments/:courseId/progress/:lessonId', markLessonCompleteHandler);

  // ── Course gamification ────────────────────────────────────────────────────
  fastify.post('/courses/:id/episodes/:epId/quiz', submitCourseQuizHandler);
  fastify.get('/courses/:id/xp', getCourseXpHandler);
  fastify.get('/courses/:id/leaderboard', getUserCourseLeaderboardHandler);
  fastify.get('/badges', getUserBadgesHandler);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  fastify.get('/dashboard/stats', getDashboardStatsHandler);
  fastify.get('/dashboard/continue-learning', getContinueLearningHandler);
  fastify.get('/dashboard/watch-history', getWatchHistoryHandler);
  fastify.delete('/dashboard/watch-history/:episodeId', removeFromHistoryHandler);

  // ── Events ────────────────────────────────────────────────────────────────
  fastify.get('/events', listUserEventsHandler);
  fastify.get('/events/:id', getUserEventHandler);
  fastify.post('/events/:id/register', registerForEventHandler);

  // ── Webinars ──────────────────────────────────────────────────────────────
  fastify.get('/webinars', listUserWebinarsHandler);
  fastify.get('/webinars/:id', getUserWebinarHandler);
  fastify.post('/webinars/:id/token', getWebinarTokenHandler);

  // ── Push notifications (FCM device registration) ─────────────────────────
  fastify.post('/fcm-token', registerFcmTokenHandler);
  fastify.delete('/fcm-token', removeFcmTokenHandler);

  // ── Notifications ─────────────────────────────────────────────────────────
  fastify.get('/notifications/unread-count', getNotificationUnreadCountHandler);
  fastify.get('/notifications/preferences', getNotificationPrefsHandler);
  fastify.patch('/notifications/preferences', updateNotificationPrefsHandler);
  fastify.get('/notifications', getUserNotificationsHandler);
  fastify.patch('/notifications/:id/read', markNotificationReadHandler);
  fastify.post('/notifications/read-all', markAllNotificationsReadHandler);
  fastify.delete('/notifications/:id', dismissNotificationHandler);
  fastify.delete('/notifications', clearReadNotificationsHandler);

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
  fastify.post('/workshops/:slug/request-access', requestWorkshopAccessHandler);
  fastify.get('/workshops/:slug/overview', getWorkshopOverviewHandler);
  fastify.get('/workshops/:slug/detail', getWorkshopDetailHandler);
  fastify.get('/workshops/:slug/flow', getWorkshopFlowHandler);
  fastify.get('/workshops/:slug/qa', getWorkshopQaHandler);
  fastify.post('/workshops/:slug/qa', postWorkshopQaHandler);
  fastify.post('/qa/:postId/reply', postQaReplyHandler);
  fastify.get('/workshops/:slug/assignments', getWorkshopAssignmentsHandler);
  fastify.post('/assignments/:id/submit', submitAssignmentHandler);
  fastify.post('/assignments/upload/presign', assignmentImagePresignHandler);
  fastify.post('/assignments/upload/file-presign', assignmentFilePresignHandler);

  // ── Challenges ────────────────────────────────────────────────────────────
  fastify.get('/workshops/:slug/challenges', getWorkshopChallengesHandler);
  fastify.get('/workshops/:slug/certificate', getWorkshopCertificateHandler);
  fastify.post('/challenges/:id/complete', completeChallengeHandler);
  fastify.post('/workshop-episodes/:id/complete', completeWorkshopEpisodeHandler);
  fastify.get('/workshop/live-calls/:id/status', getLiveCallStatusUserHandler);
  fastify.post('/workshop/live-calls/:id/token', joinLiveCallHandler);
  fastify.post('/workshop/live-calls/:id/token/refresh', joinLiveCallHandler);
  fastify.get('/workshop/live-calls/:id/polls', getUserPollsHandler);
  fastify.post('/workshop/live-calls/polls/:pollId/vote', votePollHandler);
  fastify.post('/workshop/live-calls/:id/rsvp', upsertRsvpHandler);
  fastify.get('/workshop/live-calls/:id/rsvp', getRsvpStatusHandler);
  fastify.get('/workshop/live-calls/:id/resources', getLiveCallResourcesHandler);
  fastify.post('/workshop/live-calls/:id/questions', postLiveCallQuestionHandler);
  fastify.get('/workshop/live-calls/:id/questions', getLiveCallQuestionsHandler);
  fastify.get('/workshop/live-calls/:id/chapters', getLiveCallChaptersHandler);
  fastify.post('/workshop/live-calls/:id/feedback', postLiveCallFeedbackHandler);
  fastify.get('/workshop/live-calls/:id/feedback', getMyLiveCallFeedbackHandler);
  fastify.get('/workshop/live-calls/:id/certificate', getMyLiveCallCertificateHandler);

  // ── Episodes ──────────────────────────────────────────────────────────────
  fastify.get('/episodes/:id/playback', getEpisodePlaybackHandler);
  fastify.post('/episodes/:id/progress', postEpisodeProgressHandler);
  fastify.get('/episodes/:id/resources', getUserEpisodeResourcesHandler);
  fastify.get('/episodes/:id/tasks', getUserEpisodeTasksHandler);

  // ── Products & Resources ──────────────────────────────────────────────────
  fastify.get('/products', getUserProductsHandler);
  fastify.get('/products/my', getMyInquiredProductsHandler);
  fastify.post('/products/:id/inquire', submitProductInquiryHandler);
  fastify.get('/resources', getUserResourcesHandler);
  fastify.get('/resources/:id/download', getResourceDownloadHandler);

  // ── Conversations (live chat) ─────────────────────────────────────────────
  fastify.post('/conversations',                      startConversationHandler);
  fastify.get('/conversations/unread-count',          getConversationUnreadCountHandler);
  fastify.get('/conversations',                       listMemberConversationsHandler);
  fastify.get('/conversations/:id/messages',          getMemberConversationMessagesHandler);
  fastify.post('/conversations/:id/messages',         sendMemberChatMessageHandler);
  fastify.patch('/conversations/:id/archive',         archiveConversationHandler);

  // ── Device Tracking ───────────────────────────────────────────────────────
  fastify.get('/my-devices', getMyDevicesHandler);
  fastify.delete('/my-devices/:id', revokeDeviceHandler);

  // ── Programs ──────────────────────────────────────────────────────────────
  fastify.get('/programs', listUserProgramsHandler);
  fastify.get('/programs/:id', getUserProgramHandler);
  fastify.post('/programs/:id/enroll', enrollInProgramHandler);

  // ── Global search ─────────────────────────────────────────────────────────
  fastify.get('/search', searchHandler);
}
