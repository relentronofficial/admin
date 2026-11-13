import { describe, expect, it } from 'vitest';
import { buildMemberSearchWhere, normalizePhoneQuery } from './memberSearch.js';

// A tiny evaluator for the Prisma `where` fragment this module returns, so the
// tests check which members actually match — not just the shape of the object.
type M = { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null; memberId?: string | null; businessName?: string | null };
function matches(m: M, where: any): boolean {
  if (where.OR) return where.OR.some((w: any) => matches(m, w));
  if (where.AND) return where.AND.every((w: any) => matches(m, w));
  const [field, cond] = Object.entries(where)[0] as [keyof M, any];
  const value = m[field];
  if (value == null) return false;
  return cond.mode === 'insensitive'
    ? String(value).toLowerCase().includes(String(cond.contains).toLowerCase())
    : String(value).includes(String(cond.contains));
}

const MEMBERS: M[] = [
  { id: 'm1', firstName: 'Priya', lastName: 'Kumar', email: 'Priya.K@Example.com', phone: '+919876543210' },
  { id: 'm2', firstName: 'Nandhini', lastName: 'Ravi', email: 'nandhini@tbt.in', phone: '9123456780' },
  { id: 'm3', firstName: 'Ravi', lastName: 'Shankar', email: 'ravi.s@tbt.in', phone: '+919000011111' },
];
const find = (q: string) => {
  const where = buildMemberSearchWhere(q);
  return where ? MEMBERS.filter((m) => matches(m, where)).map((m) => m.id) : [];
};

describe('buildMemberSearchWhere — one box: name, phone or email', () => {
  it('finds by partial first or last name, case-insensitively', () => {
    expect(find('pri')).toEqual(['m1']);
    expect(find('KUMAR')).toEqual(['m1']);
  });

  it('finds by full name, in either order, extra spaces ignored', () => {
    expect(find('Priya Kumar')).toEqual(['m1']);
    expect(find('  kumar   priya ')).toEqual(['m1']);
    expect(find('Nandhini Ravi')).toEqual(['m2']);
  });

  it('a full name does not match members who only share one word', () => {
    expect(find('Priya Ravi')).toEqual([]);
  });

  it('finds by email, case-insensitively and partially', () => {
    expect(find('priya.k@example.com')).toEqual(['m1']);
    expect(find('@tbt.in')).toEqual(['m2', 'm3']);
  });

  it('finds by phone however it is typed', () => {
    expect(find('9876543210')).toEqual(['m1']);
    expect(find('+91 98765 43210')).toEqual(['m1']);
    expect(find('98765-43210')).toEqual(['m1']);
    expect(find('09123456780')).toEqual(['m2']);
    expect(find('43210')).toEqual(['m1']);
  });

  it('each member appears once even when several fields match', () => {
    expect(find('ravi')).toEqual(['m2', 'm3']); // m2 last name, m3 first name + email
  });

  it('no match → empty; blank or non-string search → no filter', () => {
    expect(find('zzz-nobody')).toEqual([]);
    expect(buildMemberSearchWhere('   ')).toBeNull();
    expect(buildMemberSearchWhere(undefined)).toBeNull();
    expect(buildMemberSearchWhere(['a'])).toBeNull();
  });

  it('a short digit fragment does not trigger the phone-digits match', () => {
    const where: any = buildMemberSearchWhere('9 1');
    expect(where.OR.some((w: any) => w.phone?.contains === '91')).toBe(false);
  });
});

describe('normalizePhoneQuery', () => {
  it('strips formatting and an Indian country code', () => {
    expect(normalizePhoneQuery('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhoneQuery('0091 9876543210')).toBe('9876543210');
    expect(normalizePhoneQuery('09876543210')).toBe('9876543210');
    expect(normalizePhoneQuery('(987) 654')).toBe('987654');
  });
});
