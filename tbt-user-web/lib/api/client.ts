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

export function initApiClient(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

apiClient.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
