import axios from "axios";

// Generate and persist a stable device ID in localStorage on first load.
if (typeof window !== "undefined") {
  if (!localStorage.getItem("tbt_device_id")) {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem("tbt_device_id", id);
  }
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 15000,
  withCredentials: true, // send HttpOnly auth cookies on every request
  headers: { "Content-Type": "application/json" },
});

// Offset between server clock and client clock (ms). Updated on every response.
let _serverTimeOffset = 0;

export function getServerNow(): number {
  return Date.now() + _serverTimeOffset;
}

// ── Proactive token refresh ──────────────────────────────────────────────────────
// The backend issues a tbt_access cookie with a 15-minute TTL. To avoid a burst
// of 401 console errors on page-load (all parallel queries firing before the
// reactive interceptor can start a refresh), we stamp an expected expiry in
// localStorage after every successful login or refresh and check it upfront in
// the request interceptor. All concurrent callers await the same promise.

const ACCESS_EXP_KEY = "tbt_access_exp";
const ACCESS_LIFETIME_MS = 14.5 * 60 * 1000; // 30 s buffer before the 15-min server TTL

let _refreshPromise: Promise<void> | null = null;

function scheduleRefresh(): Promise<void> {
  if (!_refreshPromise) {
    _refreshPromise = axios
      .post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user-auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then(() => {
        if (typeof window !== "undefined")
          localStorage.setItem(ACCESS_EXP_KEY, String(Date.now() + ACCESS_LIFETIME_MS));
      })
      .finally(() => {
        _refreshPromise = null;
      });
  }
  return _refreshPromise;
}

// ── Response interceptor ─────────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => {
    const dateHeader = response.headers?.date;
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      if (!isNaN(serverMs)) _serverTimeOffset = serverMs - Date.now();
    }
    // Stamp expected expiry after a successful login (verify-otp) or refresh so
    // the request interceptor can detect stale tokens proactively next time.
    if (typeof window !== "undefined") {
      const url = response.config?.url ?? "";
      if (url.includes("/api/user-auth/verify-otp") || url.includes("/api/user-auth/refresh")) {
        localStorage.setItem(ACCESS_EXP_KEY, String(Date.now() + ACCESS_LIFETIME_MS));
      }
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Reactive refresh: catches the rare case where the proactive check was
    // skipped (no localStorage hint, e.g. first-ever session or cleared storage).
    // Skip for user-auth endpoints — a 401 there is a real credential error.
    const isAuthEndpoint = !!originalRequest?.url?.includes("/api/user-auth/");
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        await scheduleRefresh();
        return apiClient(originalRequest);
      } catch {
        // Refresh token is also expired — surface the 401.
        // Do NOT redirect to /login: sessions persist until manual sign-out (CLAUDE.md §33).
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  },
);

// ── Request interceptor ──────────────────────────────────────────────────────────

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const deviceId = localStorage.getItem("tbt_device_id");
    if (deviceId) config.headers["x-device-id"] = deviceId;

    // Proactive refresh: if the expiry hint says the access token is stale,
    // refresh now so the request goes out with a fresh cookie. All callers
    // that arrive while a refresh is in-flight await the same promise.
    const isAuthPath = !!config.url?.includes("/api/user-auth/");
    if (!isAuthPath) {
      const exp = localStorage.getItem(ACCESS_EXP_KEY);
      if (exp && Date.now() > parseInt(exp, 10)) {
        try {
          await scheduleRefresh();
        } catch {
          // Refresh failed; let the request proceed and the reactive path handle
          // the 401 if the server still rejects it.
        }
      }
    }
  }
  return config;
});

// No-op kept for callers that import it — not needed with cookie auth
export function initApiClient(_getToken?: () => Promise<string | null>) {}

export function getCachedTokenSync(): string | null {
  return null;
}

export default apiClient;
