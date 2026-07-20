import type { FastifyInstance } from 'fastify';
import {
  adminListHabitsHandler,
  adminCreateHabitHandler,
  adminUpdateHabitHandler,
  adminDeleteHabitHandler,
  adminGetButtonsConfigHandler,
  adminUpdateButtonsConfigHandler,
  listActiveHabitsHandler,
  getButtonsConfigHandler,
} from './controller.js';

/**
 * Morning Ritual routes at `/api/rituals`.
 *   * `/api/rituals/admin/*` — Clerk auth. Full CRUD.
 *   * `/api/rituals/*`       — JWT-cookie auth. Public reads for the
 *                               home-page widget.
 */
export async function ritualsRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);

      adminScope.get('/habits', adminListHabitsHandler);
      adminScope.post('/habits', adminCreateHabitHandler);
      adminScope.put('/habits/:id', adminUpdateHabitHandler);
      adminScope.delete('/habits/:id', adminDeleteHabitHandler);

      adminScope.get('/buttons', adminGetButtonsConfigHandler);
      adminScope.put('/buttons', adminUpdateButtonsConfigHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);

    userScope.get('/habits', listActiveHabitsHandler);
    userScope.get('/buttons', getButtonsConfigHandler);
  });
}
