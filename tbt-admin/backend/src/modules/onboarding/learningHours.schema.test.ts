import { describe, expect, it } from 'vitest';
import { onboardingUpdateSchema } from './schema.js';
import { updateMemberSchema } from '../members/schema.js';

// Learning hours are hours PER DAY (onboarding slider 1–24, default 1), stored in
// members.weekly_learning_hours. Validators accept 1–80 so per-week values saved
// before the switch (5–80) still pass when an unrelated field is saved.
describe.each([
  ['member onboarding PATCH', onboardingUpdateSchema],
  ['admin member update', updateMemberSchema],
])('weeklyLearningHours — %s', (_name, schema) => {
  const ok = (v: unknown) => schema.safeParse({ weeklyLearningHours: v }).success;

  it('accepts the per-day slider range, including the 1 hr default', () => {
    for (const v of [1, 12, 24]) expect(ok(v)).toBe(true);
  });

  it('still accepts a legacy per-week value', () => {
    expect(ok(5)).toBe(true);
    expect(ok(80)).toBe(true);
  });

  it('accepts null and omission', () => {
    expect(ok(null)).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('rejects out-of-range and fractional hours', () => {
    for (const v of [0, -1, 81, 1.5, '3']) expect(ok(v)).toBe(false);
  });
});
