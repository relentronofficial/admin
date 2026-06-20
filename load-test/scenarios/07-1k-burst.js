/**
 * Scenario 07 — 45-second 1 000-VU capacity burst
 *
 * Same JWT window and stage timing as scenario 06, but peak VUs doubled to 1 000.
 * Cloud Run max-instances=5, containerConcurrency=200 → 1 000 max concurrent
 * backend slots. This test deliberately saturates that ceiling to measure queueing
 * behaviour and error rate when all Cloud Run capacity is consumed.
 *
 * Shared Upstash Redis cache means most reads are cache hits; DB pressure stays
 * low even at 1 000 VUs. Expected bottleneck: Cloud Run request queue and
 * Supabase PgBouncer pool on cache-miss paths.
 *
 * Thresholds are relaxed vs scenario 06 to reflect realistic queueing at 2× load:
 *   p(90) < 3 000ms, p(95) < 12 000ms, error rate < 10%
 *
 * Run: k6 run --env TOKEN=$(Get-Content token.txt -Raw) scenarios/07-1k-burst.js
 */
import http from "k6/http";
import { check, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const latency   = new Trend("burst1k_latency", true);
const errors    = new Rate("burst1k_errors");
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
        { duration: "5s",  target: 200  },
        { duration: "10s", target: 500  },
        { duration: "10s", target: 1000 },   // peak — saturates Cloud Run capacity
        { duration: "15s", target: 1000 },   // sustain
        { duration: "5s",  target: 0    },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    // Thresholds relaxed for 2× load: queueing adds latency but cache hits keep
    // most requests fast. p(99) omitted — same reasoning as scenario 06.
    burst1k_latency: ["p(90)<3000", "p(95)<12000"],
    burst1k_errors:  ["rate<0.10"],
    http_req_failed: ["rate<0.10"],
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
  // min-instances=3 guarantees instances are already up — single health check suffices
  const warm = http.get(`${BASE}/health`).status === 200;
  console.log(`Cloud Run warm: ${warm}`);

  // Fetch all active workshop slugs dynamically
  const res = http.get(`${BASE_USER}/workshops`, { headers: h() });

  let slugs = [];
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      slugs = (body.data || []).map((w) => w.slug).filter(Boolean);
    } catch {}
  }

  if (slugs.length === 0) {
    console.warn("Could not fetch workshop slugs — falling back to env SLUG or default");
    slugs = [__ENV.SLUG || "zero-rupee-marketing"];
  }

  console.log(`Loaded ${slugs.length} workshop slug(s): ${slugs.join(", ")}`);

  // Warmup: single pass seeds Redis with all endpoint data.
  // Burst-start L1 cold-start is handled by per-instance coalescing in cache.ts
  // and clerk.ts — only 1 Redis GET/key/instance fires instead of N concurrent.
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
  // Single pass: seeds Redis (DB hits only on first). Coalescing in cache.ts+clerk.ts
  // limits Redis load at burst start to 1 GET/key/instance, so more passes are not
  // needed for correctness and only waste JWT lifetime.
  http.batch(warmupReqs);
  console.log(`Cache warmed (${warmupReqs.length} endpoints × 1 pass)`);

  return { slugs };
}

export default function (data) {
  const slugs = data.slugs;
  const slug = slugs[Math.floor(Math.random() * slugs.length)];

  group("public", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE}/api/pub/config/site` },
      { method: "GET", url: `${BASE}/api/pub/config/nav` },
      { method: "GET", url: `${BASE}/api/pub/config/ui-strings` },
    ]);
    rs.forEach((r, i) => tally(r, `pub${i}`));
  });

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

  group("workshop-detail", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/detail`, params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/flow`,   params: { headers: h() } },
    ]);
    rs.forEach((r, i) => tally(r, `ws${i}`));
  });
}
