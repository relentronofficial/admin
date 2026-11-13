// Psychometric Admin is served by the TBT backend (/api/psychometric-platform,
// data in TBT's own database), authenticated with the admin's TBT (Clerk)
// session — no second login; the backend allows Admin / Super Admin only.
// Paths keep the former standalone API's shape ("/admin/...").
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/psychometric-platform`;

// Standard response envelope returned by (almost) every backend endpoint.
// Some endpoints add top-level fields (list endpoints: total/pages/stats) or
// return the payload directly (dashboard/reports) — those call sites pass
// their own response shape as the generic argument.
export type ApiEnvelope<T = unknown> = {
  success: boolean;
  message?: string;
  // Present on success responses; the `if (ok)` / `if (data.success)` guard at
  // each call site is what makes this safe to read (error/failure bodies omit it).
  data: T;
  total?: number;
  pages?: number;
  stats?: unknown;
};

export type ApiResult<T = unknown> = { ok: boolean; status: number; data: T };

type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

// The token source: the same Clerk `getToken` (from useAuth) that the rest of
// TBT Admin's API client uses — registered by app/psychometric/layout.tsx,
// which wraps every Psychometric page. Reading `window.Clerk.session` directly
// (the previous approach) returned no token for admins whose regular TBT Admin
// requests were authenticating fine at the same moment, so the backend got
// requests without an Authorization header and answered 401.
let tokenGetter: TokenGetter | null = null;
export function setAuthTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

async function currentToken(fresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const getter: TokenGetter | null = tokenGetter ?? (() => {
    // Fallback only until the layout registers useAuth's getToken.
    const clerk = (window as unknown as { Clerk?: { session?: { getToken: TokenGetter } | null } }).Clerk;
    return clerk?.session ? (o) => clerk.session!.getToken(o) : null;
  })();
  if (!getter) return null;
  try {
    return (await getter(fresh ? { skipCache: true } : undefined)) || null;
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The admin's Clerk session token. If none comes back, asks once more for a
 * fresh one (Clerk may be mid-refresh) before giving up. Never logs the token.
 */
async function sessionToken(fresh = false): Promise<string | null> {
  const token = await currentToken(fresh);
  if (token) return token;
  await wait(300);
  return currentToken(true);
}

/** The admin's current Clerk session token, as the rest of TBT Admin sends it. */
export async function authHeaders(fresh = false): Promise<Record<string, string>> {
  const token = await sessionToken(fresh);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const NO_SESSION = { success: false, message: "Your TBT Admin session couldn't be read. Please reload the page." };

// The ported pages pass a `token` argument everywhere; it is ignored now (the
// Clerk token is attached per request) but kept so the page code is unchanged.
async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const send = async (fresh: boolean) => {
      const auth = await authHeaders(fresh);
      // Never send an unauthenticated request: without a token the backend can
      // only answer 401.
      if (!auth.Authorization) return null;
      return fetch(`${API_BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...auth },
        body: body ? JSON.stringify(body) : undefined,
      });
    };
    let res = await send(false);
    // A token the backend rejects (e.g. it expired in flight): retry once with a fresh one.
    if (res && res.status === 401) res = await send(true);
    if (!res) return { ok: false, status: 401, data: NO_SESSION as unknown as T };
    const data = await res.json().catch(() => ({ success: false, message: "Server error" }));
    // No redirect on 401/403 here: access is checked once in app/psychometric/layout.tsx.
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error("Request failed:", error);
    return {
      ok: false,
      status: 0,
      data: { success: false, message: "Connection failed. Please check your network." } as unknown as T,
    };
  }
}

export const api = {
  get: <T = unknown>(path: string, _token?: string | null) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("POST", path, body),
  put: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("PUT", path, body),
  patch: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("PATCH", path, body),
  delete: <T = unknown>(path: string, _token?: string | null) => request<T>("DELETE", path),
};

/**
 * Kept for the ported pages, which read a token before calling `api` and skip
 * work when it is missing. Auth is the Clerk session now, so this is just a
 * non-empty marker; it is never sent anywhere.
 */
export function getToken(): string | null {
  return typeof window === "undefined" ? null : "tbt-session";
}

export const API_BASE_URL = API_BASE;

// Export endpoints need the admin's auth header, so they can't be plain <a href>
// links. Fetch the file and trigger the download via a blob URL instead.
export async function downloadFile(path: string, _token: string | null, filename: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.message || "Export failed." };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (error) {
    console.error("File download failed:", error);
    return { ok: false, message: "Connection failed. Please try again." };
  }
}
