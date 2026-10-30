import { describe, expect, it } from 'vitest';
import {
  dedupeIds,
  deriveAnswerKey,
  sampleMatrixCell,
  validateAccessCodeBody,
  validateMatrixCellBody,
  validateQuestionBody,
  validateQuestionSetBody,
  validateQuestionTypeBody,
} from './contentRules.js';

const likert = (n = 5) => Array.from({ length: n }, (_, i) => ({ optionText: `o${i}`, score: i + 1, order: i + 1 }));
const base = { typeId: 't1', text: 'Q?', order: 1, questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 5, options: likert() };

describe('validateQuestionBody (same messages as the standalone validators)', () => {
  it('accepts a valid Likert question', () => {
    expect(validateQuestionBody(base)).toBeNull();
  });

  it.each([
    [{ typeId: '' }, 'Category is required.'],
    [{ text: ' ' }, 'Question text is required.'],
    [{ order: 0 }, 'Display order must be a positive number.'],
    [{ order: 1.5 }, 'Display order must be a positive number.'],
    [{ questionType: 'ESSAY' }, 'A valid question type is required.'],
    [{ language: 'fr' }, 'Language must be English (en) or Tamil (ta).'],
    [{ dimension: 'Charisma' }, 'A valid dimension is required.'],
    [{ marks: 0 }, 'Marks must be a positive number.'],
    [{ options: [] }, 'At least one answer option is required.'],
    [{ options: likert(4) }, 'Likert-scale questions need at least 5 scored options.'],
    [{ hasAudio: true, audioUrl: '' }, 'Enable-audio questions need an uploaded audio file or URL.'],
    [{ audioUrl: 'x'.repeat(4_600_001) }, 'Audio file is too large. Please use a clip under 3 MB.'],
  ])('%j → %s', (patch, msg) => {
    expect(validateQuestionBody({ ...base, ...patch })).toBe(msg);
  });

  it('type-specific answer rules', () => {
    const mcq = { ...base, questionType: 'NUMERICAL_ABILITY', options: [{ optionText: 'a', score: 1 }, { optionText: 'b', score: 0 }] };
    expect(validateQuestionBody(mcq)).toBe('Select exactly one correct answer.');
    expect(validateQuestionBody({ ...mcq, options: [{ optionText: 'a', score: 1, isCorrect: true }, { optionText: 'b', score: 0 }] })).toBeNull();
    expect(validateQuestionBody({ ...base, questionType: 'IMAGE_BASED', imageUrl: '', options: mcq.options })).toBe('Image-based questions require an image URL.');
    expect(validateQuestionBody({ ...base, questionType: 'SITUATIONAL', options: [{ optionText: 'a', score: 1 }] }))
      .toBe('Every situational option needs at least one dimension score.');
    const multi = { ...base, questionType: 'MULTI_SELECT', options: [{ optionText: 'a', score: 1, isCorrect: true }] };
    expect(validateQuestionBody(multi)).toBe('Select a scoring mode (exact or partial) for multi-select questions.');
    expect(validateQuestionBody({ ...multi, scoringMode: 'partial', options: [{ optionText: 'a', score: 1 }] })).toBe('Select at least one correct answer.');
    expect(validateQuestionBody({ ...multi, scoringMode: 'exact' })).toBeNull();
    expect(validateQuestionBody({ ...base, questionType: 'RANKING', options: [{ optionText: 'a', score: 1 }] })).toBe('Ranking questions need at least 2 items to order.');
  });
});

describe('deriveAnswerKey', () => {
  const opts = [{ _id: 'a', isCorrect: false }, { _id: 'b', isCorrect: true }, { _id: 'c', isCorrect: true }];
  it('single-correct types use the flagged option', () => {
    expect(deriveAnswerKey('LOGICAL_ABILITY', opts)).toEqual({ correctOptionId: 'b', correctOptionIds: null, idealOrder: null });
  });
  it('multi-select collects all flagged options', () => {
    expect(deriveAnswerKey('MULTI_SELECT', opts)).toEqual({ correctOptionId: null, correctOptionIds: ['b', 'c'], idealOrder: null });
  });
  it('ranking uses the saved option order', () => {
    expect(deriveAnswerKey('RANKING', opts).idealOrder).toEqual(['a', 'b', 'c']);
  });
  it('likert / situational have no answer key', () => {
    expect(deriveAnswerKey('LIKERT_SCALE', opts)).toEqual({ correctOptionId: null, correctOptionIds: null, idealOrder: null });
  });
});

describe('other validators', () => {
  it('question sets', () => {
    expect(validateQuestionSetBody({ name: 'Set', durationMinutes: 30, questionIds: ['q1'] })).toBeNull();
    expect(validateQuestionSetBody({ name: 'x'.repeat(101), durationMinutes: 30, questionIds: ['q1'] })).toBe('Set name must be 100 characters or fewer.');
    expect(validateQuestionSetBody({ name: 'Set', durationMinutes: 0, questionIds: ['q1'] })).toBe('Duration must be a whole number of minutes (at least 1).');
    expect(validateQuestionSetBody({ name: 'Set', durationMinutes: 30, questionIds: [] })).toBe('Select at least one question for the set.');
  });
  it('access codes', () => {
    expect(validateAccessCodeBody({ code: 'TBT2026', label: 'Members' })).toBeNull();
    expect(validateAccessCodeBody({ code: 'TBT-26', label: 'x' })).toBe('Code must contain only letters and numbers.');
    expect(validateAccessCodeBody({ code: 'ABCD', label: '' })).toBe('Label is required.');
  });
  it('question types and matrix cells', () => {
    expect(validateQuestionTypeBody({ name: 'Lead', order: 2, description: 'd' })).toBeNull();
    expect(validateQuestionTypeBody({ name: 'Lead', order: 0, description: 'd' })).toBe('Display order must be a positive number.');
    expect(validateMatrixCellBody({ rowTypeId: 'a', colTypeId: 'b', businessName: 'X', rating: 6 })).toBe('Rating must be a number from 1 to 5.');
    expect(validateMatrixCellBody({ rowTypeId: 'a', colTypeId: 'b', businessName: 'X', rating: 4 })).toBeNull();
  });
});

describe('helpers', () => {
  it('dedupeIds keeps first-seen order', () => {
    expect(dedupeIds(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });
  it('sampleMatrixCell matches the standalone sample grid', () => {
    expect(sampleMatrixCell('Communication', 'Communication')).toEqual(['Public Relations Agency', 5]);
    expect(sampleMatrixCell('Leadership', 'Risk Taking')).toEqual(['Startup Founder / Venture', 5]);
    expect(sampleMatrixCell('Numerical Ability', 'Communication')).toEqual(['Data Analytics Firm', 5]);
    expect(sampleMatrixCell('Custom Trait', 'Other')).toEqual(['Custom Trait Venture', 3]);
  });
});
