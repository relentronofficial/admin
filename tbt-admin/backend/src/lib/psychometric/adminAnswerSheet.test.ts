import { describe, expect, it } from 'vitest';
import { answerSelection, attemptQuestionOrder, buildAnswerSheet } from './adminAnswerSheet.js';

const types = [{ id: 't1', name: 'Leadership' }];
const q = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type_id: 't1', text: `Text ${id}?`, question_type: 'LIKERT_SCALE', language: 'en', dimension: 'Lead', time_limit_seconds: 45, ...extra,
});
const o = (id: string, qid: string, order: number, score: number, isCorrect = false) => ({
  id, question_id: qid, option_text: `Opt ${id}`, option_image_url: '', sort_order: order, score, is_correct: isCorrect,
});

describe('answerSelection', () => {
  it('reads single, multi-select and ranking answers', () => {
    expect(answerSelection({ answer_option_id: 'a' })).toEqual(['a']);
    expect(answerSelection({ selected_option_ids: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(answerSelection({ ranking_order: ['c', 'a'] })).toEqual(['c', 'a']);
    expect(answerSelection({})).toEqual([]);
  });
});

describe('attemptQuestionOrder', () => {
  it('uses the frozen attempt order, then answered questions missing from it by question_order', () => {
    expect(attemptQuestionOrder(['q2', 'q1'], [{ question_id: 'q9', question_order: 5 }, { question_id: 'q8', question_order: 3 }, { question_id: 'q1' }]))
      .toEqual(['q2', 'q1', 'q8', 'q9']);
    expect(attemptQuestionOrder(null, [{ question_id: 'b', question_order: 2 }, { question_id: 'a', question_order: 1 }])).toEqual(['a', 'b']);
  });
});

describe('buildAnswerSheet', () => {
  const session = {
    attempt_number: 2, status: 'submitted', started_at: '2026-07-01T10:00:00Z', submitted_at: '2026-07-01T10:12:30Z',
    expires_at: '2026-07-01T10:30:00Z', auto_submitted: false, duration_minutes: 30, question_ids: ['q1', 'q2', 'q3', 'q4'],
  };
  const questions = [
    q('q1'),
    q('q2', { question_type: 'SINGLE_CHOICE', correct_option_id: 'q2b', time_limit_seconds: null }),
    q('q3', { question_type: 'RANKING', ideal_order: ['q3a', 'q3b'] }),
    q('q4'),
  ];
  const options = [o('q1b', 'q1', 2, 4), o('q1a', 'q1', 1, 5), o('q2a', 'q2', 1, 0), o('q2b', 'q2', 2, 1), o('q3a', 'q3', 1, 0), o('q3b', 'q3', 2, 0)];
  const answers = [
    { question_id: 'q1', answer_option_id: 'q1b', score: 4, max_score: 5, is_correct: null, time_taken_seconds: 12.5, answered_at: '2026-07-01T10:01:00Z', status: null },
    { question_id: 'q2', answer_option_id: 'q2a', score: 0, max_score: 1, is_correct: false, time_taken_seconds: 9, answered_at: '2026-07-01T10:02:00Z', status: 'answered' },
    { question_id: 'q3', ranking_order: ['q3b', 'q3a'], score: 1, max_score: 2, time_taken_seconds: 30, answered_at: '2026-07-01T10:03:00Z', status: 'answered' },
  ];
  const out = buildAnswerSheet({ session, questions, options, answers, types });

  it('summarises the attempt: times, duration and time used', () => {
    expect(out.attempt).toMatchObject({ attemptNumber: 2, status: 'submitted', durationMinutes: 30, timeUsedSeconds: 750, autoSubmitted: false });
    expect(out.summary).toEqual({ questions: 4, answered: 3, skipped: 0, timedOut: 0, notAnswered: 1 });
  });

  it('lists questions in attempt order with sorted options, scores and the chosen option', () => {
    expect(out.questions.map((x) => x.questionId)).toEqual(['q1', 'q2', 'q3', 'q4']);
    const q1 = out.questions[0];
    expect(q1).toMatchObject({ number: 1, text: 'Text q1?', typeName: 'Leadership', timeLimitSeconds: 45, exists: true });
    expect(q1.options.map((x) => [x.optionText, x.score, x.selected])).toEqual([['Opt q1a', 5, false], ['Opt q1b', 4, true]]);
    expect(q1.answer).toMatchObject({ status: 'answered', score: 4, maxScore: 5, timeTakenSeconds: 12.5 });
  });

  it('marks the correct answer and a wrong pick', () => {
    const q2 = out.questions[1];
    expect(q2.options.find((x) => x._id === 'q2b')!.isCorrect).toBe(true);
    expect(q2.options.find((x) => x._id === 'q2a')!.selected).toBe(true);
    expect(q2.answer.isCorrect).toBe(false);
  });

  it("shows the candidate's ranking next to the ideal order", () => {
    const q3 = out.questions[2];
    expect(q3.options.map((x) => [x._id, x.rankGiven, x.selected])).toEqual([['q3a', 2, false], ['q3b', 1, false]]);
    expect(q3.idealOrder).toEqual(['q3a', 'q3b']);
  });

  it('keeps an unanswered question and one deleted since the attempt', () => {
    expect(out.questions[3].answer.status).toBe('not-answered');
    const gone = buildAnswerSheet({ session: { question_ids: ['zz'] }, questions: [], options: [], answers: [{ question_id: 'zz', status: 'skipped', score: 0, max_score: 5 }], types });
    expect(gone.questions[0]).toMatchObject({ exists: false, text: '' });
    expect(gone.questions[0].answer.status).toBe('skipped');
    expect(gone.summary.skipped).toBe(1);
  });
});
