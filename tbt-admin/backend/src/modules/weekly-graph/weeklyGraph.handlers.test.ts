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
  milestones: Array<{ id: string; programId: string; label: string; kind: string; sortOrder: number; isActive: boolean; threshold?: number | null }>;
  tasks: Array<{ id: string; programId: string | null; batchId: string | null; title: string; dayNumber: number; sortOrder: number;
    isRequired: boolean; isActive: boolean; memberId: string | null; weekId: string | null; milestoneId: string | null;
    isMilestone: boolean; milestoneLabel: string | null; deletedAt?: Date | null }>;
  submissions: Array<{ taskId: string; memberId: string; dayNumber: number; status: string }>;
  records: Array<{ id: string; memberId: string; milestoneId: string; weekId: string | null; note: string | null; recordedBy: string; recordedAt: Date }>;
  members: Array<{ id: string; firstName: string; lastName: string; batchId: string | null }>;
  /** member_revenue_reports: the member's own weekly figure ("Your Revenue Stats"), per IST ISO week. */
  revenues: Array<{ memberId: string; isoYear: number; isoWeek: number; revenue: number | null }>;
  /** The test batch (of PROGRAM): batches.snapshot_days (null = the program's length) and the member's member_batch_settings.extended_days. */
  batchSnapshotDays: number | null;
  extendedDays: number;
}
let db: Store;
const unhandled: string[] = [];
/** Makes the member-records move fail, to check the week delete is all-or-nothing. */
let failRecordMove = false;

const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/s$/, '');
const weekOut = (w: Store['weeks'][number]) => ({ id: w.id, label: w.label, startDay: w.startDay, endDay: w.endDay, sortOrder: w.sortOrder, isActive: w.isActive });
const msOut = (m: Store['milestones'][number]) => ({ id: m.id, label: m.label, kind: m.kind, sortOrder: m.sortOrder, isActive: m.isActive, threshold: m.threshold ?? null });
const sorted = <T extends { sortOrder: number; label: string }>(xs: T[]) => [...xs].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

/** Answers exactly the statements the graph handlers issue. Unknown SQL fails loudly. */
async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT id::text, name, duration_days')) return db.programs.filter((p) => p.id === a[0]);
  if (q.startsWith('SELECT duration_days AS "durationDays" FROM programs')) return db.programs.filter((p) => p.id === a[0]);
  if (q.startsWith('SELECT') && q.includes('FROM graph_weeks WHERE program_id')) return sorted(db.weeks.filter((w) => w.programId === a[0])).map(weekOut);
  if (q.startsWith('SELECT') && q.includes('FROM graph_milestones WHERE program_id')) return sorted(db.milestones.filter((m) => m.programId === a[0])).map(msOut);
  if (q.startsWith('UPDATE graph_milestones SET sort_order = sort_order + 1')) {
    const lakh = db.milestones.find((m) => m.programId === a[0] && m.label === '1 lakh' && m.kind === 'revenue');
    const has5 = db.milestones.some((m) => m.programId === a[0] && m.label === '5 Lakhs' && m.kind === 'revenue');
    if (!lakh || has5) return 0;
    for (const m of db.milestones) { if (m.programId === a[0] && m.sortOrder > lakh.sortOrder) m.sortOrder += 1; }
    return 1;
  }
  if (q.startsWith('INSERT INTO graph_milestones') && q.includes("'5 Lakhs'")) {
    const lakh = db.milestones.find((m) => m.programId === a[0] && m.label === '1 lakh' && m.kind === 'revenue');
    const has5 = db.milestones.some((m) => m.programId === a[0] && m.label === '5 Lakhs' && m.kind === 'revenue');
    if (!lakh || has5) return 0;
    db.milestones.push({ id: uuid(), programId: a[0], label: '5 Lakhs', kind: 'revenue', sortOrder: lakh.sortOrder + 1, isActive: true });
    return 1;
  }
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
  if (q.startsWith('UPDATE tasks SET graph_week_id = $3::uuid WHERE graph_week_id = $2::uuid OR')) {
    const [pid, wid, target, s, e] = a;
    let n = 0;
    for (const t of db.tasks) {
      if (t.weekId === wid || (t.programId === pid && !t.batchId && !t.weekId && t.dayNumber >= s && t.dayNumber <= e)) { t.weekId = target; n++; }
    }
    return n;
  }
  if (q.startsWith('UPDATE member_graph_milestone_records SET week_id = $2::uuid WHERE week_id = $1::uuid')) {
    if (failRecordMove) throw new Error('connection lost');
    let n = 0;
    for (const r of db.records) if (r.weekId === a[0]) { r.weekId = a[1]; n++; }
    return n;
  }
  if (q.startsWith('DELETE FROM graph_weeks')) { db.weeks = db.weeks.filter((w) => !(w.id === a[1] && w.programId === a[0])); return 1; }
  if (q.startsWith('INSERT INTO graph_milestones (program_id, label, kind, sort_order, is_active, threshold_amount) VALUES')) {
    const order = Math.max(-1, ...db.milestones.filter((m) => m.programId === a[0]).map((m) => m.sortOrder)) + 1;
    const m = { id: uuid(), programId: a[0], label: a[1], kind: a[2], sortOrder: order, isActive: a[3], threshold: a[4] };
    db.milestones.push(m);
    return [msOut(m)];
  }
  if (q.startsWith('UPDATE graph_milestones SET label = $3, kind = $4, is_active = $5, threshold_amount = $6')) {
    const m = db.milestones.find((x) => x.id === a[1] && x.programId === a[0])!;
    Object.assign(m, { label: a[2], kind: a[3], isActive: a[4], threshold: a[5] });
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
    if (!q.includes('deleted_at IS NULL')) throw new Error('activity list must skip archived activities');
    return db.tasks.filter((t) => t.programId === a[0] && !t.batchId && !t.deletedAt).map((t) => ({ ...t }));
  }
  if (q.startsWith('INSERT INTO tasks (program_id, day_number, title')) {
    const t = { id: uuid(), programId: a[0], batchId: null, dayNumber: a[1], title: a[2], isRequired: a[3], isActive: a[4], sortOrder: 0,
      memberId: null, weekId: a[5], milestoneId: a[6], isMilestone: a[7], milestoneLabel: a[8] };
    db.tasks.push(t);
    return [{ id: t.id }];
  }
  if (q.startsWith('SELECT id::text, title, day_number AS "dayNumber", is_required')) {
    return db.tasks.filter((t) => t.id === a[1] && t.programId === a[0] && !t.batchId && (!q.includes('deleted_at IS NULL') || !t.deletedAt)).map((t) => ({ ...t }));
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
  if (q.startsWith('SELECT extended_days FROM member_batch_settings')) return db.extendedDays ? [{ extended_days: db.extendedDays }] : [];
  if (q.startsWith('SELECT year AS "isoYear", week_number AS "isoWeek", revenue_generated::float8 AS revenue, created_at AS "reportedAt" FROM member_revenue_reports')) {
    return db.revenues.filter((r) => r.memberId === a[0]).map((r) => ({ isoYear: r.isoYear, isoWeek: r.isoWeek, revenue: r.revenue, reportedAt: null }));
  }
  if (q.startsWith('SELECT GREATEST( COALESCE((SELECT duration_days FROM programs WHERE id = $1::uuid), 0)')) {
    // loadProgramWeekSpanDays: program length, the batch's length (snapshot null → program's) + extra days, latest active activity day.
    const p = db.programs.find((x) => x.id === a[0]);
    const batchDays = a[0] === PROGRAM ? (db.batchSnapshotDays ?? p!.durationDays) + db.extendedDays : 0;
    const taskDays = db.tasks.filter((t) => t.isActive && t.programId === a[0]).map((t) => t.dayNumber);
    return [{ days: Math.max(p?.durationDays ?? 0, batchDays, ...taskDays, 0) }];
  }
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
  if (q.startsWith('SELECT id::text, title FROM tasks WHERE id = $2::uuid AND program_id = $1::uuid AND batch_id IS NULL')) {
    return db.tasks.filter((t) => t.id === a[1] && t.programId === a[0] && !t.batchId && !t.deletedAt).map((t) => ({ id: t.id, title: t.title }));
  }
  if (q.startsWith('DELETE FROM tasks t WHERE t.id = $2::uuid AND t.program_id = $1::uuid AND t.batch_id IS NULL AND NOT EXISTS')) {
    const t = db.tasks.find((x) => x.id === a[1] && x.programId === a[0] && !x.batchId);
    if (!t || db.submissions.some((sub) => sub.taskId === t.id)) return [];
    db.tasks = db.tasks.filter((x) => x !== t);
    return [{ id: t.id }];
  }
  if (q.startsWith('UPDATE tasks SET deleted_at = NOW(), is_active = false')) {
    const t = db.tasks.find((x) => x.id === a[1] && x.programId === a[0] && !x.batchId && !x.deletedAt);
    if (t) { t.deletedAt = new Date(); t.isActive = false; }
    return t ? 1 : 0;
  }
  if (q.startsWith('SELECT COUNT(*)::int AS submissions FROM task_submissions WHERE task_id')) {
    return [{ submissions: db.submissions.filter((sub) => sub.taskId === a[0]).length }];
  }
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
      // All-or-nothing like a real transaction: restore the store if anything inside throws.
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
        const snapshot = structuredClone(db);
        try { return await fn({ $queryRawUnsafe: sql, $executeRawUnsafe: sql }); } catch (e) { db = snapshot; throw e; }
      }),
      admin: { findUnique: vi.fn(async ({ where }: any) => db.admins[where.clerkId] ?? null) },
      member: {
        findUnique: vi.fn(async ({ where }: any) => {
          const m = db.members.find((x) => x.id === where.id);
          return m ? { id: m.id, batchId: m.batchId, email: `${m.id}@x` } : null;
        }),
        findMany: vi.fn(async () => []),
      },
      batch: { findUnique: vi.fn(async () => ({ programId: PROGRAM, snapshotDays: db.batchSnapshotDays, startsAt: new Date(Date.now() - 19 * DAY), program: { durationDays: db.programs[0].durationDays } })) },
      memberDayProgress: { findMany: vi.fn(async () => []) },
    },
  };
}

/** A fresh request + reply each call (nothing carried between calls but the store). */
async function call(handler: any, opts: { clerk?: string; memberId?: string; params?: any; body?: any; query?: any } = {}) {
  const sent: { status: number; body?: any } = { status: 200 };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    header() { return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { user: opts.clerk ?? 'clerk_admin', memberId: opts.memberId, params: opts.params ?? {}, body: opts.body, query: opts.query ?? {}, server: server(), log: { warn() {}, error() {} } };
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
    revenues: [],
    batchSnapshotDays: null,
    extendedDays: 0,
  };
});

describe('before any configuration (backward compatibility)', () => {
  it('admin sees the built-in defaults, not yet saved', async () => {
    const c = await config();
    expect(c.saved).toBe(false);
    expect(c.weeks.map((w: any) => [w.id, w.label])).toEqual([[null, 'W1'], [null, 'W2'], [null, 'W3'], [null, 'W4']]);
    expect(c.milestones.map((m: any) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh', '5 Lakhs', '1 crore']);
  });

  it('the member graph is unchanged: default weeks, legacy milestone label still lifts', async () => {
    const g = await memberGraph();
    expect(g.config.source).toBe('default');
    expect(g.weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(g.weeks[0].progressLevel).toBe(3); // approved "Ads" milestone, 1 of 1 → Funnels cap
  });

  it('28-day program, 35-day batch: admin defaults and the member graph both list W1–W5; saving the defaults keeps W5', async () => {
    db.batchSnapshotDays = 35;
    const span = [['W1', 1, 7], ['W2', 8, 14], ['W3', 15, 21], ['W4', 22, 28], ['W5', 29, 35]];
    expect((await config()).weeks.map((w: any) => [w.label, w.startDay, w.endDay])).toEqual(span);
    expect((await memberGraph()).weeks.map((w: any) => [w.label, w.startDay, w.endDay])).toEqual(span);
    await call(graph.initializeHandler, { params: P });
    expect((await config()).weeks.map((w: any) => [w.label, w.startDay, w.endDay])).toEqual(span);
    expect((await memberGraph()).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
  });

  it("a member's extra days count too: 28-day program + 7 extra days → W1–W5 on both sides", async () => {
    db.extendedDays = 7;
    expect((await config()).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect((await memberGraph()).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect((await memberGraph(OTHER_MEMBER)).weeks.map((w: any) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
  });

  it('saved custom weeks are kept exactly, whatever the batch length', async () => {
    await call(graph.initializeHandler, { params: P }); // 28 days → W1–W4 saved
    const w4 = (await config()).weeks[3];
    await call(graph.updateWeekHandler, { params: { ...P, id: w4.id }, body: { label: 'Final stretch', endDay: 30 } });
    db.batchSnapshotDays = 42; // the batch now runs longer — saved weeks are never regenerated
    const saved = [['W1', 1, 7], ['W2', 8, 14], ['W3', 15, 21], ['Final stretch', 22, 30]];
    expect((await config()).weeks.map((w: any) => [w.label, w.startDay, w.endDay])).toEqual(saved);
    expect((await memberGraph()).weeks.map((w: any) => [w.label, w.startDay, w.endDay])).toEqual(saved);
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

  it('a week in use is not deleted without a target week (409 with the counts); an unused one is', async () => {
    await call(graph.initializeHandler, { params: P });
    const weeks = (await config()).weeks;
    const inUse = await call(graph.deleteWeekHandler, { params: { ...P, id: weeks[0].id } });
    expect(inUse.status).toBe(409);
    expect(inUse.body.error).toMatch(/"W1" has 1 activities and 0 member records\. Choose a week to move them to/);
    expect((await config()).weeks).toHaveLength(4); // nothing changed
    const unused = await call(graph.deleteWeekHandler, { params: { ...P, id: weeks[3].id } });
    expect(unused.status).toBe(200);
    expect((await config()).weeks).toHaveLength(3);
  });

  it('deleting a week in use with ?moveTo moves its activities and member records to that week, then deletes it', async () => {
    await call(graph.initializeHandler, { params: P });
    const [w1, w2] = (await config()).weeks;
    db.records.push({ id: uuid(), memberId: MEMBER, milestoneId: db.milestones[0].id, weekId: w1.id, note: null, recordedBy: 'Asha', recordedAt: new Date() });
    const res = await call(graph.deleteWeekHandler, { params: { ...P, id: w1.id }, query: { moveTo: w2.id } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: w1.id, movedTo: w2.id, activities: 1, records: 1 });
    expect((await config()).weeks.map((w: any) => w.label)).toEqual(['W2', 'W3', 'W4']);
    const ads = db.tasks.find((t) => t.id === TASK_ADS)!;
    expect(ads.weekId).toBe(w2.id);   // reassigned to W2 …
    expect(ads.dayNumber).toBe(2);     // … its day (members' checklist) unchanged
    expect(db.records[0].weekId).toBe(w2.id);
    expect(db.submissions).toHaveLength(1); // no data lost
    // Not orphaned: the member graph still shows the activity, now under W2.
    const g = await memberGraph();
    expect(g.weeks.find((w: any) => w.label === 'W2').activities.map((x: any) => x.taskId)).toContain(TASK_ADS);
    expect(unhandled).toEqual([]);
  });

  it('rejects a missing or same target week, and changes nothing', async () => {
    await call(graph.initializeHandler, { params: P });
    const [w1] = (await config()).weeks;
    for (const moveTo of [w1.id, '00000000-0000-4000-8000-0000000000ff']) {
      const r = await call(graph.deleteWeekHandler, { params: { ...P, id: w1.id }, query: { moveTo } });
      expect(r.status).toBe(400);
    }
    expect((await config()).weeks).toHaveLength(4);
    expect(db.tasks.find((t) => t.id === TASK_ADS)!.weekId).toBeNull();
  });

  it('is all-or-nothing: if moving the member records fails, the week and its activities are untouched', async () => {
    await call(graph.initializeHandler, { params: P });
    const [w1, w2] = (await config()).weeks;
    failRecordMove = true;
    try {
      await expect(call(graph.deleteWeekHandler, { params: { ...P, id: w1.id }, query: { moveTo: w2.id } })).rejects.toThrow('connection lost');
    } finally { failRecordMove = false; }
    expect((await config()).weeks).toHaveLength(4);
    expect(db.tasks.find((t) => t.id === TASK_ADS)!.weekId).toBeNull();
  });

  it('only Admin / Super Admin can delete or move a week', async () => {
    await call(graph.initializeHandler, { params: P });
    const [w1, w2] = (await config()).weeks;
    expect((await call(graph.deleteWeekHandler, { clerk: 'clerk_mentor', params: { ...P, id: w1.id }, query: { moveTo: w2.id } })).status).toBe(403);
    const bySuper = await call(graph.deleteWeekHandler, { clerk: 'clerk_super', params: { ...P, id: w1.id }, query: { moveTo: w2.id } });
    expect(bySuper.status).toBe(200);
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

  it('changing "1 lakh" to "₹2 Lakhs" and adding "Sales Automation" shows in the member graph', async () => {
    await call(graph.initializeHandler, { params: P });
    const lakh = (await config()).milestones.find((m: any) => m.label === '1 lakh');
    await call(graph.updateMilestoneHandler, { params: { ...P, id: lakh.id }, body: { label: '₹2 Lakhs' } });
    const created = await call(graph.createMilestoneHandler, { params: P, body: { label: 'Sales Automation', kind: 'activity' } });
    expect(created.status).toBe(200);
    // Put the new activity milestone after Funnels, before the revenue milestones
    const ids = (await config()).milestones.map((m: any) => m.id);
    const sa = created.body.data.id;
    const order = [ids[0], ids[1], ids[2], sa, ids[3], ids[4], ids[5]];
    expect((await call(graph.reorderMilestonesHandler, { params: P, body: { ids: order } })).status).toBe(200);
    expect((await memberGraph()).config.milestones.map((m: any) => m.label))
      .toEqual(['Ads', 'Website', 'Funnels', 'Sales Automation', '₹2 Lakhs', '5 Lakhs', '1 crore']);
  });

  it('a disabled milestone leaves the member axis; a linked one cannot be deleted', async () => {
    await call(graph.initializeHandler, { params: P });
    const ms = (await config()).milestones;
    await call(graph.updateMilestoneHandler, { params: { ...P, id: ms[4].id }, body: { isActive: false } });
    expect((await memberGraph()).config.milestones.map((m: any) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh', '1 crore']);
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

describe('revenue milestones and activity markers (admin → API → member graph)', () => {
  // The batch started 19 days ago (see server()), so today is program day 20 (W3).
  const BATCH_START = () => Date.now() - 19 * DAY;
  /** IST ISO week of a program day, the way member_revenue_reports stores "Your Revenue Stats". */
  const isoOfDay = (day: number) => {
    const ist = new Date(BATCH_START() + (day - 1) * DAY + 5.5 * 3_600_000);
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
    return { isoYear: d.getUTCFullYear(), isoWeek: 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * DAY)) };
  };
  /**
   * The program day in [startDay, endDay] that is a Monday (IST). A calendar
   * week's revenue counts from its Monday, so reporting for the week starting on
   * this day lands in that program week whatever weekday the suite runs on.
   */
  const mondayIn = (startDay: number, endDay: number) => {
    for (let d = startDay; d <= endDay; d++) {
      if (new Date(BATCH_START() + (d - 1) * DAY + 5.5 * 3_600_000).getUTCDay() === 1) return d;
    }
    throw new Error('no Monday in range');
  };
  const report = (memberId: string, day: number, revenue: number | null) => db.revenues.push({ memberId, ...isoOfDay(day), revenue });
  const setRevenue = (memberId: string, day: number, revenue: number | null) => {
    const k = isoOfDay(day);
    db.revenues.find((r) => r.memberId === memberId && r.isoYear === k.isoYear && r.isoWeek === k.isoWeek)!.revenue = revenue;
  };
  const milestoneByLabel = async (label: string) => (await config()).milestones.find((m: any) => m.label === label);
  const msOf = (g: any, label: string) => g.config.milestones.find((m: any) => m.label === label);

  /** Admin turns the default "1 lakh" / "5 Lakhs" into ₹1 Lakh / ₹5 Lakhs with real thresholds ("1 crore" keeps none). */
  const configureThresholds = async () => {
    await call(graph.initializeHandler, { params: P });
    const lakh = await milestoneByLabel('1 lakh');
    const fiveLakhs = await milestoneByLabel('5 Lakhs');
    expect((await call(graph.updateMilestoneHandler, { params: { ...P, id: lakh.id }, body: { label: '₹1 Lakh', threshold: 100000 } })).status).toBe(200);
    expect((await call(graph.updateMilestoneHandler, { params: { ...P, id: fiveLakhs.id }, body: { label: '₹5 Lakhs', threshold: '500000' } })).status).toBe(200);
  };

  it('saved thresholds persist and the member graph uses them; nothing is reached without revenue', async () => {
    await configureThresholds();
    expect((await config()).milestones.filter((m: any) => m.kind === 'revenue').map((m: any) => [m.label, m.threshold]))
      .toEqual([['₹1 Lakh', 100000], ['₹5 Lakhs', 500000], ['1 crore', null]]);
    const g = await memberGraph();
    expect(g.config.milestones.filter((m: any) => m.kind === 'revenue').map((m: any) => [m.label, m.threshold, m.reached]))
      .toEqual([['₹1 Lakh', 100000, false], ['₹5 Lakhs', 500000, false], ['1 crore', null, false]]);
    expect(g.revenue).toEqual({ source: 'self_reported', totalToDate: null });
    expect(g.weeks.every((w: any) => w.cumulativeRevenue === null)).toBe(true);
  });

  it("the member's own reported revenue reaches ₹1 Lakh in the crossing week, not ₹5 Lakhs, and never another member's", async () => {
    await configureThresholds();
    report(MEMBER, mondayIn(1, 7), 60000);
    report(MEMBER, mondayIn(8, 14), 50000);
    report(OTHER_MEMBER, mondayIn(1, 7), 900000);
    const g = await memberGraph(MEMBER);
    expect(msOf(g, '₹1 Lakh')).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 2 });
    expect(msOf(g, '₹5 Lakhs')).toMatchObject({ reached: false, reachedBy: null });
    expect(g.revenue.totalToDate).toBe(110000);
    expect(g.weeks.slice(0, 3).map((w: any) => w.cumulativeRevenue)).toEqual([60000, 110000, 110000]);
    expect(g.weeks[3].cumulativeRevenue).toBeNull(); // W4 has not started
    const other = await memberGraph(OTHER_MEMBER);
    expect(msOf(other, '₹5 Lakhs')).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 1 });
  });

  it('revenue edited down, or a threshold raised, is recalculated on the next read', async () => {
    await configureThresholds();
    report(MEMBER, mondayIn(1, 7), 60000);
    report(MEMBER, mondayIn(8, 14), 50000);
    expect(msOf(await memberGraph(), '₹1 Lakh').reached).toBe(true);
    setRevenue(MEMBER, mondayIn(8, 14), 30000);
    expect(msOf(await memberGraph(), '₹1 Lakh')).toMatchObject({ reached: false, reachedWeek: null });
    setRevenue(MEMBER, mondayIn(8, 14), 50000);
    const lakh = await milestoneByLabel('₹1 Lakh');
    await call(graph.updateMilestoneHandler, { params: { ...P, id: lakh.id }, body: { threshold: 150000 } });
    expect(msOf(await memberGraph(), '₹1 Lakh')).toMatchObject({ reached: false, threshold: 150000 });
  });

  it('a blank week of revenue is not read as ₹0 or as any amount', async () => {
    await configureThresholds();
    report(MEMBER, mondayIn(1, 7), null);
    const g = await memberGraph();
    expect(g.revenue.totalToDate).toBeNull();
    expect(g.weeks[0].revenue).toBeNull();
  });

  it('rejects a threshold on an activity milestone and a non-positive amount', async () => {
    await call(graph.initializeHandler, { params: P });
    const ads = await milestoneByLabel('Ads');
    const lakh = await milestoneByLabel('1 lakh');
    expect((await call(graph.updateMilestoneHandler, { params: { ...P, id: ads.id }, body: { threshold: 1000 } })).status).toBe(400);
    expect((await call(graph.updateMilestoneHandler, { params: { ...P, id: lakh.id }, body: { threshold: 0 } })).status).toBe(400);
    expect((await call(graph.createMilestoneHandler, { params: P, body: { label: '₹10 Lakhs', kind: 'revenue', threshold: -1 } })).status).toBe(400);
    expect((await call(graph.createMilestoneHandler, { params: P, body: { label: '₹10 Lakhs', kind: 'revenue', threshold: 1000000 } })).body.data)
      .toMatchObject({ label: '₹10 Lakhs', kind: 'revenue', threshold: 1000000 });
  });

  it('"Ads W1" and "Website W2" show as markers on their milestone rows; an edited title shows after saving', async () => {
    await call(graph.initializeHandler, { params: P });
    const c = await config();
    const ads = c.milestones.find((m: any) => m.label === 'Ads');
    const web = c.milestones.find((m: any) => m.label === 'Website');
    const a1 = await call(graph.createActivityHandler, { params: P, body: { title: 'Ads W1', weekId: c.weeks[0].id, milestoneId: ads.id } });
    await call(graph.createActivityHandler, { params: P, body: { title: 'Website W2', weekId: c.weeks[1].id, milestoneId: web.id } });
    let g = await memberGraph();
    expect(g.weeks[0].activities.find((a: any) => a.title === 'Ads W1')).toMatchObject({ milestoneLabel: 'Ads', level: 1 });
    expect(g.weeks[1].activities.find((a: any) => a.title === 'Website W2')).toMatchObject({ milestoneLabel: 'Website', level: 2 });
    expect(g.weeks.map((w: any) => w.label).slice(0, 2)).toEqual(['W1', 'W2']);
    // Adding an activity is not completing it.
    expect(g.weeks[0].activities.find((a: any) => a.title === 'Ads W1').completed).toBe(false);

    await call(graph.updateActivityHandler, { params: { ...P, id: a1.body.data.id }, body: { title: 'Run Meta Ads W1' } });
    g = await memberGraph();
    expect(g.weeks[0].activities.map((a: any) => a.title)).toContain('Run Meta Ads W1');
    expect(g.weeks[0].activities.map((a: any) => a.title)).not.toContain('Ads W1');

    // Disabling an activity removes its marker.
    await call(graph.updateActivityHandler, { params: { ...P, id: a1.body.data.id }, body: { isActive: false } });
    expect((await memberGraph()).weeks[0].activities.map((a: any) => a.title)).not.toContain('Run Meta Ads W1');
  });

  it('configured W1–W10 show exactly up to W10; adding W11 extends the member graph to W11', async () => {
    await call(graph.initializeHandler, { params: P }); // W1–W4 for the 28-day program
    for (let n = 5; n <= 10; n++) {
      expect((await call(graph.createWeekHandler, { params: P, body: { label: `W${n}`, startDay: (n - 1) * 7 + 1, endDay: n * 7 } })).status).toBe(200);
    }
    expect((await memberGraph()).weeks.map((w: any) => w.label)).toEqual(Array.from({ length: 10 }, (_, i) => `W${i + 1}`));
    await call(graph.createWeekHandler, { params: P, body: { label: 'W11', startDay: 71, endDay: 77 } });
    const g = await memberGraph();
    expect(g.weeks).toHaveLength(11);
    expect(g.weeks.at(-1)).toMatchObject({ label: 'W11', startDay: 71, endDay: 77 });
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

describe('activities: delete', () => {
  const del = (id: string, clerk = 'clerk_admin', programId = PROGRAM) =>
    call(graph.deleteActivityHandler, { clerk, params: { programId, id } });

  it('deletes only the chosen activity (no submissions); it disappears for admins and members', async () => {
    const res = await del(TASK_W2);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: TASK_W2 });
    expect(db.tasks.map((t) => t.id)).toEqual([TASK_ADS]); // only that one row removed
    expect((await config()).activities.map((a: any) => a.id)).toEqual([TASK_ADS]); // fresh request (refresh)
    const g = await memberGraph();
    expect(g.weeks.flatMap((w: any) => w.activities.map((x: any) => x.taskId))).toEqual([TASK_ADS]);
    expect(db.submissions).toHaveLength(1);
    expect(unhandled).toEqual([]);
  });

  it('an activity with submissions is not deleted without explicit confirmation; its submissions are kept', async () => {
    const res = await del(TASK_ADS);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/1 submissions. Deleting it archives the activity and keeps its submissions/);
    expect(db.tasks.map((t) => t.id)).toEqual([TASK_ADS, TASK_W2]);
    expect(db.submissions).toEqual([{ taskId: TASK_ADS, memberId: MEMBER, dayNumber: 2, status: 'approved' }]);
  });

  it('only Admin / Super Admin can delete; Mentor and Moderator get 403 and nothing changes', async () => {
    expect((await del(TASK_W2, 'clerk_mentor')).status).toBe(403);
    expect((await del(TASK_W2, 'clerk_mod')).status).toBe(403);
    expect(db.tasks).toHaveLength(2);
    expect((await del(TASK_W2, 'clerk_super')).status).toBe(200);
  });

  it('an id from another program, a batch task, or a bad id → 404 and nothing is deleted', async () => {
    db.tasks.push({ id: '40000000-0000-4000-8000-000000000009', programId: null, batchId: BATCH, title: 'Batch task', dayNumber: 3, sortOrder: 0,
      isRequired: true, isActive: true, memberId: null, weekId: null, milestoneId: null, isMilestone: false, milestoneLabel: null });
    expect((await del(TASK_W2, 'clerk_admin', OTHER_PROGRAM)).status).toBe(404);
    expect((await del('40000000-0000-4000-8000-000000000009')).status).toBe(404);
    expect((await del('not-a-uuid')).status).toBe(404);
    expect(db.tasks).toHaveLength(3);
  });
});

describe('activities: delete an activity that has submissions (archive)', () => {
  const archive = (id: string, clerk = 'clerk_admin') =>
    call(graph.deleteActivityHandler, { clerk, params: { programId: PROGRAM, id }, query: { archive: 'true' } });

  it('with explicit confirmation the activity is archived: hidden for admins and members, submissions kept', async () => {
    const res = await archive(TASK_ADS);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ archived: TASK_ADS, submissions: 1 });
    const row = db.tasks.find((t) => t.id === TASK_ADS)!;
    expect(row.deletedAt).toBeInstanceOf(Date); // row kept, marked archived
    expect(row.isActive).toBe(false);
    expect(db.submissions).toEqual([{ taskId: TASK_ADS, memberId: MEMBER, dayNumber: 2, status: 'approved' }]); // untouched
    expect((await config()).activities.map((a: any) => a.id)).toEqual([TASK_W2]); // gone from the admin table
    const g = await memberGraph();
    expect(g.weeks.flatMap((w: any) => w.activities.map((x: any) => x.taskId))).toEqual([TASK_W2]); // and for members
    expect(unhandled).toEqual([]);
  });

  it('an archived activity cannot be edited, re-archived or deleted (404)', async () => {
    await archive(TASK_ADS);
    expect((await call(graph.updateActivityHandler, { params: { ...P, id: TASK_ADS }, body: { title: 'x' } })).status).toBe(404);
    expect((await archive(TASK_ADS)).status).toBe(404);
    expect((await call(graph.deleteActivityHandler, { params: { ...P, id: TASK_ADS } })).status).toBe(404);
    expect(db.submissions).toHaveLength(1);
  });

  it('archive=true on an activity without submissions still really deletes it (nothing to keep)', async () => {
    const res = await archive(TASK_W2);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: TASK_W2 });
    expect(db.tasks.map((t) => t.id)).toEqual([TASK_ADS]);
  });

  it('only Admin / Super Admin can archive; Mentor and Moderator get 403 and nothing changes', async () => {
    expect((await archive(TASK_ADS, 'clerk_mentor')).status).toBe(403);
    expect((await archive(TASK_ADS, 'clerk_mod')).status).toBe(403);
    expect(db.tasks.find((t) => t.id === TASK_ADS)!.deletedAt ?? null).toBeNull();
  });
});
