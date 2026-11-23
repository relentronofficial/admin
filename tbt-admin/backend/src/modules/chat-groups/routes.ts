import type { FastifyInstance } from 'fastify';
import {
  adminCreateGroupHandler,
  adminListGroupsHandler,
  adminGetGroupHandler,
  adminUpdateGroupHandler,
  adminDeleteGroupHandler,
  adminAddMembersHandler,
  adminRemoveMemberHandler,
  adminPinMessageHandler,
  adminUnpinMessageHandler,
  adminSetAnnouncementOnlyHandler,
  adminSetDisappearingHandler,
  adminListGroupMessagesHandler,
  adminSendMessageHandler,
  adminRaiseTicketHandler,
  adminEditMessageHandler,
  adminDeleteMessageHandler,
  adminForwardMessageHandler,
  adminMessageInfoHandler,
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
  memberForwardMessageHandler,
  memberMuteGroupHandler,
  memberStarMessageHandler,
  memberUnstarMessageHandler,
  memberListStarredHandler,
  memberListPinnedHandler,
  memberPinMessageHandler,
  memberUnpinMessageHandler,
  memberMessageInfoHandler,
  memberListGroupMediaHandler,
  memberRaiseTicketHandler,
} from './controller.js';
import {
  adminListScheduledHandler,
  adminCreateScheduledHandler,
  adminUpdateScheduledHandler,
  adminSetScheduledStatusHandler,
  adminDeleteScheduledHandler,
} from './scheduled.controller.js';

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
      adminScope.get('/:id', adminGetGroupHandler);
      adminScope.post('/', adminCreateGroupHandler);
      adminScope.put('/:id', adminUpdateGroupHandler);
      adminScope.delete('/:id', adminDeleteGroupHandler);
      adminScope.post('/:id/members', adminAddMembersHandler);
      adminScope.delete('/:id/members/:memberId', adminRemoveMemberHandler);
      adminScope.post('/:id/messages/:messageId/pin', adminPinMessageHandler);
      adminScope.delete('/:id/messages/:messageId/pin', adminUnpinMessageHandler);
      adminScope.patch('/:id/announcement-only', adminSetAnnouncementOnlyHandler);
      adminScope.patch('/:id/disappearing', adminSetDisappearingHandler);
      adminScope.get('/:id/messages', adminListGroupMessagesHandler);
      adminScope.post('/:id/messages', adminSendMessageHandler);
      adminScope.post('/:id/messages/:messageId/raise-ticket', adminRaiseTicketHandler);
      adminScope.put('/:id/messages/:messageId', adminEditMessageHandler);
      adminScope.delete('/:id/messages/:messageId', adminDeleteMessageHandler);
      adminScope.post('/:id/messages/:messageId/forward', adminForwardMessageHandler);
      adminScope.get('/:id/messages/:messageId/info', adminMessageInfoHandler);
      // Scheduled messages (one-time or daily) — scheduled.controller.ts
      adminScope.get('/:id/scheduled-messages', adminListScheduledHandler);
      adminScope.post('/:id/scheduled-messages', adminCreateScheduledHandler);
      adminScope.put('/:id/scheduled-messages/:scheduleId', adminUpdateScheduledHandler);
      adminScope.patch('/:id/scheduled-messages/:scheduleId/status', adminSetScheduledStatusHandler);
      adminScope.delete('/:id/scheduled-messages/:scheduleId', adminDeleteScheduledHandler);
    },
    { prefix: '/admin' },
  );

  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/mine', memberListMyGroupsHandler);
    userScope.get('/starred', memberListStarredHandler);
    userScope.get('/:id', memberGetGroupHandler);
    userScope.get('/:id/messages', memberListMessagesHandler);
    userScope.post('/:id/messages', memberSendMessageHandler);
    userScope.put('/:id/messages/:messageId', memberEditMessageHandler);
    userScope.delete('/:id/messages/:messageId', memberDeleteMessageHandler);
    userScope.post('/:id/messages/:messageId/react', memberToggleReactionHandler);
    userScope.post('/:id/messages/:messageId/forward', memberForwardMessageHandler);
    userScope.post('/:id/messages/:messageId/star', memberStarMessageHandler);
    userScope.delete('/:id/messages/:messageId/star', memberUnstarMessageHandler);
    userScope.get('/:id/pinned', memberListPinnedHandler);
    userScope.post('/:id/messages/:messageId/pin', memberPinMessageHandler);
    userScope.delete('/:id/messages/:messageId/pin', memberUnpinMessageHandler);
    userScope.get('/:id/messages/:messageId/info', memberMessageInfoHandler);
    userScope.post('/:id/messages/:messageId/raise-ticket', memberRaiseTicketHandler);
    userScope.post('/:id/mute', memberMuteGroupHandler);
    userScope.post('/:id/read', memberMarkReadHandler);
    userScope.get('/:id/search', memberSearchMessagesHandler);
    userScope.get('/:id/presence', memberGetGroupPresenceHandler);
    userScope.post('/:id/leave', memberLeaveGroupHandler);
    userScope.get('/:id/media', memberListGroupMediaHandler);
  });
}
