// CI schema guard — see src/lib/schemaGuardLogic.ts for the rules.
//
// Usage (from tbt-admin/backend):
//   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script > schema-diff.sql
//   npx tsx scripts/schema-guard.ts schema-diff.sql schema-apply.sql
//   # exit 0 → schema-apply.sql holds only additive SQL in one transaction (may be empty)
//   # exit 1 → destructive / unreviewed changes found; nothing must be applied
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractStartupManagedObjects, guardSchemaDiff, buildApplyScript } from '../src/lib/schemaGuardLogic.js';

const [diffPath, outPath] = process.argv.slice(2);
if (!diffPath || !outPath) {
  console.error('usage: tsx scripts/schema-guard.ts <diff.sql> <apply.sql>');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const startupSource = readFileSync(resolve(here, '../src/plugins/prisma.ts'), 'utf8');
const managed = extractStartupManagedObjects(startupSource);
const result = guardSchemaDiff(readFileSync(diffPath, 'utf8'), managed);

const count = (m: Map<string, Set<string>>) => [...m.values()].reduce((n, s) => n + s.size, 0);
console.log(`Startup-managed objects: ${managed.tables.size} tables, ${count(managed.columns)} columns, ${managed.indexes.size} indexes, ${managed.sequences.size} sequences, ${count(managed.defaults)} column defaults, ${count(managed.nullables)} nullable overrides`);
console.log(`Additive statements to apply: ${result.apply.length}`);
for (const s of result.apply) console.log(`  + ${s.replace(/\s+/g, ' ')}`);
console.log(`Destructive statements skipped (startup-managed objects kept): ${result.skipped.length}`);

if (result.blocked.length) {
  writeFileSync(outPath, '');
  console.error(`\n::error::Schema guard BLOCKED ${result.blocked.length} destructive or unreviewed statement(s). Nothing was applied.`);
  for (const s of result.blocked) console.error(`  ✗ ${s.replace(/\s+/g, ' ')}`);
  console.error('\nThese would drop or rewrite existing data/structure. Ship them only as a reviewed migration with an approved data-preservation plan.');
  process.exit(1);
}

writeFileSync(outPath, buildApplyScript(result.apply));
console.log(result.apply.length ? `\nWrote ${outPath} (single transaction).` : '\nNo schema changes to apply.');
