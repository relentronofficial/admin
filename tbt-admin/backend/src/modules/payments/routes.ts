import type { FastifyInstance } from 'fastify';
import {
  getPaymentStatsHandler,
  getPaymentListHandler,
  getPaymentAnalyticsHandler,
  razorpaySyncHandler,
  approvePaymentHandler,
  refundPaymentHandler,
  getRevenueByCourseHandler,
} from './controller.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.get('/stats', { preHandler: fastify.authenticate }, getPaymentStatsHandler);
  fastify.get('/list', { preHandler: fastify.authenticate }, getPaymentListHandler);
  fastify.get('/analytics', { preHandler: fastify.authenticate }, getPaymentAnalyticsHandler);
  fastify.get('/revenue-by-course', { preHandler: fastify.authenticate }, getRevenueByCourseHandler);
  fastify.get('/:paymentId/razorpay-sync', { preHandler: fastify.authenticate }, razorpaySyncHandler);
  fastify.post('/:paymentId/approve', { preHandler: fastify.authenticate }, approvePaymentHandler);
  fastify.post('/:paymentId/refund', { preHandler: fastify.authenticate }, refundPaymentHandler);
}
