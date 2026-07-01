/**
 * SPIKE TEST — TBT Backend
 *
 * Goal: simulate a sudden, sharp burst of traffic (e.g., a marketing email blast,
 * a flash sale, or a scheduled event going live) to verify the backend and
 * Cloud Run auto-scaling handles instant demand jumps without cascading failure.
 *
 * Pattern: idle → instant jump to 1000 VUs → hold 1 min → instant drop → recover.
 *
 * Run:
 *   BASE_URL=https://tbt-backend-xxx.run.app k6 run tests/k6/spike-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, PUBLIC_ENDPOINTS, adminHeaders, publicHeaders, ADMIN_TOKEN } from './config.js';

const spikeErrors = new Counter('spike_errors');
const spikeErrorRate = new Rate('spike_error_rate');
const spikeDuration  = new Trend('spike_req_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 5    },  // baseline — a few normal users
    { duration: '10s', target: 1000 },  // spike: 0→1000 VUs in 10s
    { duration: '1m',  target: 1000 },  // hold spike for 1 minute
    { duration: '10s', target: 5    },  // immediate drop back down
    { duration: '2m',  target: 5    },  // recovery observation window
    { duration: '30s', target: 0    },  // ramp down
  ],
  thresholds: {
    http_req_failed:  ['rate<0.15'],       // up to 15% allowed during spike (queued/rejected is expected)
    http_req_duration: ['p(95)<5000'],     // 5s ceiling during spike
    spike_error_rate:  ['rate<0.15'],
  },
};

export default function () {
  // During spike the most common pattern is unauthenticated users hitting public pages.
  group('spike_public', () => {
    for (const path of PUBLIC_ENDPOINTS) {
      const res = http.get(`${BASE_URL}${path}`, {
        headers: publicHeaders(),
        tags: { phase: 'spike', group: 'public' },
        timeout: '10s',
      });
      const ok = check(res, {
        'spike 2xx or 429': (r) => [200, 201, 204, 429].includes(r.status),
      });
      spikeDuration.add(res.timings.duration);
      if (!ok) { spikeErrors.add(1); spikeErrorRate.add(1); } else { spikeErrorRate.add(0); }
    }
  });

  // Health check — must survive even under spike
  group('spike_health', () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { phase: 'spike', group: 'health' },
      timeout: '10s',
    });
    check(res, {
      'health survives spike': (r) => r.status === 200,
    });
    if (res.status !== 200) spikeErrors.add(1);
  });

  // Admin list — important to verify auth path doesn't collapse under spike
  if (ADMIN_TOKEN) {
    group('spike_admin', () => {
      const res = http.get(`${BASE_URL}/api/members?limit=10`, {
        headers: adminHeaders(),
        tags: { phase: 'spike', group: 'admin' },
        timeout: '10s',
      });
      check(res, {
        'admin spike 2xx or 429': (r) => [200, 429].includes(r.status),
      });
      spikeDuration.add(res.timings.duration);
    });
  }

  sleep(0.05); // minimal sleep — maintain maximum pressure
}

export function handleSummary(data) {
  const summary = {
    test:       'spike',
    timestamp:  new Date().toISOString(),
    peak_vus:   1000,
    metrics: {
      http_reqs:       data.metrics.http_reqs?.values?.count,
      error_rate_pct:  ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2),
      p50_ms:          data.metrics.http_req_duration?.values?.['p(50)'],
      p95_ms:          data.metrics.http_req_duration?.values?.['p(95)'],
      p99_ms:          data.metrics.http_req_duration?.values?.['p(99)'],
      max_ms:          data.metrics.http_req_duration?.values?.max,
    },
    observations: [
      'Check Cloud Run container instance count during spike in GCP console.',
      'Check Supabase connection pool under spike (pgbouncer metrics).',
      '429 responses are ACCEPTABLE — rate limiter protecting the system.',
      '503/502 responses indicate Cloud Run failed to scale in time.',
    ],
  };
  console.log('\n=== SPIKE TEST SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  return { 'tests/results/spike-summary.json': JSON.stringify(summary, null, 2) };
}
