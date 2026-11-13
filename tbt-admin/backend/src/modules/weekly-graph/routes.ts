import type { FastifyInstance } from 'fastify';
import {
  createActivityHandler,
  createMilestoneHandler,
  createWeekHandler,
  deleteActivityHandler,
  deleteMilestoneHandler,
  deleteRecordHandler,
  deleteWeekHandler,
  getConfigHandler,
  initializeHandler,
  listRecordsHandler,
  reorderMilestonesHandler,
  reorderWeeksHandler,
  updateActivityHandler,
  updateMilestoneHandler,
  updateWeekHandler,
  upsertRecordHandler,
} from './controller.js';

// Admin-only (Clerk). Role checks are in the handlers: config edits need
// Admin/Super Admin; member records also allow Mentor; reads any admin.
// Members read the graph through GET /api/user-batch/weekly-graph.
export async function weeklyGraphRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  const base = '/admin/programs/:programId';
  fastify.get(`${base}/config`, getConfigHandler);
  fastify.post(`${base}/initialize`, initializeHandler);

  fastify.post(`${base}/weeks`, createWeekHandler);
  fastify.put(`${base}/weeks/reorder`, reorderWeeksHandler);
  fastify.put(`${base}/weeks/:id`, updateWeekHandler);
  fastify.delete(`${base}/weeks/:id`, deleteWeekHandler);

  fastify.post(`${base}/milestones`, createMilestoneHandler);
  fastify.put(`${base}/milestones/reorder`, reorderMilestonesHandler);
  fastify.put(`${base}/milestones/:id`, updateMilestoneHandler);
  fastify.delete(`${base}/milestones/:id`, deleteMilestoneHandler);

  fastify.post(`${base}/activities`, createActivityHandler);
  fastify.put(`${base}/activities/:id`, updateActivityHandler);
  fastify.delete(`${base}/activities/:id`, deleteActivityHandler);

  fastify.get('/admin/members/:memberId/records', listRecordsHandler);
  fastify.put('/admin/members/:memberId/records', upsertRecordHandler);
  fastify.delete('/admin/members/:memberId/records/:recordId', deleteRecordHandler);
}
