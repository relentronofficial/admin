/**
 * Scenario 06 — 45-second capacity burst
 *
 * Designed to run entirely within Clerk's 60-second JWT window.
 * Ramps to 500 VUs in 45s total, no sleep per iteration, so each VU
 * completes 2-4 iterations before the test ends.
 *
 * Workshop slugs are discovered dynamically at test start — no hardcoded slug needed.
 * Each VU iteration picks a random slug to spread DB load across all workshops.
 *
 * What this measures: p50/p95/p99 API latency and error rate under high concurrency.
 * No sleep = worst-case DB + network pressure.
 *
 * Run: k6 run --env TOKEN=$(Get-Content token.txt -Raw) scenarios/06-capacity-burst.js
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
  scenarios: {
    burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s",  target: 100 },
        { duration: "10s", target: 300 },
        { duration: "10s", target: 500 },   // peak
        { duration: "15s", target: 500 },   // sustain
        { duration: "5s",  target: 0 },
      ],
      // Keep ramp-down short — total must stay under 57s (JWT window minus setup ~3s).
      // 45s stages + 5s gracefulRampDown = 50s total — within 60s JWT lifetime.
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    // p(90) target: <1s (cache hits); p(95) allows for Cloud Run cold-start scale-out
    burst_latency:   ["p(90)<1000", "p(95)<5000", "p(99)<10000"],
    burst_errors:    ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE      = "https://tbt-backend-464464507912.asia-south1.run.app";
const BASE_USER = `${BASE}/api/user`;
const TOKEN     = __ENV.TOKEN;

function h() {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
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
  errors.add(ok ? 0 : 1);
}

export function setup() {
  // Warm Cloud Run before the test starts
  let warm = false;
  for (let i = 0; i < 20 && !warm; i++) {
    const r = http.get(`${BASE}/health`);
    warm = r.status === 200;
  }
  console.log(`Cloud Run warm: ${warm}`);

  // Fetch all active workshop slugs dynamically
  const res = http.get(`${BASE_USER}/workshops`, {
    headers: h(),
  });

  let slugs = [];
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      slugs = (body.data || []).map((w) => w.slug).filter(Boolean);
    } catch {}
  }

  if (slugs.length === 0) {
    console.warn("Could not fetch workshop slugs — falling back to env SLUG or default");
    const fallback = __ENV.SLUG || "zero-rupee-marketing";
    slugs = [fallback];
  }

  console.log(`Loaded ${slugs.length} workshop slug(s): ${slugs.join(", ")}`);

  // Prime in-process caches across all Cloud Run instances.
  // Cloud Run (max-instances=5) load-balances requests across instances.
  // We make 8 parallel passes so each instance is hit ~8 times and its cache is warm.
  const warmupReqs = [
    { method: "GET", url: `${BASE}/api/pub/config/site` },
    { method: "GET", url: `${BASE}/api/pub/config/nav` },
    { method: "GET", url: `${BASE}/api/pub/config/ui-strings` },
    { method: "GET", url: `${BASE_USER}/me`,                          params: { headers: h() } },
    { method: "GET", url: `${BASE_USER}/notifications/unread-count`,  params: { headers: h() } },
    { method: "GET", url: `${BASE_USER}/dashboard/stats`,             params: { headers: h() } },
    { method: "GET", url: `${BASE_USER}/dashboard/continue-learning`, params: { headers: h() } },
    { method: "GET", url: `${BASE_USER}/home/hero`,                   params: { headers: h() } },
    { method: "GET", url: `${BASE_USER}/home/sections`,               params: { headers: h() } },
    ...slugs.flatMap((s) => [
      { method: "GET", url: `${BASE_USER}/workshops/${s}/detail`, params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/workshops/${s}/flow`,   params: { headers: h() } },
    ]),
  ];
  // Fire all warmup requests in parallel (not sequential) so Cloud Run scales up
  // immediately and all instances are warm before VUs start.
  // 8 × 15 = 120 parallel requests → ~5 instances each get ~24 warmup hits → caches fully seeded.
  const parallelWarmup = [];
  for (let i = 0; i < 8; i++) parallelWarmup.push(...warmupReqs);
  http.batch(parallelWarmup);
  console.log(`Cache warmed (${warmupReqs.length} endpoints × 8 parallel passes)`);

  return { slugs };
}

export default function (data) {
  const slugs = data.slugs;
  // Each VU iteration picks a random slug — spreads DB load across all workshops
  const slug = slugs[Math.floor(Math.random() * slugs.length)];

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
      { method: "GET", url: `${BASE_USER}/me`,                                   params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/notifications/unread-count`,            params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/dashboard/stats`,                       params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/dashboard/continue-learning`,           params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/home/hero`,                             params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/home/sections`,                         params: { headers: h() } },
    ]);
    rs.forEach((r, i) => tally(r, `user${i}`));
  });

  // Workshop detail (heaviest DB query) — random slug each iteration
  group("workshop-detail", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/detail`,    params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/flow`,      params: { headers: h() } },
    ]);
    rs.forEach((r, i) => tally(r, `ws${i}`));
  });
}
