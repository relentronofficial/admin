// Admin view of one submitted attempt: every question in the attempt's order,
// its options (with scores and the correct answer, which admins may see), what
// the candidate chose, and the score / time recorded for that answer. Read-only;
// built from psy_sessions + psy_answers + psy_questions + psy_answer_options.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export interface SheetOption {
  _id: string;
  optionText: string;
  optionImageUrl: string;
  order: number;
  score: number | null;
  isCorrect: boolean;
  selected: boolean;
  /** RANKING: 1-based position the candidate gave this option; null otherwise. */
  rankGiven: number | null;
}

export interface SheetQuestion {
  number: number;
  questionId: string;
  /** False when the question was deleted after the attempt (text no longer available). */
  exists: boolean;
  text: string;
  questionType: string;
  language: string;
  typeName: string;
  dimension: string;
  timeLimitSeconds: number | null;
  options: SheetOption[];
  /** RANKING: the configured ideal order (option ids); [] otherwise. */
  idealOrder: string[];
  answer: {
    status: 'answered' | 'skipped' | 'timeout' | 'not-answered';
    selectedOptionIds: string[];
    score: number | null;
    maxScore: number | null;
    isCorrect: boolean | null;
    timeTakenSeconds: number | null;
    answeredAt: string | null;
  };
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/** The option ids an answer row selected, in the candidate's order. */
export function answerSelection(a: Row): string[] {
  const rank = ids(a.ranking_order);
  if (rank.length) return rank;
  const multi = ids(a.selected_option_ids);
  if (multi.length) return multi;
  return a.answer_option_id ? [String(a.answer_option_id)] : [];
}

/**
 * Question order: the attempt's frozen question_ids; questions answered but not
 * in that list (older attempts) follow in their recorded question_order.
 */
export function attemptQuestionOrder(sessionQuestionIds: unknown, answerRows: Row[]): string[] {
  const order = ids(sessionQuestionIds);
  const seen = new Set(order);
  const extra = [...answerRows]
    .filter((a) => !seen.has(String(a.question_id)))
    .sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0))
    .map((a) => String(a.question_id));
  return [...order, ...new Set(extra)];
}

export function buildAnswerSheet(input: {
  session: Row | null;
  questions: Row[];
  options: Row[];
  answers: Row[];
  types: Row[];
}) {
  const { session, questions, options, answers, types } = input;
  const qById = new Map(questions.map((q) => [String(q.id), q]));
  const typeName = new Map(types.map((t) => [String(t.id), String(t.name ?? '')]));
  const aByQ = new Map(answers.map((a) => [String(a.question_id), a]));
  const optsByQ = new Map<string, Row[]>();
  for (const o of [...options].sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))) {
    const k = String(o.question_id);
    if (!optsByQ.has(k)) optsByQ.set(k, []);
    optsByQ.get(k)!.push(o);
  }

  const order = attemptQuestionOrder(session?.question_ids, answers);
  const sheet: SheetQuestion[] = order.map((qid, i) => {
    const q = qById.get(qid);
    const a = aByQ.get(qid);
    const selected = a ? answerSelection(a) : [];
    const isRanking = q?.question_type === 'RANKING';
    const correctIds = new Set([...(q?.correct_option_id ? [String(q.correct_option_id)] : []), ...ids(q?.correct_option_ids)]);
    const opts = (optsByQ.get(qid) ?? []).map((o) => ({
      _id: String(o.id),
      optionText: String(o.option_text ?? ''),
      optionImageUrl: String(o.option_image_url ?? ''),
      order: o.sort_order ?? 0,
      score: num(o.score),
      isCorrect: !!o.is_correct || correctIds.has(String(o.id)),
      selected: !isRanking && selected.includes(String(o.id)),
      rankGiven: isRanking && selected.includes(String(o.id)) ? selected.indexOf(String(o.id)) + 1 : null,
    }));
    const rawStatus = a?.status;
    const status: SheetQuestion['answer']['status'] = !a ? 'not-answered'
      : rawStatus === 'timeout' ? 'timeout' : rawStatus === 'skipped' ? 'skipped' : 'answered';
    return {
      number: i + 1,
      questionId: qid,
      exists: !!q,
      text: q ? String(q.text ?? '') : '',
      questionType: String(q?.question_type ?? ''),
      language: q?.language === 'ta' ? 'ta' : 'en',
      typeName: q ? typeName.get(String(q.type_id)) ?? '' : '',
      dimension: String(q?.dimension ?? a?.dimension ?? ''),
      timeLimitSeconds: num(q?.time_limit_seconds),
      options: opts,
      idealOrder: isRanking ? ids(q?.ideal_order) : [],
      answer: {
        status,
        selectedOptionIds: selected,
        score: num(a?.score),
        maxScore: num(a?.max_score),
        isCorrect: typeof a?.is_correct === 'boolean' ? a.is_correct : null,
        timeTakenSeconds: num(a?.time_taken_seconds),
        answeredAt: iso(a?.answered_at),
      },
    };
  });

  const count = (s: string) => sheet.filter((q) => q.answer.status === s).length;
  return {
    attempt: session
      ? {
          attemptNumber: session.attempt_number ?? 1,
          status: String(session.status ?? ''),
          startedAt: iso(session.started_at),
          submittedAt: iso(session.submitted_at),
          expiresAt: iso(session.expires_at),
          autoSubmitted: !!session.auto_submitted,
          durationMinutes: num(session.duration_minutes),
          timeUsedSeconds: session.started_at && session.submitted_at
            ? Math.max(0, Math.round((new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime()) / 1000))
            : null,
        }
      : null,
    summary: {
      questions: sheet.length,
      answered: count('answered'),
      skipped: count('skipped'),
      timedOut: count('timeout'),
      notAnswered: count('not-answered'),
    },
    questions: sheet,
  };
}
