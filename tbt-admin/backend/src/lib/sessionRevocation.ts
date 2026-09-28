/**
 * Pure, I/O-free helpers for single-session enforcement.
 *
 * `loginId` is embedded in the JWT payload when a session is issued.
 * `active_login:{memberId}` in Redis tracks the currently valid loginId.
 * On revocation, the Redis key is set to the sentinel "REVOKED" so that
 * in-flight access tokens (up to 15-min TTL) are rejected immediately.
 *
 * These functions contain no Fastify/Prisma/Redis imports so they can be
 * unit-tested without any infrastructure running.
 */

/**
 * Decide whether a request carrying `loginId` should be admitted.
 *
 * Returns:
 *   'pass'    — loginId matches the active session; allow through
 *   'revoked' — a different loginId or the REVOKED sentinel is active;
 *               the caller should return 401 SESSION_REVOKED
 *   'skip'    — insufficient information to check (token pre-dates the
 *               loginId claim, or Redis was unavailable); fail open and
 *               allow through to preserve backward compatibility
 */
export function isLoginRevoked(
  loginId: string | undefined,
  activeLoginId: string | null,
): 'pass' | 'revoked' | 'skip' {
  if (!loginId) return 'skip';         // old token without claim — migration safety
  if (activeLoginId === null) return 'skip'; // Redis unavailable — fail open
  if (activeLoginId === loginId) return 'pass';
  return 'revoked';
}
