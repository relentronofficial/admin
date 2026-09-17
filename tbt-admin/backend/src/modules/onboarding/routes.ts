import type { FastifyInstance } from 'fastify';
import {
  getOnboardingHandler,
  updateOnboardingHandler,
  getOnboardingContentHandler,
  presignProfilePhotoHandler,
  presignOnboardingDocumentHandler,
  uploadOnboardingDocumentHandler,
  registerOnboardingDocumentHandler,
  deleteOnboardingDocumentHandler,
  submitOnboardingHandler,
  adminListOnboardingContentHandler,
  adminCreateOnboardingContentHandler,
  adminUpdateOnboardingContentHandler,
  adminDeleteOnboardingContentHandler,
  adminReorderOnboardingContentHandler,
} from './controller.js';

const DOC_BODY_LIMIT = 50 * 1024 * 1024; // 50 MB

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
    // Allow raw binary bodies for the proxied document upload endpoint
    userScope.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: DOC_BODY_LIMIT }, (_req, body, done) => done(null, body));
    userScope.addContentTypeParser('application/pdf', { parseAs: 'buffer', bodyLimit: DOC_BODY_LIMIT }, (_req, body, done) => done(null, body));
    userScope.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: DOC_BODY_LIMIT }, (_req, body, done) => done(null, body));

    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/', getOnboardingHandler);
    userScope.patch('/', updateOnboardingHandler);
    userScope.get('/content', getOnboardingContentHandler);
    userScope.post('/photo/presign', presignProfilePhotoHandler);
    userScope.post('/documents/presign', presignOnboardingDocumentHandler);
    userScope.post('/documents/upload', { bodyLimit: DOC_BODY_LIMIT }, uploadOnboardingDocumentHandler);
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
      adminScope.put('/content/reorder', adminReorderOnboardingContentHandler);
      adminScope.put('/content/:id', adminUpdateOnboardingContentHandler);
      adminScope.delete('/content/:id', adminDeleteOnboardingContentHandler);
    },
    { prefix: '/admin' },
  );
}
