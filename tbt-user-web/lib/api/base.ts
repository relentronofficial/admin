/**
 * Where user-web reaches the Fastify backend.
 *
 * In the browser every API call goes to the app's own origin (`/api/...`,
 * `/socket.io`), which next.config.ts rewrites to the backend. The auth cookies
 * the backend sets are then stored for the app's domain (first-party). Calling
 * the backend's run.app origin directly made them third-party cookies, which
 * Safari, Brave and Chrome-with-3P-blocking drop — members got signed in and
 * immediately bounced back to /login.
 *
 * Server-side code (Server Components, metadata) has no origin to be relative
 * to, so it keeps calling the backend directly; it never needs auth cookies.
 */
export const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

/** Prefix for API URLs: "" (same origin) in the browser, the backend URL on the server. */
export function apiBase(): string {
  return typeof window === "undefined" ? BACKEND_URL : "";
}
