/**
 * DB Connection Exhaustion Helper — used by DR-02 scenario.
 *
 * Floods the backend with DB-heavy requests to exhaust the Supabase
 * connection pool. Used only in DR testing to observe recovery behaviour.
 *
 * Run (from DR-02 scenario):
 *   BASE_URL=https://... ADMIN_TOKEN=... k6 run --vus 500 --duration 1m tests/dr/db-exhaust.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, adminHeaders, ADMIN_TOKEN } from '../k6/config.js';

export const options = {
  vus: 500,
  duration: '1m',
  thresholds: {}, // no pass/fail — this is intentionally a stress scenario
};

export default function () {
  if (!ADMIN_TOKEN) {
    // fallback: hit unauthenticated DB-touching routes
    http.post(`${BASE_URL}/api/user-auth/login`, JSON.stringify({
      phone: '+919999999999',
      password: 'db_exhaustion_probe',
    }), { headers: { 'Content-Type': 'application/json' } });
    return;
  }

  // Authenticated routes that each open a DB connection
  const routes = [
    '/api/members?limit=50',
    '/api/workshops?limit=50',
    '/api/courses?limit=50',
    '/api/batches',
    '/api/dashboard',
  ];

  for (const r of routes) {
    http.get(`${BASE_URL}${r}`, { headers: adminHeaders() });
  }
}
