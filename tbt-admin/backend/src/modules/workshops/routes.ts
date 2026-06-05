import { FastifyInstance } from 'fastify';
import {
  listWorkshopsHandler, createWorkshopHandler, getWorkshopHandler,
  updateWorkshopHandler, deleteWorkshopHandler,
  listEnrollmentsHandler, enrollMembersHandler, updateEnrollmentHandler, deleteEnrollmentHandler,
  getWorkshopFlowHandler, upsertFlowItemHandler, deleteFlowItemHandler, reorderFlowHandler,
  listChallengesHandler, createChallengeHandler, updateChallengeHandler, deleteChallengeHandler,
  listEpisodesHandler, createEpisodeHandler, updateEpisodeHandler, deleteEpisodeHandler, reorderEpisodesHandler,
  listLiveCallsHandler, createLiveCallHandler, updateLiveCallHandler, deleteLiveCallHandler,
  listAssignmentsHandler, createAssignmentHandler, updateAssignmentHandler, deleteAssignmentHandler,
  listSubmissionsHandler,
  listQAHandler, replyQAHandler, deleteQAPostHandler, deleteQAReplyHandler,
  getMemberProgressHandler,
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
}
