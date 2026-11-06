import { buildSections, orderByIds } from './assessmentRules.js';

// Read-only review of a member's submitted attempt: the attempt's frozen
// questions (in attempt order, grouped into the same category sections as the
// assessment), each question's answer options, its time limit, and what the
// member answered. Never exposes scoring secrets (score / is_correct /
// dimension_scores / correct ids / ideal order).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export interface ReviewOption {
  _id: string;
  optionText: string;
  optionImageUrl: string;
  order: number;
}

export interface ReviewAnswer {
  status: 'answered' | 'skipped' | 'timeout';
  /** LIKERT / single-choice / situational: one id. MULTI_SELECT: the chosen ids. RANKING: the member's order. */
  selectedOptionIds: string[];
  timeTakenSeconds: number | null;
}

export interface ReviewQuestion {
  _id: string;
  text: string;
  order: number;
  questionType: string;
  language: 'en' | 'ta';
  timeLimitSeconds: number | null;
  instructionText: string;
  imageUrl: string;
  options: ReviewOption[];
  answer: ReviewAnswer | null;
}

/** The ids a stored psy_answers row selected, in the member's order. */
export function selectedIds(a: Row): string[] {
  if (Array.isArray(a.ranking_order) && a.ranking_order.length) return a.ranking_order.map(String);
  if (Array.isArray(a.selected_option_ids) && a.selected_option_ids.length) return a.selected_option_ids.map(String);
  return a.answer_option_id ? [String(a.answer_option_id)] : [];
}

export function buildAnswerReview(
  types: Row[],
  questionRows: Row[],
  optionRows: Row[],
  answerRows: Row[],
  orderedIds: string[],
) {
  const optionsByQ: Record<string, ReviewOption[]> = {};
  for (const o of [...optionRows].sort((a, b) => a.sort_order - b.sort_order)) {
    (optionsByQ[o.question_id] ||= []).push({ _id: String(o.id), optionText: o.option_text, optionImageUrl: o.option_image_url ?? '', order: o.sort_order });
  }
  const answerByQ = new Map(answerRows.map((a) => [String(a.question_id), a]));

  const questions = orderByIds(questionRows, orderedIds).map((q) => {
    const a = answerByQ.get(String(q.id));
    return {
      _id: String(q.id),
      typeId: q.type_id,
      text: q.text,
      order: q.sort_order,
      questionType: q.question_type,
      language: q.language === 'ta' ? 'ta' : 'en',
      timeLimitSeconds: q.time_limit_seconds ?? null,
      instructionText: q.instruction_text ?? '',
      imageUrl: q.image_url ?? '',
      options: optionsByQ[q.id] || [],
      answer: a
        ? {
            status: a.status === 'timeout' ? 'timeout' : a.status === 'skipped' ? 'skipped' : 'answered',
            selectedOptionIds: selectedIds(a),
            timeTakenSeconds: typeof a.time_taken_seconds === 'number' ? a.time_taken_seconds : null,
          }
        : null,
    } as ReviewQuestion & { typeId: string };
  });

  return buildSections(types, questions, orderedIds).map((s) => ({
    typeId: s.typeId,
    typeName: s.typeName,
    typeIcon: s.typeIcon,
    typeColor: s.typeColor,
    questions: s.questions.map(({ typeId: _t, ...q }) => q),
  }));
}
