import type { FastifyInstance } from 'fastify';
import { VOICE_BODY_LIMIT } from '../../lib/assistant/transcribe.js';
import { chatHandler, deleteConversationHandler, evalListHandler, evalRunHandler, getConversationHandler, listConversationsHandler, selfTestHandler, statusHandler, transcribeHandler } from './controller.js';

/** AI assistant for admins (read-only). Registered at /api/admin-assistant. */
export async function adminAssistantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/status', statusHandler);
  fastify.get('/selftest', selfTestHandler);
  fastify.get('/eval', evalListHandler);
  fastify.post('/eval/:id', evalRunHandler);
  fastify.get('/conversations', listConversationsHandler);
  fastify.get('/conversations/:id', getConversationHandler);
  fastify.delete('/conversations/:id', deleteConversationHandler);
  fastify.post('/chat', chatHandler);
  fastify.post('/transcribe', { bodyLimit: VOICE_BODY_LIMIT + 1_024 }, transcribeHandler);
}
