// Psychometric Admin talks to the standalone Psychometric platform through the
// TBT backend's bridge (/api/psychometric-bridge), authenticated with the
// admin's TBT (Clerk) session — no second login. The bridge holds the
// Psychometric service-account session server-side and only allows Admin /
// Super Admin. Paths passed in are the Psychometric ones ("/admin/...").
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/psychometric-bridge`;

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

/** The admin's current Clerk session token, as the rest of TBT Admin sends it. */
export async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const clerk = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } | null } }).Clerk;
  const token = await clerk?.session?.getToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The ported pages pass a `token` argument everywhere; it is ignored now (the
// Clerk token is attached per request) but kept so the page code is unchanged.
async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(await authHeaders()) };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({ success: false, message: "Server error" }));
    // No redirect on 401/403: TBT Admin never auto-signs-out, and access is
    // checked once in app/psychometric/layout.tsx.
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

/* eslint-disable @typescript-eslint/no-unused-vars */
export const api = {
  get: <T = unknown>(path: string, _token?: string | null) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("POST", path, body),
  put: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("PUT", path, body),
  patch: <T = unknown>(path: string, body?: unknown, _token?: string | null) => request<T>("PATCH", path, body),
  delete: <T = unknown>(path: string, _token?: string | null) => request<T>("DELETE", path),
};
/* eslint-enable @typescript-eslint/no-unused-vars */

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
