import type { FastifyInstance } from 'fastify';
import * as candidate from './candidate.controller.js';

// Member-facing Psychometric assessment (JWT cookie — the member's TBT login).
// Paths match the former standalone candidate API (/assessment/...).
export async function psychometricMemberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticateUser);

  fastify.get('/settings', candidate.getAssessmentSettings);
  fastify.get('/questions', candidate.getQuestions);
  fastify.get('/questions/:id/audio', candidate.getQuestionAudio);
  fastify.get('/questions/:id/explanation-audio', candidate.getExplanationAudio);
  fastify.post('/start', candidate.startSession);
  fastify.post('/submit', candidate.submitAssessment);
  fastify.get('/result', candidate.getResult);
  fastify.post('/retest/request', candidate.requestRetest);
  fastify.get('/retest/my-request', candidate.getMyRetest);
}
