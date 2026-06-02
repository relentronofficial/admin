import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Unwrap the data envelope so callers receive { success, data, meta } directly.
apiClient.interceptors.response.use(
  (response) => response.data,
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
