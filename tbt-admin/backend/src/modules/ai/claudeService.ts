/**
 * Anthropic wrapper for the AI Content Buddy.
 *
 * Ported from the co-worker's `services/claudeService.js`. Adapted to
 * our stack: uses the same `@anthropic-ai/sdk` client already wired
 * into `modules/workshops/controller.ts` for live-call summaries, and
 * reads `ANTHROPIC_API_KEY` from our validated env schema. Model
 * defaults to `claude-haiku-4-5` (fastest tier) — the co-worker used
 * whatever CLAUDE_MODEL was set to, but haiku is the right choice here
 * given the interactive latency budget.
 *
 * Contract: given a conversation history + current turn (optional
 * image), returns { title?, content }. `title` is set only on the
 * first assistant reply so the caller can rename an untitled
 * conversation without a second round-trip.
 */

import { env } from '../../config/env.js';

const MODEL = process.env.AI_CONTENT_MODEL ?? 'claude-haiku-4-5';
const MAX_TOKENS = Number(process.env.AI_CONTENT_MAX_TOKENS ?? 1024);

export type ClaudeImage = { mimeType: string; base64: string };

export interface GenerateInput {
  history: Array<{ sender: 'user' | 'assistant'; message: string }>;
  message: string;
  image?: ClaudeImage | null;
  isFirstTurn: boolean;
  context?: { contentType?: string; tone?: string; language?: string; length?: string };
}

export interface GenerateOutput {
  title?: string;
  content: string;
}

class ClaudeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function systemPrompt(ctx: GenerateInput['context'], isFirstTurn: boolean): string {
  const bits: string[] = [
    "You are Content Buddy, an AI writing partner for members of Tamil Business Tribe.",
    "Reply in a warm, practical, action-oriented tone.",
    "When a member asks for content (a post, ad, script, email, message), produce the finished text — do not describe what you'll write, just write it.",
  ];
  if (ctx?.language) bits.push(`Reply in ${ctx.language}. Use natural, native-sounding phrasing.`);
  if (ctx?.tone) bits.push(`Tone: ${ctx.tone}.`);
  if (ctx?.contentType) bits.push(`Content type: ${ctx.contentType}.`);
  if (ctx?.length) bits.push(`Target length: ${ctx.length}.`);
  if (isFirstTurn) {
    bits.push(
      "In your response, at the very top on its own line write: TITLE: <5-8 word conversation title>. Do not repeat the title in the body.",
    );
  }
  return bits.join(' ');
}

function extractTitle(text: string): { title?: string; content: string } {
  const match = text.match(/^\s*TITLE:\s*(.+?)\s*\n+/);
  if (match) {
    return { title: match[1].trim().slice(0, 80), content: text.slice(match[0].length).trim() };
  }
  return { content: text.trim() };
}

export async function generateContent(input: GenerateInput): Promise<GenerateOutput> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ClaudeError('claude_not_configured', 'ANTHROPIC_API_KEY is not set on the server.');
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Rebuild the multi-turn conversation. Anthropic requires strictly
  // alternating user/assistant messages; the co-worker's version also
  // enforced this and dropped orphan assistant turns. We just pass the
  // history verbatim and append the current user turn.
  const messages: any[] = input.history.map((h) => ({
    role: h.sender === 'assistant' ? 'assistant' : 'user',
    content: h.message,
  }));

  const currentUserContent: any[] = [];
  if (input.image) {
    currentUserContent.push({
      type: 'image',
      source: { type: 'base64', media_type: input.image.mimeType, data: input.image.base64 },
    });
  }
  currentUserContent.push({ type: 'text', text: input.message });
  messages.push({ role: 'user', content: currentUserContent });

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(input.context, input.isFirstTurn),
      messages,
    });
    const text = (resp.content?.[0] as any)?.text ?? '';
    if (!text) throw new ClaudeError('claude_parse_error', 'Empty response from Claude.');
    return extractTitle(text);
  } catch (err: any) {
    if (err instanceof ClaudeError) throw err;
    const status = err?.status ?? err?.response?.status;
    if (status === 401) throw new ClaudeError('claude_auth_error', 'Claude API key rejected.');
    if (status === 403) throw new ClaudeError('claude_forbidden', 'Claude API forbidden.');
    if (status === 429) throw new ClaudeError('claude_rate_limited', 'Claude API rate-limited.');
    if (status === 402) throw new ClaudeError('claude_billing_error', 'Claude API billing issue.');
    if (status >= 500) throw new ClaudeError('claude_server_error', 'Claude API server error.');
    if (err?.name === 'AbortError' || /timeout/i.test(String(err?.message ?? '')))
      throw new ClaudeError('claude_timeout', 'Claude API timed out.');
    throw new ClaudeError('claude_error', err?.message ?? 'Claude call failed.');
  }
}
