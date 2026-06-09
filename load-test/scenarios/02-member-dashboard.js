/**
 * Scenario 02 — Authenticated member: dashboard + home page
 * Simulates a user landing on the platform after login.
 * Run: k6 run --env TOKEN=$(cat token.txt) scenarios/02-member-dashboard.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency = new Trend("member_latency", true);
const errors  = new Rate("member_errors");

export const options = {
  stages: [
    { duration: "30s", target: 50  },
    { duration: "1m",  target: 200 },
    { duration: "2m",  target: 500 },
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    member_latency:  ["p(95)<2000"],
    member_errors:   ["rate<0.02"],
    http_req_failed: ["rate<0.02"],
  },
};

const BASE    = "https://tbt-backend-464464507912.asia-south1.run.app/api/user";
const TOKEN   = __ENV.TOKEN;

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
}

function track(res, label) {
  latency.add(res.timings.duration);
  const ok = check(res, {
    [`${label} status 200`]: (r) => r.status === 200,
  });
  if (!ok) errors.add(1);
  return ok;
}

export default function () {
  const h = headers();

  // Page load sequence: profile + unread counts + dashboard
  const batch1 = http.batch([
    { method: "GET", url: `${BASE}/me`,                            params: { headers: h } },
    { method: "GET", url: `${BASE}/notifications/unread-count`,    params: { headers: h } },
    { method: "GET", url: `${BASE}/home/hero`,                     params: { headers: h } },
    { method: "GET", url: `${BASE}/home/sections`,                 params: { headers: h } },
  ]);
  track(batch1[0], "GET /me");
  track(batch1[1], "GET /notif-unread");
  track(batch1[2], "GET /home/hero");
  track(batch1[3], "GET /home/sections");

  sleep(1);

  // Dashboard stats + continue learning
  const batch2 = http.batch([
    { method: "GET", url: `${BASE}/dashboard/stats`,            params: { headers: h } },
    { method: "GET", url: `${BASE}/dashboard/continue-learning`, params: { headers: h } },
    { method: "GET", url: `${BASE}/dashboard/watch-history`,    params: { headers: h } },
  ]);
  track(batch2[0], "GET /dashboard/stats");
  track(batch2[1], "GET /continue-learning");
  track(batch2[2], "GET /watch-history");

  sleep(2);
}
