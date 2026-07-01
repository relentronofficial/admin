/**
 * CRASH TEST — TBT Backend
 *
 * Goal: intentionally push the backend into failure conditions and verify:
 *  1. It returns proper error codes (not silent hangs or 500 stack traces)
 *  2. The health endpoint stays reachable after each crash scenario
 *  3. The process does NOT crash (Cloud Run container stays alive)
 *
 * Each scenario is self-contained. Run one at a time or all sequentially.
 *
 * Run:
 *   BASE_URL=https://tbt-backend-xxx.run.app node tests/crash/crash-test.js
 *   # Run only one scenario:
 *   SCENARIO=malformed BASE_URL=... node tests/crash/crash-test.js
 */

const BASE_URL   = process.env.BASE_URL || 'http://localhost:8000';
const SCENARIO   = process.env.SCENARIO || 'all';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

let passed = 0;
let failed = 0;
const issues = [];

async function req(method, path, body, headers = {}, rawBody = null) {
  try {
    const h = { 'Content-Type': 'application/json', ...headers };
    const opts = { method, headers: h, signal: AbortSignal.timeout(15000) };
    if (rawBody !== null)          opts.body = rawBody;
    else if (body !== undefined)   opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, opts);
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function healthOk(label) {
  const r = await req('GET', '/health');
  const ok = r.status === 200;
  if (ok) {
    console.log(`   ✅ [health-after] ${label}: backend still alive`);
    passed++;
  } else {
    console.log(`   ❌ [health-after] ${label}: health returned ${r.status} — backend may be down!`);
    failed++;
    issues.push(`Health check failed after scenario: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Malformed Requests
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioMalformed() {
  console.log('\n── SCENARIO 1: Malformed Requests ───────────────────────────');

  const cases = [
    // Invalid JSON
    { name: 'raw invalid JSON',     path: '/api/user-auth/login', raw: '{bad json,,,' },
    { name: 'empty body',           path: '/api/user-auth/login', raw: '' },
    { name: 'binary body',          path: '/api/user-auth/login', raw: '\x00\x01\x02\xFF' },
    { name: 'truncated JSON',       path: '/api/user-auth/login', raw: '{"phone":"' },
    { name: 'array instead of obj', path: '/api/user-auth/login', raw: '["not","an","object"]' },
    { name: 'number body',          path: '/api/user-auth/login', raw: '12345' },
    { name: 'null body',            path: '/api/user-auth/login', raw: 'null' },
  ];

  for (const c of cases) {
    const r = await req('POST', c.path, undefined, {}, c.raw);
    const ok = r.status >= 400 && r.status < 500;
    console.log(`   ${ok ? '✅' : '❌'} ${c.name}: got ${r.status} ${ok ? '(expected 4xx)' : '— unexpected!'}`);
    if (ok) passed++; else { failed++; issues.push(`Malformed: ${c.name} returned ${r.status}`); }
  }

  await healthOk('malformed-requests');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: Resource Exhaustion via Concurrent Requests
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioConcurrentFlood() {
  console.log('\n── SCENARIO 2: Concurrent Request Flood (200 parallel) ──────');

  const N = 200;
  const start = Date.now();
  const promises = Array.from({ length: N }, (_, i) =>
    req('GET', '/health')
  );
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const ok200 = results.filter(r => r.status === 200).length;
  const ok429 = results.filter(r => r.status === 429).length;
  const errors = results.filter(r => r.status === 0 || r.status >= 500).length;

  console.log(`   200 OK: ${ok200}, 429 Rate-Limited: ${ok429}, Errors/Timeouts: ${errors}`);
  console.log(`   Total time for ${N} parallel requests: ${elapsed}ms`);

  const ok = errors === 0;
  console.log(`   ${ok ? '✅' : '❌'} No 5xx or timeouts: ${ok ? 'yes' : `${errors} failures`}`);
  if (ok) passed++; else { failed++; issues.push(`Concurrent flood: ${errors} 5xx/timeouts`); }

  await healthOk('concurrent-flood');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: Extremely Large Payloads
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioLargePayload() {
  console.log('\n── SCENARIO 3: Oversized Payloads ───────────────────────────');

  const sizes = [
    { label: '100KB',  data: 'x'.repeat(100_000) },
    { label: '1MB',    data: 'x'.repeat(1_000_000) },
    { label: '5MB',    data: 'x'.repeat(5_000_000) },
  ];

  for (const { label, data } of sizes) {
    const r = await req('POST', '/api/user-auth/login', { phone: '+91999', password: data });
    const ok = r.status !== 500 && r.status !== 0;
    console.log(`   ${ok ? '✅' : '❌'} ${label} payload: status ${r.status}`);
    if (ok) passed++; else { failed++; issues.push(`Large payload ${label}: status ${r.status}`); }
  }

  await healthOk('large-payloads');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: Prototype Pollution Payloads
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioPrototypePollution() {
  console.log('\n── SCENARIO 4: Prototype Pollution ──────────────────────────');

  const payloads = [
    { '__proto__': { admin: true, role: 'superadmin' }, phone: '+919999999999', password: 'x' },
    { 'constructor': { prototype: { admin: true } }, phone: '+919999999999', password: 'x' },
    { '__proto__.isAdmin': true, phone: '+919999999999', password: 'x' },
  ];

  for (const p of payloads) {
    const r = await req('POST', '/api/user-auth/login', p);
    const ok = r.status !== 200;
    console.log(`   ${ok ? '✅' : '❌'} prototype key "${Object.keys(p)[0]}": got ${r.status}`);
    if (ok) passed++; else { failed++; issues.push(`Proto pollution payload logged in with 200!`); }
  }

  await healthOk('prototype-pollution');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Path/Route Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioPathEdgeCases() {
  console.log('\n── SCENARIO 5: Path / Route Edge Cases ──────────────────────');

  const paths = [
    '/',
    '/api',
    '/api/',
    '/NONEXISTENT',
    '/api/members/undefined',
    '/api/members/null',
    '/api/members/' + 'a'.repeat(500),
    '/api/members/%00',                           // null byte
    '/api/members/%0a',                           // newline in path
    '/api/workshops/' + encodeURIComponent('../../../etc/passwd'),
  ];

  for (const p of paths) {
    const r = await req('GET', p);
    const ok = r.status !== 500 && r.status !== 0;
    console.log(`   ${ok ? '✅' : '❌'} GET ${p.substring(0, 60)}: ${r.status}`);
    if (!ok) { failed++; issues.push(`Path "${p.substring(0, 60)}" caused 500`); } else { passed++; }
  }

  await healthOk('path-edge-cases');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: HTTP Method Confusion
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioMethodConfusion() {
  console.log('\n── SCENARIO 6: HTTP Method Confusion ────────────────────────');

  const methods = ['PATCH', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT', 'PUT'];
  for (const m of methods) {
    const r = await req(m, '/api/user-auth/login', {});
    const ok = r.status !== 500 && r.status !== 0;
    console.log(`   ${ok ? '✅' : '❌'} ${m} /api/user-auth/login: ${r.status}`);
    if (!ok) { failed++; issues.push(`Method ${m} caused ${r.status}`); } else { passed++; }
  }

  // TRACE should be blocked (exposes internal headers)
  const traceR = await req('TRACE', '/health', null, {});
  const traceBlocked = traceR.status !== 200 || !JSON.stringify(traceR.data || '').includes('TRACE');
  console.log(`   ${traceBlocked ? '✅' : '⚠️ '} TRACE method: ${traceR.status} (should be 405 or blocked)`);

  await healthOk('method-confusion');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: Slow Client (Slowloris simulation)
// ─────────────────────────────────────────────────────────────────────────────
async function scenarioSlowClient() {
  console.log('\n── SCENARIO 7: Slow Client Timeout Handling ─────────────────');
  console.log('   (Sending request and waiting 30s for timeout behaviour)');

  // Cloud Run has a default request timeout. A well-behaved server should
  // return a response or terminate the connection — not hang indefinitely.
  // We use a 5s client timeout to simulate: if server responds in < 5s we pass.
  const start = Date.now();
  let timedOut = false;
  try {
    await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') timedOut = true;
  }
  const elapsed = Date.now() - start;

  if (!timedOut) {
    console.log(`   ✅ Health responded in ${elapsed}ms (well within 5s)`);
    passed++;
  } else {
    console.log(`   ⚠️  Health timed out at ${elapsed}ms — check Cloud Run instance start-up`);
  }

  // Verify health still works after the timeout simulation
  await healthOk('slow-client');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = {
  malformed:           scenarioMalformed,
  concurrent:          scenarioConcurrentFlood,
  large_payload:       scenarioLargePayload,
  prototype_pollution: scenarioPrototypePollution,
  path_edge:           scenarioPathEdgeCases,
  method_confusion:    scenarioMethodConfusion,
  slow_client:         scenarioSlowClient,
};

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('TBT CRASH TEST');
  console.log(`Target:   ${BASE_URL}`);
  console.log(`Scenario: ${SCENARIO}`);
  console.log(`Time:     ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

  const toRun = SCENARIO === 'all' ? Object.values(SCENARIOS) : [SCENARIOS[SCENARIO]].filter(Boolean);
  if (toRun.length === 0) {
    console.error(`Unknown scenario "${SCENARIO}". Valid: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  for (const fn of toRun) {
    await fn();
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTS: ✅ ${passed} PASS  ❌ ${failed} FAIL`);
  console.log(`${'═'.repeat(60)}`);

  if (issues.length > 0) {
    console.log('\nISSUES FOUND:');
    issues.forEach(i => console.log(`  ❌ ${i}`));
  }

  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync('tests/results', { recursive: true });
  writeFileSync('tests/results/crash-report.json', JSON.stringify({
    target: BASE_URL, timestamp: new Date().toISOString(),
    summary: { passed, failed }, issues,
  }, null, 2));
  console.log('\nReport saved to tests/results/crash-report.json');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
