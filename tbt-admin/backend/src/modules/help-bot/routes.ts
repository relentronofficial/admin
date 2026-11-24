import type { FastifyInstance } from 'fastify';
import * as h from './controller.js';

/** TBT Assistant for members. Registered at /api/help-bot. */
export async function helpBotRoutes(fastify: FastifyInstance) {
  fastify.register(async (user) => {
    user.addHook('preHandler', user.authenticateUser);
    user.get('/status', h.helpBotStatusHandler);

    user.register(async (opened) => {
      opened.addHook('preHandler', h.requireHelpBot);
      opened.post('/chat', h.helpBotChatHandler);
      opened.get('/conversations', h.listConversationsHandler);
      opened.get('/conversations/:id', h.getConversationHandler);
      opened.delete('/conversations/:id', h.deleteConversationHandler);
      opened.post('/messages/:id/rating', h.rateHandler);
      opened.post('/messages/:id/actions/:index', h.actionHandler);
      opened.post('/messages/:id/speech', h.speechHandler);
      opened.get('/habits', h.listHabitsHandler);
      opened.put('/habits', h.saveHabitHandler);
    });
  });

  fastify.register(async (admin) => {
    admin.addHook('preHandler', admin.authenticate);
    admin.addHook('preHandler', h.requireSuperAdmin);
    admin.get('/', h.adminOverviewHandler);
    admin.put('/settings', h.adminSettingsHandler);
    admin.post('/testers', h.addTesterHandler);
    admin.delete('/testers/:id', h.removeTesterHandler);
  }, { prefix: '/admin' });
}
