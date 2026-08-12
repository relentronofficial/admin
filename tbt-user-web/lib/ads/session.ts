/**
 * Ad session + guest identity — TBT_ADS_SPECKIT.md §"Session and Anonymous
 * User Handling".
 *
 * Two distinct identifiers, easy to conflate:
 *
 *   anonymousId — STABLE across sessions. Reuses the existing `tbt_device_id`
 *                 that `lib/api/client.ts` already writes on first load. Do
 *                 not mint a second device identifier.
 *   sessionId   — NEW per browser session (sessionStorage). Drives
 *                 once-per-session frequency rules.
 */

const SESSION_KEY = "tbt_ad_session_id";
const LAUNCH_COUNT_KEY = "tbt_ad_launch_count";
const DEVICE_KEY = "tbt_device_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/**
 * In-memory fallbacks. Private browsing and some embedded webviews throw on
 * storage access; ads must degrade to session-only frequency rather than
 * breaking the page (speckit §11).
 */
let memorySessionId: string | null = null;
let memoryAnonymousId: string | null = null;

export function getAdSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    if (!memorySessionId) memorySessionId = randomId();
    return memorySessionId;
  }
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    // client.ts normally writes this on first load; if we somehow got here
    // first, write the same key so both agree.
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    if (!memoryAnonymousId) memoryAnonymousId = randomId();
    return memoryAnonymousId;
  }
}

/**
 * Monotonic launch counter for the `afterNLaunches` trigger. Incremented once
 * per browser session, not per page navigation — a SPA route change is not a
 * launch.
 */
export function getLaunchCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const alreadyCounted = sessionStorage.getItem(`${SESSION_KEY}_counted`);
    const current = Number(localStorage.getItem(LAUNCH_COUNT_KEY) ?? "0") || 0;
    if (alreadyCounted) return current;
    const next = current + 1;
    localStorage.setItem(LAUNCH_COUNT_KEY, String(next));
    sessionStorage.setItem(`${SESSION_KEY}_counted`, "1");
    return next;
  } catch {
    return 1;
  }
}

/** Wall-clock ms when this session started — drives `delaySeconds` triggers. */
const sessionStartedAt = Date.now();

export function getSessionElapsedSeconds(): number {
  return Math.floor((Date.now() - sessionStartedAt) / 1000);
}
