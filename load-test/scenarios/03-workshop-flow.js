/**
 * Scenario 03 — Workshop detail + flow + challenges + video progress
 * Simulates the heaviest user journey: opening a workshop and watching episodes.
 *
 * Workshop slugs are discovered dynamically at test start — no hardcoded slug needed.
 * Run: k6 run --env TOKEN=$(cat token.txt) scenarios/03-workshop-flow.js
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

export function setup() {
  // Warm Cloud Run
  for (let i = 0; i < 10; i++) {
    const r = http.get("https://tbt-backend-464464507912.asia-south1.run.app/health");
    if (r.status === 200) break;
  }

  // Fetch all active workshop slugs dynamically
  const res = http.get(`${BASE}/workshops`, { headers: headers() });
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
  const slug = slugs[Math.floor(Math.random() * slugs.length)];
  const h = headers();

  // Workshop page load — fires 4 requests in parallel
  const batch = http.batch([
    { method: "GET", url: `${BASE}/workshops/${slug}/detail`,     params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${slug}/flow`,       params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${slug}/challenges`, params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${slug}/overview`,   params: { headers: h } },
  ]);
  track(batch[0], "workshop detail");
  track(batch[1], "workshop flow");
  track(batch[2], "workshop challenges");
  track(batch[3], "workshop overview");

  sleep(2);

  // Q&A + assignments tab
  const batch2 = http.batch([
    { method: "GET", url: `${BASE}/workshops/${slug}/qa`,          params: { headers: h } },
    { method: "GET", url: `${BASE}/workshops/${slug}/assignments`,  params: { headers: h } },
  ]);
  track(batch2[0], "workshop qa");
  track(batch2[1], "workshop assignments");

  sleep(1);

  // Simulate video playback: get playback token, then POST progress
  // Use a fake episode ID — will 404 gracefully but still hits DB auth layer
  const epId = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
  const playback = http.get(`${BASE}/episodes/${epId}/playback`, { headers: h });
  latency.add(playback.timings.duration);
  check(playback, { "playback responded": (r) => r.status !== 500 });

  const prog = http.post(
    `${BASE}/episodes/${epId}/progress`,
    JSON.stringify({ watchedSeconds: 30, isCompleted: false }),
    { headers: h }
  );
  latency.add(prog.timings.duration);
  check(prog, { "progress responded": (r) => r.status !== 500 });

  sleep(3);
}
