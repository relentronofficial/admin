import type { FastifyInstance } from 'fastify';
import { helpBotChatHandler, helpBotStatusHandler } from './controller.js';

/** Member-facing in-app help assistant. Registered at /api/help-bot. */
export async function helpBotRoutes(fastify: FastifyInstance) {
  fastify.get('/status', helpBotStatusHandler);

  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.post('/chat', helpBotChatHandler);
  });
}
