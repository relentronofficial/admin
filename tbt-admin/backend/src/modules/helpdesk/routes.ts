import type { FastifyInstance } from 'fastify';
import {
  // admin
  adminDashboardHandler,
  adminListCategoriesHandler,
  adminCreateCategoryHandler,
  adminUpdateCategoryHandler,
  adminDeleteCategoryHandler,
  adminListFaqsHandler,
  adminCreateFaqHandler,
  adminUpdateFaqHandler,
  adminDeleteFaqHandler,
  adminGetSettingsHandler,
  adminUpdateSettingsHandler,
  adminListTicketsHandler,
  adminGetTicketHandler,
  adminUpdateTicketStatusHandler,
  adminReplyTicketHandler,
  adminDeleteTicketHandler,
  adminListFeedbackHandler,
  adminUpdateFeedbackStatusHandler,
  adminDeleteFeedbackHandler,
  // member
  getSettingsHandler,
  listActiveCategoriesHandler,
  listFaqsHandler,
  getFaqByIdHandler,
  submitTicketHandler,
  myTicketsHandler,
  submitFeedbackHandler,
} from './controller.js';

/**
 * Helpdesk routes at `/api/helpdesk`.
 *   * `/api/helpdesk/admin/*` — Clerk auth, full CRUD.
 *   * `/api/helpdesk/*`       — JWT-cookie auth, member-facing.
 */
export async function helpdeskRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/dashboard', adminDashboardHandler);

      adminScope.get('/categories', adminListCategoriesHandler);
      adminScope.post('/categories', adminCreateCategoryHandler);
      adminScope.put('/categories/:id', adminUpdateCategoryHandler);
      adminScope.delete('/categories/:id', adminDeleteCategoryHandler);

      adminScope.get('/faqs', adminListFaqsHandler);
      adminScope.post('/faqs', adminCreateFaqHandler);
      adminScope.put('/faqs/:id', adminUpdateFaqHandler);
      adminScope.delete('/faqs/:id', adminDeleteFaqHandler);

      adminScope.get('/settings', adminGetSettingsHandler);
      adminScope.put('/settings', adminUpdateSettingsHandler);

      adminScope.get('/tickets', adminListTicketsHandler);
      adminScope.get('/tickets/:id', adminGetTicketHandler);
      adminScope.patch('/tickets/:id/status', adminUpdateTicketStatusHandler);
      adminScope.post('/tickets/:id/reply', adminReplyTicketHandler);
      adminScope.delete('/tickets/:id', adminDeleteTicketHandler);

      adminScope.get('/feedback', adminListFeedbackHandler);
      adminScope.patch('/feedback/:id/status', adminUpdateFeedbackStatusHandler);
      adminScope.delete('/feedback/:id', adminDeleteFeedbackHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/settings', getSettingsHandler);
    userScope.get('/categories', listActiveCategoriesHandler);
    userScope.get('/faqs', listFaqsHandler);
    userScope.get('/faqs/:id', getFaqByIdHandler);
    userScope.post('/tickets', submitTicketHandler);
    userScope.get('/tickets/mine', myTicketsHandler);
    userScope.post('/feedback', submitFeedbackHandler);
  });
}
