import { FastifyInstance } from 'fastify';
import { pubSiteConfigHandler, pubNavItemsHandler, pubUiStringsHandler, pubMemberSyncHandler } from './controller.js';

export async function pubRoutes(fastify: FastifyInstance) {
  fastify.get('/config/site', pubSiteConfigHandler);
  fastify.get('/config/nav', pubNavItemsHandler);
  fastify.get('/config/ui-strings', pubUiStringsHandler);
  fastify.post('/auth/sync', pubMemberSyncHandler);
}
