import { describe, expect, it } from 'vitest';
import { savePendingRegistration } from './pendingRegistrations.js';
import { PENDING_REGISTRATION_TTL_MINUTES } from './registrationLogic.js';

// Regression: production signup returned 500 with Postgres 42883
// "function make_interval(mins => bigint) does not exist" — Prisma sends a JS
// number as bigint, and make_interval only takes integer minutes. The TTL
// parameter must carry an explicit ::int cast.
describe('savePendingRegistration SQL', () => {
  const capture = () => {
    const calls: Array<{ sql: string; args: unknown[] }> = [];
    const prisma = { $executeRawUnsafe: async (sql: string, ...args: unknown[]) => { calls.push({ sql, args }); return 1; } };
    return { prisma, calls };
  };
  const reg = {
    phoneE164: '+447400123456', email: 'priya@example.com', claimMemberId: null,
    payload: { firstName: 'Priya', lastName: null, email: 'priya@example.com', passwordHash: 'h', businessName: null, city: null, state: null, productServiceType: null },
  };

  it('casts the TTL minutes to integer for make_interval', async () => {
    const { prisma, calls } = capture();
    await savePendingRegistration(prisma, reg);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO pending_registrations'))!;
    expect(insert.sql).toContain('make_interval(mins => $5::int)');
    expect(insert.sql).not.toMatch(/make_interval\(mins => \$5\)/);
    expect(insert.args[4]).toBe(PENDING_REGISTRATION_TTL_MINUTES);
    expect(Number.isInteger(insert.args[4])).toBe(true);
  });

  it('every parameter of the insert has a matching column type cast or a text column', async () => {
    const { prisma, calls } = capture();
    await savePendingRegistration(prisma, reg);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO pending_registrations'))!;
    expect(insert.sql).toContain('$3::jsonb');
    expect(insert.sql).toContain('$4::uuid');
    expect(insert.args.slice(0, 4)).toEqual(['+447400123456', 'priya@example.com', JSON.stringify(reg.payload), null]);
  });
});
