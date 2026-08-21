import type { FastifyInstance } from 'fastify';
import {
  adminListMeetingsHandler,
  adminGetMeetingHandler,
  adminCreateMeetingHandler,
  adminUpdateMeetingHandler,
  adminStartMeetingHandler,
  adminEndMeetingHandler,
  adminCancelMeetingHandler,
  adminGetMeetingStatusHandler,
  adminGetHostTokenHandler,
  adminRemoveParticipantHandler,
  adminMuteParticipantHandler,
  listMyMeetingsHandler,
  joinMyMeetingHandler,
  leaveMyMeetingHandler,
} from './controller.js';

/**
 * Virtual Self Onboarding — LiveKit verification meetings, at
 * `/api/onboarding-meetings`.
 *   * `/api/onboarding-meetings/*`       — JWT-cookie auth. The member's own meetings.
 *   * `/api/onboarding-meetings/admin/*` — Clerk auth. Centralized admin lifecycle control.
 * See ONBOARDING_LIVE_MEETING_SPECKIT.md.
 */
export async function onboardingMeetingsRoutes(fastify: FastifyInstance) {
  // ── Member (JWT cookie) ─────────────────────────────────────────
  fastify.register(async (userScope) => {
    userScope.addHook('preHandler', userScope.authenticateUser);
    userScope.get('/', listMyMeetingsHandler);
    userScope.post('/:id/token', joinMyMeetingHandler);
    userScope.post('/:id/leave', leaveMyMeetingHandler);
  });

  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.get('/', adminListMeetingsHandler);
      adminScope.post('/', adminCreateMeetingHandler);
      adminScope.get('/:id', adminGetMeetingHandler);
      adminScope.put('/:id', adminUpdateMeetingHandler);
      adminScope.post('/:id/start', adminStartMeetingHandler);
      adminScope.post('/:id/end', adminEndMeetingHandler);
      adminScope.post('/:id/cancel', adminCancelMeetingHandler);
      adminScope.get('/:id/status', adminGetMeetingStatusHandler);
      adminScope.post('/:id/host-token', adminGetHostTokenHandler);
      adminScope.post('/:id/participants/:participantId/remove', adminRemoveParticipantHandler);
      adminScope.post('/:id/participants/:participantId/mute', adminMuteParticipantHandler);
    },
    { prefix: '/admin' },
  );
}
