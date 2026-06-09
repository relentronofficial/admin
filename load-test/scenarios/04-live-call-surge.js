/**
 * Scenario 04 — Live call join surge
 * Simulates 500 members all clicking "Join" within a short window (meeting start spike).
 * Run: k6 run --env TOKEN=$(cat token.txt) --env LC_ID=<live_call_id> scenarios/04-live-call-surge.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const latency  = new Trend("join_latency", true);
const errors   = new Rate("join_errors");
const joins    = new Counter("join_attempts");

export const options = {
  // Spike: everyone tries to join at once
  scenarios: {
    join_spike: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 600,
      stages: [
        { duration: "10s", target: 50  },  // 50 joins/s
        { duration: "20s", target: 200 },  // peak surge
        { duration: "30s", target: 50  },  // taper
        { duration: "30s", target: 0   },
      ],
    },
  },
  thresholds: {
    join_latency:    ["p(95)<5000"],   // join token gen is heavy (LiveKit API call)
    join_errors:     ["rate<0.05"],    // allow 5% — waiting room returns non-200
    http_req_failed: ["rate<0.05"],
  },
};

const BASE   = "https://tbt-backend-464464507912.asia-south1.run.app/api/user";
const TOKEN  = __ENV.TOKEN;
const LC_ID  = __ENV.LC_ID || "placeholder-live-call-id";

export default function () {
  const res = http.post(
    `${BASE}/workshop/live-calls/${LC_ID}/token`,
    null,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );

  latency.add(res.timings.duration);
  joins.add(1);

  const ok = check(res, {
    "join succeeded or waiting": (r) => [200, 202, 403, 404].includes(r.status),
    "not 500": (r) => r.status !== 500,
  });
  if (!ok) errors.add(1);

  sleep(1);
}
