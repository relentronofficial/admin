/**
 * Assistant tools — the registry every chatbot tool goes through (pure: no
 * Prisma, no network). A tool is one read-only question our backend can
 * answer; the AI model only picks a tool and its arguments, it never sees the
 * database and never writes SQL.
 *
 * Guarantees enforced here, not in each tool:
 *  - a caller only ever lists or runs the tools they are allowed;
 *  - who is asking comes from the session (ctx), never from the model: any
 *    argument a tool does not declare (a smuggled memberId, say) is refused;
 *  - argument types, ranges and lengths are checked before a tool runs;
 *  - results are size-capped, and internal errors never reach the model.
 */

export type ParamSpec = {
  description: string;
  required?: boolean;
} & (
  | { type: 'string'; enum?: readonly string[]; maxLength?: number; pattern?: RegExp }
  | { type: 'integer'; min: number; max: number }
  // An object the tool validates itself; it reaches run() as JSON text.
  | { type: 'json'; schema: Record<string, unknown> }
);

export type ToolArgs = Record<string, string | number | undefined>;

export interface AssistantTool<Ctx> {
  name: string;
  description: string;
  params: Record<string, ParamSpec>;
  allowed(ctx: Ctx): boolean;
  run(ctx: Ctx, args: ToolArgs): Promise<unknown>;
}

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

/** A message that is safe to show the model (and so the user). */
export class ToolError extends Error {}

export const MAX_RESULT_CHARS = 20_000;
export const TOOL_TIMEOUT_MS = 10_000;

/** Tool definitions in the function-calling format OpenRouter uses. */
export function toolDefinitions<Ctx>(tools: readonly AssistantTool<Ctx>[], ctx: Ctx) {
  return tools.filter((t) => t.allowed(ctx)).map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(Object.entries(t.params).map(([k, p]) => [k, p.type === 'json' ? { ...p.schema, description: p.description } : {
          type: p.type,
          description: p.description,
          ...(p.type === 'string' && p.enum ? { enum: [...p.enum] } : {}),
          ...(p.type === 'integer' ? { minimum: p.min, maximum: p.max } : {}),
        }])),
        required: Object.entries(t.params).filter(([, p]) => p.required).map(([k]) => k),
        additionalProperties: false,
      },
    },
  }));
}

export function parseArgs(
  params: Record<string, ParamSpec>,
  raw: unknown,
): { ok: true; args: ToolArgs } | { ok: false; error: string } {
  let input: unknown = raw ?? {};
  if (typeof input === 'string') {
    try {
      input = input.trim() ? JSON.parse(input) : {};
    } catch {
      return { ok: false, error: 'The tool arguments were not valid JSON.' };
    }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'The tool arguments must be an object.' };

  const args: ToolArgs = {};
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(params, key)) return { ok: false, error: `Unknown argument "${key}".` };
  }
  for (const [key, spec] of Object.entries(params)) {
    let v = (input as Record<string, unknown>)[key];
    if (typeof v === 'string') v = v.trim();
    if (v == null || v === '') {
      if (spec.required) return { ok: false, error: `"${key}" is required.` };
      continue;
    }
    if (spec.type === 'json') {
      // Models sometimes send the object as JSON text.
      const text = typeof v === 'string' ? v : JSON.stringify(v);
      if (text.length > 5_000) return { ok: false, error: `"${key}" is too long.` };
      try {
        JSON.parse(text);
      } catch {
        return { ok: false, error: `"${key}" is not valid JSON.` };
      }
      args[key] = text;
      continue;
    }
    if (spec.type === 'integer') {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < spec.min || v > spec.max) {
        return { ok: false, error: `"${key}" must be a whole number from ${spec.min} to ${spec.max}.` };
      }
      args[key] = v;
      continue;
    }
    if (typeof v !== 'string') return { ok: false, error: `"${key}" must be text.` };
    if (v.length > (spec.maxLength ?? 100)) return { ok: false, error: `"${key}" is too long.` };
    if (spec.enum && !spec.enum.includes(v)) return { ok: false, error: `"${key}" must be one of: ${spec.enum.join(', ')}.` };
    if (spec.pattern && !spec.pattern.test(v)) return { ok: false, error: `"${key}" is not in the right format.` };
    args[key] = v;
  }
  return { ok: true, args };
}

/** Run one tool call the model asked for. Never throws. */
export async function runTool<Ctx>(
  tools: readonly AssistantTool<Ctx>[],
  ctx: Ctx,
  name: string,
  rawArgs: unknown,
  opts: { onError?: (err: unknown) => void; timeoutMs?: number } = {},
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  // Same answer for a missing tool and a forbidden one.
  if (!tool || !tool.allowed(ctx)) return { ok: false, error: `No tool called "${name}" is available.` };
  const parsed = parseArgs(tool.params, rawArgs);
  if (!parsed.ok) return parsed;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      tool.run(ctx, parsed.args),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ToolError('This took too long. Try a narrower question.')), opts.timeoutMs ?? TOOL_TIMEOUT_MS);
      }),
    ]);
    // bigint would make JSON.stringify throw.
    const json = JSON.stringify(data ?? null, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
    if (json.length > MAX_RESULT_CHARS) return { ok: false, error: 'Too much data. Narrow the date range, or ask about fewer items.' };
    return { ok: true, data: JSON.parse(json) };
  } catch (err) {
    if (err instanceof ToolError) return { ok: false, error: err.message };
    opts.onError?.(err);
    return { ok: false, error: 'This information could not be loaded right now.' };
  } finally {
    clearTimeout(timer);
  }
}

/** An instant as IST text, so the model never has to convert time zones. */
export function ist(at: Date | string | null | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `${new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} IST`;
}

export function fullName(p: { firstName: string | null; lastName: string | null } | null | undefined): string | null {
  if (!p) return null;
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null;
}

/** "Showing 20 of 57" — so a capped list is never counted as the total. */
export function listed<T>(items: T[], total: number) {
  return { total, showing: items.length, items };
}
