import type { FastifyInstance } from 'fastify';
import { chatHandler, deleteConversationHandler, getConversationHandler, listConversationsHandler, statusHandler } from './controller.js';

/** AI assistant for admins (read-only). Registered at /api/admin-assistant. */
export async function adminAssistantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/status', statusHandler);
  fastify.get('/conversations', listConversationsHandler);
  fastify.get('/conversations/:id', getConversationHandler);
  fastify.delete('/conversations/:id', deleteConversationHandler);
  fastify.post('/chat', chatHandler);
}
