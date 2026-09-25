// Pure validation for the course `price` field on create/update — no I/O, so it
// can be unit-tested without a database. `null`/`undefined` mean "free course"
// (Course.price is nullable) and are left to the caller to pass through as-is;
// this only validates a price that was actually supplied.
export type CoursePriceValidation =
  | { valid: true; value: string }
  | { valid: false; error: string };

export function validateCoursePrice(rawPrice: unknown): CoursePriceValidation {
  const numPrice = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(numPrice)) {
    return { valid: false, error: 'price must be a valid number' };
  }
  if (numPrice < 0) {
    return { valid: false, error: 'price must not be negative' };
  }
  // Prisma's Decimal(10,2) column — store as a plain decimal string so the
  // value round-trips correctly regardless of how the frontend serialised it.
  return { valid: true, value: numPrice.toFixed(2) };
}
