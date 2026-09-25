import { describe, it, expect } from 'vitest';
import { validateCoursePrice } from './coursePriceValidation.js';

describe('validateCoursePrice', () => {
  it('accepts a positive number and formats it to two decimal places', () => {
    expect(validateCoursePrice(499)).toEqual({ valid: true, value: '499.00' });
  });

  it('accepts a numeric string, matching what a form input sends', () => {
    expect(validateCoursePrice('1999.5')).toEqual({ valid: true, value: '1999.50' });
  });

  it('accepts zero (a free course priced explicitly at 0)', () => {
    expect(validateCoursePrice(0)).toEqual({ valid: true, value: '0.00' });
  });

  it('rejects a negative amount', () => {
    const result = validateCoursePrice(-50);
    expect(result.valid).toBe(false);
  });

  // Regression: updateCourseHandler used to pass `String(data.price)` straight
  // to Prisma. A non-numeric value became the literal string "NaN", which
  // Prisma's Decimal parser threw on — an opaque 500 instead of a 400.
  it('rejects a non-numeric value instead of coercing it to "NaN"', () => {
    const result = validateCoursePrice('not-a-number');
    expect(result.valid).toBe(false);
  });

  it('rejects Infinity', () => {
    const result = validateCoursePrice(Infinity);
    expect(result.valid).toBe(false);
  });
});
