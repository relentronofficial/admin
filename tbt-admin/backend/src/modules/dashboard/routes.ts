import { FastifyInstance } from 'fastify';
import { getMetricsHandler, getRecentActivityHandler, getAnalyticsHandler } from './controller.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/metrics', getMetricsHandler);
  fastify.get('/recent-activity', getRecentActivityHandler);
  fastify.get('/analytics', getAnalyticsHandler);
}
