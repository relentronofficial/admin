import type { FastifyInstance } from 'fastify';
import {
  // admin
  adminDashboardHandler,
  adminListLevelsHandler,
  adminCreateLevelHandler,
  adminUpdateLevelHandler,
  adminDeleteLevelHandler,
  adminListTasksHandler,
  adminCreateTaskHandler,
  adminUpdateTaskHandler,
  adminDeleteTaskHandler,
  adminLeaderboardHandler,
  adminGrantPointsHandler,
  adminActivityLogHandler,
  // member
  myPathHandler,
  completeTaskHandler,
  listLevelsHandler,
  leaderboardHandler,
} from './controller.js';

/**
 * TBT Gamification routes at `/api/tbt`.
 *   * `/api/tbt/admin/*` — Clerk auth, CRUD + leaderboard + manual grant
 *   * `/api/tbt/*`       — JWT-cookie auth, member's own path + leaderboard
 */
export async function gamificationRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/dashboard', adminDashboardHandler);

      adminScope.get('/levels', adminListLevelsHandler);
      adminScope.post('/levels', adminCreateLevelHandler);
      adminScope.put('/levels/:id', adminUpdateLevelHandler);
      adminScope.delete('/levels/:id', adminDeleteLevelHandler);

      adminScope.get('/tasks', adminListTasksHandler);
      adminScope.post('/tasks', adminCreateTaskHandler);
      adminScope.put('/tasks/:id', adminUpdateTaskHandler);
      adminScope.delete('/tasks/:id', adminDeleteTaskHandler);

      adminScope.get('/leaderboard', adminLeaderboardHandler);
      adminScope.post('/grant', adminGrantPointsHandler);
      adminScope.get('/activity-log', adminActivityLogHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/path', myPathHandler);
    userScope.post('/tasks/:id/complete', completeTaskHandler);
    userScope.get('/levels', listLevelsHandler);
    userScope.get('/leaderboard', leaderboardHandler);
  });
}
