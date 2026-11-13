// Minimal stand-in for the backend, used by verify-user-web-target.test.sh.
// Behaviour comes from env vars so each test case can simulate one situation:
//   LISTEN_DELAY_MS        refuse connections for this long (instance not up yet)
//   HEALTH_STATUSES        comma list of /health statuses, one per request; the
//                          last one repeats (e.g. "503,503,200")
//   HEALTH_FIRST_DELAY_MS  hold the first /health request this long (Cloud Run
//                          queuing a request while the instance starts)
//   CORS_ALLOW_ORIGIN      "echo" = allow the request's Origin, any other value
//                          is sent as-is, empty = no CORS header (denied)
// Writes the chosen port to PORT_FILE as soon as it is reserved.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";

const statuses = (process.env.HEALTH_STATUSES || "200").split(",").map(Number);
const firstDelay = Number(process.env.HEALTH_FIRST_DELAY_MS || 0);
const listenDelay = Number(process.env.LISTEN_DELAY_MS || 0);
const corsAllow = process.env.CORS_ALLOW_ORIGIN ?? "echo";
let healthCount = 0;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    const n = healthCount++;
    const status = statuses[Math.min(n, statuses.length - 1)];
    setTimeout(() => res.writeHead(status).end(), n === 0 ? firstDelay : 0);
    return;
  }
  if (req.method === "OPTIONS") {
    const headers = {};
    if (corsAllow === "echo" && req.headers.origin) headers["Access-Control-Allow-Origin"] = req.headers.origin;
    else if (corsAllow && corsAllow !== "echo") headers["Access-Control-Allow-Origin"] = corsAllow;
    if (headers["Access-Control-Allow-Origin"]) headers["Access-Control-Allow-Credentials"] = "true";
    res.writeHead(204, headers).end();
    return;
  }
  res.writeHead(404).end();
});

// Reserve a free port, publish it, then start listening after LISTEN_DELAY_MS.
const probe = net.createServer().listen(0, "127.0.0.1", () => {
  const { port } = probe.address();
  probe.close(() => {
    fs.writeFileSync(process.env.PORT_FILE, String(port));
    setTimeout(() => server.listen(port, "127.0.0.1"), listenDelay);
  });
});
