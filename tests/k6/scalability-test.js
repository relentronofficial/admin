/**
 * SCALABILITY TEST — TBT Backend (Google Cloud Run)
 *
 * Goal: measure how throughput (RPS) and latency scale as concurrent users
 * increase linearly. Produces a step-function profile so you can plot
 * RPS vs VUs and latency vs VUs to find the linear-scaling regime.
 *
 * Each step holds for 3 minutes — enough for Cloud Run to scale out and
 * for metrics to stabilize before the next step.
 *
 * Steps: 10 → 25 → 50 → 100 → 150 → 200 → 300 → 400
 *
 * Run:
 *   BASE_URL=https://tbt-backend-xxx.run.app k6 run tests/k6/scalability-test.js
 *
 * Interpreting results:
 *   - RPS should increase proportionally to VUs up to the DB connection pool limit
 *   - Latency should stay roughly flat through the linear-scaling region
 *   - When latency starts climbing while RPS plateaus → saturation point found
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, PUBLIC_ENDPOINTS, adminHeaders, publicHeaders, ADMIN_TOKEN } from './config.js';

// Per-step trends — tag with step label
const stepLatency = new Trend('step_latency', true);
const stepErrors  = new Counter('step_errors');

export const options = {
  stages: [
    // Warm-up
    { duration: '1m',  target: 10 },
    { duration: '3m',  target: 10 },  // step 1 — baseline
    // Ramp steps
    { duration: '30s', target: 25 },
    { duration: '3m',  target: 25 },  // step 2
    { duration: '30s', target: 50 },
    { duration: '3m',  target: 50 },  // step 3
    { duration: '30s', target: 100 },
    { duration: '3m',  target: 100 }, // step 4
    { duration: '30s', target: 150 },
    { duration: '3m',  target: 150 }, // step 5
    { duration: '30s', target: 200 },
    { duration: '3m',  target: 200 }, // step 6
    { duration: '30s', target: 300 },
    { duration: '3m',  target: 300 }, // step 7
    { duration: '30s', target: 400 },
    { duration: '3m',  target: 400 }, // step 8
    // Cool-down
    { duration: '2m',  target: 0 },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],
    http_req_duration: ['p(99)<6000'],  // generous — we care about the shape, not absolute pass/fail
  },
};

function currentStep(vu) {
  const steps = [10, 25, 50, 100, 150, 200, 300, 400];
  for (const s of steps.slice().reverse()) {
    if (__VU <= s) return `vus_${s}`;
  }
  return 'unknown';
}

export default function () {
  const step = currentStep(__VU);

  group('public_read', () => {
    for (const path of PUBLIC_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${path}`, {
        headers: publicHeaders(),
        tags: { step },
      });
      const ok = check(res, { [`${step} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
      stepLatency.add(res.timings.duration, { step });
      if (!ok) stepErrors.add(1, { step });
      sleep(0.1);
    }
  });

  // Write-path test: user-auth login (heavy DB query + bcrypt) under scale
  // Uses a non-existent phone to always get 401 without side effects
  group('auth_write_path', () => {
    const res = http.post(
      `${BASE_URL}/api/user-auth/login`,
      JSON.stringify({ phone: '+919999999999', password: 'wrongpassword_scalability_probe' }),
      { headers: publicHeaders(), tags: { step } }
    );
    // 401 is expected and correct — we're testing DB query path, not auth correctness
    check(res, { 'auth 401 or 200': (r) => [200, 401, 400, 429].includes(r.status) });
    stepLatency.add(res.timings.duration, { step });
    if (![200, 401, 400, 429].includes(res.status)) stepErrors.add(1, { step });
    sleep(0.3);
  });

  // Admin list endpoint — tests DB read under scale (if token available)
  if (ADMIN_TOKEN) {
    group('admin_list', () => {
      const res = http.get(`${BASE_URL}/api/members?limit=20`, {
        headers: adminHeaders(),
        tags: { step },
      });
      check(res, { 'admin 200': (r) => r.status === 200 });
      stepLatency.add(res.timings.duration, { step });
      if (res.status !== 200) stepErrors.add(1, { step });
      sleep(0.2);
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  const summary = {
    test:       'scalability',
    timestamp:  new Date().toISOString(),
    overall: {
      http_reqs:       data.metrics.http_reqs?.values?.count,
      error_rate_pct:  ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2),
      p95_ms:          data.metrics.http_req_duration?.values?.['p(95)'],
    },
    instructions: [
      '1. Export this data and plot RPS vs time (each step = one data point)',
      '2. Plot p95 latency vs VU count',
      '3. Linear-scaling region: RPS ~ proportional to VUs, latency flat',
      '4. Saturation point: RPS plateaus, latency starts climbing',
      '5. Cloud Run max-instances setting should be set above the saturation VU count',
    ],
    cloudrun_notes: [
      'Cloud Run auto-scales on request concurrency (not CPU)',
      'Default max-concurrency = 80 requests/instance',
      'At 400 VUs you may see 5+ instances spinning up',
      'Check GCP > Cloud Run > Revisions > Instance count timeline',
    ],
  };
  console.log('\n=== SCALABILITY TEST SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  return { 'tests/results/scalability-summary.json': JSON.stringify(summary, null, 2) };
}
