import { FastifyInstance } from 'fastify';
import {
  listSectionsHandler, createSectionHandler, updateSectionHandler, deleteSectionHandler, reorderSectionsHandler,
  listItemsHandler, createItemHandler, updateItemHandler, deleteItemHandler, reorderItemsHandler,
} from './controller.js';

export async function contentSectionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/', listSectionsHandler);
  fastify.post('/', createSectionHandler);
  fastify.put('/reorder', reorderSectionsHandler);
  fastify.put('/:id', updateSectionHandler);
  fastify.delete('/:id', deleteSectionHandler);
  fastify.get('/:id/items', listItemsHandler);
  fastify.post('/:id/items', createItemHandler);
  fastify.put('/:id/items/reorder', reorderItemsHandler);
  fastify.put('/items/:itemId', updateItemHandler);
  fastify.delete('/items/:itemId', deleteItemHandler);
}
