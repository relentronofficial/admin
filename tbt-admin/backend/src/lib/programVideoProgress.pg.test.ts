import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { loadProgramVideoProgress } from './programVideoProgress.js';
import { invalidateMemberModuleAccess, invalidateModuleOptions, saveMemberAdminOverride, saveMemberModuleSelection } from './memberModuleAccess.js';

// loadProgramVideoProgress against a REAL PostgreSQL — the real module-access
// queries (memberModuleAccess.ts) and the real count query.
//
// Opt-in and LOCAL ONLY: set LIFELINE_PG_TEST_URL to a throwaway local database
// (e.g. postgresql://postgres@localhost:55433/tbt). Runs in its own schema
// (program_videos_it), created and dropped here; any non-localhost host is
// refused. Skipped without the variable (CI has no database).

const RAW_URL = process.env.LIFELINE_PG_TEST_URL ?? '';
const isLocal = (() => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(RAW_URL).hostname);
  } catch {
    return false;
  }
})();
if (RAW_URL && !isLocal) throw new Error('LIFELINE_PG_TEST_URL must point at localhost — refusing to run against a shared database.');

const SCHEMA = 'program_videos_it';
const ME = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';
const PROGRAM = '10000000-0000-4000-8000-000000000001';
const BATCH = '20000000-0000-4000-8000-000000000001';

let prisma: PrismaClient;
let seq = 0;
const id = () => `40000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

async function course(module: string | null, over: { published?: boolean; active?: boolean; deleted?: boolean } = {}) {
  const cid = id();
  await prisma.$executeRawUnsafe(
    `INSERT INTO courses (id, module, is_published, is_active, deleted_at) VALUES ($1::uuid, $2, $3, $4, $5)`,
    cid, module, over.published ?? true, over.active ?? true, over.deleted ? new Date() : null,
  );
  return cid;
}
async function episodes(courseId: string, n: number, visible = true) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const eid = id();
    await prisma.$executeRawUnsafe(`INSERT INTO course_episodes (id, course_id, is_visible) VALUES ($1::uuid, $2::uuid, $3)`, eid, courseId, visible);
    ids.push(eid);
  }
  return ids;
}
async function complete(memberId: string, episodeIds: string[], completed = true) {
  for (const e of episodeIds) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO course_episode_progress (member_id, episode_id, completed) VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (member_id, episode_id) DO UPDATE SET completed = EXCLUDED.completed`,
      memberId, e, completed,
    );
  }
}
/** Module access is cached per member; these tests write the DB directly, so clear it like an admin change would. */
const progress = async (memberId = ME) => {
  await invalidateMemberModuleAccess(null, memberId);
  await invalidateModuleOptions(null);
  return loadProgramVideoProgress(prisma, null, memberId, BATCH);
};
const setProgram = (modules: string[]) => prisma.$executeRawUnsafe(`UPDATE programs SET allowed_modules = $1::jsonb WHERE id = $2::uuid`, JSON.stringify(modules), PROGRAM);
const setOverride = (memberId: string, modules: string[] | null) =>
  saveMemberAdminOverride(prisma, memberId, modules);

describe.skipIf(!RAW_URL)('loadProgramVideoProgress — real PostgreSQL', () => {
  beforeAll(async () => {
    const url = new URL(RAW_URL);
    url.searchParams.set('schema', SCHEMA);
    prisma = new PrismaClient({ datasourceUrl: url.toString() });
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA ${SCHEMA}`);
    // Only the columns these queries read (names as in schema.prisma / startup DDL).
    for (const ddl of [
      `CREATE TABLE programs (id UUID PRIMARY KEY, allowed_modules JSONB DEFAULT '[]'::jsonb)`,
      `CREATE TABLE batches (id UUID PRIMARY KEY, program_id UUID REFERENCES programs(id))`,
      `CREATE TABLE members (id UUID PRIMARY KEY, batch_id UUID REFERENCES batches(id), business_type VARCHAR(50))`,
      `CREATE TABLE member_module_settings (member_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
         allowed_modules JSONB, mentorship_modules JSONB, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      `CREATE TABLE module_config (module_name VARCHAR(100) PRIMARY KEY, display_name TEXT, tagline TEXT, description TEXT,
         icon_url TEXT, accent_color TEXT, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true)`,
      `CREATE TABLE courses (id UUID PRIMARY KEY, module VARCHAR(100), is_published BOOLEAN NOT NULL DEFAULT false,
         is_active BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ)`,
      `CREATE TABLE course_episodes (id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
         is_visible BOOLEAN NOT NULL DEFAULT true)`,
      `CREATE TABLE course_episode_progress (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_id UUID NOT NULL,
         episode_id UUID NOT NULL REFERENCES course_episodes(id) ON DELETE CASCADE, completed BOOLEAN NOT NULL DEFAULT false,
         UNIQUE (member_id, episode_id))`,
    ]) await prisma.$executeRawUnsafe(ddl);
    await prisma.$executeRawUnsafe(`INSERT INTO module_config (module_name, sort_order, is_active) VALUES ('Product',1,true),('Service',2,true),('Coaching',3,true),('Retired',4,false)`);
    await prisma.$executeRawUnsafe(`INSERT INTO programs (id, allowed_modules) VALUES ($1::uuid, '["Service"]'::jsonb)`, PROGRAM);
    await prisma.$executeRawUnsafe(`INSERT INTO batches (id, program_id) VALUES ($1::uuid, $2::uuid)`, BATCH, PROGRAM);
    await prisma.$executeRawUnsafe(`INSERT INTO members (id, batch_id) VALUES ($1::uuid, $3::uuid), ($2::uuid, $3::uuid)`, ME, OTHER, BATCH);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM course_episode_progress`);
    await prisma.$executeRawUnsafe(`DELETE FROM course_episodes`);
    await prisma.$executeRawUnsafe(`DELETE FROM courses`);
    await setProgram(['Service']);
    await setOverride(ME, null);
    await setOverride(OTHER, null);
  });

  it('none / some / all required videos completed', async () => {
    const c1 = await course('Service');
    const c2 = await course('Service');
    const e1 = await episodes(c1, 3);
    const e2 = await episodes(c2, 2);
    expect(await progress()).toEqual({ total: 5, completed: 0 });
    await complete(ME, [e1[0], e2[1]]);
    expect(await progress()).toEqual({ total: 5, completed: 2 });
    await complete(ME, [...e1, ...e2]);
    expect(await progress()).toEqual({ total: 5, completed: 5 });
  });

  it('progress rows with completed = false do not count', async () => {
    const c = await course('Service');
    const e = await episodes(c, 2);
    await complete(ME, e, false);
    expect(await progress()).toEqual({ total: 2, completed: 0 });
  });

  it('hidden episodes are excluded from the total (and their completion ignored)', async () => {
    const c = await course('Service');
    const visible = await episodes(c, 2);
    const hidden = await episodes(c, 3, false);
    await complete(ME, [...visible, ...hidden]);
    expect(await progress()).toEqual({ total: 2, completed: 2 });
  });

  it('courses the member never opened still count', async () => {
    const opened = await course('Service');
    const neverOpened = await course('Service');
    await complete(ME, await episodes(opened, 2));
    await episodes(neverOpened, 4);
    expect(await progress()).toEqual({ total: 6, completed: 2 });
  });

  it('only published, active, non-deleted courses in the program modules count', async () => {
    await episodes(await course('Service'), 1);
    await episodes(await course('Product'), 5); // other module
    await episodes(await course(null), 5); // general content, no module
    await episodes(await course('Service', { published: false }), 5);
    await episodes(await course('Service', { active: false }), 5);
    await episodes(await course('Service', { deleted: true }), 5);
    await episodes(await course('Retired'), 5); // inactive module
    expect(await progress()).toEqual({ total: 1, completed: 0 });
  });

  it("the member's allowed_modules override replaces the program modules", async () => {
    await episodes(await course('Service'), 2);
    await episodes(await course('Product'), 3);
    await setOverride(ME, ['Product']);
    expect(await progress(ME)).toEqual({ total: 3, completed: 0 });
    expect(await progress(OTHER)).toEqual({ total: 2, completed: 0 }); // no override → program modules
    await setProgram([]); // empty = all active modules
    expect(await progress(OTHER)).toEqual({ total: 5, completed: 0 });
  });

  it("courses outside the member's own module selection (which they can't open) don't count", async () => {
    await episodes(await course('Service'), 2);
    await episodes(await course('Product'), 3);
    await setProgram(['Product', 'Service']);
    await saveMemberModuleSelection(prisma, ME, ['Service']);
    try {
      expect(await progress(ME)).toEqual({ total: 2, completed: 0 });
      expect(await progress(OTHER)).toEqual({ total: 5, completed: 0 }); // no selection → whole ceiling
    } finally {
      await prisma.$executeRawUnsafe(`UPDATE member_module_settings SET mentorship_modules = NULL WHERE member_id = $1::uuid`, ME);
    }
  });

  it("another member's completions never count", async () => {
    const e = await episodes(await course('Service'), 2);
    await complete(OTHER, e);
    expect(await progress(ME)).toEqual({ total: 2, completed: 0 });
    expect(await progress(OTHER)).toEqual({ total: 2, completed: 2 });
  });

  it('zero eligible videos → total 0', async () => {
    await episodes(await course('Product'), 3);
    expect(await progress()).toEqual({ total: 0, completed: 0 });
  });
});
