/**
 * Shared k6 configuration for TBT backend load tests.
 *
 * Usage:
 *   export BASE_URL=https://your-cloud-run-url.run.app
 *   export USER_TOKEN=<valid tbt_access JWT>        # cookie-based user auth
 *   export ADMIN_TOKEN=<valid Clerk JWT>             # admin auth
 *   k6 run tests/k6/stress-test.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
export const USER_TOKEN = __ENV.USER_TOKEN || '';
export const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

// Public endpoints — no auth required
export const PUBLIC_ENDPOINTS = [
  '/health',
  '/api/pub/config/site',
  '/api/pub/config/nav',
  '/api/pub/config/ui-strings',
  '/api/pub/home/hero',
  '/api/pub/home/sections',
];

// User-authenticated endpoints (JWT cookie)
export const USER_ENDPOINTS = [
  '/api/user-auth/me',
  '/api/user/profile',
];

// Admin-authenticated endpoints (Clerk JWT)
export const ADMIN_ENDPOINTS = [
  '/api/members',
  '/api/dashboard',
  '/api/workshops',
  '/api/courses',
  '/api/batches',
  '/api/tiers',
  '/api/notifications',
];

export function userHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cookie': `tbt_access=${USER_TOKEN}`,
  };
}

export function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
  };
}

export function publicHeaders() {
  return { 'Content-Type': 'application/json' };
}

// Shared pass/fail thresholds
export const DEFAULT_THRESHOLDS = {
  http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],   // <5% error rate
  http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: false }], // 95th pct < 2s
  http_req_duration: [{ threshold: 'p(99)<5000', abortOnFail: false }], // 99th pct < 5s
};
