import type { FastifyInstance } from 'fastify';
import {
  adminCreateGroupHandler,
  adminListGroupsHandler,
  adminUpdateGroupHandler,
  adminDeleteGroupHandler,
  adminAddMembersHandler,
  adminRemoveMemberHandler,
  memberListMyGroupsHandler,
  memberGetGroupHandler,
  memberListMessagesHandler,
  memberSendMessageHandler,
  memberEditMessageHandler,
  memberDeleteMessageHandler,
  memberToggleReactionHandler,
  memberMarkReadHandler,
  memberSearchMessagesHandler,
  memberLeaveGroupHandler,
  memberGetGroupPresenceHandler,
} from './controller.js';

/**
 * Chat groups (WhatsApp-inspired) routes at `/api/chat-groups`.
 *   * `/api/chat-groups/admin/*` — Clerk auth. Full group + member CRUD.
 *   * `/api/chat-groups/*`       — JWT-cookie auth. Members read/write
 *                                    the groups they belong to.
 */
export async function chatGroupsRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.get('/', adminListGroupsHandler);
      adminScope.post('/', adminCreateGroupHandler);
      adminScope.put('/:id', adminUpdateGroupHandler);
      adminScope.delete('/:id', adminDeleteGroupHandler);
      adminScope.post('/:id/members', adminAddMembersHandler);
      adminScope.delete('/:id/members/:memberId', adminRemoveMemberHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/mine', memberListMyGroupsHandler);
    userScope.get('/:id', memberGetGroupHandler);
    userScope.get('/:id/messages', memberListMessagesHandler);
    userScope.post('/:id/messages', memberSendMessageHandler);
    userScope.put('/:id/messages/:messageId', memberEditMessageHandler);
    userScope.delete('/:id/messages/:messageId', memberDeleteMessageHandler);
    userScope.post('/:id/messages/:messageId/react', memberToggleReactionHandler);
    userScope.post('/:id/read', memberMarkReadHandler);
    userScope.get('/:id/search', memberSearchMessagesHandler);
    userScope.get('/:id/presence', memberGetGroupPresenceHandler);
    userScope.post('/:id/leave', memberLeaveGroupHandler);
  });
}
