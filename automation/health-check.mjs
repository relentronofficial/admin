#!/usr/bin/env node
/**
 * TBT Health Monitor
 * Checks all three services and logs results.
 * Run: node automation/health-check.mjs
 * Or scheduled via Windows Task Scheduler / CronCreate.
 */
import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { notify } from './notify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_DIR = join(ROOT, '.claude', 'devops');
const LOG_FILE = join(LOG_DIR, 'health.jsonl');

const SERVICES = [
  {
    name: 'backend-prod',
    url: 'https://tbt-backend-464464507912.asia-south1.run.app/api/pub/config/site',
    critical: true,
    timeoutMs: 8000,
    // Any 2xx = up
    okStatuses: null,
  },
  {
    name: 'backend-staging',
    url: 'https://tbt-backend-staging-nt77kcmmiq-el.a.run.app/api/pub/config/site',
    critical: false,
    // Cloud Run staging cold-starts can take 15–20s
    timeoutMs: 20000,
    okStatuses: null,
  },
  {
    name: 'user-web',
    url: 'https://app.tamilbusinesstribe.com',
    critical: true,
    timeoutMs: 8000,
    // Cloud Run load balancer may issue a 301/302 redirect (e.g. trailing-slash
    // normalisation). Any response means the service is serving traffic.
    okStatuses: [200, 301, 302, 307, 308],
  },
  {
    name: 'admin-panel',
    // Clerk-protected — unauthenticated requests get 302→Clerk sign-in.
    // Any response (including 3xx/4xx) means Vercel is serving the app.
    url: 'https://v0-tbt-ott-admin.vercel.app',
    critical: true,
    timeoutMs: 8000,
    // 200, 302, 401, 403, 404 all mean "server is up"
    okStatuses: [200, 302, 401, 403, 404],
  },
];

async function checkService(service) {
  const start = Date.now();
  try {
    const res = await fetch(service.url, {
      signal: AbortSignal.timeout(service.timeoutMs ?? 8000),
      redirect: 'manual', // don't follow redirects — a redirect IS a response
    });
    const ok = service.okStatuses
      ? service.okStatuses.includes(res.status)
      : res.ok;
    return {
      name: service.name,
      status: ok ? 'up' : 'degraded',
      httpStatus: res.status,
      latencyMs: Date.now() - start,
      critical: service.critical,
    };
  } catch (err) {
    return {
      name: service.name,
      status: 'down',
      error: err.message,
      latencyMs: Date.now() - start,
      critical: service.critical,
    };
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] TBT Health Check`);
  console.log('─'.repeat(60));

  const results = await Promise.all(SERVICES.map(checkService));

  const allOk = results.every(r => r.status === 'up');
  const criticalDown = results.filter(r => r.critical && r.status === 'down');

  for (const r of results) {
    const icon = r.status === 'up' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌';
    const latency = r.latencyMs ? ` ${r.latencyMs}ms` : '';
    console.log(`${icon} ${r.name.padEnd(20)} ${r.status.padEnd(10)}${latency}`);
    if (r.error) console.log(`   └─ ${r.error}`);
  }

  console.log('─'.repeat(60));
  console.log(allOk ? '✅ All services healthy' : `❌ ${criticalDown.length} critical service(s) down`);

  // Persist to log
  const entry = {
    ts: new Date().toISOString(),
    summary: allOk ? 'healthy' : criticalDown.length > 0 ? 'critical' : 'degraded',
    results,
  };
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  // Exit with non-zero if critical services are down (useful for scheduled tasks)
  if (criticalDown.length > 0) {
    console.error('\n❌ CRITICAL: Services down:', criticalDown.map(r => r.name).join(', '));
    await notify(
      `🚨 *TBT Critical Alert*\n\n${criticalDown.length} service(s) DOWN:\n${criticalDown.map(r => `• ${r.name}${r.error ? ` — ${r.error.slice(0, 80)}` : ''}`).join('\n')}\n\n_${new Date().toISOString()}_`,
      'MarkdownV2'
    ).catch(() => {});
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});
