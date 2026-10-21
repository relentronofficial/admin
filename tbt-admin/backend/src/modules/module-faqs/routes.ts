import type { FastifyInstance } from 'fastify';
import {
  createFaqHandler,
  createFaqsBulkHandler,
  deleteFaqHandler,
  listFaqsAdminHandler,
  reorderFaqsHandler,
  setFaqPublishedHandler,
  updateFaqHandler,
} from './controller.js';

// Admin-only (Clerk). Any admin can read; writes need Admin/Super Admin (checked
// in the handlers). Members read published FAQs via GET /api/pub/module-faqs.
export async function moduleFaqsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/admin', listFaqsAdminHandler);
  fastify.post('/admin', createFaqHandler);
  fastify.post('/admin/bulk', createFaqsBulkHandler);
  fastify.put('/admin/reorder', reorderFaqsHandler);
  fastify.put('/admin/:id', updateFaqHandler);
  fastify.patch('/admin/:id/publish', setFaqPublishedHandler);
  fastify.delete('/admin/:id', deleteFaqHandler);
}
