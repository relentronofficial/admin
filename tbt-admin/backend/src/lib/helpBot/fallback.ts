/** Answers that need no AI (pure). */
import type { FaqItem } from './helpBotLogic.js';

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** The published answer to exactly this question, if there is one. */
export function exactFaq(question: string, faqs: FaqItem[]): FaqItem | null {
  const q = norm(question);
  return (q && faqs.find((f) => norm(f.question) === q)) || null;
}

const COMMON = new Set(['what', 'when', 'where', 'which', 'how', 'the', 'and', 'for', 'can', 'are', 'you', 'this', 'that', 'with', 'from', 'have', 'does', 'epdi', 'enna', 'enga', 'naan', 'eppo', 'yen', 'want']);

/** The help answers that share the most words with the question. */
export function closestFaqs(question: string, faqs: FaqItem[], max = 3): FaqItem[] {
  const words = [...new Set(norm(question).split(' ').filter((w) => w.length > 2 && !COMMON.has(w)))];
  if (!words.length) return [];
  return faqs
    .map((f) => {
      const title = norm(f.question);
      const body = norm(f.answer);
      return { f, score: words.reduce((s, w) => s + (title.includes(w) ? 3 : body.includes(w) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.f);
}

/** What to say when the AI cannot answer. */
export function offlineAnswer(question: string, faqs: FaqItem[]): string {
  const found = closestFaqs(question, faqs);
  const help = found.length
    ? `The assistant can't think just now, but these help answers may be what you need:\n\n${found.map((f) => `**${f.question.trim()}**\n${f.answer.replace(/\s+/g, ' ').trim().slice(0, 600)}`).join('\n\n')}`
    : 'The assistant is not able to answer just now.';
  return `${help}\n\nStill need help? [Raise a ticket](/support/new) and the team will reply.`;
}
