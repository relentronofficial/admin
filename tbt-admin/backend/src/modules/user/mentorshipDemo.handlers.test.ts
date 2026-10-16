import { beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the REAL handlers (user + user-batch controllers) with a fake Prisma
// client to prove the mentorship demo overlay is isolated to the configured
// member, never writes, never caches a demo body, stays consistent across
// endpoints, and turns off cleanly when the configuration is removed.

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_EMAIL = 'demo@example.com';
const BATCH_ID = '33333333-3333-3333-3333-333333333333';

const envMock = vi.hoisted(() => ({
  env: { MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '', PROGRAM_TIMEZONE: 'Asia/Kolkata' } as Record<string, string | undefined>,
}));
vi.mock('../../config/env.js', () => envMock);

const user = await import('./controller.js');
const userBatch = await import('../user-batch/controller.js');
const { cacheGet, invalidateCache } = await import('../../lib/cache.js');

const DAY_MS = 86_400_000;
const STARTS_AT = new Date(Date.now() - 29 * DAY_MS); // program day 30 today
const REAL_REVENUE_ROW = { revenue_generated: 1000, number_of_orders: 3, daily_revenue: [1000], updated_at: null };
const REAL_SOCIAL_ROW = { total_followers: 50, updated_at: null };
const REAL_TASK = { id: 'real-task-1', title: 'Real task', day_number: 2, sort_order: 0, is_required: true, member_id: null, is_milestone: false, milestone_label: null };
const EMAILS: Record<string, string> = { [TARGET_ID]: TARGET_EMAIL, [OTHER_ID]: 'other@example.com' };

function harness(memberId: string, opts: { emails?: Record<string, string>; batch?: boolean; body?: any; query?: any; headers?: any } = {}) {
  const emails = opts.emails ?? EMAILS;
  const inBatch = opts.batch ?? true;
  const queryRaw = vi.fn(async (sql: string) => {
    if (sql.includes('member_revenue_reports')) return [REAL_REVENUE_ROW];
    if (sql.includes('member_social_reports')) return [REAL_SOCIAL_ROW];
    if (sql.includes('FROM tasks')) return [REAL_TASK];
    if (sql.includes('FROM task_submissions')) return [{ taskId: 'real-task-1', dayNumber: 2, status: 'approved' }];
    if (sql.includes('FROM member_batch_settings')) return [{ extended_days: 0 }];
    return [];
  });
  const executeRaw = vi.fn(async () => 0);
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) =>
    emails[where.id] ? { id: where.id, email: emails[where.id], batchId: inBatch ? BATCH_ID : null } : null);
  const request: any = {
    memberId,
    params: {},
    body: opts.body ?? { revenueGenerated: 1000, totalFollowers: 50 },
    query: opts.query ?? {},
    headers: opts.headers ?? {},
    log: { warn: () => {}, error: () => {} },
    server: {
      prisma: {
        $queryRawUnsafe: queryRaw,
        $executeRawUnsafe: executeRaw,
        member: { findUnique },
        batch: {
          findUnique: vi.fn(async () => ({
            startsAt: STARTS_AT, snapshotDays: null, name: 'Batch', programId: null, program: { name: 'TBT – eComm Mastery', durationDays: 90 },
          })),
        },
        courseStreak: { findUnique: vi.fn(async () => ({ currentStreak: 3 })) },
        memberDayProgress: { findMany: vi.fn(async () => []) },
        pointsLedger: { findMany: vi.fn(async () => []) },
      },
      redis: null,
    },
  };
  const sent: { body?: any; headers: Record<string, string> } = { headers: {} };
  const reply: any = {
    header: (k: string, v: string) => { sent.headers[k.toLowerCase()] = v; return reply; },
    status: () => reply,
    code: () => reply,
    send: (b: any) => { sent.body = b; return reply; },
  };
  const dbWrites = () =>
    queryRaw.mock.calls.filter(([sql]) => /\b(INSERT|UPDATE|DELETE)\b/i.test(String(sql))).length +
    executeRaw.mock.calls.length;
  return { request, reply, sent, queryRaw, findUnique, dbWrites };
}

async function call(handler: (req: any, reply: any) => Promise<unknown>, memberId: string, opts?: Parameters<typeof harness>[1]) {
  const h = harness(memberId, opts);
  await handler(h.request, h.reply);
  return h;
}

beforeEach(async () => {
  envMock.env.MENTORSHIP_DEMO_MEMBER_ID = TARGET_ID;
  envMock.env.MENTORSHIP_DEMO_EMAIL = TARGET_EMAIL;
  // Clear the in-process (L1) caches the handlers use, between cases.
  for (const k of ['streak:', 'mentorship:stats:']) await invalidateCache(null, `${k}*`);
});

describe('revenue / social overlay', () => {
  it('serves demo revenue and social to the configured member, marked and uncacheable', async () => {
    const rev = await call(user.getMentorshipRevenueHandler, TARGET_ID);
    expect(rev.sent.headers['x-tbt-demo']).toBe('mentorship');
    expect(rev.sent.headers['cache-control']).toBe('private, no-store');
    expect(rev.sent.body.data.revenueGenerated).toBe(499900);
    expect(rev.queryRaw).not.toHaveBeenCalled(); // real rows not even read

    const soc = await call(user.getMentorshipSocialHandler, TARGET_ID);
    expect(soc.sent.body.data.totalFollowers).toBe(12450);
  });

  it('serves real data to every other member without a demo lookup', async () => {
    const h = await call(user.getMentorshipRevenueHandler, OTHER_ID);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.revenueGenerated).toBe(1000);
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});

describe('navbar Top Streak overlay (GET /api/user/streak)', () => {
  it('demo member: a live demo streak in the real response shape', async () => {
    const h = await call(user.getMyStreakHandler, TARGET_ID);
    expect(h.sent.headers['x-tbt-demo']).toBe('mentorship');
    expect(h.sent.headers['cache-control']).toBe('private, no-store');
    const s = h.sent.body.data;
    expect(Object.keys(s).sort()).toEqual(['activeToday', 'currentStreak', 'last7Days', 'longestStreak', 'pointsToday', 'totalActiveDays']);
    expect(s.activeToday).toBe(true);
    expect(s.currentStreak).toBeGreaterThanOrEqual(12);
    expect(s.last7Days).toHaveLength(7);
  });

  it('other member: their real (empty) streak', async () => {
    const h = await call(user.getMyStreakHandler, OTHER_ID);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(h.sent.body.data.currentStreak).toBe(0);
  });
});

describe('Weekly Activity Graph overlay (GET /api/user-batch/weekly-graph)', () => {
  it('demo member: graph from demo activities; real tasks are not read', async () => {
    const h = await call(userBatch.getMyWeeklyGraphHandler, TARGET_ID);
    expect(h.sent.headers['x-tbt-demo']).toBe('mentorship');
    const g = h.sent.body.data;
    expect(g.totalDays).toBe(90);
    expect(g.weeks).toHaveLength(13);
    expect(g.weeks.flatMap((w: any) => w.activities).every((a: any) => a.taskId.startsWith('demo-'))).toBe(true);
    expect(h.queryRaw.mock.calls.some(([sql]) => String(sql).includes('FROM tasks'))).toBe(false);
    expect(g.weeks.every((w: any) => w.progressLevel === null || w.progressLevel <= 3)).toBe(true);
  });

  it('other member: their real tasks and submissions', async () => {
    const h = await call(userBatch.getMyWeeklyGraphHandler, OTHER_ID);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    const ids = h.sent.body.data.weeks.flatMap((w: any) => w.activities.map((a: any) => a.taskId));
    expect(ids).toEqual(['real-task-1']);
  });

  it('demo member without a batch: no graph, same as the real endpoint', async () => {
    const h = await call(userBatch.getMyWeeklyGraphHandler, TARGET_ID, { batch: false });
    expect(h.sent.body.data).toBeNull();
  });
});

describe('cross-endpoint consistency for the demo member', () => {
  it('navbar streak == dashboard streak; Tier Access == streak active days; dashboard tasks == graph totals', async () => {
    const streak = (await call(user.getMyStreakHandler, TARGET_ID)).sent.body.data;
    const stats = (await call(user.getMentorshipStatsHandler, TARGET_ID)).sent.body.data;
    const graph = (await call(userBatch.getMyWeeklyGraphHandler, TARGET_ID)).sent.body.data;

    expect(stats.streakDays).toBe(streak.currentStreak);
    expect(stats.activeDays).toBe(streak.totalActiveDays);
    expect(stats.activeDays).toBeLessThanOrEqual(stats.totalDays);
    expect(stats.tasksCompleted).toBe(graph.summary.completed);
    expect(stats.tasksTotal).toBe(graph.summary.total);
    // Not demo-controlled: real program identity stays
    expect(stats.programName).toBe('TBT – eComm Mastery');
    expect(stats.totalDays).toBe(graph.totalDays);
  });
});

describe('isolation: client input can never turn demo mode on', () => {
  it('another member sending the target id/email/demo flags in body, query or headers still gets real data', async () => {
    const spoof = {
      body: { memberId: TARGET_ID, email: TARGET_EMAIL, demo: true },
      query: { memberId: TARGET_ID, demo: '1' },
      headers: { 'x-tbt-demo': 'mentorship', 'x-member-id': TARGET_ID },
    };
    for (const handler of [user.getMyStreakHandler, user.getMentorshipStatsHandler, user.getMentorshipRevenueHandler, userBatch.getMyWeeklyGraphHandler]) {
      const h = await call(handler, OTHER_ID, spoof);
      expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
      expect(h.findUnique.mock.calls.some(([q]) => q?.select?.email)).toBe(false);
    }
  });

  it('no authenticated member id → never demo', async () => {
    const h = await call(user.getMentorshipRevenueHandler, undefined as any);
    expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
  });

  it('target id with a different stored email → real data on every endpoint', async () => {
    const emails = { [TARGET_ID]: 'changed@example.com' };
    for (const handler of [user.getMyStreakHandler, user.getMentorshipSocialHandler, userBatch.getMyWeeklyGraphHandler]) {
      const h = await call(handler, TARGET_ID, { emails });
      expect(h.sent.headers['x-tbt-demo']).toBeUndefined();
    }
  });
});

describe('caching cannot leak demo responses', () => {
  it('the per-member caches never hold a demo value', async () => {
    // Streak: the demo member's real computation is skipped, so nothing is cached for them.
    const demoStreak = (await call(user.getMyStreakHandler, TARGET_ID)).sent.body.data;
    expect(demoStreak.currentStreak).toBeGreaterThan(0);
    expect(await cacheGet<any>(null, `streak:${TARGET_ID}`)).toBeNull();

    // Stats: the real value is cached, the demo overlay is applied after.
    const demoStats = (await call(user.getMentorshipStatsHandler, TARGET_ID)).sent.body.data;
    const cachedStats = await cacheGet<any>(null, `mentorship:stats:${TARGET_ID}`);
    expect(cachedStats.streakDays).toBe(3); // real courseStreak value
    expect(demoStats.streakDays).toBe(demoStreak.currentStreak);
  });

  it('another member never receives the demo member\'s values, before or after', async () => {
    await call(user.getMyStreakHandler, TARGET_ID);
    const other = await call(user.getMyStreakHandler, OTHER_ID);
    expect(other.sent.body.data.currentStreak).toBe(0);
    expect(other.sent.headers['x-tbt-demo']).toBeUndefined();
  });

  it('disabling demo mode immediately serves the real value to the former demo member', async () => {
    await call(user.getMyStreakHandler, TARGET_ID);        // demo served
    await call(user.getMentorshipStatsHandler, TARGET_ID); // real stats cached, demo served
    envMock.env.MENTORSHIP_DEMO_MEMBER_ID = '';
    const streak = await call(user.getMyStreakHandler, TARGET_ID);
    expect(streak.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(streak.sent.body.data.currentStreak).toBe(0);
    const stats = await call(user.getMentorshipStatsHandler, TARGET_ID);
    expect(stats.sent.body.data.streakDays).toBe(3);
  });
});

describe('demo saves never modify real records', () => {
  it('PUT revenue / PUT social for the demo member issue no database statement', async () => {
    const h = harness(TARGET_ID);
    await user.upsertMentorshipRevenueHandler(h.request, h.reply);
    await user.upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.queryRaw).not.toHaveBeenCalled();
    expect(h.dbWrites()).toBe(0);
  });

  it('demo reads add no database writes: streak and graph issue none; stats issues exactly what it does with demo off', async () => {
    for (const handler of [user.getMyStreakHandler, userBatch.getMyWeeklyGraphHandler]) {
      expect((await call(handler, TARGET_ID)).dbWrites()).toBe(0);
    }
    // Stats still computes the member's real values (programme, courses, rank), which
    // runs the existing idempotent legacy-points → ledger sync for every member.
    // Demo mode must not add to it or change what it writes.
    const writesOf = (h: ReturnType<typeof harness>) =>
      [...h.queryRaw.mock.calls, ...h.request.server.prisma.$executeRawUnsafe.mock.calls]
        .map(([sql, ...args]: any[]) => [String(sql).replace(/\s+/g, ' ').trim(), args] as [string, unknown[]])
        .filter(([sql]) => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql));
    await invalidateCache(null, 'mentorship:stats:*');
    const demoOn = await call(user.getMentorshipStatsHandler, TARGET_ID);
    expect(demoOn.sent.headers['x-tbt-demo']).toBe('mentorship');
    await invalidateCache(null, 'mentorship:stats:*');
    envMock.env.MENTORSHIP_DEMO_EMAIL = '';
    const demoOff = await call(user.getMentorshipStatsHandler, TARGET_ID);
    expect(demoOff.sent.headers['x-tbt-demo']).toBeUndefined();
    expect(writesOf(demoOn)).toEqual(writesOf(demoOff));
    for (const [sql] of writesOf(demoOn)) expect(sql).toMatch(/^INSERT INTO tbt_activity_log .* SELECT /i);
  });

  it('other members\' saves still write normally', async () => {
    const h = harness(OTHER_ID);
    await user.upsertMentorshipRevenueHandler(h.request, h.reply);
    await user.upsertMentorshipSocialHandler(h.request, h.reply);
    expect(h.dbWrites()).toBe(2);
  });
});

describe('demo configuration removed', () => {
  const removals: Array<[string, Record<string, string | undefined>]> = [
    ['both unset', { MENTORSHIP_DEMO_MEMBER_ID: undefined, MENTORSHIP_DEMO_EMAIL: undefined }],
    ['member id removed', { MENTORSHIP_DEMO_MEMBER_ID: '' }],
    ['email removed', { MENTORSHIP_DEMO_EMAIL: '' }],
    ['blank values', { MENTORSHIP_DEMO_MEMBER_ID: '  ', MENTORSHIP_DEMO_EMAIL: '  ' }],
  ];

  for (const [label, change] of removals) {
    it(`${label}: every endpoint returns the former demo member's real data and saves write again`, async () => {
      Object.assign(envMock.env, change);

      const rev = await call(user.getMentorshipRevenueHandler, TARGET_ID);
      expect(rev.sent.body.data.revenueGenerated).toBe(1000);
      expect(rev.findUnique).not.toHaveBeenCalled();

      const soc = await call(user.getMentorshipSocialHandler, TARGET_ID);
      expect(soc.sent.body.data.totalFollowers).toBe(50);

      const streak = await call(user.getMyStreakHandler, TARGET_ID);
      expect(streak.sent.body.data.currentStreak).toBe(0);

      const stats = await call(user.getMentorshipStatsHandler, TARGET_ID);
      expect(stats.sent.body.data.streakDays).toBe(3);

      const graph = await call(userBatch.getMyWeeklyGraphHandler, TARGET_ID);
      expect(graph.sent.body.data.weeks.flatMap((w: any) => w.activities.map((a: any) => a.taskId))).toEqual(['real-task-1']);

      for (const h of [rev, soc, streak, stats, graph]) expect(h.sent.headers['x-tbt-demo']).toBeUndefined();

      const save = harness(TARGET_ID);
      await user.upsertMentorshipRevenueHandler(save.request, save.reply);
      await user.upsertMentorshipSocialHandler(save.request, save.reply);
      expect(save.dbWrites()).toBe(2);
    });
  }
});
