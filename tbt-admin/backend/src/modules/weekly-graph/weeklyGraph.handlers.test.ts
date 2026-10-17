import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real weekly-graph admin handlers + the real member endpoint
// (GET /api/user-batch/weekly-graph) against a small in-memory store that
// answers the SQL those handlers issue. Every request below is a fresh request
// object, so anything read back was persisted server-side — the same thing a
// page refresh or a new login session sees.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const graph = await import('./controller.js');
const userBatch = await import('../user-batch/controller.js');

const PROGRAM = '10000000-0000-0000-0000-000000000001';
const OTHER_PROGRAM = '10000000-0000-0000-0000-000000000002';
const BATCH = '20000000-0000-0000-0000-000000000001';
const MEMBER = '30000000-0000-0000-0000-000000000001';
const OTHER_MEMBER = '30000000-0000-0000-0000-000000000002';
const DAY = 86_400_000;
const TASK_ADS = '40000000-0000-4000-8000-000000000001';
const TASK_W2 = '40000000-0000-4000-8000-000000000002';

let seq = 0;
const uuid = () => `9${String(++seq).padStart(7, '0')}-0000-4000-8000-000000000000`;

interface Store {
  admins: Record<string, { id: string; fullName: string; role: string }>;
  programs: Array<{ id: string; name: string; durationDays: number }>;
  weeks: Array<{ id: string; programId: string; label: string; startDay: number; endDay: number; sortOrder: number; isActive: boolean }>;
  milestones: Array<{ id: string; programId: string; label: string; kind: string; sortOrder: number; isActive: boolean }>;
  tasks: Array<{ id: string; programId: string | null; batchId: string | null; title: string; dayNumber: number; sortOrder: number;
    isRequired: boolean; isActive: boolean; memberId: string | null; weekId: string | null; milestoneId: string | null;
    isMilestone: boolean; milestoneLabel: string | null }>;
  submissions: Array<{ taskId: string; memberId: string; dayNumber: number; status: string }>;
  records: Array<{ id: string; memberId: string; milestoneId: string; weekId: string | null; note: string | null; recordedBy: string; recordedAt: Date }>;
  members: Array<{ id: string; firstName: string; lastName: string; batchId: string | null }>;
}
let db: Store;
const unhandled: string[] = [];

const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/s$/, '');
const weekOut = (w: Store['weeks'][number]) => ({ id: w.id, label: w.label, startDay: w.startDay, endDay: w.endDay, sortOrder: w.sortOrder, isActive: w.isActive });
const msOut = (m: Store['milestones'][number]) => ({ id: m.id, label: m.label, kind: m.kind, sortOrder: m.sortOrder, isActive: m.isActive });
const sorted = <T extends { sortOrder: number; label: string }>(xs: T[]) => [...xs].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

/** Answers exactly the statements the graph handlers issue. Unknown SQL fails loudly. */
async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT id::text, name, duration_days')) return db.programs.filter((p) => p.id === a[0]);
  if (q.startsWith('SELECT duration_days AS "durationDays" FROM programs')) return db.programs.filter((p) => p.id === a[0]);
  if (q.startsWith('SELECT') && q.includes('FROM graph_weeks WHERE program_id')) return sorted(db.weeks.filter((w) => w.programId === a[0])).map(weekOut);
  if (q.startsWith('SELECT') && q.includes('FROM graph_milestones WHERE program_id')) return sorted(db.milestones.filter((m) => m.programId === a[0])).map(msOut);
  if (q.startsWith('INSERT INTO graph_milestones (program_id, label, kind, sort_order) SELECT')) {
    if (db.milestones.some((m) => m.programId === a[0])) return 0;
    for (let i = 1; i < a.length; i += 3) db.milestones.push({ id: uuid(), programId: a[0], label: a[i], kind: a[i + 1], sortOrder: a[i + 2], isActive: true });
    return 1;
  }
  if (q.startsWith('INSERT INTO graph_weeks (program_id, label, start_day, end_day, sort_order) SELECT')) {
    if (db.weeks.some((w) => w.programId === a[0])) return 0;
    for (let i = 1; i < a.length; i += 4) db.weeks.push({ id: uuid(), programId: a[0], label: a[i], startDay: a[i + 1], endDay: a[i + 2], sortOrder: a[i + 3], isActive: true });
    return 1;
  }
  if (q.startsWith('UPDATE tasks t SET graph_milestone_id = m.id')) {
    for (const t of db.tasks) {
      if (t.milestoneId || !t.isMilestone || t.programId !== a[0]) continue;
      const m = db.milestones.find((x) => x.programId === a[0] && norm(x.label) === norm(t.milestoneLabel));
      if (m) t.milestoneId = m.id;
    }
    return 0;
  }
  if (q.startsWith('INSERT INTO graph_weeks (program_id, label, start_day, end_day, sort_order, is_active) VALUES')) {
    const order = Math.max(-1, ...db.weeks.filter((w) => w.programId === a[0]).map((w) => w.sortOrder)) + 1;
    const w = { id: uuid(), programId: a[0], label: a[1], startDay: a[2], endDay: a[3], sortOrder: order, isActive: a[4] };
    db.weeks.push(w);
    return [weekOut(w)];
  }
  if (q.startsWith('UPDATE graph_weeks SET label')) {
    const w = db.weeks.find((x) => x.id === a[1] && x.programId === a[0])!;
    Object.assign(w, { label: a[2], startDay: a[3], endDay: a[4], isActive: a[5] });
    return [weekOut(w)];
  }
  if (q.startsWith('SELECT (SELECT COUNT(*)::int FROM tasks WHERE graph_week_id')) {
    const [pid, wid, s, e] = a;
    return [{
      linked: db.tasks.filter((t) => t.weekId === wid).length,
      by_day: db.tasks.filter((t) => t.programId === pid && !t.batchId && !t.weekId && t.dayNumber >= s && t.dayNumber <= e).length,
      records: db.records.filter((r) => r.weekId === wid).length,
    }];
  }
  if (q.startsWith('DELETE FROM graph_weeks')) { db.weeks = db.weeks.filter((w) => !(w.id === a[1] && w.programId === a[0])); return 1; }
  if (q.startsWith('INSERT INTO graph_milestones (program_id, label, kind, sort_order, is_active) VALUES')) {
    const order = Math.max(-1, ...db.milestones.filter((m) => m.programId === a[0]).map((m) => m.sortOrder)) + 1;
    const m = { id: uuid(), programId: a[0], label: a[1], kind: a[2], sortOrder: order, isActive: a[3] };
    db.milestones.push(m);
    return [msOut(m)];
  }
  if (q.startsWith('UPDATE graph_milestones SET label')) {
    const m = db.milestones.find((x) => x.id === a[1] && x.programId === a[0])!;
    Object.assign(m, { label: a[2], kind: a[3], isActive: a[4] });
    return [msOut(m)];
  }
  if (q.startsWith('UPDATE tasks SET milestone_label = $2 WHERE graph_milestone_id')) {
    for (const t of db.tasks) if (t.milestoneId === a[0]) t.milestoneLabel = a[1];
    return 0;
  }
  if (q.startsWith('SELECT (SELECT COUNT(*)::int FROM tasks WHERE graph_milestone_id')) {
    return [{ linked: db.tasks.filter((t) => t.milestoneId === a[0]).length, records: db.records.filter((r) => r.milestoneId === a[0]).length }];
  }
  if (q.startsWith('DELETE FROM graph_milestones')) { db.milestones = db.milestones.filter((m) => !(m.id === a[1] && m.programId === a[0])); return 1; }
  const reorder = q.match(/^UPDATE (graph_weeks|graph_milestones) AS t SET sort_order/);
  if (reorder) {
    const rows = reorder[1] === 'graph_weeks' ? db.weeks : db.milestones;
    (a[1] as string[]).forEach((id, i) => { const r = rows.find((x) => x.id === id && x.programId === a[0]); if (r) r.sortOrder = i; });
    return 1;
  }
  if (q.startsWith('SELECT id::text, title, day_number AS "dayNumber", sort_order')) {
    return db.tasks.filter((t) => t.programId === a[0] && !t.batchId).map((t) => ({ ...t }));
  }
  if (q.startsWith('INSERT INTO tasks (program_id, day_number, title')) {
    const t = { id: uuid(), programId: a[0], batchId: null, dayNumber: a[1], title: a[2], isRequired: a[3], isActive: a[4], sortOrder: 0,
      memberId: null, weekId: a[5], milestoneId: a[6], isMilestone: a[7], milestoneLabel: a[8] };
    db.tasks.push(t);
    return [{ id: t.id }];
  }
  if (q.startsWith('SELECT id::text, title, day_number AS "dayNumber", is_required')) {
    return db.tasks.filter((t) => t.id === a[1] && t.programId === a[0] && !t.batchId).map((t) => ({ ...t }));
  }
  if (q.startsWith('UPDATE tasks SET title = $2')) {
    const t = db.tasks.find((x) => x.id === a[0])!;
    Object.assign(t, { title: a[1], isRequired: a[2], isActive: a[3], weekId: a[4], milestoneId: a[5], isMilestone: a[6], milestoneLabel: a[7], dayNumber: a[8] });
    return 1;
  }
  if (q.startsWith('SELECT m.id::text, m.first_name')) {
    return db.members.filter((m) => m.id === a[0]).map((m) => ({
      id: m.id, firstName: m.firstName, lastName: m.lastName, programId: m.batchId === BATCH ? PROGRAM : null,
    }));
  }
  if (q.startsWith('INSERT INTO member_graph_milestone_records')) {
    const existing = db.records.find((r) => r.memberId === a[0] && r.milestoneId === a[1]);
    if (existing) Object.assign(existing, { weekId: a[2], note: a[3], recordedBy: a[4] });
    else db.records.push({ id: uuid(), memberId: a[0], milestoneId: a[1], weekId: a[2], note: a[3], recordedBy: a[4], recordedAt: new Date() });
    return 1;
  }
  if (q.startsWith('SELECT r.id::text, r.milestone_id::text')) {
    return db.records.filter((r) => r.memberId === a[0]).map((r) => ({ id: r.id, milestoneId: r.milestoneId, weekId: r.weekId, note: r.note }));
  }
  if (q.startsWith('DELETE FROM member_graph_milestone_records')) { db.records = db.records.filter((r) => !(r.id === a[0] && r.memberId === a[1])); return 1; }
  // ── member endpoint (GET /api/user-batch/weekly-graph) ──
  if (q.startsWith('SELECT milestone_id::text AS "milestoneId", week_id::text AS "weekId" FROM member_graph_milestone_records')) {
    return db.records.filter((r) => r.memberId === a[0]).map((r) => ({ milestoneId: r.milestoneId, weekId: r.weekId }));
  }
  if (q.startsWith('SELECT extended_days FROM member_batch_settings')) return [];
  if (q.startsWith('SELECT id::text, title, day_number, sort_order, is_required')) {
    const [batchId, programId, memberId] = a;
    return db.tasks.filter((t) => t.isActive && (t.batchId === batchId || (programId && t.programId === programId && !t.batchId)) && (!t.memberId || t.memberId === memberId))
      .map((t) => ({ id: t.id, title: t.title, day_number: t.dayNumber, sort_order: t.sortOrder, is_required: t.isRequired, member_id: t.memberId,
        is_milestone: t.isMilestone, milestone_label: t.milestoneLabel, graph_week_id: t.weekId, graph_milestone_id: t.milestoneId }));
  }
  if (q.startsWith('SELECT task_id::text AS "taskId"')) {
    return db.submissions.filter((s) => s.memberId === a[1]).map((s) => ({ taskId: s.taskId, dayNumber: s.dayNumber, status: s.status }));
  }
  if (q.includes('FROM members m JOIN batches b')) return []; // refresh notification audience
  unhandled.push(q.slice(0, 160));
  throw new Error(`Unhandled SQL in test store: ${q.slice(0, 120)}`);
}

function server() {
  return {
    io: null,
    redis: null,
    prisma: {
      $queryRawUnsafe: vi.fn(sql),
      $executeRawUnsafe: vi.fn(sql),
      admin: { findUnique: vi.fn(async ({ where }: any) => db.admins[where.clerkId] ?? null) },
      member: {
        findUnique: vi.fn(async ({ where }: any) => {
          const m = db.members.find((x) => x.id === where.id);
          return m ? { id: m.id, batchId: m.batchId, email: `${m.id}@x` } : null;
        }),
        findMany: vi.fn(async () => []),
      },
      batch: { findUnique: vi.fn(async () => ({ programId: PROGRAM, snapshotDays: null, startsAt: new Date(Date.now() - 19 * DAY), program: { durationDays: 28 } })) },
      memberDayProgress: { findMany: vi.fn(async () => []) },
    },
  };
}

/** A fresh request + reply each call (nothing carried between calls but the store). */
async function call(handler: any, opts: { clerk?: string; memberId?: string; params?: any; body?: any } = {}) {
  const sent: { status: number; body?: any } = { status: 200 };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    header() { return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { user: opts.clerk ?? 'clerk_admin', memberId: opts.memberId, params: opts.params ?? {}, body: opts.body, query: {}, server: server(), log: { warn() {}, error() {} } };
  await handler(req, reply);
  return sent;
}
const P = { programId: PROGRAM };
const config = async (clerk = 'clerk_admin') => (await call(graph.getConfigHandler, { clerk, params: P })).body.data;
const memberGraph = async (memberId = MEMBER) => (await call(userBatch.getMyWeeklyGraphHandler, { memberId })).body.data;

beforeEach(() => {
  seq = 0;
  unhandled.length = 0;
  db = {
    admins: {
      clerk_admin: { id: 'a1', fullName: 'Asha Admin', role: 'admin' },
      clerk_super: { id: 'a2', fullName: 'Sam Super', role: 'super_admin' },
      clerk_mentor: { id: 'a3', fullName: 'Mani Mentor', role: 'mentor' },
      clerk_mod: { id: 'a4', fullName: 'Mo Moderator', role: 'moderator' },
    },
    programs: [{ id: PROGRAM, name: 'eComm Mastery', durationDays: 28 }, { id: OTHER_PROGRAM, name: 'Other', durationDays: 14 }],
    weeks: [], milestones: [],
    tasks: [
      { id: TASK_ADS, programId: PROGRAM, batchId: null, title: 'Launch first ad', dayNumber: 2, sortOrder: 0, isRequired: true, isActive: true,
        memberId: null, weekId: null, milestoneId: null, isMilestone: true, milestoneLabel: 'Ads' },
      { id: TASK_W2, programId: PROGRAM, batchId: null, title: 'Build landing page', dayNumber: 9, sortOrder: 0, isRequired: true, isActive: true,
        memberId: null, weekId: null, milestoneId: null, isMilestone: false, milestoneLabel: null },
    ],
    submissions: [{ taskId: TASK_ADS, memberId: MEMBER, dayNumber: 2, status: 'approved' }],
    records: [],
    members: [
      { id: MEMBER, firstName: 'Priya', lastName: 'K', batchId: BATCH },
      { id: OTHER_MEMBER, firstName: 'Ravi', lastName: 'S', batchId: BATCH },
    ],
  };
});

describe('before any configuration (backward compatibility)', () => {
  it('admin sees the built-in defaults, not yet saved', async () => {
    const c = await config();
    expect(c.saved).toBe(false);
    expect(c.weeks.map((w: any) => [w.id, w.label])).toEqual([[null, 'W1'], [null, 'W2'], [null, 'W3'], [null, 'W4']]);
    expect(c.milestones.map((m: any) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh', '1 crore']);
  });

  it('the member graph is unchanged: default weeks, legacy milestone label still lifts', async () => {
    const g = await memberGraph();
    expect(g.config.source).toBe('default');
    expect(g.weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(g.weeks[0].progressLevel).toBe(3); // approved "Ads" milestone, 1 of 1 → Funnels cap
  });
});

describe('weeks: create, edit, reorder, enable/disable, delete', () => {
  it('adding W5 persists and appears in the member graph', async () => {
    const res = await call(graph.createWeekHandler, { params: P, body: { label: 'W5', startDay: 29, endDay: 35 } });
    expect(res.status).toBe(200);
    expect((await config()).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']); // fresh request
    expect((await memberGraph()).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
  });

  it('renaming a week updates its label; the activity and approved progress stay', async () => {
    await call(graph.initializeHandler, { params: P });
    const w1 = (await config()).weeks[0];
    expect((await call(graph.updateWeekHandler, { params: { ...P, id: w1.id }, body: { label: 'Kick-off' } })).status).toBe(200);
    const g = await memberGraph();
    expect(g.weeks[0]).toMatchObject({ label: 'Kick-off', weekId: w1.id });
    expect(g.weeks[0].activities[0]).toMatchObject({ taskId: TASK_ADS, completed: true });
  });

  it('reordering changes the display order', async () => {
    await call(graph.initializeHandler, { params: P });
    const ids = (await config()).weeks.map((w: any) => w.id);
    const res = await call(graph.reorderWeeksHandler, { params: P, body: { ids: [ids[1], ids[0], ids[2], ids[3]] } });
    expect(res.status).toBe(200);
    expect((await memberGraph()).weeks.map((w: any) => w.label)).toEqual(['W2', 'W1', 'W3', 'W4']);
  });

  it('disabling hides the week and its activities; re-enabling restores them with their history', async () => {
    await call(graph.initializeHandler, { params: P });
    const w1 = (await config()).weeks[0];
    await call(graph.updateWeekHandler, { params: { ...P, id: w1.id }, body: { isActive: false } });
    let g = await memberGraph();
    expect(g.weeks.map((w: any) => w.label)).toEqual(['W2', 'W3', 'W4']);
    expect(db.submissions).toHaveLength(1); // nothing deleted
    await call(graph.updateWeekHandler, { params: { ...P, id: w1.id }, body: { isActive: true } });
    g = await memberGraph();
    expect(g.weeks[0].activities[0]).toMatchObject({ taskId: TASK_ADS, completed: true });
  });

  it('a week in use cannot be deleted (disable instead); an unused one can', async () => {
    await call(graph.initializeHandler, { params: P });
    const weeks = (await config()).weeks;
    const inUse = await call(graph.deleteWeekHandler, { params: { ...P, id: weeks[0].id } });
    expect(inUse.status).toBe(409);
    expect(inUse.body.error).toMatch(/Disable it instead/);
    const unused = await call(graph.deleteWeekHandler, { params: { ...P, id: weeks[3].id } });
    expect(unused.status).toBe(200);
    expect((await config()).weeks).toHaveLength(3);
  });

  it('rejects invalid, duplicate and overlapping weeks', async () => {
    expect((await call(graph.createWeekHandler, { params: P, body: { label: '', startDay: 29, endDay: 35 } })).status).toBe(400);
    expect((await call(graph.createWeekHandler, { params: P, body: { label: 'W9', startDay: 40, endDay: 35 } })).status).toBe(400);
    expect((await call(graph.createWeekHandler, { params: P, body: { label: 'w1', startDay: 29, endDay: 35 } })).status).toBe(409);
    const overlap = await call(graph.createWeekHandler, { params: P, body: { label: 'Bonus', startDay: 27, endDay: 33 } });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toMatch(/overlap "W4"/);
  });

  it('rejects a reorder that does not list every week exactly once', async () => {
    await call(graph.initializeHandler, { params: P });
    const ids = (await config()).weeks.map((w: any) => w.id);
    expect((await call(graph.reorderWeeksHandler, { params: P, body: { ids: ids.slice(1) } })).status).toBe(400);
  });
});

describe('milestones (including revenue milestones)', () => {
  it('initializing links legacy milestone activities by id, so a rename keeps them', async () => {
    await call(graph.initializeHandler, { params: P });
    const ads = (await config()).milestones.find((m: any) => m.label === 'Ads');
    expect(db.tasks.find((t) => t.id === TASK_ADS)!.milestoneId).toBe(ads.id);
    await call(graph.updateMilestoneHandler, { params: { ...P, id: ads.id }, body: { label: 'Meta Ads' } });
    expect(db.tasks.find((t) => t.id === TASK_ADS)!.milestoneLabel).toBe('Meta Ads');
    const g = await memberGraph();
    expect(g.config.milestones[0].label).toBe('Meta Ads');
    expect(g.weeks[0].progressLevel).toBe(3);
  });

  it('changing "1 lakh" to "₹5 Lakhs" and adding "Sales Automation" shows in the member graph', async () => {
    await call(graph.initializeHandler, { params: P });
    const lakh = (await config()).milestones.find((m: any) => m.label === '1 lakh');
    await call(graph.updateMilestoneHandler, { params: { ...P, id: lakh.id }, body: { label: '₹5 Lakhs' } });
    const created = await call(graph.createMilestoneHandler, { params: P, body: { label: 'Sales Automation', kind: 'activity' } });
    expect(created.status).toBe(200);
    // Put the new activity milestone after Funnels, before the revenue milestones
    const ids = (await config()).milestones.map((m: any) => m.id);
    const sa = created.body.data.id;
    const order = [ids[0], ids[1], ids[2], sa, ids[3], ids[4]];
    expect((await call(graph.reorderMilestonesHandler, { params: P, body: { ids: order } })).status).toBe(200);
    expect((await memberGraph()).config.milestones.map((m: any) => m.label))
      .toEqual(['Ads', 'Website', 'Funnels', 'Sales Automation', '₹5 Lakhs', '1 crore']);
  });

  it('a disabled milestone leaves the member axis; a linked one cannot be deleted', async () => {
    await call(graph.initializeHandler, { params: P });
    const ms = (await config()).milestones;
    await call(graph.updateMilestoneHandler, { params: { ...P, id: ms[4].id }, body: { isActive: false } });
    expect((await memberGraph()).config.milestones.map((m: any) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh']);
    expect((await call(graph.deleteMilestoneHandler, { params: { ...P, id: ms[0].id } })).status).toBe(409); // linked activity
    expect((await call(graph.deleteMilestoneHandler, { params: { ...P, id: ms[4].id } })).status).toBe(200);
  });

  it('rejects duplicate and invalid milestones', async () => {
    expect((await call(graph.createMilestoneHandler, { params: P, body: { label: 'website' } })).status).toBe(409);
    expect((await call(graph.createMilestoneHandler, { params: P, body: { label: 'X', kind: 'profit' } })).status).toBe(400);
  });
});

describe('activities', () => {
  it('creating an activity in a week shows it in that week of the member graph', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    const res = await call(graph.createActivityHandler, { params: P, body: { title: 'Set up WhatsApp automation', weekId: c.weeks[2].id } });
    expect(res.status).toBe(200);
    const g = await memberGraph();
    expect(g.weeks[2].activities.map((a: any) => a.title)).toContain('Set up WhatsApp automation');
  });

  it('renaming an activity and moving it to another week keeps its approved submission', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    await call(graph.updateActivityHandler, { params: { ...P, id: TASK_ADS }, body: { title: 'Launch Meta ads', weekId: c.weeks[1].id } });
    const t = db.tasks.find((x) => x.id === TASK_ADS)!;
    expect(t).toMatchObject({ title: 'Launch Meta ads', weekId: c.weeks[1].id, dayNumber: 8 });
    const g = await memberGraph();
    expect(g.weeks[1].activities.find((a: any) => a.taskId === TASK_ADS)).toMatchObject({ title: 'Launch Meta ads', completed: true });
    expect(db.submissions).toHaveLength(1);
  });

  it('rejects an activity without a week, or with a week from another program', async () => {
    await call(graph.initializeHandler, { params: P });
    expect((await call(graph.createActivityHandler, { params: P, body: { title: 'X' } })).status).toBe(400);
    const foreign = await call(graph.createActivityHandler, { params: P, body: { title: 'X', weekId: '99999999-0000-4000-8000-000000000000' } });
    expect(foreign.status).toBe(400);
  });
});

describe('admin-recorded member milestones', () => {
  it('a recorded revenue milestone lifts only that member\'s graph, in the recorded week', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    const lakh = c.milestones.find((m: any) => m.label === '1 lakh');
    const res = await call(graph.upsertRecordHandler, { params: { memberId: MEMBER }, body: { milestoneId: lakh.id, weekId: c.weeks[1].id, note: 'Verified invoices' } });
    expect(res.status).toBe(200);
    expect((await memberGraph(MEMBER)).weeks[1].progressLevel).toBe(4);
    // The other member in the same batch sees none of it
    const other = await memberGraph(OTHER_MEMBER);
    expect(other.weeks[1].progressLevel).toBe(0);
    expect(other.weeks[0].progressLevel).toBe(0); // and not the first member's approved task either
  });

  it('records persist, can be moved to another week and removed', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    const crore = c.milestones.find((m: any) => m.label === '1 crore');
    await call(graph.upsertRecordHandler, { params: { memberId: MEMBER }, body: { milestoneId: crore.id, weekId: c.weeks[0].id } });
    await call(graph.upsertRecordHandler, { params: { memberId: MEMBER }, body: { milestoneId: crore.id, weekId: c.weeks[2].id } });
    const listed = (await call(graph.listRecordsHandler, { params: { memberId: MEMBER } })).body.data.records;
    expect(listed).toHaveLength(1);
    expect(listed[0].weekId).toBe(c.weeks[2].id);
    await call(graph.deleteRecordHandler, { params: { memberId: MEMBER, recordId: listed[0].id } });
    expect(db.records).toHaveLength(0);
  });

  it('rejects a milestone or week from another program', async () => {
    await call(graph.initializeHandler, { params: P });
    await call(graph.initializeHandler, { params: { programId: OTHER_PROGRAM } });
    const foreign = db.milestones.find((m) => m.programId === OTHER_PROGRAM)!;
    const week = (await config()).weeks[0];
    const res = await call(graph.upsertRecordHandler, { params: { memberId: MEMBER }, body: { milestoneId: foreign.id, weekId: week.id } });
    expect(res.status).toBe(400);
  });
});

describe('authorization', () => {
  it('moderators and mentors cannot change the configuration', async () => {
    for (const clerk of ['clerk_mod', 'clerk_mentor']) {
      expect((await call(graph.createWeekHandler, { clerk, params: P, body: { label: 'W5', startDay: 29, endDay: 35 } })).status).toBe(403);
      expect((await call(graph.createMilestoneHandler, { clerk, params: P, body: { label: 'Nope' } })).status).toBe(403);
      expect((await call(graph.initializeHandler, { clerk, params: P })).status).toBe(403);
    }
    expect(db.weeks).toHaveLength(0);
    expect(db.milestones).toHaveLength(0);
  });

  it('a mentor can record member milestones; a moderator cannot', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    const body = { milestoneId: c.milestones[3].id, weekId: c.weeks[0].id };
    expect((await call(graph.upsertRecordHandler, { clerk: 'clerk_mod', params: { memberId: MEMBER }, body })).status).toBe(403);
    expect((await call(graph.upsertRecordHandler, { clerk: 'clerk_mentor', params: { memberId: MEMBER }, body })).status).toBe(200);
  });

  it('an unknown admin account is refused; a super admin is allowed', async () => {
    expect((await call(graph.getConfigHandler, { clerk: 'clerk_nobody', params: P })).status).toBe(403);
    expect((await call(graph.createWeekHandler, { clerk: 'clerk_super', params: P, body: { label: 'W5', startDay: 29, endDay: 35 } })).status).toBe(200);
  });

  it('bad or unknown ids are rejected safely', async () => {
    expect((await call(graph.getConfigHandler, { params: { programId: 'x' } })).status).toBe(400);
    expect((await call(graph.getConfigHandler, { params: { programId: '10000000-0000-0000-0000-000000000099' } })).status).toBe(404);
    await call(graph.initializeHandler, { params: P });
    expect((await call(graph.updateWeekHandler, { params: { ...P, id: '99999999-0000-4000-8000-000000000000' }, body: { label: 'Y' } })).status).toBe(404);
    expect((await call(graph.listRecordsHandler, { params: { memberId: 'nope' } })).status).toBe(400);
  });
});

describe('test store', () => {
  it('answers every statement the handlers issue', async () => {
    await call(graph.initializeHandler, { params: P });
    await config();
    await memberGraph();
    expect(unhandled).toEqual([]);
  });
});
