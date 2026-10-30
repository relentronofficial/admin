import { createHmac } from 'node:crypto';

/**
 * Psychometric bridge — lets TBT Admin users (and, on the member side, TBT
 * members) use the standalone Psychometric platform with their TBT login.
 *
 * There is no Psychometric account or password: the TBT backend signs each
 * forwarded request with a short-lived HS256 token using a key shared with the
 * Psychometric server (PSYCHOMETRIC_BRIDGE_SECRET here, TBT_BRIDGE_SECRET
 * there; see its utils/tbtBridge.js). The key never reaches a browser, and the
 * TBT backend only signs admin tokens for Admin / Super Admin users.
 */

const BRIDGE_ROLES = new Set(['super_admin', 'admin']);

/** Psychometric Admin is limited to Admin and Super Admin. */
export function canUsePsychometric(role: string | null | undefined): boolean {
  return !!role && BRIDGE_ROLES.has(role);
}

// Admin endpoints the integrated pages use. Auth endpoints (login, logout,
// change-password, profile) are deliberately absent.
const ALLOWED_SECTIONS = new Set([
  'users',
  'shared-ids',
  'question-types',
  'questions',
  'answer-options',
  'question-sets',
  'dashboard',
  'results',
  'export',
  'settings',
  'retest-requests',
  'business-matrix',
  'tts',
  'notifications',
]);

const SAFE_PATH = /^\/admin\/([a-z-]+)(\/[A-Za-z0-9_-]+)*$/;

/**
 * Returns the upstream path to call for a bridged request path (query string
 * already removed), or null when it is not an allowed Psychometric admin path.
 * Only plain segments are accepted — no dots, encoded characters or `..`.
 */
export function resolveUpstreamPath(path: string): string | null {
  const m = SAFE_PATH.exec(path);
  if (!m || !ALLOWED_SECTIONS.has(m[1])) return null;
  return path;
}

export const BRIDGE_ISSUER = 'tbt-backend';
export const ADMIN_AUDIENCE = 'psychometric-admin';
export const CANDIDATE_AUDIENCE = 'psychometric-candidate';
/** Each token is signed per request, so it only needs to outlive one call. */
export const BRIDGE_TOKEN_TTL_SECONDS = 5 * 60;

/** A standard HS256 JWT (verified on the other side with `jsonwebtoken`). */
export function signBridgeToken(
  secret: string,
  audience: string,
  claims: { sub: string } & Record<string, string | undefined>,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const header = enc({ alg: 'HS256', typ: 'JWT' });
  const payload = enc({ ...claims, iss: BRIDGE_ISSUER, aud: audience, iat: nowSeconds, exp: nowSeconds + BRIDGE_TOKEN_TTL_SECONDS });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
