import { describe, expect, it, vi } from 'vitest';
import type { AdminToolCtx } from './adminTools.js';
import type { MemberToolCtx } from './memberTools.js';
import { MAX_RESULT_CHARS, ToolError, ist, parseArgs, runTool, toolDefinitions, type AssistantTool } from './registry.js';

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata' } }));
const { adminTools, batchDay, memberScope } = await import('./adminTools.js');
const { memberTools } = await import('./memberTools.js');

const NOW = new Date('2026-11-24T10:00:00Z');
const ADMIN_ID = '30000000-0000-4000-8000-0000000000a1';

/** Records every Prisma call; reads return empty results. */
function fakePrisma(over: Record<string, any> = {}) {
  const calls: Array<{ model: string; method: string; args: any[] }> = [];
  const prisma = new Proxy({}, {
    get: (_t, model: string) => {
      if (model === '$queryRawUnsafe') return async (...args: any[]) => { calls.push({ model: 'raw', method: model, args }); return over.raw?.(...args) ?? []; };
      return new Proxy({}, {
        get: (_m, method: string) => async (args: any) => {
          calls.push({ model, method, args: [args] });
          const o = over[`${model}.${method}`];
          if (o) return typeof o === 'function' ? o(args) : o;
          return method === 'count' ? 0 : method.startsWith('findMany') || method === 'groupBy' ? [] : null;
        },
      });
    },
  }) as any;
  return { prisma, calls };
}
const adminCtx = (role: string, prisma: any = fakePrisma().prisma): AdminToolCtx => ({ prisma, now: NOW, admin: { id: ADMIN_ID, role } });
const names = (role: string) => toolDefinitions(adminTools, adminCtx(role)).map((t) => t.function.name);

describe('who may use which admin tool', () => {
  it('admins get every tool', () => {
    expect(names('super_admin')).toHaveLength(adminTools.length);
    expect(names('admin')).toHaveLength(adminTools.length);
  });
  it('account managers and mentors get no company-wide figures', () => {
    for (const role of ['account_manager', 'mentor']) {
      expect(names(role).sort()).toEqual(['getAtRiskMembers', 'getInactiveMembers', 'getMemberDetails', 'getMemberProgress', 'getPendingSubmissions', 'getSupportCalls', 'getSupportTickets', 'searchMembers']);
    }
  });
  it('moderators get tickets only; unknown roles get nothing', () => {
    expect(names('moderator')).toEqual(['getSupportTickets']);
    expect(names('')).toEqual([]);
    expect(names('guest')).toEqual([]);
  });
  it('a forbidden tool does not run even if the model calls it', async () => {
    const { prisma, calls } = fakePrisma();
    for (const t of ['getRevenueSummary', 'getBatchSummary', 'getOverview']) {
      expect((await runTool(adminTools, adminCtx('mentor', prisma), t, {})).ok).toBe(false);
    }
    expect(calls).toEqual([]);
  });
});

describe('member scope', () => {
  it('scoped roles only reach their own members', () => {
    expect(memberScope(adminCtx('mentor'))).toEqual({ deletedAt: null, accountManagerId: ADMIN_ID });
    expect(memberScope(adminCtx('admin'))).toEqual({ deletedAt: null });
  });
  it.each(['searchMembers', 'getInactiveMembers', 'getPendingSubmissions', 'getSupportTickets'])('%s carries the scope in every query', async (tool) => {
    const { prisma, calls } = fakePrisma();
    const r = await runTool(adminTools, adminCtx('account_manager', prisma), tool, {});
    expect(r.ok).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(JSON.stringify(c.args)).toContain(ADMIN_ID);
  });
  it('getMemberDetails / getMemberProgress look the member up inside the scope', async () => {
    for (const tool of ['getMemberDetails', 'getMemberProgress']) {
      const { prisma, calls } = fakePrisma();
      const r = await runTool(adminTools, adminCtx('mentor', prisma), tool, { member: 'TBT-1' });
      expect(r).toMatchObject({ ok: false });
      expect(calls).toHaveLength(1);
      expect(JSON.stringify(calls[0].args)).toContain(ADMIN_ID);
    }
  });
  it('getSupportCalls is limited to calls the scoped admin hosts', async () => {
    const { prisma, calls } = fakePrisma();
    await runTool(adminTools, adminCtx('mentor', prisma), 'getSupportCalls', {});
    expect(calls[0].args[3]).toBe(ADMIN_ID);
    expect(calls[0].args[1]).toEqual(new Date('2026-11-23T18:30:00Z')); // IST midnight
    expect(calls[0].args[2]).toEqual(new Date('2026-11-24T18:30:00Z'));
  });
});

describe('privacy', () => {
  it('no tool selects contact details, notes, secrets or message text', async () => {
    const id = '30000000-0000-4000-8000-0000000000b2';
    const { prisma, calls } = fakePrisma({ 'member.findFirst': { id, memberId: 'T1', firstName: 'A', lastName: null, batchId: null, createdAt: NOW, batch: null, accountManager: null } });
    for (const t of ['searchMembers', 'getMemberDetails', 'getMemberProgress', 'getPendingSubmissions', 'getInactiveMembers', 'getSupportTickets']) {
      await runTool(adminTools, adminCtx('admin', prisma), t, t.startsWith('getMember') ? { member: id } : {});
    }
    const selected = calls.map((c) => JSON.stringify(c.args[0]?.select ?? {})).join();
    for (const f of ['phone', 'email', 'pincode', 'gstNumber', 'passwordHash', 'notes', 'message"', 'adminNotes', 'kyc']) expect(selected).not.toContain(f);
  });
});

describe('member tools', () => {
  const ctx = (prisma: any): MemberToolCtx => ({ prisma, now: NOW, memberId: ADMIN_ID });
  it('no tool accepts a member argument', async () => {
    for (const t of memberTools) {
      expect(Object.keys(t.params).filter((k) => /member|user|id$/i.test(k))).toEqual([]);
      const { prisma, calls } = fakePrisma();
      const r = await runTool(memberTools, ctx(prisma), t.name, { memberId: 'someone-else' });
      expect(r).toMatchObject({ ok: false });
      expect(calls).toEqual([]);
    }
  });
  it('admin tools are not reachable from the member list', async () => {
    expect((await runTool(memberTools, ctx(fakePrisma().prisma), 'getRevenueSummary', {})).ok).toBe(false);
  });
  it('hides another member\'s assigned task and refuses future days', async () => {
    const T = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
    const over = {
      'member.findFirst': { id: ADMIN_ID, batchId: T(9), membershipPlan: 'free' },
      'batch.findUnique': { startsAt: new Date('2026-11-20T00:00:00Z'), programId: null },
      'task.findMany': [1, 2, 3].map((n) => ({ id: T(n), title: `t${n}`, isRequired: true, estimatedMinutes: 5 })),
      raw: () => [{ id: T(1), member_id: null }, { id: T(2), member_id: 'other' }, { id: T(3), member_id: ADMIN_ID }],
    };
    const r: any = await runTool(memberTools, ctx(fakePrisma(over).prisma), 'getMyTasks', {});
    expect(r.data.currentDay).toBe(5);
    expect(r.data.tasks.map((t: any) => t.title)).toEqual(['t1', 't3']);
    expect(await runTool(memberTools, ctx(fakePrisma(over).prisma), 'getMyTasks', { day: 6 })).toMatchObject({ ok: false, error: expect.stringContaining('not been reached') });
  });
  it('searchHelp treats % and _ as plain text', async () => {
    const { prisma, calls } = fakePrisma();
    await runTool(memberTools, ctx(prisma), 'searchHelp', { query: '50%_' });
    expect(calls[0].args[1]).toBe('%50\\%\\_%');
  });
});

describe('arguments', () => {
  const p = adminTools.find((t) => t.name === 'getInactiveMembers')!.params;
  it('accepts JSON text and objects', () => {
    expect(parseArgs(p, '{"days":7}')).toEqual({ ok: true, args: { days: 7 } });
    expect(parseArgs(p, '')).toEqual({ ok: true, args: {} });
  });
  it('refuses bad input', () => {
    for (const raw of ['{bad', [], { days: 0 }, { days: 1.5 }, { days: '7' }, { limit: 51 }, { nope: 1 }, { batch: 5 }, { batch: 'x'.repeat(101) }, '{"__proto__":{"a":1}}']) {
      expect(parseArgs(p, raw).ok).toBe(false);
    }
  });
  it('half a date range and reversed dates are explained, not guessed', async () => {
    expect(await runTool(adminTools, adminCtx('admin'), 'getRevenueSummary', { from: '2026-11-01' })).toMatchObject({ ok: false, error: expect.stringContaining('both') });
    expect((await runTool(adminTools, adminCtx('admin'), 'getRevenueSummary', { from: '2026-11-20', to: '2026-11-01' })).ok).toBe(false);
  });
  it('an ambiguous batch name asks which one', async () => {
    const { prisma } = fakePrisma({ 'batch.findMany': (a: any) => (a.where.name.equals ? [] : [{ name: 'Batch 5' }, { name: 'Batch 55' }]) });
    expect(await runTool(adminTools, adminCtx('admin', prisma), 'getBatchSummary', { batch: 'Batch' })).toMatchObject({ ok: false, error: expect.stringContaining('Batch 5, Batch 55') });
  });
});

describe('runTool', () => {
  const tool = (run: () => Promise<unknown>): AssistantTool<null>[] => [{ name: 't', description: '', params: {}, allowed: () => true, run }];
  it('hides internal errors, reports them to the log, passes ToolError through', async () => {
    const onError = vi.fn();
    const r = await runTool(tool(async () => { throw new Error('password=secret'); }), null, 't', {}, { onError });
    expect(JSON.stringify(r)).not.toContain('secret');
    expect(onError).toHaveBeenCalledOnce();
    expect(await runTool(tool(async () => { throw new ToolError('Ask which one.'); }), null, 't', {})).toEqual({ ok: false, error: 'Ask which one.' });
  });
  it('caps size, times out and converts bigint', async () => {
    expect((await runTool(tool(async () => 'x'.repeat(MAX_RESULT_CHARS)), null, 't', {})).ok).toBe(false);
    expect((await runTool(tool(() => new Promise(() => {})), null, 't', {}, { timeoutMs: 10 })).ok).toBe(false);
    expect(await runTool(tool(async () => ({ n: 5n })), null, 't', {})).toEqual({ ok: true, data: { n: 5 } });
  });
});

describe('dates', () => {
  it('batch day: Day 1 is the IST start date, capped at the programme length', () => {
    const start = new Date('2026-11-16T00:00:00Z');
    expect(batchDay(start, 90, new Date('2026-11-15T18:29:00Z'))).toBe(0);
    expect(batchDay(start, 90, new Date('2026-11-15T18:31:00Z'))).toBe(1);
    expect(batchDay(start, 90, NOW)).toBe(9);
    expect(batchDay(start, 5, NOW)).toBe(5);
  });
  it('formats IST', () => {
    expect(ist('2026-11-23T19:00:00Z')).toBe('2026-11-24 00:30 IST');
    expect(ist(null)).toBeNull();
  });
});

describe('definitions', () => {
  it('are valid function definitions with unique names', () => {
    for (const list of [toolDefinitions(adminTools, adminCtx('admin')), toolDefinitions(memberTools, {} as MemberToolCtx)]) {
      expect(new Set(list.map((t) => t.function.name)).size).toBe(list.length);
      for (const t of list) {
        expect(t.function.name).toMatch(/^[a-zA-Z]{1,64}$/);
        expect(t.function.parameters.additionalProperties).toBe(false);
      }
    }
  });
});
