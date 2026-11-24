/**
 * One call to OpenRouter's chat-completions API (not streamed: each round's
 * message, including its reasoning blocks, must go back unchanged on the next
 * round, and a whole message cannot be reassembled wrongly).
 */

/** Good at choosing tools; about $2 in / $10 out per million tokens (2026-11). */
export const ASSISTANT_MODEL = 'anthropic/claude-sonnet-5.5';
const URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 3_000; // reasoning + answer

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system'; content: string | unknown[] }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[]; reasoning_details?: unknown }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface Completion {
  message: Extract<ChatMessage, { role: 'assistant' }>;
  finishReason: string | null;
  costUsd: number;
}

export type Complete = (messages: ChatMessage[], tools: unknown[], signal?: AbortSignal) => Promise<Completion>;

/** Carries a message that is safe to show an admin. */
export class AssistantServiceError extends Error {}

export function explainStatus(status: number): string {
  if (status === 401 || status === 403) return 'The OpenRouter key was refused. Check the key in the backend settings.';
  if (status === 402) return 'The OpenRouter account is out of credit or has reached its spending limit.';
  if (status === 429) return 'The AI service is busy. Please try again in a minute.';
  return 'The AI service could not answer just now. Please try again.';
}

export function readCompletion(json: any): Completion {
  // OpenRouter can report an upstream failure inside a 200 response.
  if (json?.error) throw new AssistantServiceError(explainStatus(Number(json.error.code) || 500));
  const choice = json?.choices?.[0];
  const m = choice?.message;
  if (!m || choice.error) throw new AssistantServiceError(explainStatus(Number(choice?.error?.code) || 500));
  const calls: ToolCall[] = (Array.isArray(m.tool_calls) ? m.tool_calls : [])
    .filter((c: any) => typeof c?.id === 'string' && typeof c?.function?.name === 'string')
    .map((c: any) => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: String(c.function.arguments ?? '') } }));
  return {
    message: {
      role: 'assistant',
      content: typeof m.content === 'string' ? m.content : null,
      ...(calls.length ? { tool_calls: calls } : {}),
      ...(m.reasoning_details ? { reasoning_details: m.reasoning_details } : {}),
    },
    finishReason: choice.finish_reason ?? null,
    costUsd: Number(json?.usage?.cost) || 0,
  };
}

export function openRouterComplete(apiKey: string, log: (info: unknown) => void): Complete {
  return async (messages, tools, signal) => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ASSISTANT_MODEL,
          messages,
          tools,
          max_tokens: MAX_TOKENS,
          reasoning: { effort: 'low', exclude: false },
          usage: { include: true },
          // Only providers that do not store or train on the data.
          provider: { data_collection: 'deny', require_parameters: true },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      log({ err });
      throw new AssistantServiceError('The AI service took too long or could not be reached. Please try again.');
    }
    if (!res.ok) {
      log({ status: res.status, body: (await res.text().catch(() => '')).slice(0, 500) });
      throw new AssistantServiceError(explainStatus(res.status));
    }
    return readCompletion(await res.json());
  };
}
