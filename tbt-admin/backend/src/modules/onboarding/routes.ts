import type { FastifyInstance } from 'fastify';
import {
  getOnboardingHandler,
  updateOnboardingHandler,
  getOnboardingContentHandler,
  presignOnboardingDocumentHandler,
  registerOnboardingDocumentHandler,
  deleteOnboardingDocumentHandler,
  submitOnboardingHandler,
  adminListOnboardingContentHandler,
  adminCreateOnboardingContentHandler,
  adminUpdateOnboardingContentHandler,
  adminDeleteOnboardingContentHandler,
} from './controller.js';

/**
 * Self-onboarding routes at `/api/onboarding`.
 *   * `/api/onboarding/*`         — JWT-cookie auth. Member's own wizard.
 *   * `/api/onboarding/admin/*`   — Clerk auth. Admin-authored step content CRUD.
 * Application review (approve/reject/request-changes) lives in the existing
 * `members` module — see SELF_ONBOARDING_SPECKIT.md §5.5.
 */
export async function onboardingRoutes(fastify: FastifyInstance) {
  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/', getOnboardingHandler);
    userScope.patch('/', updateOnboardingHandler);
    userScope.get('/content', getOnboardingContentHandler);
    userScope.post('/documents/presign', presignOnboardingDocumentHandler);
    userScope.post('/documents', registerOnboardingDocumentHandler);
    userScope.delete('/documents/:id', deleteOnboardingDocumentHandler);
    userScope.post('/submit', submitOnboardingHandler);
  });

  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.get('/content', adminListOnboardingContentHandler);
      adminScope.post('/content', adminCreateOnboardingContentHandler);
      adminScope.put('/content/:id', adminUpdateOnboardingContentHandler);
      adminScope.delete('/content/:id', adminDeleteOnboardingContentHandler);
    },
    { prefix: '/admin' },
  );
}
