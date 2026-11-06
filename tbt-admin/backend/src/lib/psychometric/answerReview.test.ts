import { describe, expect, it } from 'vitest';
import { buildAnswerReview, selectedIds } from './answerReview.js';

const types = [
  { id: 't1', name: 'Leadership', icon: 'crown', color: '#f00' },
  { id: 't2', name: 'Finance', icon: 'coin', color: '#0f0' },
];
const q = (id: string, typeId: string, extra: Record<string, unknown> = {}) => ({
  id, type_id: typeId, text: `Exact text of ${id}?`, sort_order: 10, question_type: 'LIKERT_SCALE', language: 'en',
  time_limit_seconds: 45, instruction_text: '', image_url: '', correct_option_id: 'secret', ideal_order: ['secret'], ...extra,
});
const o = (id: string, qid: string, order: number) => ({
  id, question_id: qid, option_text: `Option ${id}`, option_image_url: '', sort_order: order, score: 99, is_correct: true, dimension_scores: { x: 1 },
});

describe('selectedIds', () => {
  it('reads single, multi-select and ranking answers', () => {
    expect(selectedIds({ answer_option_id: 'a' })).toEqual(['a']);
    expect(selectedIds({ answer_option_id: null, selected_option_ids: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(selectedIds({ answer_option_id: null, ranking_order: ['c', 'a', 'b'] })).toEqual(['c', 'a', 'b']);
    expect(selectedIds({ answer_option_id: null, selected_option_ids: null, ranking_order: null })).toEqual([]);
  });
});

describe('buildAnswerReview', () => {
  const questions = [q('q1', 't1'), q('q2', 't2', { question_type: 'RANKING', time_limit_seconds: null }), q('q3', 't1')];
  // Options arrive unsorted; the review shows them in their configured order.
  const options = [o('q1b', 'q1', 2), o('q1a', 'q1', 1), o('q2a', 'q2', 1), o('q2b', 'q2', 2), o('q3a', 'q3', 1)];
  const answers = [
    { question_id: 'q1', answer_option_id: 'q1b', status: 'answered', time_taken_seconds: 12.5, score: 5, is_correct: true },
    { question_id: 'q2', answer_option_id: null, ranking_order: ['q2b', 'q2a'], status: 'answered', time_taken_seconds: 30 },
    { question_id: 'q3', answer_option_id: null, status: 'timeout', time_taken_seconds: null },
  ];
  // Attempt order: q2 first, so its section (Finance) comes first.
  const out = buildAnswerReview(types, questions, options, answers, ['q2', 'q1', 'q3']);

  it('groups questions into sections in attempt order', () => {
    expect(out.map((s) => s.typeName)).toEqual(['Finance', 'Leadership']);
    expect(out[1].questions.map((x) => x._id)).toEqual(['q1', 'q3']);
  });

  it('keeps exact text, sorted options and the configured time limit', () => {
    const q1 = out[1].questions[0];
    expect(q1.text).toBe('Exact text of q1?');
    expect(q1.options.map((x) => x.optionText)).toEqual(['Option q1a', 'Option q1b']);
    expect(q1.timeLimitSeconds).toBe(45);
    expect(out[0].questions[0].timeLimitSeconds).toBeNull();
  });

  it("attaches the member's saved answer, including ranking order and timeouts", () => {
    expect(out[1].questions[0].answer).toEqual({ status: 'answered', selectedOptionIds: ['q1b'], timeTakenSeconds: 12.5 });
    expect(out[0].questions[0].answer?.selectedOptionIds).toEqual(['q2b', 'q2a']);
    expect(out[1].questions[1].answer).toEqual({ status: 'timeout', selectedOptionIds: [], timeTakenSeconds: null });
  });

  it('never includes scoring secrets', () => {
    const json = JSON.stringify(out);
    for (const secret of ['score', 'is_correct', 'isCorrect', 'dimension_scores', 'correct_option_id', 'ideal_order', 'secret']) {
      expect(json).not.toContain(secret);
    }
  });

  it('skips questions deleted since the attempt and leaves unanswered ones null', () => {
    const r = buildAnswerReview(types, [q('q1', 't1')], [o('q1a', 'q1', 1)], [], ['gone', 'q1']);
    expect(r).toHaveLength(1);
    expect(r[0].questions.map((x) => x._id)).toEqual(['q1']);
    expect(r[0].questions[0].answer).toBeNull();
  });
});
