import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { unsupportedNumbers } from './answerCheck.js';
import { catalogue, compileQuery, datasets, queryDataTool } from './queryData.js';
import { runTool, toolDefinitions } from './registry.js';

const q = (o: Record<string, unknown>) => compileQuery(o);
const bad = (o: Record<string, unknown>) => expect(() => q(o));

describe('compileQuery', () => {
  it('lists the newest members', () => {
    const c = q({ dataset: 'members', select: ['member', 'joined_at'], order_by: ['joined_at desc'], limit: 5 });
    expect(c.sql).toMatch(/ORDER BY 2 DESC NULLS LAST, 1, 2 LIMIT 5$/);
    expect(c.sql).toContain('m.deleted_at IS NULL');
    expect(c.params).toEqual([]);
  });
  it('orders rows by a column that is not shown', () => {
    expect(q({ dataset: 'members', select: ['member'], order_by: ['joined_at desc'] }).sql).toContain("AT TIME ZONE 'Asia/Kolkata') DESC NULLS LAST");
  });
  it('groups, totals and gives an overall figure', () => {
    const c = q({ dataset: 'revenue', group_by: ['received_at:month'], metrics: ['sum:amount_inr', 'count'], order_by: ['sum:amount_inr desc'] });
    expect(c.sql).toContain(`date_trunc('month'`);
    expect(c.sql).toContain('AS "sum_amount_inr"');
    expect(c.sql).toContain('GROUP BY 1');
    expect(c.sql).toContain('ORDER BY 2 DESC');
    expect(c.overallSql).not.toContain('GROUP BY');
  });
  it('binds every value', () => {
    const c = q({
      dataset: 'members', select: ['member'],
      filters: [
        { field: 'batch', op: '=', value: "x'; DROP TABLE members; --" },
        { field: 'member', op: 'contains', value: '50%_' },
        { field: 'joined_at', op: '>=', value: '2026-11-01' },
        { field: 'courses_enrolled', op: '=', value: 0 },
        { field: 'member_status', op: 'in', value: ['Active', 'paused'] },
        { field: 'onboarding_completed', op: '=', value: false },
        { field: 'city', op: 'is_empty' },
      ],
    });
    expect(c.sql).not.toContain('DROP');
    expect(c.params).toEqual(["x'; drop table members; --", '%50\\%\\_%', '2026-11-01', '0', 'active', 'paused', 'false']);
    expect(c.sql).toContain('::date >= $3::date');
  });
  it('having applies to metrics only and drops the overall row', () => {
    const c = q({ dataset: 'revenue', group_by: ['member_code'], metrics: ['count'], having: [{ field: 'count', op: '>=', value: 2 }] });
    expect(c.sql).toContain('HAVING (COUNT(*)::float8)::numeric >= $1::numeric');
    expect(c.overallSql).toBeNull();
    bad({ dataset: 'revenue', group_by: ['member_code'], metrics: ['count'], having: [{ field: 'source', op: '=', value: 'x' }] }).toThrow(/having/);
  });
  it('refuses anything outside the catalogue', () => {
    bad({ dataset: 'admins', select: ['email'] }).toThrow(/Unknown dataset/);
    bad({ dataset: 'constructor', select: ['x'] }).toThrow(/Unknown dataset/);
    bad({ dataset: 'members', select: ['phone'] }).toThrow(/not a column/);
    bad({ dataset: 'members', select: ['__proto__'] }).toThrow(/not a column/);
    bad({ dataset: 'members', select: ['member'], sql: 'x' }).toThrow(/Unknown key/);
    bad({ dataset: 'members', select: ['member'], order_by: ['1; DROP TABLE x'] }).toThrow();
    bad({ dataset: 'members', select: ['member'], order_by: ['member desc, pg_sleep(9)'] }).toThrow();
    bad({ dataset: 'members', group_by: ["joined_at:month'"] }).toThrow(/Group dates/);
    bad({ dataset: 'members', metrics: ['pg_sleep:member'] }).toThrow(/Unknown metric/);
    bad({ dataset: 'members', select: ['member'], limit: 5000 }).toThrow(/limit/);
    bad({ dataset: 'members', select: ['member'], filters: [{ field: 'member', op: 'OR 1=1', value: 'x' }] }).toThrow(/operator/);
  });
  it('checks value types', () => {
    const f = (field: string, op: string, value: unknown) => bad({ dataset: 'members', select: ['member'], filters: [{ field, op, value }] });
    f('joined_at', '>=', '2026-02-31').toThrow(/real dates/);
    f('courses_enrolled', '>', 'many').toThrow(/number/);
    f('onboarding_completed', '=', 'yes').toThrow(/true or false/);
    f('member', '>', 'a').toThrow(/does not work/);
    f('member_status', 'in', []).toThrow(/list/);
    bad({ dataset: 'members' }).toThrow(/Give "select"/);
    bad({ dataset: 'members', metrics: ['sum:member'] }).toThrow(/number column/);
    bad({ dataset: 'members', select: ['member'], metrics: ['count'] }).toThrow(/either/);
  });
});

describe('catalogue', () => {
  it('never offers private columns', () => {
    const text = Object.values(datasets).flatMap((d) => Object.values(d.columns).map((c) => c.sql)).join(' ');
    expect(text).not.toMatch(/phone|email|password|token|gst|address|pincode|notes|proof|kyc_doc|meeting_url|\.message|journal|dob|clerk|razorpay_(order|payment)_id/i);
  });
  it('uses only tables and columns that exist', () => {
    const schema = readFileSync(new URL('../../../prisma/schema.prisma', import.meta.url), 'utf8');
    const ddl = readFileSync(new URL('../../plugins/prisma.ts', import.meta.url), 'utf8');
    const tables = new Map<string, Set<string>>();
    const add = (table: string, c: string) => tables.set(table, (tables.get(table) ?? new Set()).add(c));
    for (const m of schema.matchAll(/^model \w+ \{([\s\S]*?)^\}/gm)) {
      const table = /@@map\("(\w+)"\)/.exec(m[1])?.[1];
      if (!table) continue;
      for (const line of m[1].split('\n')) {
        const f = /^\s+(\w+)\s+\w/.exec(line);
        if (f) add(table, /@map\("(\w+)"\)/.exec(line)?.[1] ?? f[1]);
      }
    }
    for (const m of ddl.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\s*\)\s*`/g)) {
      for (const line of m[2].split('\n')) { const f = /^\s*(\w+)\s+\w/.exec(line); if (f) add(m[1], f[1]); }
    }
    for (const m of ddl.matchAll(/ALTER TABLE (\w+)([\s\S]*?)`/g)) {
      for (const c of m[2].matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)) add(m[1], c[1]);
    }
    const missing: string[] = [];
    for (const [name, d] of Object.entries(datasets)) {
      const everything = [d.from, d.where ?? '', ...Object.values(d.columns).map((c) => c.sql)];
      const global = new Map<string, string>();
      const aliases = (s: string, into: Map<string, string>) => {
        for (const m of s.matchAll(/(?:FROM|JOIN|^)\s*(\w+) (\w+)/g)) if (tables.has(m[1])) into.set(m[2], m[1]);
        return into;
      };
      aliases(d.from, global);
      for (const sql of everything) {
        const scope = aliases(sql.replace(/^\(+/, ' '), new Map(global));
        for (const m of sql.matchAll(/(?<!')\b([a-z]{1,2})\.(?:"(\w+)"|(\w+))/g)) {
          const [alias, c] = [m[1], m[2] ?? m[3]];
          if (alias === 'r' && name === 'revenue') continue; // the UNION's own columns
          const table = scope.get(alias);
          if (!table || !tables.get(table)!.has(c)) missing.push(`${name}: ${alias}.${c} (${table ?? 'no table'})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
  it('stays small enough to send with every question', () => expect(catalogue().length).toBeLessThan(12_000));
});

describe('queryData tool', () => {
  const ctx = (role: string, prisma: any = {}) => ({ prisma, now: new Date(), admin: { id: 'x', role } }) as any;
  it('is for admins only', async () => {
    const has = (role: string) => toolDefinitions([queryDataTool], ctx(role)).length;
    expect([has('super_admin'), has('admin'), has('mentor'), has('account_manager'), has('moderator')]).toEqual([1, 1, 0, 0, 0]);
    expect((await runTool([queryDataTool], ctx('mentor'), 'queryData', { query: { dataset: 'members', select: ['member'] } })).ok).toBe(false);
  });
  it('runs read-only with a time limit', async () => {
    const sent: string[] = [];
    const prisma = {
      $executeRawUnsafe: (s: string) => { sent.push(s); return 0; },
      $queryRawUnsafe: (s: string) => { sent.push(s); return s.startsWith('SELECT COUNT(*)::int') ? [{ total: 49 }] : [{ member: 'A' }]; },
      $transaction: async (a: unknown[]) => a,
    };
    const r = await runTool([queryDataTool], ctx('admin', prisma), 'queryData', JSON.stringify({ query: { dataset: 'members', select: ['member'] } }));
    expect(r).toEqual({ ok: true, data: { total: 49, showing: 1, rows: [{ member: 'A' }] } });
    expect(sent[0]).toBe('SET TRANSACTION READ ONLY');
    expect(sent[1]).toContain('statement_timeout');
  });
  it('tells the model what was wrong, without database detail', async () => {
    const r1 = await runTool([queryDataTool], ctx('admin'), 'queryData', { query: { dataset: 'members', select: ['phone'] } });
    expect(r1).toMatchObject({ ok: false, error: expect.stringContaining('not a column') });
    const onError = vi.fn();
    const r2 = await runTool([queryDataTool], ctx('admin', { $executeRawUnsafe: () => { throw new Error('secret sql'); } }), 'queryData', { query: { dataset: 'members', select: ['member'] } }, { onError });
    expect(JSON.stringify(r2)).not.toContain('secret');
    expect(onError).toHaveBeenCalled();
  });
});

describe('unsupportedNumbers', () => {
  it('accepts figures from the data in any format', () => {
    expect(unsupportedNumbers('₹8,17,599 from 49 members on 2026-11-24 at 9:46 PM (6.7%)', ['{"a":817599,"n":49,"r":6.67}'])).toEqual([]);
  });
  it('flags invented figures', () => {
    expect(unsupportedNumbers('Total ₹9,00,000 from 49', ['{"a":817599,"n":49}'])).toEqual(['9,00,000']);
  });
  it('ignores small numbers, years and rounded forms', () => {
    expect(unsupportedNumbers('Top 3 in 2026: about 8.2 lakh', [])).toEqual([]);
  });
});
