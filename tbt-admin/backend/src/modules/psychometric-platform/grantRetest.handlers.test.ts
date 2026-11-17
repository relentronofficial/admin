import { beforeEach, describe, expect, it } from 'vitest';
import * as results from './results.controller.js';

// POST /admin/users/:id/grant-retest against an in-memory stand-in for the
// psy_* tables. Production case (2026-11-17): Janani V and Nandhini Babu had
// their attempts cut short by a 1-minute question set but had never requested
// a retest — the admin had no way to give them one.

const ADMIN = { id: 'admin-1', fullName: 'Admin', email: 'admin@tbt.test', role: 'admin' };

type Cand = { id: string; member_id: string | null; name: string; email: string | null; access_code: string | null; access_code_id: string | null; has_completed: boolean };
type Retest = { id: string; candidate_id: string; status: string; created_at: number; requested_by_user: boolean; decided_by?: string; reason?: string; attempt_number?: number; current_result_id?: string | null };

let cands: Cand[];
let retests: Retest[];
let resultsRows: { id: string; candidate_id: string; percentage: number; level: string; created_at: number }[];
let locks: string[];
let seq = 0;

const db = {
  async $queryRawUnsafe(text: string, ...a: any[]): Promise<any[]> {
    const q = text.replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT * FROM psy_candidates WHERE id = $1')) return cands.filter((c) => c.id === a[0]);
    if (q.startsWith('SELECT id, status FROM psy_retest_requests')) {
      return retests.filter((r) => r.candidate_id === a[0] && ['pending', 'approved'].includes(r.status)).sort((x, y) => y.created_at - x.created_at).slice(0, 1);
    }
    if (q.startsWith('SELECT id, percentage, level FROM psy_results')) return resultsRows.filter((r) => r.candidate_id === a[0]).sort((x, y) => y.created_at - x.created_at).slice(0, 1);
    if (q.startsWith('SELECT COUNT(*)::int AS n FROM psy_results')) return [{ n: resultsRows.filter((r) => r.candidate_id === a[0]).length }];
    if (q.startsWith('SELECT question_set_id FROM psy_access_codes')) return [{ question_set_id: 'set-1' }];
    if (q.startsWith('INSERT INTO psy_retest_requests')) {
      const r: Retest = { id: `rr-${++seq}`, candidate_id: a[0], attempt_number: a[5], current_result_id: a[6], reason: a[9], status: 'approved', requested_by_user: false, decided_by: a[10], created_at: seq };
      retests.push(r);
      return [{ id: r.id }];
    }
    throw new Error(`unhandled query: ${q.slice(0, 80)}`);
  },
  async $executeRawUnsafe(text: string, ...a: any[]): Promise<number> {
    const q = text.replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT pg_advisory_xact_lock')) { locks.push(a[0]); return 1; }
    if (q.startsWith("UPDATE psy_retest_requests SET status = 'approved'")) {
      const r = retests.find((x) => x.id === a[2] && x.status === 'pending');
      if (r) { r.status = 'approved'; r.decided_by = a[0]; }
      return r ? 1 : 0;
    }
    throw new Error(`unhandled exec: ${q.slice(0, 80)}`);
  },
};

async function grant(id: string, body?: any) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = { code(c: number) { sent.status = c; return reply; }, send(b: any) { sent.body = b; return reply; } };
  const req: any = { params: { id }, body, psyAdmin: ADMIN, server: { prisma: { ...db, $transaction: (fn: any) => fn(db) } } };
  await results.grantRetest(req, reply);
  return sent;
}

const cand = (id: string, over: Partial<Cand> = {}): Cand => ({ id, member_id: `m-${id}`, name: `Member ${id}`, email: null, access_code: 'CODE', access_code_id: 'ac-1', has_completed: true, ...over });

beforeEach(() => {
  cands = [cand('c1'), cand('c2', { has_completed: false })];
  retests = [];
  resultsRows = [{ id: 'res-1', candidate_id: 'c1', percentage: 8, level: 'Needs Improvement', created_at: 1 }];
  locks = [];
});

describe('grant retest (admin)', () => {
  it('a completed candidate with no request gets one approved retest, attributed to the admin', async () => {
    const r = await grant('c1');
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/Retest granted/);
    expect(retests).toHaveLength(1);
    expect(retests[0]).toMatchObject({ candidate_id: 'c1', status: 'approved', requested_by_user: false, decided_by: 'admin-1', attempt_number: 2, current_result_id: 'res-1', reason: 'Granted by admin' });
    expect(locks).toEqual(['psy-retest:m-c1']); // same lock as the member's own request
  });

  it('keeps an admin-given reason', async () => {
    await grant('c1', { reason: '  Time limit was 1 minute  ' });
    expect(retests[0].reason).toBe('Time limit was 1 minute');
  });

  it("approves the member's pending request instead of adding a second one", async () => {
    retests.push({ id: 'rr-p', candidate_id: 'c1', status: 'pending', created_at: 0, requested_by_user: true });
    const r = await grant('c1');
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/pending retest request/);
    expect(retests).toHaveLength(1);
    expect(retests[0]).toMatchObject({ id: 'rr-p', status: 'approved', decided_by: 'admin-1' });
  });

  it('refuses a second grant while an approved retest is still unused', async () => {
    await grant('c1');
    const r = await grant('c1');
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/already has an approved retest/);
    expect(retests).toHaveLength(1);
  });

  it('a used retest does not block a new grant', async () => {
    retests.push({ id: 'rr-u', candidate_id: 'c1', status: 'used', created_at: 0, requested_by_user: true });
    expect((await grant('c1')).status).toBe(200);
    expect(retests.filter((r) => r.status === 'approved')).toHaveLength(1);
  });

  it('a candidate who never completed the assessment needs no retest', async () => {
    const r = await grant('c2');
    expect(r.status).toBe(400);
    expect(retests).toHaveLength(0);
  });

  it('unknown candidate → 404', async () => {
    expect((await grant('nope')).status).toBe(404);
  });
});
