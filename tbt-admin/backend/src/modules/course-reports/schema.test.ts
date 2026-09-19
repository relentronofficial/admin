import { describe, expect, it } from 'vitest';

import { submitEpisodeFeedbackSchema } from './schema.js';

/**
 * Pure input-validation tests for the course video feedback endpoint
 * (POST /api/course-reports/episode-feedback). This is the only part of
 * the feature that is unit-testable without a database — the rest
 * (ownership from the JWT, enrollment/episode checks, persistence,
 * notification delivery) is exercised via `deliverMemberEpisodeFeedbackToAdmin`
 * against a real Prisma client, which this repo's Vitest config deliberately
 * does not cover (see vitest.config.ts).
 */

const VALID = {
  courseId: '11111111-1111-1111-1111-111111111111',
  episodeId: '22222222-2222-2222-2222-222222222222',
  feedback: 'This lesson was super clear and easy to follow.',
};

const parse = (over: Record<string, unknown> = {}) =>
  submitEpisodeFeedbackSchema.safeParse({ ...VALID, ...over });

describe('submitEpisodeFeedbackSchema', () => {
  it('accepts a well-formed submission', () => {
    expect(parse().success).toBe(true);
  });

  it('rejects empty feedback', () => {
    expect(parse({ feedback: '' }).success).toBe(false);
  });

  it('rejects whitespace-only feedback', () => {
    expect(parse({ feedback: '   \n\t  ' }).success).toBe(false);
  });

  it('trims surrounding whitespace on an otherwise valid submission', () => {
    const result = parse({ feedback: '  Great video!  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toBe('Great video!');
    }
  });

  it('rejects feedback longer than 4000 characters', () => {
    expect(parse({ feedback: 'a'.repeat(4001) }).success).toBe(false);
  });

  it('rejects a non-UUID courseId', () => {
    expect(parse({ courseId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a non-UUID episodeId', () => {
    expect(parse({ episodeId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a missing courseId', () => {
    const { courseId, ...rest } = VALID;
    expect(submitEpisodeFeedbackSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a missing episodeId', () => {
    const { episodeId, ...rest } = VALID;
    expect(submitEpisodeFeedbackSchema.safeParse(rest).success).toBe(false);
  });
});
