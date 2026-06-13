import { FastifyInstance } from 'fastify';
import {
  listWorkshopsHandler, createWorkshopHandler, getWorkshopHandler,
  updateWorkshopHandler, deleteWorkshopHandler,
  listEnrollmentsHandler, enrollMembersHandler, updateEnrollmentHandler, deleteEnrollmentHandler,
  getWorkshopFlowHandler, upsertFlowItemHandler, deleteFlowItemHandler, reorderFlowHandler,
  listChallengesHandler, createChallengeHandler, updateChallengeHandler, deleteChallengeHandler,
  listEpisodesHandler, createEpisodeHandler, updateEpisodeHandler, deleteEpisodeHandler, reorderEpisodesHandler,
  listLiveCallsHandler, createLiveCallHandler, updateLiveCallHandler, deleteLiveCallHandler,
  getLiveCallHostTokenHandler, getLiveCallStatusHandler, endLiveCallHandler,
  muteParticipantHandler, removeParticipantHandler, muteAllHandler, lockRoomHandler, admitParticipantHandler,
  startRecordingHandler, stopRecordingHandler,
  createPollHandler, closePollHandler, getPollsHandler,
  getAttendanceHandler,
  sendRemindersHandler,
  listAssignmentsHandler, createAssignmentHandler, updateAssignmentHandler, deleteAssignmentHandler,
  listSubmissionsHandler,
  listQAHandler, replyQAHandler, deleteQAPostHandler, deleteQAReplyHandler,
  getMemberProgressHandler,
  syncEpisodeDurationsHandler,
} from './controller.js';

export async function workshopRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listWorkshopsHandler);
  fastify.post('/', createWorkshopHandler);
  fastify.get('/:id', getWorkshopHandler);
  fastify.put('/:id', updateWorkshopHandler);
  fastify.delete('/:id', deleteWorkshopHandler);

  fastify.get('/:id/enrollments', listEnrollmentsHandler);
  fastify.post('/:id/enroll', enrollMembersHandler);
  fastify.put('/:id/enrollments/:enrollmentId', updateEnrollmentHandler);
  fastify.delete('/:id/enrollments/:enrollmentId', deleteEnrollmentHandler);

  fastify.get('/:id/flow', getWorkshopFlowHandler);
  fastify.post('/:id/flow', upsertFlowItemHandler);
  fastify.put('/:id/flow/reorder', reorderFlowHandler);
  fastify.put('/:id/flow/:itemId', upsertFlowItemHandler);
  fastify.delete('/:id/flow/:itemId', deleteFlowItemHandler);

  fastify.get('/:id/challenges', listChallengesHandler);
  fastify.post('/:id/challenges', createChallengeHandler);
  fastify.put('/challenges/:cid', updateChallengeHandler);
  fastify.delete('/challenges/:cid', deleteChallengeHandler);

  fastify.get('/challenges/:cid/episodes', listEpisodesHandler);
  fastify.post('/challenges/:cid/episodes', createEpisodeHandler);
  fastify.put('/challenges/:cid/episodes/reorder', reorderEpisodesHandler);
  fastify.put('/episodes/:eid', updateEpisodeHandler);
  fastify.delete('/episodes/:eid', deleteEpisodeHandler);

  fastify.get('/:id/live-calls', listLiveCallsHandler);
  fastify.post('/:id/live-calls', createLiveCallHandler);
  fastify.put('/live-calls/:lcid', updateLiveCallHandler);
  fastify.delete('/live-calls/:lcid', deleteLiveCallHandler);
  fastify.get('/live-calls/:lcid/status', getLiveCallStatusHandler);
  fastify.post('/live-calls/:lcid/host-token', getLiveCallHostTokenHandler);
  fastify.post('/live-calls/:lcid/end', endLiveCallHandler);

  // Host controls
  fastify.post('/live-calls/:lcid/participants/:identity/mute', muteParticipantHandler);
  fastify.delete('/live-calls/:lcid/participants/:identity', removeParticipantHandler);
  fastify.post('/live-calls/:lcid/mute-all', muteAllHandler);
  fastify.post('/live-calls/:lcid/lock', lockRoomHandler);
  fastify.post('/live-calls/:lcid/admit', admitParticipantHandler);

  // Recording
  fastify.post('/live-calls/:lcid/recording/start', startRecordingHandler);
  fastify.post('/live-calls/:lcid/recording/stop', stopRecordingHandler);

  // Polls
  fastify.get('/live-calls/:lcid/polls', getPollsHandler);
  fastify.post('/live-calls/:lcid/polls', createPollHandler);
  fastify.post('/polls/:pollId/close', closePollHandler);

  // Attendance
  fastify.get('/live-calls/:lcid/attendance', getAttendanceHandler);

  // Reminders
  fastify.post('/live-calls/:lcid/reminders', sendRemindersHandler);

  fastify.get('/:id/assignments', listAssignmentsHandler);
  fastify.post('/:id/assignments', createAssignmentHandler);
  fastify.put('/assignments/:aid', updateAssignmentHandler);
  fastify.delete('/assignments/:aid', deleteAssignmentHandler);
  fastify.get('/assignments/:aid/submissions', listSubmissionsHandler);

  fastify.get('/:id/qa', listQAHandler);
  fastify.post('/qa/:postId/reply', replyQAHandler);
  fastify.delete('/qa/:postId', deleteQAPostHandler);
  fastify.delete('/qa/replies/:replyId', deleteQAReplyHandler);

  fastify.get('/:id/progress/:memberId', getMemberProgressHandler);

  fastify.post('/sync-durations', syncEpisodeDurationsHandler);
}
