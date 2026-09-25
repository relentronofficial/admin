import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include Clerk token if needed
// However, since we are using Fastify with clerkPlugin, we might need to pass the token
// In Next.js, we can get the token from Clerk
apiClient.interceptors.request.use(async (config) => {
  // If we were on the client, we could use useAuth() from Clerk,
  // but this is a static client. We'll handle tokens in custom hooks.
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Backend returns { error: "string message" } — not { error: { message: "..." } }.
    // Guard against both shapes so neither swallows the real error text.
    const backendError = error.response?.data?.error;
    const message =
      (typeof backendError === 'string' ? backendError : backendError?.message) ||
      error.message ||
      'Something went wrong';
    return Promise.reject({ ...error, message });
  }
);

export default apiClient;
