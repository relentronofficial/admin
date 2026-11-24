/** Exact arithmetic for the assistant, so it never works figures out in its head. No eval: a small parser. */
import type { AdminToolCtx } from './adminTools.js';
import { ToolError, type AssistantTool } from './registry.js';

export function evaluate(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[-+*/()]|\S/g) ?? [];
  let i = 0;
  let depth = 0;
  const bad = () => new ToolError('Use plain numbers with + - * / and brackets only, e.g. (817599 - 270000) / 270000 * 100.');
  const atom = (): number => {
    const t = tokens[i++];
    if (t === '-') return -atom();
    if (t === '(') {
      if (++depth > 30) throw bad();
      const v = sum();
      if (tokens[i++] !== ')') throw bad();
      depth--;
      return v;
    }
    if (t === undefined || !/^\d/.test(t)) throw bad();
    return Number(t);
  };
  const product = (): number => {
    let v = atom();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++];
      const r = atom();
      if (op === '/' && r === 0) throw new ToolError('Division by zero: there is no answer.');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '-') v = tokens[i++] === '+' ? v + product() : v - product();
    return v;
  };
  const v = sum();
  if (i !== tokens.length || !Number.isFinite(v)) throw bad();
  return Math.round(v * 1e4) / 1e4;
}

export const calculateTool: AssistantTool<AdminToolCtx> = {
  name: 'calculate',
  description: 'Exact arithmetic on figures you have already looked up: differences, ratios, growth %, sums across lookups. One expression per call. Every figure in it must come from a lookup result or the question.',
  params: { expression: { type: 'string', required: true, maxLength: 400, description: 'e.g. (817599 - 270000) / 270000 * 100. Digits without commas.' } },
  allowed: () => true,
  // Only the result: the figures put in are not evidence of themselves.
  async run(_c, a) {
    return { result: evaluate(String(a.expression)) };
  },
};
