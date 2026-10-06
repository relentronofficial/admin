// Deploy-time schema guard (pure — no Prisma, no I/O; unit-tested in
// schemaGuardLogic.test.ts, CLI wrapper in scripts/schema-guard.ts).
//
// Why this exists: CI used to run `prisma db push --accept-data-loss` against
// production. Many tables/columns/indexes are created by the startup DDL in
// src/plugins/prisma.ts and are NOT in schema.prisma, so every deploy dropped
// them (and their data); startup then recreated them empty.
//
// Contract: CI produces the read-only diff
//   prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script
// and passes it here. Only additive statements are allowed through. Drops of
// objects the startup DDL owns are skipped (kept). Anything else — drops of
// Prisma-owned objects, column type changes, renames, enum rewrites, unknown
// statements — blocks the deploy for human review.

export interface StartupManagedObjects {
  tables: Set<string>;
  columns: Map<string, Set<string>>; // table -> columns added via ADD COLUMN IF NOT EXISTS
  indexes: Set<string>;
  sequences: Set<string>;
  defaults: Map<string, Set<string>>; // table -> columns whose DEFAULT startup sets (ALTER COLUMN … SET DEFAULT)
  nullables: Map<string, Set<string>>; // table -> columns startup made nullable (ALTER COLUMN … DROP NOT NULL)
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(value);
}

export interface SchemaGuardResult {
  /** Statements that are safe to apply (additive only). */
  apply: string[];
  /** Destructive statements skipped because the object is owned by startup DDL. */
  skipped: string[];
  /** Statements that must not run without a reviewed migration. Non-empty → fail the deploy. */
  blocked: string[];
}

const ident = String.raw`"?([A-Za-z_][A-Za-z0-9_]*)"?`;

/** Extract the tables, columns and indexes created by the startup DDL source (src/plugins/prisma.ts). */
export function extractStartupManagedObjects(source: string): StartupManagedObjects {
  const tables = new Set<string>();
  const columns = new Map<string, Set<string>>();
  const indexes = new Set<string>();
  const sequences = new Set<string>();
  const defaults = new Map<string, Set<string>>();
  const nullables = new Map<string, Set<string>>();

  for (const m of source.matchAll(new RegExp(String.raw`CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?${ident}`, 'gi'))) {
    tables.add(m[1]);
  }
  for (const m of source.matchAll(new RegExp(String.raw`INDEX\s+(?:CONCURRENTLY\s+)?IF\s+NOT\s+EXISTS\s+${ident}`, 'gi'))) {
    indexes.add(m[1]);
  }
  for (const m of source.matchAll(new RegExp(String.raw`CREATE\s+SEQUENCE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?${ident}`, 'gi'))) {
    sequences.add(m[1]);
  }
  // ALTER TABLE <t> ... ADD COLUMN IF NOT EXISTS <c>[, ADD COLUMN IF NOT EXISTS <c2> ...]
  // A segment ends at the end of the template literal or the next ALTER/CREATE
  // TABLE (every ADD COLUMN follows its own ALTER TABLE). Quotes and semicolons
  // are NOT terminators — column defaults can contain them.
  const alterRe = new RegExp(String.raw`ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?${ident}([\s\S]*?)(?=\`|ALTER\s+TABLE|CREATE\s+TABLE|$)`, 'gi');
  for (const m of source.matchAll(alterRe)) {
    const table = m[1];
    for (const c of m[2].matchAll(new RegExp(String.raw`ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+${ident}`, 'gi'))) {
      addTo(columns, table, c[1]);
    }
    for (const c of m[2].matchAll(new RegExp(String.raw`ALTER\s+COLUMN\s+${ident}\s+SET\s+DEFAULT\s`, 'gi'))) {
      addTo(defaults, table, c[1]);
    }
    for (const c of m[2].matchAll(new RegExp(String.raw`ALTER\s+COLUMN\s+${ident}\s+DROP\s+NOT\s+NULL`, 'gi'))) {
      addTo(nullables, table, c[1]);
    }
  }
  return { tables, columns, indexes, sequences, defaults, nullables };
}

/** Split a Prisma migrate-diff script into statements (comments dropped). */
export function splitSqlStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/).filter((l) => !/^\s*--/.test(l));
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === "'") inQuote = !inQuote;
      if (ch === ';' && !inQuote) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cur += '\n';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Split the clause list of an ALTER TABLE on top-level commas. */
function splitClauses(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inQuote = false;
  let cur = '';
  for (const ch of body) {
    if (ch === "'") inQuote = !inQuote;
    if (!inQuote && ch === '(') depth++;
    if (!inQuote && ch === ')') depth--;
    if (ch === ',' && depth === 0 && !inQuote) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ADDITIVE_STATEMENT = [
  /^CREATE\s+TABLE\s/i,
  /^CREATE\s+(UNIQUE\s+)?INDEX\s/i,
  /^CREATE\s+TYPE\s/i,
  /^ALTER\s+TYPE\s+\S+\s+ADD\s+VALUE\s/i,
];

const ADDITIVE_CLAUSE = [
  /^ADD\s+COLUMN\s/i,
  /^ADD\s+CONSTRAINT\s+\S+\s+FOREIGN\s+KEY\s/i,
];

export function guardSchemaDiff(diffSql: string, managed: StartupManagedObjects): SchemaGuardResult {
  const result: SchemaGuardResult = { apply: [], skipped: [], blocked: [] };
  const colOwned = (t: string, c: string) => managed.tables.has(t) || !!managed.columns.get(t)?.has(c);

  for (const stmt of splitSqlStatements(diffSql)) {
    const oneLine = stmt.replace(/\s+/g, ' ');

    if (ADDITIVE_STATEMENT.some((re) => re.test(oneLine))) {
      result.apply.push(stmt);
      continue;
    }

    let m = oneLine.match(new RegExp(String.raw`^DROP\s+TABLE\s+${ident}$`, 'i'));
    if (m) {
      (managed.tables.has(m[1]) ? result.skipped : result.blocked).push(stmt);
      continue;
    }

    m = oneLine.match(new RegExp(String.raw`^DROP\s+INDEX\s+${ident}$`, 'i'));
    if (m) {
      (managed.indexes.has(m[1]) ? result.skipped : result.blocked).push(stmt);
      continue;
    }

    m = oneLine.match(new RegExp(String.raw`^DROP\s+SEQUENCE\s+${ident}$`, 'i'));
    if (m) {
      (managed.sequences.has(m[1]) ? result.skipped : result.blocked).push(stmt);
      continue;
    }

    m = oneLine.match(new RegExp(String.raw`^ALTER\s+TABLE\s+${ident}\s+([\s\S]+)$`, 'i'));
    if (m) {
      const table = m[1];
      const keep: string[] = [];
      let blocked = false;
      for (const clause of splitClauses(m[2])) {
        if (ADDITIVE_CLAUSE.some((re) => re.test(clause))) {
          keep.push(clause);
          continue;
        }
        const dropCol = clause.match(new RegExp(String.raw`^DROP\s+COLUMN\s+${ident}$`, 'i'));
        if (dropCol && colOwned(table, dropCol[1])) {
          result.skipped.push(`ALTER TABLE "${table}" ${clause}`);
          continue;
        }
        const dropCon = clause.match(new RegExp(String.raw`^DROP\s+CONSTRAINT\s+${ident}$`, 'i'));
        if (dropCon && constraintOwned(table, dropCon[1], managed)) {
          result.skipped.push(`ALTER TABLE "${table}" ${clause}`);
          continue;
        }
        // Prisma reverting a default / nullability that the startup DDL deliberately set.
        const dropDefault = clause.match(new RegExp(String.raw`^ALTER\s+COLUMN\s+${ident}\s+DROP\s+DEFAULT$`, 'i'));
        if (dropDefault && managed.defaults.get(table)?.has(dropDefault[1])) {
          result.skipped.push(`ALTER TABLE "${table}" ${clause}`);
          continue;
        }
        const setNotNull = clause.match(new RegExp(String.raw`^ALTER\s+COLUMN\s+${ident}\s+SET\s+NOT\s+NULL$`, 'i'));
        if (setNotNull && managed.nullables.get(table)?.has(setNotNull[1])) {
          result.skipped.push(`ALTER TABLE "${table}" ${clause}`);
          continue;
        }
        blocked = true;
        result.blocked.push(`ALTER TABLE "${table}" ${clause}`);
      }
      if (!blocked && keep.length) result.apply.push(`ALTER TABLE "${table}" ${keep.join(',\n')}`);
      continue;
    }

    // Anything else (DROP TYPE, RENAME, BEGIN/COMMIT enum rewrites, DELETE, TRUNCATE, …).
    result.blocked.push(stmt);
  }
  return result;
}

/** Postgres default FK/unique names are <table>_<column>_fkey / _key. */
function constraintOwned(table: string, name: string, managed: StartupManagedObjects): boolean {
  if (managed.tables.has(table)) return true;
  const cols = managed.columns.get(table);
  if (!cols) return false;
  for (const c of cols) {
    if (name === `${table}_${c}_fkey` || name === `${table}_${c}_key`) return true;
  }
  return false;
}

/** The SQL to execute: all additive statements in one transaction (atomic — no partial schema). */
export function buildApplyScript(apply: string[]): string {
  if (!apply.length) return '';
  return ['BEGIN;', ...apply.map((s) => `${s};`), 'COMMIT;', ''].join('\n');
}
