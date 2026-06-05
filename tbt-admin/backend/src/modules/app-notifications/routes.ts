import { FastifyInstance } from 'fastify';
import { listNotificationsHandler, createNotificationHandler, deleteNotificationHandler, getNotificationStatsHandler } from './controller.js';

export async function appNotificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listNotificationsHandler);
  fastify.post('/', createNotificationHandler);
  fastify.get('/:id/stats', getNotificationStatsHandler);
  fastify.delete('/:id', deleteNotificationHandler);
}
