import type { FastifyInstance } from 'fastify';
import {
  generateHandler,
  listConversationsHandler,
  getMessagesHandler,
  renameConversationHandler,
  deleteConversationHandler,
  listSavedHandler,
  saveContentHandler,
  updateSavedHandler,
  deleteSavedHandler,
  adminListConversationsHandler,
  adminGetMessagesHandler,
  adminDeleteConversationHandler,
  adminStatsHandler,
} from './controller.js';

/**
 * AI Content Buddy routes.
 *
 * Split into two auth zones:
 *   * `/api/ai/*`       — member-facing, JWT-cookie auth. Members can
 *                          only see + mutate their own conversations
 *                          and saved content (enforced in every handler
 *                          via memberId filter).
 *   * `/api/ai/admin/*` — admin moderation, Clerk auth. Read-any,
 *                          delete-any. No write endpoints — admins
 *                          curate, they don't put words in members'
 *                          mouths.
 */
export async function aiRoutes(fastify: FastifyInstance) {
  // ── User-facing (JWT cookie) ────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.post('/content/create', generateHandler);
    userScope.get('/conversations', listConversationsHandler);
    userScope.get('/conversations/:id/messages', getMessagesHandler);
    userScope.patch('/conversations/:id', renameConversationHandler);
    userScope.delete('/conversations/:id', deleteConversationHandler);
    userScope.get('/saved', listSavedHandler);
    userScope.post('/saved', saveContentHandler);
    userScope.patch('/saved/:id', updateSavedHandler);
    userScope.delete('/saved/:id', deleteSavedHandler);
  });

  // ── Admin moderation (Clerk) ────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.get('/stats', adminStatsHandler);
      adminScope.get('/conversations', adminListConversationsHandler);
      adminScope.get('/conversations/:id/messages', adminGetMessagesHandler);
      adminScope.delete('/conversations/:id', adminDeleteConversationHandler);
    },
    { prefix: '/admin' },
  );
}
