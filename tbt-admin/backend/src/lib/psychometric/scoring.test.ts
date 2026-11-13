import { describe, expect, it } from 'vitest';
import { buildAnswerRows, buildSections, orderByIds, publicAudio, shuffled } from './assessmentRules.js';
import { calculateResult, computeQuestionMaxes, evaluateAnswer, getLevel, getRecommendations, type ScoredAnswer, type ScoringOption } from './scoring.js';

// Values below were checked against the standalone platform's original
// engines (a 28,400-case randomized cross-check run during the port).

const opts = (...scores: number[]) => scores.map((score, i) => ({ id: `o${i}`, score }));
const q = (over: Record<string, unknown> = {}) => ({ id: 'q1', typeId: 't1', questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 5, ...over }) as any;

describe('evaluateAnswer', () => {
  it('Likert: the chosen option score, no right/wrong', () => {
    expect(evaluateAnswer(q(), opts(1, 2, 3, 4, 5), 'o3')).toEqual({ score: 4, maxScore: 5, isCorrect: null, dimensionScores: { Leadership: 4 } });
    expect(() => evaluateAnswer(q(), opts(1, 2), 'nope')).toThrow('Invalid answer option for LIKERT_SCALE question.');
  });

  it('single-correct types: full marks or zero', () => {
    const mcq = q({ questionType: 'VERBAL_ABILITY', correctOptionId: 'o1' });
    expect(evaluateAnswer(mcq, opts(0, 0), 'o1')).toMatchObject({ score: 5, isCorrect: true });
    expect(evaluateAnswer(mcq, opts(0, 0), 'o0')).toMatchObject({ score: 0, isCorrect: false });
  });

  it('situational: multi-dimension, max = best option total', () => {
    const o: ScoringOption[] = [
      { id: 'a', score: 0, dimensionScores: { Communication: 5, Teamwork: 3 } },
      { id: 'b', score: 0, dimensionScores: { Leadership: 4 } },
    ];
    expect(evaluateAnswer(q({ questionType: 'SITUATIONAL' }), o, 'b')).toEqual({ score: 4, maxScore: 8, isCorrect: null, dimensionScores: { Leadership: 4 } });
  });

  it('multi-select: exact vs partial', () => {
    const base = { questionType: 'MULTI_SELECT', correctOptionIds: ['o0', 'o1'], marks: 4 };
    expect(evaluateAnswer(q({ ...base, scoringMode: 'exact' }), opts(0, 0, 0), ['o0'])).toMatchObject({ score: 0, isCorrect: false });
    expect(evaluateAnswer(q({ ...base, scoringMode: 'exact' }), opts(0, 0, 0), ['o1', 'o0'])).toMatchObject({ score: 4, isCorrect: true });
    expect(evaluateAnswer(q({ ...base, scoringMode: 'partial' }), opts(0, 0, 0), ['o0'])).toMatchObject({ score: 2 });
    expect(evaluateAnswer(q({ ...base, scoringMode: 'partial' }), opts(0, 0, 0), ['o0', 'o2'])).toMatchObject({ score: 0 });
  });

  it('ranking: share of exact positions', () => {
    const r = q({ questionType: 'RANKING', idealOrder: ['o0', 'o1', 'o2'], marks: 3 });
    expect(evaluateAnswer(r, opts(0, 0, 0), ['o0', 'o2', 'o1'])).toMatchObject({ score: 1, isCorrect: false });
    expect(() => evaluateAnswer(r, opts(0, 0, 0), ['o0'])).toThrow('Invalid ranking submitted for RANKING question.');
  });
});

describe('calculateResult', () => {
  it('scores, levels, categories, dimensions and composites', () => {
    const qs = [
      q({ id: 'a', typeId: 'lead', dimension: 'Leadership', marks: 5 }),
      q({ id: 'b', typeId: 'comm', dimension: 'Communication', marks: 5 }),
      q({ id: 'c', typeId: 'comm', dimension: 'Communication', marks: 5 }),
    ];
    const types = { lead: 'Leadership', comm: 'Communication' };
    const { categoryQuestionMax, dimensionQuestionMax } = computeQuestionMaxes(qs, types);
    const answers: ScoredAnswer[] = [
      { questionId: 'a', score: 5, isCorrect: null, dimensionScores: { Leadership: 5 }, status: 'answered' },
      { questionId: 'b', score: 4, isCorrect: null, dimensionScores: { Communication: 4 }, status: 'answered' },
      { questionId: 'c', score: 0, isCorrect: null, dimensionScores: {}, status: 'skipped' },
    ];
    const r = calculateResult(answers, { a: 'Leadership', b: 'Communication', c: 'Communication' }, categoryQuestionMax, dimensionQuestionMax, 3);
    expect(r).toMatchObject({
      totalMarks: 9, maxScore: 15, percentage: 60, level: 'Good',
      categoryScores: { Leadership: 5, Communication: 4 },
      categoryPercentages: { Leadership: 100, Communication: 40 },
      highestCategory: ['Leadership'],
      dimensionPercentages: { Leadership: 100, Communication: 40 },
      strongDimensions: ['Leadership', 'Communication'],
      skippedCount: 1,
      personalityScore: 28,
      businessReadinessPercent: 60,
    });
    expect(r.improvementAreas.map((x) => x.category)).toEqual(['Communication', 'Leadership']);
  });

  it('a zero score has no dominant category', () => {
    const r = calculateResult([{ questionId: 'a', score: 0, isCorrect: null, dimensionScores: {} }], { a: 'Leadership' }, { Leadership: 5 }, { Leadership: 5 }, 1);
    expect(r.highestCategory).toEqual([]);
    expect(r.level).toBe('Needs Improvement');
  });

  it('levels and recommendations', () => {
    expect([80, 79.9, 60, 40, 39.9].map(getLevel)).toEqual(['Excellent', 'Good', 'Good', 'Average', 'Needs Improvement']);
    expect(getRecommendations({ 'Risk Taking': 90 }).map((x) => x.business)).toEqual(['Freelance Services', 'Small Retail Business', 'Local Service Business']);
    expect(getRecommendations({ Communication: 80, Leadership: 80, 'Risk Taking': 80, Teamwork: 80 })).toHaveLength(5);
    expect(getRecommendations({ 'Risk Taking': 10 })[0].business).toBe('Franchise');
  });
});

describe('assessment rules', () => {
  const qs = [
    { id: 'a', typeId: 't', questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 5, order: 1 },
    { id: 'b', typeId: 't', questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 5, order: 2 },
  ];
  const optionsByQ = { a: opts(1, 5), b: opts(2, 4) };

  it('a manual submit must account for every question', () => {
    expect(buildAnswerRows(qs, [{ questionId: 'a', answerOptionId: 'o1' }], optionsByQ, false)).toEqual({ error: 'All 2 questions must be answered or explicitly timed out.' });
  });

  it('an auto-submit may be partial; missing → skipped, explicit timeout → timeout', () => {
    const r = buildAnswerRows(qs, [{ questionId: 'a', status: 'timeout' }], optionsByQ, true) as any;
    expect(r.rows.map((x: any) => [x.questionId, x.status, x.score])).toEqual([['a', 'timeout', 0], ['b', 'skipped', 0]]);
  });

  it('scores answered rows and rejects options from another question', () => {
    const ok = buildAnswerRows(qs, [{ questionId: 'a', answerOptionId: 'o1', timeTakenSeconds: 12 }, { questionId: 'b', answerOptionId: 'o0' }], optionsByQ, false) as any;
    expect(ok.rows.map((x: any) => [x.score, x.status, x.timeTakenSeconds])).toEqual([[5, 'answered', 12], [2, 'answered', null]]);
    const optsWrong = { a: [{ id: 'x1', score: 1 }], b: opts(2, 4) };
    expect(buildAnswerRows(qs, [{ questionId: 'a', answerOptionId: 'o1' }, { questionId: 'b', answerOptionId: 'o0' }], optsWrong, false)).toEqual({ error: 'Invalid answer option for question.' });
  });

  it('sections follow the set order, empty categories dropped', () => {
    const types = [{ id: 't1', name: 'One', icon: '', color: '' }, { id: 't2', name: 'Two', icon: '', color: '' }, { id: 't3', name: 'Three', icon: '', color: '' }];
    const questions = [{ _id: 'x', typeId: 't1' }, { _id: 'y', typeId: 't2' }];
    expect(buildSections(types, questions, ['y', 'x']).map((s) => s.typeName)).toEqual(['Two', 'One']);
  });

  it('audio only when playable; ids reorder; shuffle keeps members', () => {
    expect(publicAudio({ hasAudio: true, audioUrl: ' data:audio/mpeg;base64,AA ' })).toEqual({ hasAudio: true, audioUrl: 'data:audio/mpeg;base64,AA' });
    expect(publicAudio({ hasAudio: true, audioUrl: 'ftp://x' })).toEqual({ hasAudio: false, audioUrl: undefined });
    expect(publicAudio({ hasAudio: false, audioUrl: 'https://x/a.mp3' }).hasAudio).toBe(false);
    expect(orderByIds([{ id: 'a' }, { id: 'b' }], ['b', 'zz', 'a']).map((x) => x.id)).toEqual(['b', 'a']);
    expect(shuffled([1, 2, 3, 4], () => 0).sort()).toEqual([1, 2, 3, 4]);
  });
});
