import { FastifyInstance } from 'fastify';
import {
  adminListQuestionsHandler,
  adminCreateQuestionHandler,
  adminUpdateQuestionHandler,
  adminDeleteQuestionHandler,
  adminReorderQuestionsHandler,
  adminListResponsesHandler,
} from './controller.js';

export async function psychometricRoutes(fastify: FastifyInstance) {
  // All admin routes require Clerk auth
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/questions',            adminListQuestionsHandler);
  fastify.post('/questions',           adminCreateQuestionHandler);
  fastify.put('/questions/:id',        adminUpdateQuestionHandler);
  fastify.delete('/questions/:id',     adminDeleteQuestionHandler);
  fastify.put('/questions/reorder',    adminReorderQuestionsHandler);
  fastify.get('/responses',            adminListResponsesHandler);
}
