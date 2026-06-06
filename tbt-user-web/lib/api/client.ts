import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Offset between server clock and client clock (ms). Updated on every response.
// Prevents countdown drift when the user's device clock is wrong.
let _serverTimeOffset = 0;

/**
 * Returns the best-available estimate of current server time in milliseconds.
 * Use in place of Date.now() wherever server-clock accuracy matters (e.g. countdowns).
 */
export function getServerNow(): number {
  return Date.now() + _serverTimeOffset;
}

// Unwrap the data envelope so callers receive { success, data, meta } directly.
// Also captures the HTTP Date header to keep _serverTimeOffset current.
apiClient.interceptors.response.use(
  (response) => {
    const dateHeader = response.headers?.date;
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      if (!isNaN(serverMs)) _serverTimeOffset = serverMs - Date.now();
    }
    return response.data;
  },
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  }
);

// Attach Clerk bearer token on every request.
// Call initApiClient() once inside a client component after Clerk loads.
let _getToken: (() => Promise<string | null>) | null = null;

// Cache the JWT so we don't call getToken() on every request.
// Clerk tokens are valid for 60s; we refresh 10s early to avoid edge expiry.
let _tokenCache: { token: string; expiresAt: number } | null = null;

export function initApiClient(getToken: () => Promise<string | null>) {
  _getToken = getToken;
  _tokenCache = null; // clear stale token on re-init (sign-in / sign-out)
}

async function getCachedToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  // On page load, TanStack Query fires before AuthInterceptor's useEffect runs.
  // Poll up to 2000ms so the interceptor has time to call initApiClient().
  if (!_getToken) {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (_getToken) break;
    }
  }

  if (!_getToken) throw new Error('Auth not initialised');
  const token = await _getToken();
  if (!token) throw new Error('No auth token');
  _tokenCache = { token, expiresAt: now + 50_000 }; // cache 50s
  return token;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getCachedToken();
  config.headers.Authorization = `Bearer ${token}`;

  // Attach device ID if available (used for security telemetry)
  if (typeof window !== "undefined") {
    const deviceId = localStorage.getItem("tbt_device_id");
    if (deviceId) {
      config.headers["x-device-id"] = deviceId;
    }
  }

  return config;
});

export default apiClient;
