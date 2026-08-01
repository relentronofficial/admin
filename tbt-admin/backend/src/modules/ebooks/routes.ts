import type { FastifyInstance } from 'fastify';
import {
  // admin
  adminListCategoriesHandler,
  adminCreateCategoryHandler,
  adminUpdateCategoryHandler,
  adminDeleteCategoryHandler,
  adminListBooksHandler,
  adminCreateBookHandler,
  adminUpdateBookHandler,
  adminToggleBookStatusHandler,
  adminDeleteBookHandler,
  adminListBannersHandler,
  adminCreateBannerHandler,
  adminUpdateBannerHandler,
  adminDeleteBannerHandler,
  adminDashboardHandler,
  adminBookAnalyticsHandler,
  adminBookBookmarksHandler,
  adminListReviewsHandler,
  adminUpdateReviewStatusHandler,
  adminBulkImportBooksHandler,
  adminListSeriesHandler,
  adminCreateSeriesHandler,
  adminUpdateSeriesHandler,
  adminDeleteSeriesHandler,
  // member
  listActiveCategoriesHandler,
  listFeaturedBooksHandler,
  listBannersHandler,
  listLibraryHandler,
  getBookHandler,
  upsertBookmarkHandler,
  deleteBookmarkHandler,
  listBookmarksHandler,
  submitProgressHandler,
  getProgressHandler,
  continueReadingHandler,
  memberSubmitReviewHandler,
  memberListReviewsHandler,
  getReadingStreakHandler,
} from './controller.js';

/**
 * E-books routes at `/api/ebooks`.
 *   * `/api/ebooks/admin/*` — Clerk auth, full CRUD.
 *   * `/api/ebooks/*`       — JWT-cookie auth, member library +
 *                              bookmarks + progress.
 */
export async function ebookRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/dashboard', adminDashboardHandler);

      adminScope.get('/categories', adminListCategoriesHandler);
      adminScope.post('/categories', adminCreateCategoryHandler);
      adminScope.put('/categories/:id', adminUpdateCategoryHandler);
      adminScope.delete('/categories/:id', adminDeleteCategoryHandler);

      adminScope.get('/books', adminListBooksHandler);
      adminScope.post('/books', adminCreateBookHandler);
      adminScope.put('/books/:id', adminUpdateBookHandler);
      adminScope.put('/books/:id/toggle-status', adminToggleBookStatusHandler);
      adminScope.delete('/books/:id', adminDeleteBookHandler);
      adminScope.get('/books/:id/analytics', adminBookAnalyticsHandler);
      adminScope.get('/books/:id/bookmarks', adminBookBookmarksHandler);
      adminScope.post('/books/bulk-import', adminBulkImportBooksHandler);

      adminScope.get('/banners', adminListBannersHandler);
      adminScope.post('/banners', adminCreateBannerHandler);
      adminScope.put('/banners/:id', adminUpdateBannerHandler);
      adminScope.delete('/banners/:id', adminDeleteBannerHandler);

      adminScope.get('/reviews', adminListReviewsHandler);
      adminScope.put('/reviews/:id/status', adminUpdateReviewStatusHandler);

      adminScope.get('/series', adminListSeriesHandler);
      adminScope.post('/series', adminCreateSeriesHandler);
      adminScope.put('/series/:id', adminUpdateSeriesHandler);
      adminScope.delete('/series/:id', adminDeleteSeriesHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/categories', listActiveCategoriesHandler);
    userScope.get('/featured', listFeaturedBooksHandler);
    userScope.get('/banners', listBannersHandler);
    userScope.get('/library', listLibraryHandler);
    userScope.get('/books/:id', getBookHandler);
    userScope.get('/bookmarks', listBookmarksHandler);
    userScope.post('/bookmarks', upsertBookmarkHandler);
    userScope.delete('/bookmarks/:bookId', deleteBookmarkHandler);
    userScope.post('/progress', submitProgressHandler);
    userScope.get('/progress/:bookId', getProgressHandler);
    userScope.get('/continue-reading', continueReadingHandler);
    userScope.get('/books/:id/reviews', memberListReviewsHandler);
    userScope.post('/books/:id/reviews', memberSubmitReviewHandler);
    userScope.get('/streak', getReadingStreakHandler);
  });
}
