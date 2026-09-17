import type { FastifyInstance } from 'fastify';
import {
  // admin
  adminListReportsHandler,
  adminGetReportHandler,
  adminCreateOrSendReportHandler,
  adminUpdateRemarksHandler,
  adminListFeedbackHandler,
  adminGetFeedbackHandler,
  adminUpdateFeedbackStatusHandler,
  // member
  getMyCurrentReportHandler,
  getMyReportHistoryHandler,
  submitFeedbackHandler,
  getMyFeedbackHistoryHandler,
} from './controller.js';

/**
 * Weekly Course Report + Feedback routes at `/api/course-reports`.
 *   * `/api/course-reports/admin/*` — Clerk auth, admin CRUD/review.
 *   * `/api/course-reports/*`       — JWT-cookie auth, member-facing, always
 *     scoped to `req.memberId` (never taken from the request body/params).
 * Mirrors the exact two-subscope split used by the Helpdesk module.
 */
export async function courseReportRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/reports', adminListReportsHandler);
      adminScope.get('/reports/:id', adminGetReportHandler);
      adminScope.post('/reports/send', adminCreateOrSendReportHandler);
      adminScope.patch('/reports/:id/remarks', adminUpdateRemarksHandler);

      adminScope.get('/feedback', adminListFeedbackHandler);
      adminScope.get('/feedback/:id', adminGetFeedbackHandler);
      adminScope.patch('/feedback/:id/status', adminUpdateFeedbackStatusHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/current', getMyCurrentReportHandler);
    userScope.get('/mine', getMyReportHistoryHandler);
    userScope.post('/feedback', submitFeedbackHandler);
    userScope.get('/feedback/mine', getMyFeedbackHistoryHandler);
  });
}
