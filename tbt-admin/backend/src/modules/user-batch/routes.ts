import { FastifyInstance } from 'fastify';
import {
  getMyBatchHandler, saveDraftHandler, submitDayHandler,
  markAttendanceHandler, requestBreakHandler, getBatchCertificateHandler,
  getMySubmissionsHandler,
} from './controller.js';

export async function userBatchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticateUser);

  fastify.get('/', getMyBatchHandler);
  fastify.get('/certificate', getBatchCertificateHandler);
  fastify.get('/submissions', getMySubmissionsHandler);
  fastify.put('/:dayNumber', saveDraftHandler);
  fastify.post('/:dayNumber/submit', submitDayHandler);
  fastify.post('/attendance', markAttendanceHandler);
  fastify.post('/break', requestBreakHandler);
}
