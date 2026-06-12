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

// ── Response interceptor ────────────────────────────────────────────────────────

let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

apiClient.interceptors.response.use(
  (response) => {
    const dateHeader = response.headers?.date;
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      if (!isNaN(serverMs)) _serverTimeOffset = serverMs - Date.now();
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Auto-refresh on 401 (once per request).
    // Skip for user-auth endpoints — a 401 there is a real credential/OTP error,
    // not an expired session, so we should surface the error directly.
    const isAuthEndpoint = !!originalRequest?.url?.includes("/api/user-auth/");
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (_isRefreshing) {
        // Queue up callers while a refresh is already in-flight
        return new Promise<void>((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      _isRefreshing = true;

      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user-auth/refresh`,
          {},
          { withCredentials: true },
        );
        _refreshQueue.forEach((p) => p.resolve());
        _refreshQueue = [];
        return apiClient(originalRequest);
      } catch (refreshError) {
        _refreshQueue.forEach((p) => p.reject(refreshError));
        _refreshQueue = [];
        // Redirect to login only if not already there
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
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

// ── Request interceptor ─────────────────────────────────────────────────────────
// Attach device ID for security telemetry. Cookies are sent automatically.
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const deviceId = localStorage.getItem("tbt_device_id");
    if (deviceId) config.headers["x-device-id"] = deviceId;
  }
  return config;
});

// No-op kept for callers that import it — no longer needed with cookie auth
export function initApiClient(_getToken?: () => Promise<string | null>) {}

export function getCachedTokenSync(): string | null { return null; }

export default apiClient;
