// Import the former standalone Psychometric platform (MongoDB) into TBT's psy_* tables.
// Rules and row mapping: src/lib/psychometric/mongoImport.ts.
//
// Usage (from tbt-admin/backend):
//   npx tsx scripts/psychometric-import.ts --mongo-env E:/psyhcometric/app/.env
//       dry run: reads Mongo only, prints what would be imported and every problem found
//   ... --check-target [--target-env .env]
//       also reads the target Postgres (DIRECT_URL) and checks for clashes; writes nothing
//   ... --apply --target-host <db host> [--target-env .env]
//       writes, in one transaction, after the same checks; refuses if any blocker is found
//   ... --results-only
//       leaves content (types, questions, sets, codes, settings, matrix, audio) untouched;
//       for re-runs after the first import, once content is edited in TBT only
//
// Mongo is only ever read (find / listCollections). MONGO_URI is read from the
// given .env file and never printed. The Mongo driver is loaded from the old
// app's own install (next to that .env), so TBT doesn't depend on it.
// A JSON report (counts + issues by record id, no personal data) is written to
// --report (default ./psychometric-import-report.json).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';
import {
  MONGO_COLLECTIONS, MONGO_PROJECTIONS, TABLES, buildImportPlan, normalize, rowKey, summarizeIssues, uniqueCollisions, upsertStatements,
  type Doc, type Issue, type Row, type Snapshot, type SourceName,
} from '../src/lib/psychometric/mongoImport.js';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };

const mongoEnvPath = opt('mongo-env');
if (!mongoEnvPath) { console.error('usage: tsx scripts/psychometric-import.ts --mongo-env <old app .env> [--check-target | --apply --target-host <host>] [--results-only]'); process.exit(2); }
const apply = flag('apply');
const checkTarget = apply || flag('check-target');
const resultsOnly = flag('results-only');
const reportPath = resolve(opt('report') ?? 'psychometric-import-report.json');

const secrets: string[] = [];
/** Error text with every connection string (and its password) removed. */
const redact = (msg: string) => secrets.reduce((m, s) => (s ? m.split(s).join('<redacted>') : m), msg);
const die = (msg: string): never => { console.error(redact(msg)); process.exit(1); };

function readEnvValue(path: string, key: string) {
  const v = parseEnv(readFileSync(path, 'utf8'))[key];
  if (!v) die(`${key} is not set in ${path}`);
  secrets.push(v!);
  try { const u = new URL(v!); if (u.password) secrets.push(u.password, decodeURIComponent(u.password)); } catch { /* not a URL */ }
  return v!;
}

async function readMongo(): Promise<Snapshot> {
  const uri = readEnvValue(mongoEnvPath!, 'MONGO_URI');
  const req = createRequire(resolve(opt('mongodb-from') ?? dirname(resolve(mongoEnvPath!)), 'package.json'));
  const { MongoClient } = req('mongodb');
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred', appName: 'tbt-psychometric-import' });
  try {
    await client.connect();
    const db = client.db();
    const present = new Set<string>((await db.listCollections({}, { nameOnly: true }).toArray()).map((c: { name: string }) => c.name));
    const known = new Set<string>(Object.values(MONGO_COLLECTIONS));
    const unknown = [...present].filter((n) => !known.has(n) && !n.startsWith('system.'));
    if (unknown.length) console.log(`Note: collections not imported (not part of the platform's models): ${unknown.join(', ')}`);
    const snap = {} as Snapshot;
    for (const [name, coll] of Object.entries(MONGO_COLLECTIONS) as [SourceName, string][]) {
      if (!present.has(coll)) { console.log(`Note: collection "${coll}" does not exist; treated as empty`); snap[name] = []; continue; }
      const docs = await db.collection(coll).find({}, { projection: MONGO_PROJECTIONS[name] }).toArray();
      snap[name] = docs.map((d: unknown) => normalize(d) as Doc);
    }
    return snap;
  } catch (e) {
    return die(`Reading MongoDB failed: ${(e as Error).message}`);
  } finally {
    await client.close().catch(() => {});
  }
}

function printTable(head: string[], body: (string | number)[][]) {
  const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => String(r[i]).length)));
  const line = (r: (string | number)[]) => r.map((c, i) => (i ? String(c).padStart(w[i]) : String(c).padEnd(w[i]))).join('  ');
  console.log(line(head));
  for (const r of body) console.log(line(r));
}

async function main() {
  console.log(`Psychometric import — ${apply ? 'APPLY' : checkTarget ? 'dry run + target check' : 'dry run (Mongo only)'}${resultsOnly ? ', results only' : ''}`);
  const snap = await readMongo();
  const plan = buildImportPlan(snap);
  const tables = TABLES.filter((t) => !(resultsOnly && t.content));
  const issues: Issue[] = [...plan.issues];

  let prisma: PrismaClient | null = null;
  let targetHost = '';
  if (checkTarget) {
    const envPath = resolve(opt('target-env') ?? '.env');
    const url = process.env.PSY_IMPORT_DATABASE_URL ? (secrets.push(process.env.PSY_IMPORT_DATABASE_URL), process.env.PSY_IMPORT_DATABASE_URL) : readEnvValue(envPath, 'DIRECT_URL');
    try { const u = new URL(url); targetHost = u.hostname; if (u.password) secrets.push(u.password, decodeURIComponent(u.password)); } catch { die('Target database URL is not a valid URL'); }
    console.log(`Target database host: ${targetHost}`);
    if (apply && opt('target-host') !== targetHost) die(`--apply needs --target-host ${targetHost} (the host of the target database) to confirm where it writes.`);
    prisma = new PrismaClient({ datasources: { db: { url } } });

    const q = <T = Row>(sql: string, ...p: unknown[]) => prisma!.$queryRawUnsafe<T[]>(sql, ...p);
    const missing: string[] = [];
    for (const t of TABLES) { const [r] = await q<{ ok: string | null }>(`SELECT to_regclass($1)::text AS ok`, t.table); if (!r?.ok) missing.push(t.table); }
    if (missing.length) die(`The target has no ${missing.join(', ')} — deploy the backend with the psychometric-platform module first (its startup creates them).`);

    for (const t of tables) {
      const cols = [...new Set([...t.key, ...(t.unique ?? []).flat()])];
      const existing = await q(`SELECT ${cols.join(', ')} FROM ${t.table}`);
      issues.push(...uniqueCollisions(t, plan.rows[t.table], existing));
    }
    if (resultsOnly) {
      // Content stays as it is in TBT: a candidate whose access code isn't there keeps the code text only.
      const codeIds = new Set((await q<{ id: string }>(`SELECT id FROM psy_access_codes`)).map((r) => r.id));
      for (const c of plan.rows.psy_candidates) {
        if (c.access_code_id && !codeIds.has(String(c.access_code_id))) {
          issues.push({ level: 'warning', table: 'psy_candidates', id: String(c.id), message: `access code ${c.access_code_id} is not in TBT; candidate kept with its code text only` });
          c.access_code_id = null;
        }
      }
    }
  }

  // ── summary ────────────────────────────────────────────────────────────────
  console.log('');
  printTable(['table', 'rows', 'left out'], TABLES.map((t) => [
    t.table + (resultsOnly && t.content ? ' (not written)' : ''), plan.rows[t.table].length, plan.skipped[t.table] ?? 0,
  ]));
  const groups = summarizeIssues(issues);
  const blockers = issues.filter((i) => i.level === 'blocker').length;
  console.log(`\nIssues: ${blockers} blocker(s), ${issues.filter((i) => i.level === 'warning').length} warning(s), ${issues.filter((i) => i.level === 'info').length} info`);
  for (const g of groups) console.log(`  [${g.level}] ${g.table}: ${g.message} ×${g.count}  e.g. ${g.ids.join(', ')}`);

  const report: Record<string, unknown> = {
    at: new Date().toISOString(), mode: apply ? 'apply' : checkTarget ? 'check-target' : 'dry-run', resultsOnly, targetHost: targetHost || null,
    counts: Object.fromEntries(TABLES.map((t) => [t.table, { rows: plan.rows[t.table].length, leftOut: plan.skipped[t.table] ?? 0, written: !(resultsOnly && t.content) }])),
    issues,
  };
  const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (!apply) { save(); console.log(`\nNothing written. Report: ${reportPath}`); await prisma?.$disconnect(); return; }
  if (blockers) { save(); await prisma?.$disconnect(); die(`\n${blockers} blocker(s): nothing written. Report: ${reportPath}`); }

  // ── apply ──────────────────────────────────────────────────────────────────
  const started = Date.now();
  await prisma!.$transaction(async (tx) => {
    // Orders may have been swapped since an earlier run; park this import's live
    // rows far above any real order (negative orders are deleted-question
    // sentinels) so each upsert can't collide with a not-yet-updated row.
    for (const table of ['psy_question_types', 'psy_questions']) {
      if (tables.some((t) => t.table === table)) {
        await tx.$executeRawUnsafe(`UPDATE ${table} SET sort_order = sort_order + 1000000000 WHERE id = ANY($1::text[]) AND sort_order BETWEEN 1 AND 999999999`,
          plan.rows[table].map((r) => String(r.id)));
      }
    }
    for (const t of tables) {
      const size = t.cols.some(([, type]) => type === 'bytea') ? 10 : 200;
      for (const s of upsertStatements(t, plan.rows[t.table], size)) await tx.$executeRawUnsafe(s.sql, ...s.params);
      console.log(`  wrote ${t.table}: ${plan.rows[t.table].length}`);
    }
  }, { maxWait: 30_000, timeout: 15 * 60_000 });
  console.log(`Committed in ${((Date.now() - started) / 1000).toFixed(1)} s. Verifying…`);

  // ── verify: every row written is there ────────────────────────────────────
  const verify: Record<string, { expected: number; found: number }> = {};
  let bad = 0;
  for (const t of tables) {
    const keys = plan.rows[t.table].map((r) => rowKey(t, r));
    const [r] = await prisma!.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM ${t.table} WHERE concat_ws('|', ${t.key.join(', ')}) = ANY($1::text[])`, keys);
    verify[t.table] = { expected: keys.length, found: r.n };
    if (r.n !== keys.length) bad++;
  }
  printTable(['table', 'expected', 'found'], Object.entries(verify).map(([k, v]) => [k, v.expected, v.found]));
  report.verify = verify;
  save();
  await prisma!.$disconnect();
  if (bad) die(`\nVerification FAILED for ${bad} table(s). Report: ${reportPath}`);
  console.log(`\nImport complete and verified. Report: ${reportPath}`);
}

main().catch((e) => die(`Import failed: ${(e as Error).stack ?? e}`));
