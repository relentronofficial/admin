import { FastifyInstance } from 'fastify';
import { pubSiteConfigHandler, pubNavItemsHandler, pubUiStringsHandler, pubMemberSyncHandler, livekitWebhookHandler, pubSessionCheckHandler, pubHomeHeroHandler, pubHomeSectionsHandler } from './controller.js';

export async function pubRoutes(fastify: FastifyInstance) {
  fastify.get('/config/site', pubSiteConfigHandler);
  fastify.get('/config/nav', pubNavItemsHandler);
  fastify.get('/config/ui-strings', pubUiStringsHandler);
  fastify.get('/session-check', pubSessionCheckHandler);
  fastify.get('/home/hero', pubHomeHeroHandler);
  fastify.get('/home/sections', pubHomeSectionsHandler);
  fastify.post('/auth/sync', pubMemberSyncHandler);

  // LiveKit webhook — accepts raw text/string body for HMAC verification
  fastify.addContentTypeParser('application/webhook+json', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
  });
  fastify.post('/workshops/livekit/webhook', livekitWebhookHandler);
}
