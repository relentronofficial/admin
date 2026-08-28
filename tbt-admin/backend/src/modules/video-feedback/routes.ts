import type { FastifyInstance } from 'fastify';
import {
  adminListQuestionsHandler,
  adminCreateQuestionHandler,
  adminUpdateQuestionHandler,
  adminDeleteQuestionHandler,
  adminReorderQuestionsHandler,
  adminGetResponsesHandler,
  getUserQuestionsHandler,
  submitFeedbackHandler,
} from './controller.js';

export async function videoFeedbackRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ────────────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/episodes/:episodeId/questions', adminListQuestionsHandler);
      adminScope.post('/episodes/:episodeId/questions', adminCreateQuestionHandler);
      adminScope.put('/questions/:questionId', adminUpdateQuestionHandler);
      adminScope.delete('/questions/:questionId', adminDeleteQuestionHandler);
      adminScope.put('/episodes/:episodeId/questions/reorder', adminReorderQuestionsHandler);
      adminScope.get('/episodes/:episodeId/responses', adminGetResponsesHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ──────────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/episodes/:episodeId/questions', getUserQuestionsHandler);
    userScope.post('/episodes/:episodeId/responses', submitFeedbackHandler);
  });
}
