import type { FastifyInstance } from 'fastify';
import { activityHandler, activitySeenHandler, activityUnreadHandler } from './activity.controller.js';
import { callsHandler, membersHandler, summaryHandler, teamHandler, ticketsHandler } from './controller.js';

/**
 * "My Workspace" at `/api/my-workspace` (Clerk). Read-only views of the data
 * mapped to the logged-in admin: assigned members, their tickets, hosted
 * calls and direct reports. See controller.ts for the mapping.
 */
export async function myWorkspaceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/summary', summaryHandler as any);
  fastify.get('/members', membersHandler as any);
  fastify.get('/tickets', ticketsHandler as any);
  fastify.get('/calls', callsHandler as any);
  fastify.get('/team', teamHandler as any);
  fastify.get('/activity', activityHandler);
  fastify.get('/activity/unread', activityUnreadHandler);
  fastify.post('/activity/seen', activitySeenHandler);
}
