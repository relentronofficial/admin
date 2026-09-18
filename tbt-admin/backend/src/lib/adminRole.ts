import type { FastifyRequest } from 'fastify';

/**
 * Resolves the acting admin's DB row from the Clerk-verified request — the
 * Clerk `sub` (decorated onto `request.user` by the clerk plugin) is not a
 * UUID, so every "who performed this action" write needs this lookup first.
 * Same pattern as modules/admins/controller.ts's `creatorAdmin` lookup.
 */
export async function getActingAdmin(req: FastifyRequest) {
  return req.server.prisma.admin.findUnique({
    where: { clerkId: req.user },
    select: { id: true, fullName: true, role: true },
  });
}

const ANALYTICS_AND_SETTINGS_ROLES = new Set(['admin', 'super_admin']);

/** Analytics + alarm-settings edits are restricted to admin/super_admin. */
export function canManageHelpdeskSettings(role: string | undefined | null): boolean {
  return !!role && ANALYTICS_AND_SETTINGS_ROLES.has(role);
}
