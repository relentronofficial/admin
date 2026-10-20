import { describe, expect, it } from 'vitest';
import {
  FAQ_ANSWER_MAX,
  FAQ_QUESTION_MAX,
  canManageModuleFaqs,
  publicFaqList,
  sanitizeFaqText,
  validateFaqInput,
  validateFaqReorder,
} from './moduleFaqLogic.js';

describe('canManageModuleFaqs', () => {
  it('allows only admin and super_admin', () => {
    expect(canManageModuleFaqs('admin')).toBe(true);
    expect(canManageModuleFaqs('super_admin')).toBe(true);
    for (const r of ['mentor', 'support', '', null, undefined]) expect(canManageModuleFaqs(r as any)).toBe(false);
  });
});

describe('sanitizeFaqText', () => {
  it('keeps readable multiline answers and drops markup and control characters', () => {
    expect(sanitizeFaqText('Line one  \r\nLine two\r\n\r\n\r\n\r\nLine three', true)).toBe('Line one\nLine two\n\nLine three');
    expect(sanitizeFaqText('<script>alert(1)</script>Plain <b>bold</b>\u0007', true)).toBe('alert(1)Plain bold');
    expect(sanitizeFaqText('  What is\n  this?  ', false)).toBe('What is this?');
  });
});

describe('validateFaqInput', () => {
  it('requires a question and an answer', () => {
    expect(validateFaqInput({ answer: 'a' })).toEqual({ ok: false, error: 'Question is required' });
    expect(validateFaqInput({ question: 'q' })).toEqual({ ok: false, error: 'Answer is required' });
    expect(validateFaqInput({ question: '   ', answer: 'a' })).toEqual({ ok: false, error: 'Question is required' });
    expect(validateFaqInput({ question: 'q', answer: '<p></p>' })).toEqual({ ok: false, error: 'Answer is required' });
  });
  it('enforces length limits after sanitising', () => {
    expect(validateFaqInput({ question: 'q'.repeat(FAQ_QUESTION_MAX + 1), answer: 'a' }).ok).toBe(false);
    expect(validateFaqInput({ question: 'q', answer: 'a'.repeat(FAQ_ANSWER_MAX + 1) }).ok).toBe(false);
    expect(validateFaqInput({ question: 'q'.repeat(FAQ_QUESTION_MAX), answer: 'a'.repeat(FAQ_ANSWER_MAX) }).ok).toBe(true);
  });
  it('defaults new FAQs to unpublished and rejects a non-boolean publish flag', () => {
    expect(validateFaqInput({ question: 'Q?', answer: 'A' })).toEqual({ ok: true, value: { question: 'Q?', answer: 'A', isPublished: false } });
    expect(validateFaqInput({ question: 'Q?', answer: 'A', isPublished: 'yes' }).ok).toBe(false);
  });
  it('merges a partial update over the current values', () => {
    const current = { question: 'Old?', answer: 'Old', isPublished: true };
    expect(validateFaqInput({ answer: 'New' }, current)).toEqual({ ok: true, value: { question: 'Old?', answer: 'New', isPublished: true } });
  });
  it('rejects non-object bodies', () => {
    expect(validateFaqInput([] as any).ok).toBe(false);
  });
});

describe('validateFaqReorder', () => {
  it('needs every id exactly once', () => {
    expect(validateFaqReorder(['a', 'b'], ['b', 'a'])).toEqual({ ok: true, value: ['b', 'a'] });
    expect(validateFaqReorder(['a', 'b'], ['a']).ok).toBe(false);
    expect(validateFaqReorder(['a', 'b'], ['a', 'a']).ok).toBe(false);
    expect(validateFaqReorder(['a', 'b'], ['a', 'c']).ok).toBe(false);
    expect(validateFaqReorder(['a'], 'a').ok).toBe(false);
  });
});

describe('publicFaqList', () => {
  it('returns only published FAQs, in display order, without admin fields', () => {
    const out = publicFaqList([
      { id: '2', question: 'Second', answer: 'B', is_published: true, sort_order: 1, updated_at: new Date() },
      { id: '3', question: 'Draft', answer: 'C', is_published: false, sort_order: 0 },
      { id: '1', question: 'First', answer: 'A', is_published: true, sort_order: 0 },
    ]);
    expect(out).toEqual([
      { id: '1', question: 'First', answer: 'A' },
      { id: '2', question: 'Second', answer: 'B' },
    ]);
  });
});
