import { evaluateAnswer, type ScoringOption, type ScoringQuestion } from './scoring.js';

/**
 * Pure parts of the candidate assessment flow, ported from the standalone
 * controllers/assessmentController.js.
 */

/** Submit grace window: absorbs network/clock skew on the client's timeout auto-submit. */
export const SUBMIT_GRACE_MS = 60 * 1000;

/** Fisher–Yates copy. RANKING options are stored in the correct order, so they must be shuffled for candidates. */
export function shuffled<T>(arr: T[], random: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Reorders fetched rows to an ordered id list, dropping ids that didn't resolve. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function orderByIds<T extends Record<string, any>>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((x) => [String(x.id), x]));
  return orderedIds.map((id) => byId.get(String(id))).filter((x): x is T => !!x);
}

/** A question's audio is shown only when actually playable (data URI or absolute URL). */
export function publicAudio(q: { hasAudio?: boolean; audioUrl?: string | null }) {
  const url = typeof q.audioUrl === 'string' ? q.audioUrl.trim() : '';
  const playable = !!q.hasAudio && !!url && (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'));
  return { hasAudio: playable, audioUrl: playable ? url : undefined };
}

export interface SubmittedAnswer {
  questionId: string;
  answerOptionId?: string;
  answerOptionIds?: string[];
  orderedOptionIds?: string[];
  timeTakenSeconds?: number;
  status?: string;
}

export interface AttemptQuestion extends ScoringQuestion {
  order: number;
}

export interface AnswerRow {
  questionId: string;
  answerOptionId: string | null;
  selectedOptionIds: string[] | null;
  rankingOrder: string[] | null;
  score: number;
  maxScore: number;
  isCorrect: boolean | null;
  dimension: string;
  dimensionScores: Record<string, number>;
  questionOrder: number;
  timeTakenSeconds: number | null;
  status: 'answered' | 'skipped' | 'timeout';
}

function referencedOptionIds(a: SubmittedAnswer | undefined, questionType: string): string[] {
  if (!a) return [];
  if (questionType === 'MULTI_SELECT') return a.answerOptionIds || [];
  if (questionType === 'RANKING') return a.orderedOptionIds || [];
  return a.answerOptionId ? [a.answerOptionId] : [];
}

/**
 * Scores a submission against the attempt's frozen questions. Every question
 * gets a row: a real answer, or a 0-score skipped/timeout row. A manual
 * (non-auto) submit must account for every question.
 */
export function buildAnswerRows(
  questions: AttemptQuestion[],
  answers: SubmittedAnswer[],
  optionsByQuestion: Record<string, ScoringOption[]>,
  autoSubmitted: boolean,
): { error: string } | { rows: AnswerRow[] } {
  const byQ = new Map((answers || []).map((a) => [String(a.questionId), a]));
  const unresolved = questions.filter((q) => !byQ.has(q.id));
  if (!autoSubmitted && unresolved.length) return { error: `All ${questions.length} questions must be answered or explicitly timed out.` };

  const rows: AnswerRow[] = [];
  for (const q of questions) {
    const a = byQ.get(q.id);
    const opts = optionsByQuestion[q.id] || [];
    const refIds = referencedOptionIds(a, q.questionType).map(String);
    const time = typeof a?.timeTakenSeconds === 'number' && a.timeTakenSeconds >= 0 ? a.timeTakenSeconds : null;
    if (!refIds.length) {
      rows.push({
        questionId: q.id, answerOptionId: null, selectedOptionIds: null, rankingOrder: null,
        score: 0, maxScore: q.marks, isCorrect: null, dimension: q.dimension, dimensionScores: {},
        questionOrder: q.order, timeTakenSeconds: time, status: a?.status === 'timeout' ? 'timeout' : 'skipped',
      });
      continue;
    }
    const valid = new Set(opts.map((o) => o.id));
    if (!refIds.every((id) => valid.has(id))) return { error: 'Invalid answer option for question.' };
    const value = q.questionType === 'MULTI_SELECT' ? a!.answerOptionIds : q.questionType === 'RANKING' ? a!.orderedOptionIds : a!.answerOptionId;
    let ev;
    try {
      ev = evaluateAnswer(q, opts, value);
    } catch (e) {
      return { error: (e as Error).message };
    }
    rows.push({
      questionId: q.id,
      answerOptionId: q.questionType === 'MULTI_SELECT' || q.questionType === 'RANKING' ? null : String(a!.answerOptionId),
      selectedOptionIds: q.questionType === 'MULTI_SELECT' ? (a!.answerOptionIds || []).map(String) : null,
      rankingOrder: q.questionType === 'RANKING' ? (a!.orderedOptionIds || []).map(String) : null,
      score: ev.score, maxScore: ev.maxScore, isCorrect: ev.isCorrect, dimension: q.dimension, dimensionScores: ev.dimensionScores,
      questionOrder: q.order, timeTakenSeconds: time, status: a!.status === 'timeout' ? 'timeout' : 'answered',
    });
  }
  return { rows };
}

/**
 * Groups the attempt's questions into category sections for the candidate UI,
 * ordered by where each category FIRST appears in the set (so the admin
 * controls the sequence by reordering the set). Empty categories are dropped.
 */
export function buildSections<Q extends { _id: string; typeId: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  types: Record<string, any>[],
  questions: Q[],
  orderedIds: string[],
) {
  const sections = types
    .map((t) => ({ typeId: t.id, typeName: t.name, typeIcon: t.icon, typeColor: t.color, questions: questions.filter((q) => q.typeId === t.id) }))
    .filter((s) => s.questions.length > 0);
  const pos = new Map(orderedIds.map((id, i) => [String(id), i]));
  const first = (s: { questions: Q[] }) => Math.min(...s.questions.map((q) => pos.get(q._id) ?? Number.MAX_SAFE_INTEGER));
  return sections.sort((a, b) => first(a) - first(b));
}
