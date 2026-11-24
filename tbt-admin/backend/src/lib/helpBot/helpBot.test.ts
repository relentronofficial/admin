import { describe, expect, it, vi } from 'vitest';
import { runTool, toolDefinitions } from '../assistant/registry.js';
import type { MemberToolCtx } from '../assistant/memberTools.js';
import { loadHelpBotAccess, mayUseHelpBot } from './access.js';
import { allowedFrom, type HelpBotAction } from './actions.js';
import { closestFaqs, exactFaq, offlineAnswer } from './fallback.js';

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata' } }));
const { memberActionTools, bookLocked, pickOne } = await import('../assistant/memberActionTools.js');
const { memberTools } = await import('../assistant/memberTools.js');

const ME = '10000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-11-24T10:00:00Z');
const all = [...memberTools, ...memberActionTools];

describe('who may use it', () => {
  it('only testers while testing; everyone active once opened; closed otherwise', () => {
    const t = (audience: unknown, isTester: unknown, memberStatus: unknown = 'active') => mayUseHelpBot({ audience, isTester, memberStatus });
    expect(t('testers', true)).toBe(true);
    expect(t('testers', false)).toBe(false);
    expect(t('testers', 'true')).toBe(false);
    expect(t('all', false)).toBe(true);
    expect(t('all', true, 'suspended')).toBe(false);
    expect(t('testers', true, 'pending')).toBe(false);
    for (const x of [undefined, null, '', 'everyone']) expect(t(x, true)).toBe(false);
  });
  it('a missing member or settings row means no', async () => {
    expect(await loadHelpBotAccess({ $queryRawUnsafe: async () => [] as any }, ME)).toEqual({ allowed: false, comingSoon: false, dailyLimit: 0 });
    const as = (audience: string, is_tester: boolean, status = 'active') => loadHelpBotAccess({ $queryRawUnsafe: async () => [{ audience, is_tester, status, daily_limit: 50 }] as any }, ME);
    expect(await as('testers', false)).toMatchObject({ allowed: false, comingSoon: true });
    expect(await as('testers', true)).toMatchObject({ allowed: true, comingSoon: false });
    expect(await as('all', false)).toMatchObject({ allowed: true, comingSoon: false });
    expect(await as('testers', false, 'pending')).toMatchObject({ allowed: false, comingSoon: false });
  });
});

it('an action is confirmed once', () => {
  expect(allowedFrom('working')).toEqual(['pending']);
  expect(allowedFrom('dismissed')).toEqual(['pending']);
  expect(allowedFrom('done')).toEqual(['working']);
  expect(allowedFrom('pending')).toEqual(['working']);
  expect(allowedFrom('x')).toEqual([]);
});

describe('answers without AI', () => {
  const faqs = [
    { question: 'How do I get a refund?', answer: 'Raise a ticket.' },
    { question: 'How do I download my certificate?', answer: 'Complete every lesson.' },
  ];
  it('matches the same question only', () => {
    expect(exactFaq('how do i get a refund', faqs)?.answer).toBe('Raise a ticket.');
    expect(exactFaq('refund', faqs)).toBeNull();
    expect(exactFaq('??', [{ question: '', answer: 'x' }])).toBeNull();
  });
  it('finds close ones and always offers a ticket', () => {
    expect(closestFaqs('certificate epdi edukradhu', faqs)[0].question).toContain('certificate');
    expect(offlineAnswer('zzz', faqs)).toContain('/support/new');
  });
});

/** Records calls; over = canned results. */
function ctx(over: Record<string, any> = {}) {
  const calls: Array<{ key: string; args: any[] }> = [];
  const prisma = new Proxy({}, {
    get: (_t, model: string) => model === '$queryRawUnsafe'
      ? async (...args: any[]) => { calls.push({ key: 'raw', args }); return over.raw?.(...args) ?? []; }
      : new Proxy({}, { get: (_m, method: string) => async (args: any) => { calls.push({ key: `${model}.${method}`, args: [args] }); return over[`${model}.${method}`] ?? (method === 'count' ? 0 : method === 'findMany' ? [] : null); } }),
  }) as any;
  const actions: HelpBotAction[] = [];
  return { c: { prisma, now: NOW, memberId: ME, actions } as MemberToolCtx, calls, actions };
}

describe('member tools', () => {
  it('no tool takes a member, and every lookup of own data is pinned to the caller', async () => {
    const { c, calls } = ctx();
    expect(JSON.stringify(toolDefinitions(all, c))).not.toMatch(/memberId|member_id/);
    expect((await runTool(all, c, 'getMyPayments', { memberId: 'x' })).ok).toBe(false);
    await runTool(all, c, 'getMyPayments', {});
    await runTool(all, c, 'getMyTicket', { number: 7 });
    await runTool(all, c, 'getMyHabits', {});
    const own = calls.filter((x) => x.key !== 'member.findUnique');
    expect(own.length).toBeGreaterThan(3);
    for (const x of own) expect(JSON.stringify(x.args)).toContain(ME);
  });
  it('tool names are unique', () => expect(new Set(all.map((t) => t.name)).size).toBe(all.length));
  it('community search shows only approved active posts', async () => {
    const { c, calls } = ctx();
    await runTool(all, c, 'searchCommunity', { query: 'ads' });
    expect(calls.find((x) => x.key === 'post.findMany')!.args[0].where).toMatchObject({ status: 'active', isApproved: true });
  });
  it('internal ticket notes are never read', async () => {
    const { c, calls } = ctx();
    await runTool(all, c, 'getMyTicket', { number: 7 });
    expect(calls[0].args[0].select.replies.where).toEqual({ isInternal: false });
  });
  it('batch-locked books stay hidden', () => {
    expect(bookLocked(null, null)).toBe(false);
    expect(bookLocked(['a'], 'a')).toBe(false);
    expect(bookLocked(['a'], 'b')).toBe(true);
    expect(bookLocked(['a'], null)).toBe(true);
    expect(bookLocked([], 'a')).toBe(true);
  });
  it('pickOne asks when unsure', () => {
    const n = (s: string) => s;
    expect(pickOne(['Ads', 'Ads Pro'], n, 'ads', 'course')).toBe('Ads');
    expect(() => pickOne(['Ads A', 'Ads B'], n, 'ads', 'course')).toThrow(/which one/);
    expect(() => pickOne(['Ads A'], n, 'x', 'course')).toThrow(/No course/);
  });
  it('preparing never writes, and stops at three', async () => {
    const { c, calls, actions } = ctx();
    for (let i = 0; i < 4; i++) await runTool(all, c, 'prepareTicket', { subject: `s${i}`, message: 'm' });
    expect(actions).toHaveLength(3);
    expect(calls.every((x) => /findMany|findUnique|raw/.test(x.key))).toBe(true);
  });
  const slot = { id: 's1', category: 'sales_support', title: 'Sales', starts_at: '2026-11-25T05:00:00Z', duration_minutes: 30, capacity: 1, status: 'scheduled', active_count: 0 };
  it('a booking is refused without calls left', async () => {
    const { c, actions } = ctx({ raw: (q: string) => (q.includes('active_count') ? [slot] : []), 'member.findUnique': { membershipPlan: 'free', status: 'active' } });
    const r = await runTool(all, c, 'prepareCallBooking', { category: 'sales_support', start: '2026-11-25 10:30 IST' });
    expect(r.ok).toBe(false);
    expect(actions).toEqual([]);
  });
  it('a booking needs a real slot', async () => {
    const { c } = ctx();
    expect(await runTool(all, c, 'prepareCallBooking', { category: 'sales_support', start: '2026-11-25 10:30 IST' })).toMatchObject({ ok: false, error: expect.stringContaining('no open slot') });
  });
  it('a habit is matched by name', async () => {
    const { c, actions } = ctx({ raw: () => [{ id: 'h1', question: 'Did you meditate?', done: null }] });
    await runTool(all, c, 'prepareHabit', { habit: 'meditate', done: 'yes' });
    expect(actions).toEqual([{ type: 'habit', habitId: 'h1', question: 'Did you meditate?', done: true }]);
  });
});
