import { describe, expect, it, vi } from 'vitest';
import { HISTORY_CHARS, HISTORY_TURNS, MAX_CALLS_PER_ROUND, MAX_ROUNDS, adminSystemPrompt, conversationTitle, runChatLoop } from './chatLoop.js';
import { AssistantServiceError, explainStatus, openRouterComplete, readCompletion, usableKey, type Completion } from './openRouter.js';

const answer = (text: string | null, finishReason = 'stop'): Completion => ({ message: { role: 'assistant', content: text }, finishReason, costUsd: 0.01 });
const asks = (...names: string[]): Completion => ({
  message: {
    role: 'assistant', content: 'Let me check', reasoning_details: [{ sig: 'x' }],
    tool_calls: names.map((n, i) => ({ id: `c${i}`, type: 'function', function: { name: n, arguments: '{"a":1}' } })),
  },
  finishReason: 'tool_calls', costUsd: 0.02,
});
/** Plays completions in order and keeps a copy of what was sent each time. */
function script(...steps: Completion[]) {
  const sent: any[][] = [];
  const complete = async (m: any[]) => { sent.push(structuredClone(m)); return steps[Math.min(sent.length, steps.length) - 1]; };
  return { complete, sent };
}
const base = { system: 'S', history: [], question: 'Q', tools: [] };

describe('runChatLoop', () => {
  it('answers without tools', async () => {
    const { complete } = script(answer(' Hi '));
    expect(await runChatLoop({ ...base, complete, runTool: vi.fn() })).toEqual({ text: 'Hi', toolsUsed: [], costUsd: 0.01 });
  });
  it('runs tools, returns results in order, keeps reasoning, sums cost', async () => {
    const { complete, sent } = script(asks('a', 'b'), answer('done'));
    const seen: string[] = [];
    const r = await runChatLoop({
      ...base, complete, onTool: (n) => seen.push(n),
      runTool: async (n) => (n === 'a' ? { ok: true, data: { n: 1 } } : { ok: false, error: 'nope' }),
    });
    expect(r).toEqual({ text: 'done', toolsUsed: ['a', 'b'], costUsd: 0.03 });
    expect(seen).toEqual(['a', 'b']);
    expect(sent[1].slice(2)).toEqual([
      asks('a', 'b').message,
      { role: 'tool', tool_call_id: 'c0', content: '{"n":1}' },
      { role: 'tool', tool_call_id: 'c1', content: '{"error":"nope"}' },
    ]);
  });
  it('stops after the round limit', async () => {
    const { complete, sent } = script(asks('a'));
    const r = await runChatLoop({ ...base, complete, runTool: async () => ({ ok: true, data: 1 }) });
    expect(sent).toHaveLength(MAX_ROUNDS);
    expect(r.text).toMatch(/too many lookups/i);
  });
  it('limits calls per round but answers every call', async () => {
    const names = Array.from({ length: MAX_CALLS_PER_ROUND + 2 }, (_, i) => `t${i}`);
    const { complete, sent } = script(asks(...names), answer('ok'));
    const runTool = vi.fn(async () => ({ ok: true as const, data: 1 }));
    await runChatLoop({ ...base, complete, runTool });
    expect(runTool).toHaveBeenCalledTimes(MAX_CALLS_PER_ROUND);
    expect(sent[1].filter((m) => m.role === 'tool')).toHaveLength(names.length);
  });
  it('handles empty, filtered and cut-off answers', async () => {
    const go = async (c: Completion) => (await runChatLoop({ ...base, complete: script(c).complete, runTool: vi.fn() })).text;
    expect(await go(answer(null))).toMatch(/could not put together/);
    expect(await go(answer('x', 'content_filter'))).toMatch(/can't help/);
    expect(await go(answer('part', 'length'))).toMatch(/^part[\s\S]*cut short/);
  });
  it('trims history', async () => {
    const { complete, sent } = script(answer('x'));
    const history = Array.from({ length: 30 }, () => ({ role: 'user' as const, content: 'y'.repeat(HISTORY_CHARS + 5) }));
    await runChatLoop({ ...base, history, complete, runTool: vi.fn() });
    expect(sent[0]).toHaveLength(HISTORY_TURNS + 2);
    expect(sent[0][1].content).toHaveLength(HISTORY_CHARS);
  });
});

describe('OpenRouter', () => {
  it('reads a message, tool calls and cost', () => {
    const c = readCompletion({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: '1', function: { name: 'a', arguments: '{}' } }, { bad: 1 }] } }], usage: { cost: 0.5 } });
    expect(c.message.tool_calls).toEqual([{ id: '1', type: 'function', function: { name: 'a', arguments: '{}' } }]);
    expect(c.costUsd).toBe(0.5);
  });
  it('turns failures into safe messages', async () => {
    expect(() => readCompletion({ error: { code: 402, message: 'secret detail' } })).toThrow(/out of credit/);
    expect(() => readCompletion({})).toThrow(AssistantServiceError);
    expect(explainStatus(401)).toMatch(/key was refused/);
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad key sk-xyz', { status: 401 }));
    await expect(openRouterComplete('k', () => {})([], [])).rejects.toThrow(/key was refused/);
    spy.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] })));
    await openRouterComplete('k', () => {})([], []);
    const body = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(body.provider.data_collection).toBe('deny');
    spy.mockRestore();
  });
});

describe('key safety', () => {
  it('accepts only an OpenRouter key', () => {
    expect(usableKey(' sk-or-v1-abc\n')).toBe('sk-or-v1-abc');
    expect(usableKey('{"type":"service_account"}')).toBeNull();
    expect(usableKey('sk-or-a\nb')).toBeNull();
    expect(usableKey(undefined)).toBeNull();
  });
  it('never logs the key, even when fetch quotes it', async () => {
    const logs: unknown[] = [];
    await expect(openRouterComplete('SECRET\nKEY', (i) => logs.push(i))([], [])).rejects.toThrow(AssistantServiceError);
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain('SECRET');
  });
});

describe('prompt', () => {
  it('gives the date and role, and flags limited access', () => {
    const p = (role: string) => adminSystemPrompt({ adminName: 'A', role, today: '2026-11-24' });
    expect(p('admin')).toContain('2026-11-24');
    expect(p('admin')).not.toContain('only has access to part');
    expect(p('mentor')).toContain('only has access to part');
  });
  it('titles are short', () => expect(conversationTitle(` a\n${'b'.repeat(80)}`).length).toBe(60));
});
