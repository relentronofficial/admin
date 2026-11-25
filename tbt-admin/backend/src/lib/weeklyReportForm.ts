// Weekly report questions — pure rules (no Prisma, `now` passed in); tested in
// weeklyReportForm.test.ts. Admins write the questions for weeks 1–18 once; every
// batch counts its own weeks from its start date (IST calendar days).
import { z } from 'zod';
import { IST_OFFSET_MS } from './weeklyReportGate.js';

export const TOTAL_WEEKS = 18;
export const QUESTION_TYPES = ['short_text', 'long_text', 'number', 'rating', 'yes_no', 'single_choice', 'multi_choice', 'date'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type AnswerValue = string | number | string[];

const CHOICE: QuestionType[] = ['single_choice', 'multi_choice'];

export const questionSchema = z.object({
  id: z.string().min(1).max(64),
  question: z.string().trim().min(1, 'Every question needs its text.').max(300),
  help: z.string().trim().max(300).optional().default(''),
  type: z.enum(QUESTION_TYPES),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1, 'An option is empty.').max(120)).max(20).optional().default([]),
}).superRefine((q, ctx) => {
  if (!CHOICE.includes(q.type)) return;
  if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: `"${q.question}" needs at least 2 options.` });
  else if (new Set(q.options).size !== q.options.length) ctx.addIssue({ code: 'custom', message: `"${q.question}" has the same option twice.` });
});
export type WeeklyQuestion = z.infer<typeof questionSchema>;

export const saveQuestionsSchema = z.object({
  version: z.number().int().min(0),
  questions: z.array(questionSchema).max(30)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'Two questions share an id.'),
});

export const submitAnswersSchema = z.object({
  courseId: z.string().uuid(),
  week: z.number().int().min(1).max(TOTAL_WEEKS),
  version: z.number().int().min(1),
  answers: z.record(z.string(), z.unknown()),
});

const istDay = (d: Date) => Math.floor((d.getTime() + IST_OFFSET_MS) / 86_400_000);

/** Batch week on `now`: 1 = the 7 days from the start date. ≤ 0 before it starts, > 18 once finished. */
export function batchWeek(startsAt: Date, now: Date): number {
  return Math.floor((istDay(now) - istDay(startsAt)) / 7) + 1;
}

/** One answer in its stored form, `null` when left blank; throws with a message for the member. */
export function readAnswer(q: WeeklyQuestion, raw: unknown): AnswerValue | null {
  const bad = (why: string): never => { throw new Error(`${q.question}: ${why}`); };
  if (raw === undefined || raw === null) return null;
  if (q.type === 'multi_choice') {
    if (!Array.isArray(raw) || raw.some((v) => !q.options.includes(v))) return bad('choose from the options');
    const picked = q.options.filter((o) => raw.includes(o));
    return picked.length ? picked : null;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') return bad('answer not understood');
  const s = String(raw).trim();
  if (!s) return null;
  switch (q.type) {
    case 'number': {
      const n = Number(s);
      return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : bad('enter a number');
    }
    case 'rating': {
      const n = Number(s);
      return Number.isInteger(n) && n >= 1 && n <= 10 ? n : bad('choose 1 to 10');
    }
    case 'yes_no': return s === 'Yes' || s === 'No' ? s : bad('choose Yes or No');
    case 'single_choice': return q.options.includes(s) ? s : bad('choose one of the options');
    case 'date': {
      const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
      return t && !Number.isNaN(t.getTime()) && t.toISOString().startsWith(s) ? s : bad('enter a date');
    }
    case 'short_text': return s.length <= 300 ? s : bad('keep it under 300 characters');
    default: return s.length <= 2000 ? s : bad('keep it under 2000 characters');
  }
}

export interface StoredAnswer { id: string; question: string; type: QuestionType; value: AnswerValue | null }

/** Checks a whole submission. The question text is stored with each answer, so later edits don't change history. */
export function readAnswers(questions: WeeklyQuestion[], raw: Record<string, unknown>): StoredAnswer[] {
  const out = questions.map((q) => {
    const value = readAnswer(q, Object.prototype.hasOwnProperty.call(raw, q.id) ? raw[q.id] : null);
    if (q.required && value === null) throw new Error(`${q.question}: this question is required`);
    return { id: q.id, question: q.question, type: q.type, value };
  });
  if (out.every((a) => a.value === null)) throw new Error('Answer at least one question.');
  return out;
}

/** Earlier answers that still fit today's questions, to fill the form in again. */
export function prefill(questions: WeeklyQuestion[], stored: StoredAnswer[] | null): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const q of questions) {
    const old = stored?.find((a) => a.id === q.id);
    if (!old || old.value === null) continue;
    try {
      const v = readAnswer(q, old.value);
      if (v !== null) out[q.id] = v;
    } catch { /* the question changed type or options */ }
  }
  return out;
}

/** Plain-text report, for the existing Feedback tab and WhatsApp message. */
export function answersAsText(week: number, answers: StoredAnswer[]): string {
  return [
    `Batch week ${week}`,
    ...answers.filter((a) => a.value !== null).map((a) => `${a.question}\n${Array.isArray(a.value) ? a.value.join(', ') : a.value}`),
  ].join('\n\n');
}
