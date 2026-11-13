import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/user/enrollments/:courseId/progress/:lessonId — saving lesson
// progress / completion. In production every DB round trip costs ~0.35 s, and
// waiting on the points/streak refresh pushed completions past the client's
// 15 s timeout. The completion must answer without waiting for that refresh,
// while still recording the completion + XP exactly once and keeping the
// access / module / lock checks.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));
const stats = vi.hoisted(() => ({ release: () => {}, calls: 0 }));
vi.mock('../../lib/tbtStats.js', () => ({
  // The heavy points/streak recompute: hangs until the test releases it.
  computeMemberStats: vi.fn(() => { stats.calls++; return new Promise((r) => { stats.release = () => r({ totalPoints: 10, currentStreak: 1 }); }); }),
  syncLegacyPointsToLedger: vi.fn(async () => {}),
}));
vi.mock('../../lib/memberActivity.js', () => ({ trackActivity: vi.fn(), recordActiveMinute: vi.fn() }));
vi.mock('../../lib/memberModuleAccess.js', () => ({
  loadMemberModuleAccess: vi.fn(async () => ({ restricted: false })),
  loadActiveModuleOptions: vi.fn(async () => []),
  invalidateMemberModuleAccess: vi.fn(),
  saveMemberModuleSelection: vi.fn(),
}));
vi.mock('../../lib/courseNotifications.js', () => ({
  notifyCourseEnrolled: vi.fn(async () => {}), notifyEpisodeCompleted: vi.fn(async () => {}),
  notifyCourseCompleted: vi.fn(async () => {}), notifyQuizPassed: vi.fn(async () => {}),
}));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000d1';
const COURSE = '70000000-0000-4000-8000-0000000000d1';
const EP1 = '80000000-0000-4000-8000-000000000001';
const EP2 = '80000000-0000-4000-8000-000000000002';

let access: any;
let requireSequential: boolean;
let progress: Map<string, any>;
let xpRows: Set<string>;
let upserts: number;

function prisma() {
  return {
    courseAccess: { findUnique: vi.fn(async () => access) },
    courseEpisode: {
      findFirst: vi.fn(async ({ where }: any) => ([EP1, EP2].includes(where.id) ? { id: where.id, title: 'Lesson', durationSeconds: 100 } : null)),
      findMany: vi.fn(async () => [{ id: EP1, order: 1, durationSeconds: 100 }, { id: EP2, order: 2, durationSeconds: 100 }]),
      count: vi.fn(async () => 2),
      update: vi.fn(async () => ({})),
    },
    course: {
      findUnique: vi.fn(async () => ({ requireSequential, completionThresholdPercent: 95, xpPerEpisode: 10, title: 'Course' })),
    },
    courseEpisodeProgress: {
      findUnique: vi.fn(async ({ where }: any) => progress.get(where.memberId_episodeId.episodeId) ?? null),
      findMany: vi.fn(async () => [...progress.entries()].map(([episodeId, p]) => ({ episodeId, ...p }))),
      count: vi.fn(async ({ where }: any) => (where.completed ? [...progress.values()].filter((p) => p.completed).length : progress.size)),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        upserts++;
        const id = where.memberId_episodeId.episodeId;
        const cur = progress.get(id);
        const next = cur
          ? { ...cur, ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) }
          : { ...create };
        progress.set(id, next);
        return { ...next, completedAt: next.completedAt ?? null };
      }),
    },
    courseEnrollment: { updateMany: vi.fn(async () => ({ count: 1 })) },
    courseStreak: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    securityLog: { create: vi.fn(async () => ({})) },
    memberSession: { updateMany: vi.fn(async () => ({ count: 1 })) },
    pointsLedger: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    member: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    memberXP: { create: vi.fn(async () => ({})) },
    $queryRawUnsafe: vi.fn(async (sql: string, ...a: any[]) => {
      if (/INSERT INTO member_xp/.test(sql)) {
        const key = `${a[0]}:${a[2]}`;
        if (xpRows.has(key)) return []; // ON CONFLICT DO NOTHING
        xpRows.add(key);
        return [{ id: `xp-${xpRows.size}` }];
      }
      if (/streak_points/.test(sql)) return [{ streak_points: 0 }];
      return [];
    }),
    $executeRawUnsafe: vi.fn(async () => 1),
  };
}

let server: any;
async function save(lessonId: string, body: Record<string, unknown>) {
  const res: { status: number; body?: any } = { status: 200 };
  const reply: any = {
    status(c: number) { res.status = c; return reply; }, code(c: number) { res.status = c; return reply; },
    header() { return reply; }, send(b: any) { res.body = b; return reply; },
  };
  const request: any = {
    params: { courseId: COURSE, lessonId }, body, memberId: ME, headers: {}, server,
    log: { info() {}, warn() {}, error() {} },
  };
  await user.markLessonCompleteHandler(request, reply);
  return res;
}
const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`no response within ${ms} ms`)), ms))]);

beforeEach(() => {
  access = { id: 'a1', isActive: true, accessType: 'lifetime', expiresAt: null };
  requireSequential = true;
  progress = new Map();
  xpRows = new Set();
  upserts = 0;
  stats.calls = 0;
  server = { prisma: prisma(), redis: null, io: { to: () => ({ emit() {} }) }, log: { info() {}, warn() {}, error() {} } };
});

describe('lesson completion', () => {
  it('answers without waiting for the points/streak refresh (which is still started)', async () => {
    const r = await within(save(EP1, { watchedSeconds: 100, deltaSeconds: 30, isCompleted: true, videoDuration: 100 }), 2000);
    expect(r.status).toBe(200);
    expect(r.body.data.completed).toBe(true);
    expect(progress.get(EP1)?.completed).toBe(true);
    expect(xpRows.size).toBe(1); // XP recorded before answering
    expect(server.prisma.courseEnrollment.updateMany).toHaveBeenCalled(); // course % updated
    await vi.waitFor(() => expect(stats.calls).toBe(1)); // refresh runs in the background
    stats.release();
  });

  it('a repeated completion (client retry) is not counted twice — one XP row, still completed', async () => {
    const first = await within(save(EP1, { watchedSeconds: 100, isCompleted: true, videoDuration: 100 }), 2000);
    const again = await within(save(EP1, { watchedSeconds: 100, isCompleted: true, videoDuration: 100 }), 2000);
    expect(first.body.data.completed).toBe(true);
    expect(again.body.data.completed).toBe(true);
    expect(xpRows.size).toBe(1);
    expect(server.prisma.courseEnrollment.updateMany).toHaveBeenCalledTimes(1);
    stats.release();
  });

  it('a save below the completion threshold stays incomplete and awards nothing', async () => {
    const r = await within(save(EP1, { watchedSeconds: 20, deltaSeconds: 20, isCompleted: false, videoDuration: 100 }), 2000);
    expect(r.status).toBe(200);
    expect(r.body.data.completed).toBe(false);
    expect(xpRows.size).toBe(0);
    expect(stats.calls).toBe(0);
  });
});

describe('checks are unchanged', () => {
  it('a locked lesson (previous one not completed) is refused and nothing is written', async () => {
    const r = await save(EP2, { watchedSeconds: 100, isCompleted: true, videoDuration: 100 });
    expect(r.status).toBe(403);
    expect(r.body.error.message ?? r.body.error).toMatch(/locked/i);
    expect(upserts).toBe(0);
    expect(xpRows.size).toBe(0);
  });

  it('the next lesson completes once the previous one is done (sequential unlock)', async () => {
    await save(EP1, { watchedSeconds: 100, isCompleted: true, videoDuration: 100 });
    const r = await within(save(EP2, { watchedSeconds: 100, isCompleted: true, videoDuration: 100 }), 2000);
    expect(r.status).toBe(200);
    expect(r.body.data.completed).toBe(true);
    stats.release();
  });

  it('no course access → 403 before anything else, even for an unknown lesson', async () => {
    access = null;
    const r = await save('80000000-0000-4000-8000-0000000000ff', { watchedSeconds: 1 });
    expect(r.status).toBe(403);
    expect(r.body.error.message ?? r.body.error).toMatch(/Access required/);
    expect(upserts).toBe(0);
  });

  it('a lesson that is not in the course → 404', async () => {
    const r = await save('80000000-0000-4000-8000-0000000000ff', { watchedSeconds: 1 });
    expect(r.status).toBe(404);
    expect(upserts).toBe(0);
  });
});
