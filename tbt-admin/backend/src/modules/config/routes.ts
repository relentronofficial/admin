import { FastifyInstance } from 'fastify';
import {
  getSiteConfigHandler, updateSiteConfigHandler,
  getUiStringsHandler, updateUiStringsHandler,
  listNavItemsHandler, createNavItemHandler, updateNavItemHandler, deleteNavItemHandler, reorderNavItemsHandler,
  getProductsPageConfigHandler, updateProductsPageConfigHandler,
  getResourcesPageConfigHandler, updateResourcesPageConfigHandler,
} from './controller.js';

export async function configRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/site', getSiteConfigHandler);
  fastify.put('/site', updateSiteConfigHandler);

  fastify.get('/ui-strings', getUiStringsHandler);
  fastify.put('/ui-strings', updateUiStringsHandler);

  fastify.get('/nav', listNavItemsHandler);
  fastify.post('/nav', createNavItemHandler);
  fastify.put('/nav/reorder', reorderNavItemsHandler);
  fastify.put('/nav/:id', updateNavItemHandler);
  fastify.delete('/nav/:id', deleteNavItemHandler);

  fastify.get('/products-page', getProductsPageConfigHandler);
  fastify.put('/products-page', updateProductsPageConfigHandler);

  fastify.get('/resources-page', getResourcesPageConfigHandler);
  fastify.put('/resources-page', updateResourcesPageConfigHandler);
}
