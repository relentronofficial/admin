/**
 * Scenario 06 — 45-second capacity burst
 *
 * Designed to run entirely within Clerk's 60-second JWT window.
 * Ramps to 500 VUs in 45s total, no sleep per iteration, so each VU
 * completes 2-4 iterations before the test ends.
 *
 * What this measures: p50/p95/p99 API latency and error rate under high concurrency.
 * No sleep = worst-case DB + network pressure.
 *
 * Run: k6 run --env TOKEN=$(Get-Content token.txt -Raw) --env SLUG=zero-rupee-marketing scenarios/06-capacity-burst.js
 */
import http from "k6/http";
import { check, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const latency   = new Trend("burst_latency", true);
const errors    = new Rate("burst_errors");
const status200 = new Counter("s200");
const status401 = new Counter("s401");
const status429 = new Counter("s429");
const status5xx = new Counter("s5xx");

export const options = {
  stages: [
    { duration: "5s",  target: 100 },   // fast ramp
    { duration: "10s", target: 300 },
    { duration: "10s", target: 500 },   // peak
    { duration: "15s", target: 500 },   // sustain peak (JWT still valid)
    { duration: "5s",  target: 0 },
  ],
  thresholds: {
    burst_latency:   ["p(95)<3000", "p(99)<8000"],
    burst_errors:    ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE  = "https://tbt-backend-464464507912.asia-south1.run.app";
const TOKEN = __ENV.TOKEN;
const SLUG  = __ENV.SLUG || "zero-rupee-marketing";

function h() {
  return { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } };
}

function tally(res, label) {
  latency.add(res.timings.duration);
  if (res.status >= 200 && res.status < 300) status200.add(1);
  else if (res.status === 401) status401.add(1);
  else if (res.status === 429) status429.add(1);
  else if (res.status >= 500) status5xx.add(1);
  const ok = check(res, {
    [`${label}: not 5xx`]: (r) => r.status < 500,
    [`${label}: not 429`]: (r) => r.status !== 429,
    [`${label}: not 401`]: (r) => r.status !== 401,
  });
  if (!ok) errors.add(1);
}

export default function () {
  // Public endpoints — no auth, always valid
  group("public", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE}/api/pub/config/site` },
      { method: "GET", url: `${BASE}/api/pub/config/nav` },
      { method: "GET", url: `${BASE}/api/pub/config/ui-strings` },
    ]);
    rs.forEach((r, i) => tally(r, `pub${i}`));
  });

  // Authenticated user endpoints
  group("auth-user", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE}/api/user/me`,                                   ...h() },
      { method: "GET", url: `${BASE}/api/user/notifications/unread-count`,            ...h() },
      { method: "GET", url: `${BASE}/api/user/dashboard/stats`,                       ...h() },
      { method: "GET", url: `${BASE}/api/user/dashboard/continue-learning`,           ...h() },
      { method: "GET", url: `${BASE}/api/user/home/hero`,                             ...h() },
      { method: "GET", url: `${BASE}/api/user/home/sections`,                         ...h() },
    ]);
    rs.forEach((r, i) => tally(r, `user${i}`));
  });

  // Workshop detail (heaviest DB query)
  group("workshop-detail", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE}/api/user/workshops/${SLUG}/detail`,    ...h() },
      { method: "GET", url: `${BASE}/api/user/workshops/${SLUG}/flow`,      ...h() },
    ]);
    rs.forEach((r, i) => tally(r, `ws${i}`));
  });
}
