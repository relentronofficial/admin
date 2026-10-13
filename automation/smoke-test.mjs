#!/usr/bin/env node
/**
 * TBT Post-Deploy Smoke Test
 *
 * Validates that key API endpoints return expected shapes after a deployment.
 * Runs automatically after a production CI/CD deploy via the TBT-SmokeTest
 * Windows scheduled task (or manually: node automation/smoke-test.mjs).
 *
 * Does NOT require auth — only tests public/unauthenticated endpoints.
 * Add authenticated tests only if a test JWT is available via TEST_JWT env var.
 */
import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { notify } from './notify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_DIR = join(ROOT, '.claude', 'devops');
const LOG_FILE = join(LOG_DIR, 'smoke.jsonl');

const BACKEND = 'https://tbt-backend-464464507912.asia-south1.run.app';
const USER_WEB = 'https://app.tamilbusinesstribe.com';
const TIMEOUT_MS = 12000;

const CHECKS = [
  {
    name: 'backend:site-config',
    url: `${BACKEND}/api/pub/config/site`,
    expect: (body) => body?.data?.siteName || body?.siteName,
    description: 'Site config returns siteName',
  },
  {
    name: 'backend:nav-config',
    url: `${BACKEND}/api/pub/config/nav`,
    expect: (body) => Array.isArray(body?.data?.items) || Array.isArray(body?.data) || Array.isArray(body),
    description: 'Nav config returns items array',
  },
  {
    name: 'backend:ui-strings',
    url: `${BACKEND}/api/pub/config/ui-strings`,
    expect: (body) => body?.data !== undefined || body !== undefined,
    description: 'UI strings endpoint responds',
  },
  {
    name: 'user-web:homepage',
    url: USER_WEB,
    statusOk: [200, 301, 302, 307, 308],
    expect: () => true,
    description: 'User web homepage responds',
  },
];

async function runCheck(check) {
  const start = Date.now();
  try {
    const res = await fetch(check.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'manual',
    });

    const latencyMs = Date.now() - start;
    const statusOk = check.statusOk
      ? check.statusOk.includes(res.status)
      : res.ok;

    if (!statusOk) {
      return { name: check.name, pass: false, reason: `HTTP ${res.status}`, latencyMs };
    }

    let body = null;
    if (res.headers.get('content-type')?.includes('application/json')) {
      try { body = await res.json(); } catch {}
    }

    const expectPass = check.expect(body);
    return {
      name: check.name,
      pass: !!expectPass,
      reason: expectPass ? null : `Unexpected response shape`,
      latencyMs,
      httpStatus: res.status,
    };
  } catch (err) {
    return { name: check.name, pass: false, reason: err.message, latencyMs: Date.now() - start };
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] TBT Smoke Test`);
  console.log('─'.repeat(60));

  const results = await Promise.all(CHECKS.map(runCheck));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);

  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(30)} ${r.latencyMs}ms${r.reason ? ` — ${r.reason}` : ''}`);
  }

  console.log('─'.repeat(60));
  console.log(`${passed}/${results.length} checks passed`);

  const entry = {
    ts: new Date().toISOString(),
    passed,
    total: results.length,
    results,
  };

  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  if (failed.length > 0) {
    console.error('\n❌ SMOKE TEST FAILED:', failed.map(r => r.name).join(', '));
    await notify(
      `🧪 *Smoke Test Failed* after deploy\n\n${failed.map(r => `• ${r.name}: ${r.reason ?? 'unexpected shape'}`).join('\n')}\n\n_${new Date().toISOString()}_`,
      'MarkdownV2'
    ).catch(() => {});
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed.');
    await notify(
      `✅ *Smoke Test Passed* — all ${results.length} checks healthy after deploy\\.\n\n_${new Date().toISOString()}_`,
      'MarkdownV2'
    ).catch(() => {});
  }
}

main().catch(err => {
  console.error('Smoke test error:', err.message);
  process.exit(1);
});
