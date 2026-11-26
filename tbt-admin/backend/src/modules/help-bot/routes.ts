import type { FastifyInstance } from 'fastify';
import * as h from './controller.js';
import { VOICE_BODY_LIMIT } from '../../lib/assistant/transcribe.js';

/** TBT Assistant for members. Registered at /api/help-bot. */
export async function helpBotRoutes(fastify: FastifyInstance) {
  fastify.register(async (user) => {
    user.addHook('preHandler', user.authenticateUser);
    user.get('/status', h.helpBotStatusHandler);

    user.register(async (opened) => {
      opened.addHook('preHandler', h.requireHelpBot);
      // Room for one screenshot (the app shrinks it to well under this).
      opened.post('/chat', { bodyLimit: 2_500_000 }, h.helpBotChatHandler);
      opened.get('/conversations', h.listConversationsHandler);
      opened.get('/conversations/:id', h.getConversationHandler);
      opened.delete('/conversations/:id', h.deleteConversationHandler);
      opened.post('/messages/:id/rating', h.rateHandler);
      opened.post('/messages/:id/actions/:index', h.actionHandler);
      opened.post('/messages/:id/speech', h.speechHandler);
      // A hold-to-record voice note (base64 WAV, up to 60 s) → text.
      opened.post('/transcribe', { bodyLimit: VOICE_BODY_LIMIT + 1_024 }, h.transcribeHandler);
      opened.get('/habits', h.listHabitsHandler);
      opened.put('/habits', h.saveHabitHandler);
      opened.get('/nudge', h.nudgeHandler);
      opened.get('/prefs', h.getPrefsHandler);
      opened.put('/prefs', h.savePrefsHandler);
      opened.post('/memory', h.addMemoryHandler);
    });
  });

  fastify.register(async (admin) => {
    admin.addHook('preHandler', admin.authenticate);
    admin.addHook('preHandler', h.requireSuperAdmin);
    admin.get('/', h.adminOverviewHandler);
    admin.put('/settings', h.adminSettingsHandler);
    admin.post('/testers', h.addTesterHandler);
    admin.delete('/testers/:id', h.removeTesterHandler);
    admin.post('/poor/:id', h.reviewPoorHandler);
  }, { prefix: '/admin' });
}
