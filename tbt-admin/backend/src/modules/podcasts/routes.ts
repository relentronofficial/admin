import type { FastifyInstance } from 'fastify';
import {
  // admin
  adminListCategoriesHandler,
  adminCreateCategoryHandler,
  adminUpdateCategoryHandler,
  adminDeleteCategoryHandler,
  adminListSeriesHandler,
  adminCreateSeriesHandler,
  adminUpdateSeriesHandler,
  adminDeleteSeriesHandler,
  adminListEpisodesHandler,
  adminCreateEpisodeHandler,
  adminUpdateEpisodeHandler,
  adminToggleEpisodeStatusHandler,
  adminDeleteEpisodeHandler,
  adminDashboardHandler,
  // member
  listActiveCategoriesHandler,
  listEpisodesHandler,
  getEpisodeHandler,
  listFeaturedSeriesHandler,
  getSeriesHandler,
  continueListeningHandler,
  submitProgressHandler,
  markCompletedHandler,
} from './controller.js';

/**
 * Podcasts routes.
 *
 * Two auth zones (same pattern as modules/ai/):
 *   * `/api/podcasts/admin/*` — Clerk auth. CRUD on all podcast tables.
 *   * `/api/podcasts/*`       — JWT-cookie auth. Members browse
 *                                published podcasts + track their own
 *                                listening progress.
 */
export async function podcastRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/dashboard', adminDashboardHandler);

      adminScope.get('/categories', adminListCategoriesHandler);
      adminScope.post('/categories', adminCreateCategoryHandler);
      adminScope.put('/categories/:id', adminUpdateCategoryHandler);
      adminScope.delete('/categories/:id', adminDeleteCategoryHandler);

      adminScope.get('/series', adminListSeriesHandler);
      adminScope.post('/series', adminCreateSeriesHandler);
      adminScope.put('/series/:id', adminUpdateSeriesHandler);
      adminScope.delete('/series/:id', adminDeleteSeriesHandler);

      adminScope.get('/episodes', adminListEpisodesHandler);
      adminScope.post('/episodes', adminCreateEpisodeHandler);
      adminScope.put('/episodes/:id', adminUpdateEpisodeHandler);
      adminScope.put('/episodes/:id/toggle-status', adminToggleEpisodeStatusHandler);
      adminScope.delete('/episodes/:id', adminDeleteEpisodeHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/categories', listActiveCategoriesHandler);
    userScope.get('/episodes', listEpisodesHandler);
    userScope.get('/episodes/:id', getEpisodeHandler);
    userScope.get('/series', listFeaturedSeriesHandler);
    userScope.get('/series/:id', getSeriesHandler);
    userScope.get('/continue-listening', continueListeningHandler);
    userScope.post('/progress', submitProgressHandler);
    userScope.post('/mark-completed', markCompletedHandler);
  });
}
