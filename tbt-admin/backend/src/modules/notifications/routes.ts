import { FastifyInstance } from 'fastify';
import {
  listNotificationsHandler,
  sendNotificationHandler,
  markAsReadHandler,
  broadcastNotificationHandler
} from './controller.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listNotificationsHandler);
  fastify.post('/send', sendNotificationHandler);
  fastify.put('/:id/read', markAsReadHandler);
  fastify.post('/broadcast', broadcastNotificationHandler);
}
