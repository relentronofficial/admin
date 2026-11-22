import type { FastifyInstance } from 'fastify';
import {
  cohortsHandler,
  courseLessonsHandler,
  coursesHandler,
  digestPreviewHandler,
  digestSendHandler,
  funnelStuckHandler,
  funnelsHandler,
  mentorshipHandler,
  overviewHandler,
  revenueHandler,
  riskHandler,
  supportHandler,
  usageHandler,
} from './controller.js';

/** Admin Insights — registered at /api/insights (Clerk). */
export async function insightsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/overview', overviewHandler);
  fastify.get('/funnels', funnelsHandler);
  fastify.get('/funnels/stuck', funnelStuckHandler);
  fastify.get('/cohorts', cohortsHandler);
  fastify.get('/courses', coursesHandler);
  fastify.get('/courses/:id/lessons', courseLessonsHandler);
  fastify.get('/mentorship', mentorshipHandler);
  fastify.get('/support', supportHandler);
  fastify.get('/revenue', revenueHandler);
  fastify.get('/usage', usageHandler);
  fastify.get('/risk', riskHandler);
  fastify.get('/digest/preview', digestPreviewHandler);
  fastify.post('/digest/send', digestSendHandler);
}
