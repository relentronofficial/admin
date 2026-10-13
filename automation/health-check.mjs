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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_DIR = join(ROOT, '.claude', 'devops');
const LOG_FILE = join(LOG_DIR, 'health.jsonl');

const SERVICES = [
  {
    name: 'backend-prod',
    url: 'https://tbt-backend-464464507912.asia-south1.run.app/api/pub/config/site',
    critical: true,
  },
  {
    name: 'backend-staging',
    url: 'https://tbt-backend-staging-nt77kcmmiq-el.a.run.app/api/pub/config/site',
    critical: false,
  },
  {
    name: 'user-web',
    url: 'https://app.tamilbusinesstribe.com',
    critical: true,
  },
  {
    name: 'admin-panel',
    url: 'https://v0-tbt-ott-admin.vercel.app',
    critical: true,
  },
];

async function checkService(service) {
  const start = Date.now();
  try {
    const res = await fetch(service.url, { signal: AbortSignal.timeout(8000) });
    return {
      name: service.name,
      status: res.ok ? 'up' : 'degraded',
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
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});
