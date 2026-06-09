/**
 * Scenario 01 — Public endpoints (no auth)
 * Target: 500 VUs | These are hit on every page load before auth.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency = new Trend("pub_latency", true);
const errors  = new Rate("pub_errors");

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m",  target: 300 },
    { duration: "2m",  target: 500 },
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    pub_latency:        ["p(95)<1500"],
    pub_errors:         ["rate<0.01"],
    http_req_failed:    ["rate<0.01"],
  },
};

const BASE = "https://tbt-backend-464464507912.asia-south1.run.app/api/pub";

export default function () {
  // Bootstrap calls — every user web page load fires all three in parallel
  const responses = http.batch([
    { method: "GET", url: `${BASE}/config/site` },
    { method: "GET", url: `${BASE}/config/nav` },
    { method: "GET", url: `${BASE}/config/ui-strings` },
  ]);

  for (const res of responses) {
    latency.add(res.timings.duration);
    const ok = check(res, {
      "status 200": (r) => r.status === 200,
      "has success": (r) => {
        try { return JSON.parse(r.body)?.success === true; } catch { return false; }
      },
    });
    if (!ok) errors.add(1);
  }

  sleep(1);
}
