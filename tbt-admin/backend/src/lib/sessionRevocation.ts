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

export interface LoginSessionRow {
  id: string;
  tokenHash: string | null;
  deviceId: string | null;
}

/**
 * Split a member's `member_sessions` rows, at login time, into real sessions
 * on OTHER devices (shown on the "Active Sessions" screen) and rows that are
 * not a live session elsewhere (cleaned up silently).
 *
 * A row is NOT a conflict when:
 *   - it has no token: device-tracking rows written by the profile endpoint
 *     and the legacy /pub/auth/sync path are not sessions;
 *   - it belongs to the device that is logging in now;
 *   - its refresh token is gone from Redis (`live === false`): logged out,
 *     revoked or expired.
 *
 * `live` maps tokenHash → true/false; a hash missing from the map (Redis
 * unavailable) keeps the row as a conflict, the safe default.
 */
export function classifyLoginSessions<T extends LoginSessionRow>(
  rows: T[],
  currentDeviceId: string | null | undefined,
  live: Map<string, boolean>,
): { conflicts: T[]; stale: T[] } {
  const conflicts: T[] = [];
  const stale: T[] = [];
  for (const row of rows) {
    const sameDevice = !!currentDeviceId && row.deviceId === currentDeviceId;
    if (!row.tokenHash || sameDevice || live.get(row.tokenHash) === false) stale.push(row);
    else conflicts.push(row);
  }
  return { conflicts, stale };
}
