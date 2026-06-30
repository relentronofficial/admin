import { FastifyInstance } from 'fastify';
import {
  listProgramsHandler,
  listBatchesHandler,
  getBatchHandler,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
  cloneBatchHandler,
  listBatchDaysHandler,
  getBatchDayDetailHandler,
  upsertBatchDayHandler,
  getBatchProgressHandler,
  getMemberProgressHandler,
  upsertMemberProgressHandler,
  getAttendanceHandler,
  upsertAttendanceHandler,
  getBreakRequestsHandler,
  approveBreakHandler,
  rejectBreakHandler,
  upsertMemberSettingsHandler,
  getDayAnalyticsHandler,
} from './controller.js';
import {
  approveDayHandler,
  rejectDayHandler,
  getPendingApprovalsHandler,
  bulkApproveDaysHandler,
} from '../user-batch/controller.js';

export async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Programs list (for batch form dropdown)
  fastify.get('/programs', listProgramsHandler);

  // Batch CRUD
  fastify.get('/', listBatchesHandler);
  fastify.get('/:id', getBatchHandler);
  fastify.post('/', createBatchHandler);
  fastify.put('/:id', updateBatchHandler);
  fastify.delete('/:id', deleteBatchHandler);
  fastify.post('/:id/clone', cloneBatchHandler);

  // Day content
  fastify.get('/:id/days', listBatchDaysHandler);
  fastify.get('/:id/days/:dayNumber', getBatchDayDetailHandler);
  fastify.put('/:id/days/:dayNumber', upsertBatchDayHandler);

  // Member progress (admin view + manual mark)
  fastify.get('/:id/progress', getBatchProgressHandler);
  fastify.get('/:id/pending', getPendingApprovalsHandler);
  fastify.post('/:id/pending/bulk-approve', bulkApproveDaysHandler);
  fastify.get('/:id/progress/:memberId', getMemberProgressHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber', upsertMemberProgressHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber/approve', approveDayHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber/reject', rejectDayHandler);

  // Attendance (admin)
  fastify.get('/:id/attendance/:memberId', getAttendanceHandler);
  fastify.put('/:id/attendance/:memberId/:dayNumber', upsertAttendanceHandler);

  // Break requests (admin)
  fastify.get('/:id/breaks', getBreakRequestsHandler);
  fastify.put('/:id/breaks/:reqId/approve', approveBreakHandler);
  fastify.put('/:id/breaks/:reqId/reject', rejectBreakHandler);

  // Member settings (admin)
  fastify.put('/:id/members/:memberId/settings', upsertMemberSettingsHandler);

  // Day-level analytics
  fastify.get('/:id/day-analytics', getDayAnalyticsHandler);
}
