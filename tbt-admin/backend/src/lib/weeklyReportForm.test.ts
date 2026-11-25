import { describe, expect, it } from 'vitest';
import { answersAsText, batchWeek, batchWeekOf, prefill, readAnswer, readAnswers, saveQuestionsSchema, storedWeek, withShownWeek, type WeeklyQuestion } from './weeklyReportForm.js';

const q = (over: Partial<WeeklyQuestion> = {}): WeeklyQuestion => ({ id: 'a', question: 'Q', help: '', type: 'short_text', required: true, options: [], ...over });

describe('batchWeek', () => {
  const start = new Date('2026-11-02T00:00:00Z'); // 2 Nov in IST
  it('counts 7 IST days per week from the start date', () => {
    expect(batchWeek(start, new Date('2026-11-01T18:29:59Z'))).toBe(0);
    expect(batchWeek(start, new Date('2026-11-01T18:30:00Z'))).toBe(1); // 2 Nov 00:00 IST
    expect(batchWeek(start, new Date('2026-11-08T18:29:59Z'))).toBe(1);
    expect(batchWeek(start, new Date('2026-11-08T18:30:00Z'))).toBe(2);
    expect(batchWeek(start, new Date('2027-03-07T18:29:59Z'))).toBe(18);
    expect(batchWeek(start, new Date('2027-03-07T18:30:00Z'))).toBe(19);
  });
  it('uses the IST start date whatever the time of day', () => {
    expect(batchWeek(new Date('2026-11-01T18:30:00Z'), new Date('2026-11-08T18:29:00Z'))).toBe(1);
  });
});

describe('stored week', () => {
  it('keeps question reports apart from enrollment weeks', () => {
    expect(batchWeekOf(storedWeek(1))).toBe(1);
    expect(batchWeekOf(storedWeek(18))).toBe(18);
    expect([0, 18, 100, 119].map(batchWeekOf)).toEqual([null, null, null, null]);
    expect(withShownWeek({ weekNumber: storedWeek(4) }).weekNumber).toBe(4);
    expect(withShownWeek({ weekNumber: 30 }).weekNumber).toBe(30);
  });
});

describe('answers', () => {
  it('checks each type', () => {
    expect(readAnswer(q({ type: 'number' }), '1500.5')).toBe(1500.5);
    expect(() => readAnswer(q({ type: 'number' }), 'x')).toThrow('enter a number');
    expect(readAnswer(q({ type: 'number' }), 0)).toBe(0);
    expect(() => readAnswer(q({ type: 'rating' }), 11)).toThrow();
    expect(readAnswer(q({ type: 'yes_no' }), 'Yes')).toBe('Yes');
    expect(() => readAnswer(q({ type: 'yes_no' }), 'Maybe')).toThrow();
    expect(() => readAnswer(q({ type: 'single_choice', options: ['A', 'B'] }), 'C')).toThrow();
    expect(readAnswer(q({ type: 'multi_choice', options: ['A', 'B'] }), ['B', 'A', 'B'])).toEqual(['A', 'B']);
    expect(() => readAnswer(q({ type: 'date' }), '2026-02-30')).toThrow('enter a date');
    expect(readAnswer(q(), '  ')).toBeNull();
    expect(() => readAnswer(q(), {})).toThrow();
  });
  it('needs required answers and at least one answer', () => {
    expect(() => readAnswers([q()], {})).toThrow('required');
    expect(() => readAnswers([q({ required: false })], {})).toThrow('at least one');
    expect(() => readAnswers([q({ id: 'toString' })], {})).toThrow('required');
    expect(readAnswers([q({ type: 'number' })], { a: 0 })[0].value).toBe(0);
  });
  it('refills only what still fits, and renders text', () => {
    const old = readAnswers([q({ type: 'single_choice', options: ['A', 'B'] }), q({ id: 'b' })], { a: 'A', b: 'hi' });
    expect(prefill([q({ type: 'single_choice', options: ['B', 'C'] }), q({ id: 'b' })], old)).toEqual({ b: 'hi' });
    expect(answersAsText(old)).toBe('Q\nA\n\nQ\nhi');
  });
});

describe('saveQuestionsSchema', () => {
  const save = (questions: unknown[]) => saveQuestionsSchema.safeParse({ version: 0, questions }).success;
  it('rejects bad questions', () => {
    expect(save([q()])).toBe(true);
    expect(save([])).toBe(true);
    expect(save([q({ question: ' ' })])).toBe(false);
    expect(save([q({ type: 'single_choice', options: ['A'] })])).toBe(false);
    expect(save([q({ type: 'multi_choice', options: ['A', 'A '] })])).toBe(false);
    expect(save([q(), q()])).toBe(false);
  });
});
