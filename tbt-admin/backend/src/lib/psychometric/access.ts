const PSYCHOMETRIC_ADMIN_ROLES = new Set(['super_admin', 'admin']);

/** Psychometric Admin is limited to Admin and Super Admin. */
export function canUsePsychometric(role: string | null | undefined): boolean {
  return !!role && PSYCHOMETRIC_ADMIN_ROLES.has(role);
}
