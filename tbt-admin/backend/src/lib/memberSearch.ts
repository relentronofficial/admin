// Free-text member search — pure (no I/O), unit-tested in memberSearch.test.ts.
// Used by GET /api/members?search= (Members page, Weekly Graph member picker).
//
// One box finds a member by any of:
//   * name — first or last name, or a full name ("Priya Kumar": every word must
//     match the first or the last name), case-insensitive
//   * email — case-insensitive
//   * phone — however it is typed: "+91 98765-43210", "98765 43210" and
//     "9876543210" all match a stored "+919876543210" or "9876543210"
//   * member id / business name (as before)
// It returns one Prisma `where` fragment; the caller's findMany returns each
// member once however many fields match, so results never duplicate.

const MIN_PHONE_DIGITS = 4; // fewer digits would match half the member base

/** Digits only; a leading Indian country code (91 + 10 digits) is dropped so +91/0091 forms match local ones. */
export function normalizePhoneQuery(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export function buildMemberSearchWhere(rawSearch: unknown): Record<string, unknown> | null {
  if (typeof rawSearch !== 'string') return null;
  const search = rawSearch.trim().replace(/\s+/g, ' ');
  if (!search) return null;
  const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });

  const or: Record<string, unknown>[] = [
    { firstName: ci(search) },
    { lastName: ci(search) },
    { email: ci(search) },
    { memberId: ci(search) },
    { businessName: ci(search) },
    { phone: { contains: search } },
  ];

  // Full name: every word must appear in the first or the last name.
  const words = search.split(' ');
  if (words.length > 1) {
    or.push({ AND: words.map((w) => ({ OR: [{ firstName: ci(w) }, { lastName: ci(w) }] })) });
  }

  // Phone typed with spaces, dashes, brackets or a country code.
  const digits = normalizePhoneQuery(search);
  const looksLikePhone = /^[\d\s()+\-.]+$/.test(search);
  if (looksLikePhone && digits.length >= MIN_PHONE_DIGITS && digits !== search) {
    or.push({ phone: { contains: digits } });
  }

  return { OR: or };
}
