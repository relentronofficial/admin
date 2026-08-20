import { FastifyInstance } from 'fastify';
import {
  listProgramsHandler,
  createProgramHandler,
  updateProgramHandler,
  deleteProgramHandler,
  listBatchesHandler,
  getBatchHandler,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
  cloneBatchHandler,
  markBatchCompleteHandler,
  archiveBatchHandler,
  getAllBatchTasksHandler,
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
  getWeekAnalyticsHandler,
  listBatchTasksHandler,
  createBatchTaskHandler,
  updateBatchTaskHandler,
  deleteBatchTaskHandler,
  reorderBatchTasksHandler,
  migrateJsonTasksHandler,
  getBatchSubmissionsHandler,
  getReportHistoryHandler,
  previewBatchReportHandler,
  sendTestBatchReportHandler,
} from './controller.js';
import {
  approveDayHandler,
  rejectDayHandler,
  getPendingApprovalsHandler,
  bulkApproveDaysHandler,
} from '../user-batch/controller.js';

export async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Programs CRUD
  fastify.get('/programs', listProgramsHandler);
  fastify.post('/programs', createProgramHandler);
  fastify.put('/programs/:programId', updateProgramHandler);
  fastify.delete('/programs/:programId', deleteProgramHandler);

  // Batch CRUD
  fastify.get('/', listBatchesHandler);
  fastify.get('/:id', getBatchHandler);
  fastify.post('/', createBatchHandler);
  fastify.put('/:id', updateBatchHandler);
  fastify.delete('/:id', deleteBatchHandler);
  fastify.post('/:id/clone', cloneBatchHandler);
  fastify.post('/:id/complete', markBatchCompleteHandler);
  fastify.post('/:id/archive', archiveBatchHandler);

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

  // Day-level and week-level analytics
  fastify.get('/:id/day-analytics', getDayAnalyticsHandler);
  fastify.get('/:id/week-analytics', getWeekAnalyticsHandler);

  // Inline task CRUD (tasks table with batchId)
  fastify.get('/:id/tasks', listBatchTasksHandler);
  fastify.post('/:id/tasks', createBatchTaskHandler);
  fastify.put('/:id/tasks/reorder', reorderBatchTasksHandler);
  fastify.post('/:id/tasks/migrate-json', migrateJsonTasksHandler);
  fastify.put('/:id/tasks/:taskId', updateBatchTaskHandler);
  fastify.delete('/:id/tasks/:taskId', deleteBatchTaskHandler);

  // All tasks for a batch (program + batch-inline combined)
  fastify.get('/:id/all-tasks', getAllBatchTasksHandler);

  // Task submissions (admin view)
  fastify.get('/:id/submissions', getBatchSubmissionsHandler);

  // Weekly/monthly WhatsApp report delivery (admin visibility + manual test trigger)
  fastify.get('/reports/history', getReportHistoryHandler);
  fastify.post('/reports/preview', previewBatchReportHandler);
  fastify.post('/reports/send-test', sendTestBatchReportHandler);
}
