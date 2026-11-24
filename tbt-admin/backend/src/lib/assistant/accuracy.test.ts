import { describe, expect, it, vi } from 'vitest';
import { calculateTool, evaluate } from './calculate.js';
import { runChatLoop } from './chatLoop.js';
import { evalCases, gradeAnswer } from './evalCases.js';
import { compileQuery } from './queryData.js';

describe('calculate', () => {
  it('works out arithmetic', () => {
    expect(evaluate('(817599 - 270000) / 270000 * 100')).toBe(202.8144);
    expect(evaluate('2 + 3 * 4 - -1')).toBe(15);
    expect(evaluate('10 / 4 / 5')).toBe(0.5);
  });
  it('refuses everything else', () => {
    for (const x of ['', '1 +', '(1', '1)', '1 2', 'process.exit()', '2 ** 3', '1e400', '1,000', '1/0', '('.repeat(50)]) expect(() => evaluate(x), x).toThrow();
  });
});

const call = (name: string, args: unknown) => ({ message: { role: 'assistant' as const, content: null, reasoning_details: [1], tool_calls: [{ id: 'x', type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }] }, finishReason: 'tool_calls', costUsd: 1 });
const say = (content: string) => ({ message: { role: 'assistant' as const, content }, finishReason: 'stop', costUsd: 1 });
const base = { system: { shared: 's', personal: 'p' }, history: [], question: 'q', tools: [] };

describe('harder questions', () => {
  it('calculate only takes figures that were looked up', async () => {
    const run = vi.fn(async (name: string) => ({ ok: true as const, data: name === 'calculate' ? { result: 1 } : { a: 500 } }));
    const steps = [call('lookup', {}), call('calculate', { expression: '500 / 777' }), call('calculate', { expression: '500 / 100' }), say('done')];
    const seen: any[] = [];
    await runChatLoop({ ...base, complete: async (m) => { seen.push(structuredClone(m)); return steps.shift()!; }, runTool: run });
    expect(run.mock.calls.map((c) => c[0])).toEqual(['lookup', 'calculate']);
    expect(JSON.stringify(seen[2])).toContain('777');
  });
  it('moves to the stronger model after three rounds, without the old reasoning', async () => {
    const steps = [call('a', {}), call('a', {}), call('a', {})];
    const strong = vi.fn(async (_m: any) => say('done'));
    const r = await runChatLoop({ ...base, complete: async () => steps.shift()!, completeHard: strong, runTool: async () => ({ ok: true, data: {} }) });
    expect(r).toMatchObject({ text: 'done', hard: true });
    expect(JSON.stringify(strong.mock.calls[0][0])).not.toContain('reasoning_details');
  });
  it('moves to it when a figure is unsupported', async () => {
    const strong = vi.fn(async () => say('none'));
    expect((await runChatLoop({ ...base, complete: async () => say('₹5,55,555'), completeHard: strong, runTool: vi.fn() })).text).toBe('none');
    expect(strong).toHaveBeenCalledOnce();
  });
  it('carries on with the usual model if the stronger one fails', async () => {
    const steps = [say('₹5,55,555'), say('none')];
    const strong = vi.fn(async () => { throw new Error('busy'); });
    const r = await runChatLoop({ ...base, complete: async () => steps.shift()!, completeHard: strong as any, runTool: vi.fn() });
    expect(r).toMatchObject({ text: 'none', hard: false });
  });
  it('easy questions never use it', async () => {
    const strong = vi.fn();
    const steps = [call('a', {}), say('done')];
    await runChatLoop({ ...base, complete: async () => steps.shift()!, completeHard: strong, runTool: async () => ({ ok: true, data: {} }) });
    expect(strong).not.toHaveBeenCalled();
  });
});

describe('accuracy test', () => {
  const cases = evalCases('2026-11-24');
  it('has 50+ cases with unique ids and valid lookups', () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) if (c.query) for (const k of [...c.expect, ...(c.tie ? [c.tie] : [])]) expect(compileQuery(c.query).sql, c.id).toContain(`AS "${k}"`);
  });
  it('handles January', () => expect(JSON.stringify(evalCases('2027-01-05'))).toContain('2026-12-31'));
  it('grades', () => {
    const num = cases.find((c) => c.id === 'revenue-month')!;
    const g = (a: string, rows: any[] = [{ sum_amount_inr: 817599 }], c = num) => gradeAnswer(c, rows, a).pass;
    expect(g('Total ₹8,17,599')).toBe(true);
    expect(g('Total ₹8,17,500')).toBe(false);
    expect(g('Total ₹1\n\n⚠ Calculated: 817599')).toBe(false);
    expect(g('Illa', [{ sum_amount_inr: 0 }])).toBe(true);
    const best = cases.find((c) => c.id === 'members-streak')!;
    const tied = [{ member: 'A B', current_streak: 5 }, { member: 'C D', current_streak: 5 }, { member: 'E F', current_streak: 1 }];
    expect(g('It is c d', tied, best)).toBe(true);
    expect(g('E F', tied, best)).toBe(false);
    const priv = cases.find((c) => c.id === 'private-phone')!;
    expect(g('98765 43210', [], priv)).toBe(false);
    expect(g("I can't show that", [], priv)).toBe(true);
  });
  it('is available to every role', () => expect(calculateTool.allowed({} as any)).toBe(true));
});
