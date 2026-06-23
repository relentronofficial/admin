import { FastifyInstance } from 'fastify';
import {
  listBatchesHandler,
  getBatchHandler,
  createBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
  listBatchDaysHandler,
  getBatchDayDetailHandler,
  upsertBatchDayHandler,
  getBatchProgressHandler,
  getMemberProgressHandler,
  upsertMemberProgressHandler,
} from './controller.js';
import {
  approveDayHandler,
  rejectDayHandler,
  getPendingApprovalsHandler,
} from '../user-batch/controller.js';

export async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Batch CRUD
  fastify.get('/', listBatchesHandler);
  fastify.get('/:id', getBatchHandler);
  fastify.post('/', createBatchHandler);
  fastify.put('/:id', updateBatchHandler);
  fastify.delete('/:id', deleteBatchHandler);

  // Day content
  fastify.get('/:id/days', listBatchDaysHandler);
  fastify.get('/:id/days/:dayNumber', getBatchDayDetailHandler);
  fastify.put('/:id/days/:dayNumber', upsertBatchDayHandler);

  // Member progress (admin view + manual mark)
  fastify.get('/:id/progress', getBatchProgressHandler);
  fastify.get('/:id/pending', getPendingApprovalsHandler);
  fastify.get('/:id/progress/:memberId', getMemberProgressHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber', upsertMemberProgressHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber/approve', approveDayHandler);
  fastify.put('/:id/progress/:memberId/:dayNumber/reject', rejectDayHandler);
}
