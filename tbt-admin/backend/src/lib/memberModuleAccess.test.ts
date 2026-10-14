import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMemberModuleAccess,
  loadActiveModuleOptions,
  invalidateMemberModuleAccess,
  invalidateModuleOptions,
} from './memberModuleAccess.js';
import { isCourseModuleAllowed } from './mentorshipModules.js';

// In-memory stand-in for the two raw-SQL reads the loader makes — no DB.
// Each member row mirrors the members/batches/programs join the loader issues.
type MemberRow = { allowed_modules: unknown; mentorship_modules: unknown; program_modules: unknown };

function fakePrisma(members: Record<string, MemberRow>, activeModules: string[]) {
  const calls = { member: 0, options: 0 };
  return {
    calls,
    members,
    activeModules,
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      if (sql.includes('FROM module_config')) {
        calls.options++;
        return this.activeModules.map((name, i) => ({
          module_name: name, display_name: `${name} Mentorship`, tagline: null,
          description: null, icon_url: null, accent_color: null, sort_order: i,
        }));
      }
      if (sql.includes('FROM members m')) {
        calls.member++;
        const row = this.members[params[0] as string];
        return row ? [row] : [];
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  };
}

const SERVICES_USER = '11111111-1111-1111-1111-111111111111';
const COACHX_USER = '22222222-2222-2222-2222-222222222222';
const LEGACY_USER = '33333333-3333-3333-3333-333333333333';

let n = 0;
// Unique member ids per test so the shared in-process cache cannot leak between tests.
const ids = () => {
  n++;
  return {
    services: SERVICES_USER.slice(0, -4) + String(1000 + n),
    coachx: COACHX_USER.slice(0, -4) + String(1000 + n),
    legacy: LEGACY_USER.slice(0, -4) + String(1000 + n),
  };
};

describe('loadMemberModuleAccess', () => {
  beforeEach(async () => {
    await invalidateModuleOptions(null);
  });

  it('two members with different selections get different, isolated verdicts', async () => {
    const id = ids();
    const prisma = fakePrisma({
      [id.services]: { allowed_modules: null, mentorship_modules: ['Service'], program_modules: [] },
      [id.coachx]: { allowed_modules: null, mentorship_modules: '["Coaching"]', program_modules: null },
    }, ['Product', 'Service', 'Coaching']);

    const services = await loadMemberModuleAccess(prisma, null, id.services);
    const coachx = await loadMemberModuleAccess(prisma, null, id.coachx);

    expect(services.effective).toEqual(['Service']);
    expect(coachx.effective).toEqual(['Coaching']);
    expect(isCourseModuleAllowed('Coaching', services)).toBe(false);
    expect(isCourseModuleAllowed('Service', coachx)).toBe(false);
  });

  it('persisted selection is re-read after invalidation (change of selection)', async () => {
    const id = ids();
    const prisma = fakePrisma({
      [id.services]: { allowed_modules: null, mentorship_modules: ['Service'], program_modules: [] },
    }, ['Product', 'Service', 'Coaching']);

    expect((await loadMemberModuleAccess(prisma, null, id.services)).effective).toEqual(['Service']);

    // Simulates PUT /api/user/mentorship/modules writing a new value.
    prisma.members[id.services].mentorship_modules = ['Product', 'Coaching'];
    // Cached until invalidated…
    expect((await loadMemberModuleAccess(prisma, null, id.services)).effective).toEqual(['Service']);
    await invalidateMemberModuleAccess(null, id.services);
    expect((await loadMemberModuleAccess(prisma, null, id.services)).effective).toEqual(['Product', 'Coaching']);
  });

  it('member without a selection keeps the program ceiling and is asked to choose', async () => {
    const id = ids();
    const prisma = fakePrisma({
      [id.legacy]: { allowed_modules: null, mentorship_modules: null, program_modules: ['Product'] },
    }, ['Product', 'Service', 'Coaching']);

    const a = await loadMemberModuleAccess(prisma, null, id.legacy);
    expect(a.selection).toBeNull();
    expect(a.effective).toEqual(['Product']);
    expect(a.selectable).toEqual(['Product']);
    expect(a.selectionRequired).toBe(true);
  });

  it('a module the admin deactivates drops out of the verdict after invalidation', async () => {
    const id = ids();
    const prisma = fakePrisma({
      [id.services]: { allowed_modules: null, mentorship_modules: ['Service'], program_modules: [] },
    }, ['Product', 'Service', 'Coaching']);

    expect((await loadMemberModuleAccess(prisma, null, id.services)).effective).toEqual(['Service']);
    prisma.activeModules = ['Product', 'Coaching'];
    await invalidateModuleOptions(null);
    await invalidateMemberModuleAccess(null, id.services);

    const a = await loadMemberModuleAccess(prisma, null, id.services);
    expect(a.effective).toEqual([]);
    expect(a.selectionRequired).toBe(true);
    expect(isCourseModuleAllowed('Service', a)).toBe(false);
  });

  it('propagates DB errors instead of returning an unrestricted verdict', async () => {
    const id = ids();
    const prisma = {
      async $queryRawUnsafe() { throw new Error('db down'); },
    };
    await expect(loadMemberModuleAccess(prisma, null, id.services)).rejects.toThrow('db down');
  });
});

describe('loadActiveModuleOptions', () => {
  it('returns only active modules with their display metadata', async () => {
    await invalidateModuleOptions(null);
    const prisma = fakePrisma({}, ['Product', 'Coaching']);
    const opts = await loadActiveModuleOptions(prisma, null);
    expect(opts.map((o) => o.moduleName)).toEqual(['Product', 'Coaching']);
    expect(opts[0].displayName).toBe('Product Mentorship');
  });
});
