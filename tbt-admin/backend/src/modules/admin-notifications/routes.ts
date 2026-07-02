import { FastifyInstance } from 'fastify';
import {
  listAdminNotificationsHandler,
  getAdminUnreadCountHandler,
  markAdminNotificationReadHandler,
  markAllAdminNotificationsReadHandler,
} from './controller.js';

export async function adminNotificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listAdminNotificationsHandler);
  fastify.get('/unread-count', getAdminUnreadCountHandler);
  fastify.put('/:id/read', markAdminNotificationReadHandler);
  fastify.put('/read-all', markAllAdminNotificationsReadHandler);
}
