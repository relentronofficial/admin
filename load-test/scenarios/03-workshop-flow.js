/**
 * Scenario 03 — Workshop detail + flow + challenges + video progress
 * Simulates the heaviest user journey: opening a workshop and watching episodes.
 * Run: k6 run --env TOKEN=$(cat token.txt) --env SLUG=zero-rupee-marketing scenarios/03-workshop-flow.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency = new Trend("workshop_latency", true);
const errors  = new Rate("workshop_errors");

export const options = {
  stages: [
    { duration: "30s", target: 50  },
    { duration: "1m",  target: 200 },
    { duration: "3m",  target: 500 },
    { duration: "1m",  target: 0   },
  ],
  thresholds: {
    workshop_latency: ["p(95)<3000"],
    workshop_errors:  ["rate<0.02"],
    http_req_failed:  ["rate<0.02"],
  },
};

const BASE  = "https://tbt-backend-464464507912.asia-south1.run.app/api/user";
const TOKEN = __ENV.TOKEN;
const SLUG  = __ENV.SLUG || "zero-rupee-marketing";

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
}

function track(res, label) {
  latency.add(res.timings.duration);
  const ok = check(res, {
    [`${label} 200`]: (r) => r.status === 200,
  });
  if (!ok) errors.add(1);
  return res;
}

export default function () {
  const h = headers();

  // Workshop page load — fires 4 requests in parallel
  const batch = http.batch([
    { method: "GET", url: `${BASE}/workshops/${SLUG}/detail`,     params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${SLUG}/flow`,       params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${SLUG}/challenges`, params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${SLUG}/overview`,   params: { headers: h } },
  ]);
  track(batch[0], "workshop detail");
  track(batch[1], "workshop flow");
  track(batch[2], "workshop challenges");
  track(batch[3], "workshop overview");

  sleep(2);

  // Q&A + assignments tab
  const batch2 = http.batch([
    { method: "GET", url: `${BASE}/workshops/${SLUG}/qa`,          params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${SLUG}/assignments`,  params: { headers: h } },
  ]);
  track(batch2[0], "workshop qa");
  track(batch2[1], "workshop assignments");

  sleep(1);

  // Simulate video playback: get playback token, then POST progress every 30s (2 ticks here)
  // Use a fake episode ID — will 404 gracefully but still hits DB auth layer
  const epId = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
  const playback = http.get(`${BASE}/episodes/${epId}/playback`, { headers: h });
  latency.add(playback.timings.duration);
  // 404 is expected for fake ID — just checking the auth + routing layer
  check(playback, { "playback responded": (r) => r.status !== 500 });

  // POST progress (realistic 30s-interval write load)
  const prog = http.post(
    `${BASE}/episodes/${epId}/progress`,
    JSON.stringify({ watchedSeconds: 30, isCompleted: false }),
    { headers: h }
  );
  latency.add(prog.timings.duration);
  check(prog, { "progress responded": (r) => r.status !== 500 });

  sleep(3);
}
