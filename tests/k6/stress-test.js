/**
 * STRESS TEST — TBT Backend
 *
 * Goal: find the breaking point by ramping load far beyond normal capacity.
 * Stages ramp from 10 VUs → 500 VUs over ~10 min, hold, then ramp down.
 * Watch for: error rate spike, p(99) latency blow-up, 5xx responses.
 *
 * Run:
 *   BASE_URL=https://tbt-backend-xxx.run.app k6 run tests/k6/stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, PUBLIC_ENDPOINTS, adminHeaders, userHeaders, publicHeaders, ADMIN_TOKEN, USER_TOKEN } from './config.js';

// Custom metrics
const errorCount   = new Counter('stress_errors');
const errorRate    = new Rate('stress_error_rate');
const pubLatency   = new Trend('pub_endpoint_duration', true);
const adminLatency = new Trend('admin_endpoint_duration', true);
const userLatency  = new Trend('user_endpoint_duration', true);

export const options = {
  stages: [
    { duration: '1m',  target: 10  },  // warm-up
    { duration: '2m',  target: 50  },  // ramp to light load
    { duration: '2m',  target: 100 },  // ramp to moderate
    { duration: '2m',  target: 200 },  // ramp to heavy load
    { duration: '2m',  target: 350 },  // ramp to stress zone
    { duration: '2m',  target: 500 },  // peak stress
    { duration: '1m',  target: 500 },  // hold peak
    { duration: '2m',  target: 0   },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.10'],          // allow up to 10% errors under stress
    http_req_duration: ['p(95)<3000'],         // 95th pct under 3s
    stress_error_rate: ['rate<0.10'],
  },
};

export default function () {
  // ── Public endpoints (heaviest traffic) ──────────────────────────────────
  group('public_endpoints', () => {
    for (const path of PUBLIC_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${path}`, { headers: publicHeaders(), tags: { group: 'public' } });
      const ok = check(res, {
        'public 2xx': (r) => r.status >= 200 && r.status < 300,
        'public <2s':  (r) => r.timings.duration < 2000,
      });
      pubLatency.add(res.timings.duration);
      if (!ok) { errorCount.add(1); errorRate.add(1); } else { errorRate.add(0); }
      sleep(0.1);
    }
  });

  // ── Health check ─────────────────────────────────────────────────────────
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { group: 'health' } });
    check(res, {
      'health ok':      (r) => r.status === 200,
      'health body ok': (r) => JSON.parse(r.body).status === 'ok',
    });
  });

  // ── Admin endpoints (if ADMIN_TOKEN is set) ───────────────────────────────
  if (ADMIN_TOKEN) {
    group('admin_members', () => {
      const res = http.get(`${BASE_URL}/api/members?limit=20&page=1`, {
        headers: adminHeaders(),
        tags: { group: 'admin' },
      });
      const ok = check(res, {
        'members 200':     (r) => r.status === 200,
        'members has data': (r) => { try { return Array.isArray(JSON.parse(r.body)?.data?.data); } catch { return false; } },
      });
      adminLatency.add(res.timings.duration);
      if (!ok) { errorCount.add(1); errorRate.add(1); } else { errorRate.add(0); }
      sleep(0.2);
    });

    group('admin_dashboard', () => {
      const res = http.get(`${BASE_URL}/api/dashboard`, {
        headers: adminHeaders(),
        tags: { group: 'admin' },
      });
      check(res, { 'dashboard 200': (r) => r.status === 200 });
      adminLatency.add(res.timings.duration);
      sleep(0.2);
    });
  }

  // ── User endpoints (if USER_TOKEN is set) ─────────────────────────────────
  if (USER_TOKEN) {
    group('user_me', () => {
      const res = http.get(`${BASE_URL}/api/user-auth/me`, {
        headers: userHeaders(),
        tags: { group: 'user' },
      });
      const ok = check(res, { 'me 200': (r) => r.status === 200 });
      userLatency.add(res.timings.duration);
      if (!ok) { errorCount.add(1); errorRate.add(1); } else { errorRate.add(0); }
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  const summary = {
    test:       'stress',
    timestamp:  new Date().toISOString(),
    vus_max:    500,
    metrics: {
      http_reqs:         data.metrics.http_reqs?.values?.count,
      error_rate_pct:    ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2),
      p50_ms:            data.metrics.http_req_duration?.values?.['p(50)'],
      p95_ms:            data.metrics.http_req_duration?.values?.['p(95)'],
      p99_ms:            data.metrics.http_req_duration?.values?.['p(99)'],
      pub_p95_ms:        data.metrics.pub_endpoint_duration?.values?.['p(95)'],
      admin_p95_ms:      data.metrics.admin_endpoint_duration?.values?.['p(95)'],
    },
    thresholds_passed: Object.entries(data.metrics)
      .filter(([, v]) => v.thresholds)
      .every(([, v]) => Object.values(v.thresholds).every((t) => t.ok)),
  };
  console.log('\n=== STRESS TEST SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  return { 'tests/results/stress-summary.json': JSON.stringify(summary, null, 2) };
}
