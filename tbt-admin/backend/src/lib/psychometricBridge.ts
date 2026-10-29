/**
 * Psychometric bridge — lets TBT Admin users work in Psychometric Admin with
 * their TBT (Clerk) session instead of a second login.
 *
 * The standalone Psychometric API (Express + MongoDB) only accepts a token from
 * its own POST /admin/login, and keeps ONE active session per admin account
 * (every login invalidates the previous token). So the TBT backend signs in
 * with a dedicated service account whose credentials live only in server env
 * (Secret Manager), keeps that token server-side, and forwards an allow-listed
 * set of admin endpoints for authorised TBT admins. The browser never sees the
 * Psychometric credentials or token.
 *
 * The token is shared through Redis so every backend instance (staging shares
 * the same Redis) uses the same session — otherwise each instance's login would
 * knock the others out. Re-login happens only under a short Redis lock.
 */

const BRIDGE_ROLES = new Set(['super_admin', 'admin']);

/** Psychometric Admin is limited to Admin and Super Admin. */
export function canUsePsychometric(role: string | null | undefined): boolean {
  return !!role && BRIDGE_ROLES.has(role);
}

// Admin endpoints the integrated pages use. Auth endpoints (login, logout,
// change-password, profile) are deliberately absent: through the bridge they
// would act on the shared service account.
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

export const TOKEN_KEY = 'psychometric:bridge:token';
export const LOCK_KEY = 'psychometric:bridge:login-lock';
// Psychometric tokens last 8h; re-use one for 7h so it never expires mid-request.
export const TOKEN_TTL_SECONDS = 7 * 60 * 60;
const LOCK_TTL_SECONDS = 15;

export interface BridgeStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

export interface PsychometricSession {
  /** A current token — cached, or freshly obtained. */
  getToken(): Promise<string>;
  /** Called after the API rejected `stale`: returns a newer token, signing in only if nobody else already has. */
  refresh(stale: string | null): Promise<string>;
}

export function createPsychometricSession(opts: {
  store: BridgeStore | null;
  login: () => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  /** How long to wait for another instance's sign-in before giving up. */
  waitAttempts?: number;
}): PsychometricSession {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const waitAttempts = opts.waitAttempts ?? 20;
  let cached: string | null = null;
  let inflight: Promise<string> | null = null;

  const readShared = async () => {
    if (!opts.store) return null;
    try {
      return await opts.store.get(TOKEN_KEY);
    } catch {
      return null;
    }
  };

  async function signInAndShare(): Promise<string> {
    const token = await opts.login();
    cached = token;
    if (opts.store) {
      try {
        await opts.store.set(TOKEN_KEY, token, 'EX', TOKEN_TTL_SECONDS);
      } catch {
        /* Redis down: this instance still has the token in memory */
      }
    }
    return token;
  }

  async function doRefresh(stale: string | null): Promise<string> {
    const shared = await readShared();
    if (shared && shared !== stale) {
      cached = shared;
      return shared;
    }
    if (!opts.store) return signInAndShare();

    let locked = false;
    try {
      locked = (await opts.store.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')) !== null;
    } catch {
      // Redis unreachable: sign in directly rather than block every request.
      return signInAndShare();
    }
    if (locked) {
      try {
        return await signInAndShare();
      } finally {
        await opts.store.del(LOCK_KEY).catch(() => {});
      }
    }
    // Another instance is signing in — wait for its token instead of logging in
    // again (which would invalidate theirs).
    for (let i = 0; i < waitAttempts; i++) {
      await sleep(500);
      const next = await readShared();
      if (next && next !== stale) {
        cached = next;
        return next;
      }
    }
    throw new Error('Psychometric sign-in is taking too long. Please try again.');
  }

  function refresh(stale: string | null): Promise<string> {
    if (cached && cached !== stale) return Promise.resolve(cached);
    if (!inflight) inflight = doRefresh(stale).finally(() => { inflight = null; });
    return inflight;
  }

  return {
    async getToken() {
      if (cached) return cached;
      const shared = await readShared();
      if (shared) {
        cached = shared;
        return shared;
      }
      return refresh(null);
    },
    refresh,
  };
}
