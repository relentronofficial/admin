import { beforeEach, describe, expect, it } from 'vitest';
import { loadProgramVideoProgress, programVideoModules } from './programVideoProgress.js';
import { resolveModuleAccess } from './mentorshipModules.js';
import { invalidateMemberModuleAccess, invalidateModuleOptions } from './memberModuleAccess.js';

// Module resolution + fail-closed behaviour against a fake database that
// answers the two queries loadMemberModuleAccess issues and the count query.
// The SQL itself (visible episodes, published courses, unopened courses,
// per-member completion) runs against real Postgres in programVideoProgress.pg.test.ts.

const ACTIVE = ['Product', 'Service', 'Coaching'];
const MEMBER = '30000000-0000-4000-8000-000000000001';
const BATCH = '20000000-0000-4000-8000-000000000001';

function fakeDb(member: { allowed_modules?: unknown; program_modules?: unknown; mentorship_modules?: unknown; business_type?: string | null }, counts = { total: 7, completed: 3 }, fail?: 'access' | 'count') {
  const seen: { modules?: string[] } = {};
  const prisma = {
    $queryRawUnsafe: async (text: string, ...a: any[]) => {
      const q = text.replace(/\s+/g, ' ').trim();
      if (q.includes('FROM members m')) {
        if (fail === 'access') throw new Error('connection terminated');
        return [{ allowed_modules: null, mentorship_modules: null, business_type: null, program_modules: null, ...member }];
      }
      if (q.includes('FROM module_config')) return ACTIVE.map((m) => ({ module_name: m }));
      if (q.includes('FROM course_episodes ce')) {
        if (fail === 'count') throw new Error('connection terminated');
        seen.modules = a[1];
        return [counts];
      }
      throw new Error(`Unhandled SQL: ${q}`);
    },
  };
  return { prisma, seen };
}

describe('programVideoModules — which modules are required', () => {
  const access = (over: Partial<Parameters<typeof resolveModuleAccess>[0]>) =>
    resolveModuleAccess({ activeModules: ACTIVE, adminOverride: null, programModules: [], selection: null, ...over });

  it("uses the program's allowed modules", () => {
    expect(programVideoModules(access({ programModules: ['Service'] }))).toEqual(['Service']);
  });
  it('a member-specific override replaces the program modules', () => {
    expect(programVideoModules(access({ programModules: ['Service'], adminOverride: ['Product', 'Coaching'] }))).toEqual(['Product', 'Coaching']);
  });
  it('an empty program list (or empty override) means all active modules', () => {
    expect(programVideoModules(access({ programModules: [] }))).toEqual(ACTIVE);
    expect(programVideoModules(access({ programModules: ['Service'], adminOverride: [] }))).toEqual(ACTIVE);
  });
  it('inactive modules are not required', () => {
    expect(programVideoModules(access({ programModules: ['Service', 'Retired'] }))).toEqual(['Service']);
  });
  it("only modules the member can open: their own selection / business-type default narrows the set", () => {
    expect(programVideoModules(access({ programModules: ['Product', 'Service'], selection: ['Service'] }))).toEqual(['Service']);
    expect(programVideoModules(access({ programModules: ['Product', 'Service'], businessType: 'Product' }))).toEqual(['Product']);
    // a selection can never widen the ceiling
    expect(programVideoModules(access({ programModules: ['Service'], selection: ['Product', 'Service'] }))).toEqual(['Service']);
  });
  it('a restricted member with no usable selection has no required modules (fails closed)', () => {
    expect(programVideoModules(access({ programModules: ['Service'], selection: ['Product'] }))).toEqual([]);
  });
});

describe('loadProgramVideoProgress', () => {
  // Module access is cached per member (in-process without Redis); each test
  // starts clean, as the app does after an admin module change.
  beforeEach(async () => {
    await invalidateMemberModuleAccess(null, MEMBER);
    await invalidateModuleOptions(null);
  });

  it('returns the counts for the resolved program modules', async () => {
    const { prisma, seen } = fakeDb({ program_modules: ['Service'] }, { total: 12, completed: 5 });
    expect(await loadProgramVideoProgress(prisma, null, MEMBER, BATCH)).toEqual({ total: 12, completed: 5 });
    expect(seen.modules).toEqual(['Service']);
  });

  it("applies the member's own module selection (members.mentorship_modules)", async () => {
    const { prisma, seen } = fakeDb({ program_modules: ['Product', 'Service'], mentorship_modules: ['Product'] });
    await loadProgramVideoProgress(prisma, null, MEMBER, BATCH);
    expect(seen.modules).toEqual(['Product']);
  });

  it('applies the member override (members.allowed_modules) over the program', async () => {
    const { prisma, seen } = fakeDb({ program_modules: ['Service'], allowed_modules: ['Product'] });
    await loadProgramVideoProgress(prisma, null, MEMBER, BATCH);
    expect(seen.modules).toEqual(['Product']);
  });

  it('no batch (no program) → null; nothing is queried', async () => {
    const { prisma, seen } = fakeDb({ program_modules: ['Service'] });
    expect(await loadProgramVideoProgress(prisma, null, MEMBER, null)).toBeNull();
    expect(seen.modules).toBeUndefined();
  });

  it('no eligible modules → zero videos (never "complete")', async () => {
    const { prisma, seen } = fakeDb({ program_modules: ['Retired'] });
    expect(await loadProgramVideoProgress(prisma, null, MEMBER, BATCH)).toEqual({ total: 0, completed: 0 });
    expect(seen.modules).toBeUndefined();
  });

  it('database errors fail closed (null)', async () => {
    expect(await loadProgramVideoProgress(fakeDb({ program_modules: ['Service'] }, undefined, 'access').prisma, null, MEMBER, BATCH)).toBeNull();
    expect(await loadProgramVideoProgress(fakeDb({ program_modules: ['Service'] }, undefined, 'count').prisma, null, MEMBER, BATCH)).toBeNull();
  });

  it('never reports more completed than total', async () => {
    const { prisma } = fakeDb({ program_modules: ['Service'] }, { total: 2, completed: 5 });
    expect(await loadProgramVideoProgress(prisma, null, MEMBER, BATCH)).toEqual({ total: 2, completed: 2 });
  });
});
