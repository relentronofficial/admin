import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  listAdminsHandler,
  createAdminHandler,
  getAdminHandler,
  updateAdminHandler,
  deleteAdminHandler,
  updateStatusHandler,
  updateRBAChandler,
  generateIdHandler,
  checkUsernameHandler,
  checkEmailHandler,
  searchAdminsHandler
} from './controller.js';
import { invalidateAdminAuthCache } from '../../plugins/clerk.js';

const forbidden = (reply: FastifyReply) =>
  reply.status(403).send({ success: false, data: null, error: 'Forbidden: only a super admin can manage admin accounts' });

/** Creating, deleting, suspending or re-roling admins is super-admin only. */
async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.adminRole !== 'super_admin') return forbidden(reply);
}

/** Editing an admin: super admins edit anyone; others only their own profile, never role or status. */
async function requireSuperAdminOrSelf(request: FastifyRequest, reply: FastifyReply) {
  if (request.adminRole === 'super_admin') return;
  const { id } = request.params as { id: string };
  if (id !== request.adminId) return forbidden(reply);
  // A profile form may send the current role/status back unchanged — drop them
  // rather than refuse, so a self-edit can never change access.
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object') {
    delete body.role;
    delete body.status;
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  // Any change to an admin can change who may sign in — drop cached verdicts.
  fastify.addHook('onResponse', async (request) => {
    if (request.method !== 'GET') invalidateAdminAuthCache();
  });

  fastify.get('/', listAdminsHandler);
  fastify.post('/', { preHandler: requireSuperAdmin }, createAdminHandler);
  fastify.get('/generate-id', generateIdHandler);
  fastify.get('/check-username', checkUsernameHandler);
  fastify.get('/check-email', checkEmailHandler);
  fastify.get('/search', searchAdminsHandler);
  fastify.get('/:id', getAdminHandler);
  fastify.put('/:id', { preHandler: requireSuperAdminOrSelf }, updateAdminHandler);
  fastify.delete('/:id', { preHandler: requireSuperAdmin }, deleteAdminHandler);
  fastify.put('/:id/status', { preHandler: requireSuperAdmin }, updateStatusHandler);
  fastify.put('/:id/rbac', { preHandler: requireSuperAdmin }, updateRBAChandler);
}
