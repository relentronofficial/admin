import { FastifyInstance } from 'fastify';
import {
  listPostsHandler,
  createPostHandler,
  getPostHandler,
  deletePostHandler,
  pinPostHandler,
  getCommentsHandler,
  memberListFeedHandler,
  memberSubmitPostHandler,
  memberToggleLikeHandler,
  memberListCommentsHandler,
  memberAddCommentHandler,
  memberDeleteCommentHandler,
  adminApprovePostHandler,
} from './controller.js';

/**
 * Community routes at `/api/community`.
 *
 *   * `/api/community/admin/*` — Clerk auth. Full CRUD + moderation.
 *   * `/api/community/*`       — JWT-cookie auth. Members list the
 *                                 approved feed and submit new posts.
 *
 * Admin routes moved under `/admin` prefix in Module 9A. Nothing
 * external called them yet so the URL change is safe.
 */
export async function communityRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.get('/posts', listPostsHandler);
      adminScope.post('/posts', createPostHandler);
      adminScope.get('/posts/:id', getPostHandler);
      adminScope.delete('/posts/:id', deletePostHandler);
      adminScope.put('/posts/:id/pin', pinPostHandler);
      adminScope.put('/posts/:id/approve', adminApprovePostHandler);
      adminScope.get('/posts/:id/comments', getCommentsHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/feed', memberListFeedHandler);
    userScope.post('/feed', memberSubmitPostHandler);
    userScope.post('/posts/:id/like', memberToggleLikeHandler);
    userScope.get('/posts/:id/comments', memberListCommentsHandler);
    userScope.post('/posts/:id/comments', memberAddCommentHandler);
    userScope.delete('/posts/:id/comments/:commentId', memberDeleteCommentHandler);
  });
}
