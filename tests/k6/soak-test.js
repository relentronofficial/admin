/**
 * SOAK / ENDURANCE TEST — TBT Backend
 *
 * Goal: run the backend at a realistic sustained load for 2 hours to surface:
 *  - Memory leaks (heap grows without bound → eventual OOM restart)
 *  - Connection pool exhaustion (DB connections not returned to pool)
 *  - Redis connection leaks
 *  - Gradual latency increase under stable RPS (CPU/GC pressure)
 *  - Token refresh edge cases for long-lived sessions
 *
 * Typical production load assumption: ~50–100 concurrent users at peak.
 * Soak load = 80 VUs (slightly above average, sustained).
 *
 * Run (allow ~2.5h):
 *   BASE_URL=https://tbt-backend-xxx.run.app k6 run tests/k6/soak-test.js
 *
 * Monitor during run:
 *   - GCP Cloud Run: memory usage trend (Memory / CPU graphs)
 *   - Supabase: active DB connections
 *   - Upstash Redis: connected clients
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, PUBLIC_ENDPOINTS, adminHeaders, userHeaders, publicHeaders, ADMIN_TOKEN, USER_TOKEN } from './config.js';

// Track latency in 10-minute buckets via tags in the default group
const earlyLatency  = new Trend('soak_early_latency',  true);  // first 30 min
const midLatency    = new Trend('soak_mid_latency',    true);  // 30–90 min
const lateLatency   = new Trend('soak_late_latency',   true);  // final 30 min
const soakErrors    = new Counter('soak_errors');
const soakErrorRate = new Rate('soak_error_rate');

const START_TIME = Date.now();

function bucket() {
  const elapsed = (Date.now() - START_TIME) / 1000;
  if (elapsed < 1800)  return 'early'; // 0–30 min
  if (elapsed < 5400)  return 'mid';   // 30–90 min
  return 'late';                        // 90–120 min
}

export const options = {
  stages: [
    { duration: '5m',  target: 30 },  // warm-up ramp
    { duration: '2h',  target: 80 },  // sustained soak at 80 VUs
    { duration: '5m',  target: 0  },  // cool-down
  ],
  thresholds: {
    http_req_failed:  ['rate<0.02'],        // strict <2% errors for soak
    http_req_duration: ['p(95)<2000'],      // 95th pct must stay under 2s
    soak_error_rate:   ['rate<0.02'],
  },
};

export default function () {
  const phase = bucket();

  // ── Public page simulation (most users are unauthenticated visitors) ──────
  group('public', () => {
    for (const path of PUBLIC_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${path}`, {
        headers: publicHeaders(),
        tags: { soak_phase: phase },
      });
      const ok = check(res, { 'pub 2xx': (r) => r.status >= 200 && r.status < 300 });
      if (phase === 'early') earlyLatency.add(res.timings.duration);
      else if (phase === 'mid') midLatency.add(res.timings.duration);
      else lateLatency.add(res.timings.duration);
      if (!ok) { soakErrors.add(1); soakErrorRate.add(1); } else { soakErrorRate.add(0); }
      sleep(0.3);
    }
  });

  // ── Health probe — simulate load balancer health check every iteration ────
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health ok': (r) => r.status === 200 });
    if (res.status !== 200) soakErrors.add(1);
  });

  // ── Authenticated user flow (simulates active logged-in member) ───────────
  if (USER_TOKEN) {
    group('user_session', () => {
      const meRes = http.get(`${BASE_URL}/api/user-auth/me`, {
        headers: userHeaders(),
        tags: { soak_phase: phase },
      });
      check(meRes, { 'me 200': (r) => r.status === 200 });
      if (meRes.status !== 200) soakErrors.add(1);
      sleep(1);

      const workshopsRes = http.get(`${BASE_URL}/api/workshops?limit=10`, {
        headers: userHeaders(),
        tags: { soak_phase: phase },
      });
      check(workshopsRes, { 'workshops 200': (r) => r.status === 200 });
      if (workshopsRes.status !== 200) soakErrors.add(1);
    });
  }

  // ── Admin background queries (simulate admin panel open in browser tab) ───
  if (ADMIN_TOKEN) {
    group('admin_background', () => {
      const res = http.get(`${BASE_URL}/api/members?limit=20&page=1`, {
        headers: adminHeaders(),
        tags: { soak_phase: phase },
      });
      check(res, { 'admin members 200': (r) => r.status === 200 });
      if (res.status !== 200) soakErrors.add(1);
    });
  }

  sleep(1.5);
}

export function handleSummary(data) {
  const summary = {
    test:       'soak',
    duration:   '2h',
    timestamp:  new Date().toISOString(),
    metrics: {
      http_reqs:         data.metrics.http_reqs?.values?.count,
      error_rate_pct:    ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2),
      p50_ms:            data.metrics.http_req_duration?.values?.['p(50)'],
      p95_ms:            data.metrics.http_req_duration?.values?.['p(95)'],
      p99_ms:            data.metrics.http_req_duration?.values?.['p(99)'],
      early_p95_ms:      data.metrics.soak_early_latency?.values?.['p(95)'],
      mid_p95_ms:        data.metrics.soak_mid_latency?.values?.['p(95)'],
      late_p95_ms:       data.metrics.soak_late_latency?.values?.['p(95)'],
    },
    memory_leak_signal: (() => {
      const early = data.metrics.soak_early_latency?.values?.['p(95)'];
      const late  = data.metrics.soak_late_latency?.values?.['p(95)'];
      if (!early || !late) return 'insufficient data';
      const drift = ((late - early) / early * 100).toFixed(1);
      return `late p95 is ${drift}% ${late > early ? 'higher' : 'lower'} than early p95 — ${Math.abs(parseFloat(drift)) > 30 ? '⚠️ POSSIBLE LEAK/DEGRADATION' : '✅ STABLE'}`;
    })(),
  };
  console.log('\n=== SOAK TEST SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  return { 'tests/results/soak-summary.json': JSON.stringify(summary, null, 2) };
}
