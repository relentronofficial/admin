/**
 * Scenario 05 — Full user journey (production replica)
 * Simulates realistic mixed traffic: browsing, workshops, notifications, progress posts.
 * This is the main scenario for overall system capacity testing.
 *
 * Workshop slugs are discovered dynamically at test start — no hardcoded slug needed.
 * Run: k6 run --env TOKEN=$(cat token.txt) scenarios/05-full-journey.js
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency  = new Trend("journey_latency", true);
const errors   = new Rate("journey_errors");
const p95_slow = new Rate("slow_requests");   // requests > 2s

export const options = {
  stages: [
    { duration: "1m",  target: 100 },
    { duration: "2m",  target: 300 },
    { duration: "3m",  target: 500 },
    { duration: "2m",  target: 500 },  // sustain at peak
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    journey_latency:    ["p(95)<3000", "p(99)<5000"],
    journey_errors:     ["rate<0.02"],
    http_req_failed:    ["rate<0.02"],
    slow_requests:      ["rate<0.10"],
  },
};

const BASE_USER = "https://tbt-backend-464464507912.asia-south1.run.app/api/user";
const BASE_PUB  = "https://tbt-backend-464464507912.asia-south1.run.app/api/pub";
const TOKEN     = __ENV.TOKEN;

function h() {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
}

function req(res, label) {
  latency.add(res.timings.duration);
  if (res.timings.duration > 2000) p95_slow.add(1);
  const ok = check(res, {
    [`${label}: not 5xx`]: (r) => r.status < 500,
    [`${label}: not 429`]: (r) => r.status !== 429,
  });
  if (!ok) errors.add(1);
}

export function setup() {
  // Warm Cloud Run
  for (let i = 0; i < 10; i++) {
    const r = http.get("https://tbt-backend-464464507912.asia-south1.run.app/health");
    if (r.status === 200) break;
  }

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
    const fallback = __ENV.SLUG || "zero-rupee-marketing";
    slugs = [fallback];
  }

  console.log(`Loaded ${slugs.length} workshop slug(s): ${slugs.join(", ")}`);
  return { slugs };
}

export default function (data) {
  const slugs = data.slugs;
  // Each VU picks a random slug — spreads DB load realistically across all workshops
  const slug = slugs[Math.floor(Math.random() * slugs.length)];

  // ── Phase 1: App bootstrap (every new tab) ──────────────────────────────────
  group("bootstrap", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_PUB}/config/site` },
      { method: "GET", url: `${BASE_PUB}/config/nav` },
      { method: "GET", url: `${BASE_PUB}/config/ui-strings` },
    ]);
    rs.forEach((r, i) => req(r, `pub-${i}`));
  });

  sleep(0.5);

  // ── Phase 2: Platform landing ───────────────────────────────────────────────
  group("platform-landing", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/me`,                         params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/notifications/unread-count`, params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/home/hero`,                  params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/home/sections`,              params: { headers: h() } },
    ]);
    rs.forEach((r, i) => req(r, `landing-${i}`));
  });

  sleep(1);

  // ── Phase 3: Dashboard ──────────────────────────────────────────────────────
  group("dashboard", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/dashboard/stats`,            params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/dashboard/continue-learning`,params: { headers: h() } },
    ]);
    rs.forEach((r, i) => req(r, `dash-${i}`));
  });

  sleep(1);

  // ── Phase 4: Workshop browsing ──────────────────────────────────────────────
  group("workshop-browse", () => {
    req(http.get(`${BASE_USER}/workshops`, { headers: h() }), "workshops-list");
    sleep(0.5);
    req(http.get(`${BASE_USER}/workshops/my`, { headers: h() }), "my-workshops");
  });

  sleep(1);

  // ── Phase 5: Workshop detail (heaviest DB query) ────────────────────────────
  group("workshop-detail", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/detail`,     params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/flow`,       params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/workshops/${slug}/challenges`, params: { headers: h() } },
    ]);
    rs.forEach((r, i) => req(r, `detail-${i}`));
  });

  sleep(2);

  // ── Phase 6: Notifications ──────────────────────────────────────────────────
  group("notifications", () => {
    req(http.get(`${BASE_USER}/notifications?page=1&limit=20`, { headers: h() }), "notifs");
  });

  sleep(1);

  // ── Phase 7: Products + Resources ──────────────────────────────────────────
  group("products-resources", () => {
    const rs = http.batch([
      { method: "GET", url: `${BASE_USER}/products`,  params: { headers: h() } },
      { method: "GET", url: `${BASE_USER}/resources`, params: { headers: h() } },
    ]);
    rs.forEach((r, i) => req(r, `prod-${i}`));
  });

  sleep(2);
}
