import type { FastifyInstance } from 'fastify';
import * as h from './controller.js';

/** AI credits wallet. Registered at /api/ai-credits. */
export async function aiCreditsRoutes(fastify: FastifyInstance) {
  fastify.register(async (user) => {
    user.addHook('preHandler', user.authenticateUser);
    user.get('/', h.walletHandler);
    user.get('/packs', h.packsHandler);
    user.get('/history', h.historyHandler);
    user.post('/razorpay/create-order', h.createOrderHandler);
    user.post('/razorpay/verify', h.verifyHandler);
  });

  fastify.register(async (admin) => {
    admin.addHook('preHandler', admin.authenticate);
    admin.addHook('preHandler', h.requireFullAccessAdmin);
    admin.get('/packs', h.adminListPacksHandler);
    admin.post('/packs', h.adminCreatePackHandler);
    admin.put('/packs/:id', h.adminUpdatePackHandler);
    admin.delete('/packs/:id', h.adminDeletePackHandler);
    admin.get('/orders', h.adminListOrdersHandler);
  }, { prefix: '/admin' });
}
