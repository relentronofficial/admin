import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real admin handlers + the real public endpoint against an in-memory
// module_faqs table that answers exactly the SQL they issue. Each call is a
// fresh request, so anything read back was persisted server-side.

vi.mock('../../config/env.js', () => ({ env: {} }));

const admin = await import('./controller.js');
const pub = await import('../pub/controller.js');

const ADMINS: Record<string, { id: string; fullName: string; role: string }> = {
  clerk_admin: { id: '70000000-0000-4000-8000-000000000001', fullName: 'Admin', role: 'admin' },
  clerk_super: { id: '70000000-0000-4000-8000-000000000002', fullName: 'Super', role: 'super_admin' },
  clerk_mentor: { id: '70000000-0000-4000-8000-000000000003', fullName: 'Mentor', role: 'mentor' },
};

type Row = { id: string; question: string; answer: string; is_published: boolean; sort_order: number; created_at: number; updated_at: Date; updated_by: string | null };
let table: Row[];
let seq = 0;
const uuid = () => `9${String(++seq).padStart(7, '0')}-0000-4000-8000-000000000000`;
const out = (r: Row) => ({ id: r.id, question: r.question, answer: r.answer, is_published: r.is_published, sort_order: r.sort_order, updated_at: r.updated_at });
const ordered = () => [...table].sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at);
const unhandled: string[] = [];

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('DELETE FROM module_faqs')) {
    const before = table.length;
    table = table.filter((r) => r.id !== a[0]);
    return before - table.length;
  }
  if (q.includes('FROM module_faqs WHERE is_published = TRUE')) return ordered().filter((r) => r.is_published).map(out);
  if (q.includes('FROM module_faqs ORDER BY sort_order')) return ordered().map(out);
  if (q.includes('FROM module_faqs WHERE id = $1::uuid')) return table.filter((r) => r.id === a[0]).map(out);
  if (q.startsWith('SELECT id::text AS id FROM module_faqs FOR UPDATE')) return table.map((r) => ({ id: r.id }));
  if (q.startsWith('INSERT INTO module_faqs')) {
    const r: Row = { id: uuid(), question: a[0], answer: a[1], is_published: a[2], sort_order: Math.max(-1, ...table.map((x) => x.sort_order)) + 1, created_at: seq, updated_at: new Date(), updated_by: a[3] };
    table.push(r);
    return [out(r)];
  }
  if (q.startsWith('UPDATE module_faqs SET question')) {
    const r = table.find((x) => x.id === a[0]);
    if (!r) return [];
    Object.assign(r, { question: a[1], answer: a[2], is_published: a[3], updated_by: a[4] });
    return [out(r)];
  }
  if (q.startsWith('UPDATE module_faqs SET is_published')) {
    const r = table.find((x) => x.id === a[0]);
    if (!r) return [];
    Object.assign(r, { is_published: a[1], updated_by: a[2] });
    return [out(r)];
  }
  if (q.startsWith('UPDATE module_faqs SET sort_order')) {
    const r = table.find((x) => x.id === a[0])!;
    r.sort_order = a[1];
    return 1;
  }
  unhandled.push(q);
  throw new Error(`unhandled SQL: ${q.slice(0, 80)}`);
}

function server() {
  const prisma: any = {
    $queryRawUnsafe: sql,
    $executeRawUnsafe: sql,
    $transaction: async (fn: any) => fn(prisma),
    admin: { findUnique: async ({ where }: any) => ADMINS[where.clerkId] ?? null },
  };
  return { prisma, redis: null, log: { error() {} } };
}

async function call(handler: any, opts: { clerk?: string; params?: any; body?: any } = {}) {
  const sent: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    header(k: string, v: string) { sent.headers[k] = v; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { user: opts.clerk, params: opts.params ?? {}, body: opts.body, query: {}, server: server(), log: { error() {} } };
  await handler(req, reply);
  return sent;
}

const create = (body: any, clerk = 'clerk_admin') => call(admin.createFaqHandler, { clerk, body });
const publicList = async () => (await call(pub.pubModuleFaqsHandler)).body.data as Array<{ id: string; question: string; answer: string }>;

beforeEach(() => {
  table = [];
  unhandled.length = 0;
});

describe('admin FAQ management', () => {
  it('creates, edits, publishes, unpublishes and deletes an FAQ', async () => {
    const c = await create({ question: 'How do modules unlock?', answer: 'Finish each lesson\nin order.' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ question: 'How do modules unlock?', answer: 'Finish each lesson\nin order.', isPublished: false, sortOrder: 0 });
    const id = c.body.data.id;
    expect(await publicList()).toEqual([]); // drafts are never public

    const e = await call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id }, body: { answer: 'Updated answer' } });
    expect(e.body.data).toMatchObject({ question: 'How do modules unlock?', answer: 'Updated answer' });

    await call(admin.setFaqPublishedHandler, { clerk: 'clerk_admin', params: { id }, body: { isPublished: true } });
    expect(await publicList()).toEqual([{ id, question: 'How do modules unlock?', answer: 'Updated answer' }]);

    await call(admin.setFaqPublishedHandler, { clerk: 'clerk_super', params: { id }, body: { isPublished: false } });
    expect(await publicList()).toEqual([]);

    const d = await call(admin.deleteFaqHandler, { clerk: 'clerk_admin', params: { id } });
    expect(d.status).toBe(200);
    expect((await call(admin.listFaqsAdminHandler, { clerk: 'clerk_admin' })).body.data).toEqual([]);
  });

  it('reorders FAQs and the public list follows the new order', async () => {
    const a = (await create({ question: 'A?', answer: 'a', isPublished: true })).body.data.id;
    const b = (await create({ question: 'B?', answer: 'b', isPublished: true })).body.data.id;
    const c = (await create({ question: 'C?', answer: 'c', isPublished: false })).body.data.id;
    const r = await call(admin.reorderFaqsHandler, { clerk: 'clerk_admin', body: { ids: [c, b, a] } });
    expect(r.body.data.map((f: any) => f.id)).toEqual([c, b, a]);
    expect((await publicList()).map((f) => f.question)).toEqual(['B?', 'A?']);
  });

  it('rejects an incomplete or invalid reorder without changing the order', async () => {
    const a = (await create({ question: 'A?', answer: 'a' })).body.data.id;
    const b = (await create({ question: 'B?', answer: 'b' })).body.data.id;
    for (const ids of [[a], [a, a], [a, 'x'], 'nope']) {
      expect((await call(admin.reorderFaqsHandler, { clerk: 'clerk_admin', body: { ids } })).status).toBe(400);
    }
    expect(table.find((r) => r.id === a)!.sort_order).toBe(0);
    expect(table.find((r) => r.id === b)!.sort_order).toBe(1);
  });

  it('validates required fields and sanitises markup', async () => {
    expect((await create({ question: '', answer: 'x' })).body).toMatchObject({ success: false, error: 'Question is required' });
    expect((await create({ question: 'Q?', answer: '   ' })).body).toMatchObject({ success: false, error: 'Answer is required' });
    const ok = await create({ question: 'Q <b>bold</b>?', answer: '<img src=x onerror=alert(1)>Safe' });
    expect(ok.body.data).toMatchObject({ question: 'Q bold?', answer: 'Safe' });
  });

  it('returns 404 for missing or malformed ids', async () => {
    const missing = '80000000-0000-4000-8000-000000000000';
    expect((await call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id: missing }, body: { answer: 'x' } })).status).toBe(404);
    expect((await call(admin.setFaqPublishedHandler, { clerk: 'clerk_admin', params: { id: 'not-a-uuid' }, body: { isPublished: true } })).status).toBe(404);
    expect((await call(admin.deleteFaqHandler, { clerk: 'clerk_admin', params: { id: missing } })).status).toBe(404);
  });

  it('rejects a non-boolean publish flag', async () => {
    const id = (await create({ question: 'Q?', answer: 'A' })).body.data.id;
    expect((await call(admin.setFaqPublishedHandler, { clerk: 'clerk_admin', params: { id }, body: { isPublished: 'true' } })).status).toBe(400);
    expect(table[0].is_published).toBe(false);
  });
});

describe('authorization', () => {
  it('mentors and unknown Clerk users cannot create, edit, publish, reorder or delete', async () => {
    const id = (await create({ question: 'Q?', answer: 'A' })).body.data.id;
    for (const clerk of ['clerk_mentor', 'stranger', undefined]) {
      expect((await call(admin.createFaqHandler, { clerk, body: { question: 'X?', answer: 'x' } })).status).toBe(403);
      expect((await call(admin.updateFaqHandler, { clerk, params: { id }, body: { answer: 'hacked' } })).status).toBe(403);
      expect((await call(admin.setFaqPublishedHandler, { clerk, params: { id }, body: { isPublished: true } })).status).toBe(403);
      expect((await call(admin.reorderFaqsHandler, { clerk, body: { ids: [id] } })).status).toBe(403);
      expect((await call(admin.deleteFaqHandler, { clerk, params: { id } })).status).toBe(403);
    }
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ answer: 'A', is_published: false });
  });

  it('a mentor can read the admin list; an unknown user cannot', async () => {
    await create({ question: 'Q?', answer: 'A' });
    expect((await call(admin.listFaqsAdminHandler, { clerk: 'clerk_mentor' })).status).toBe(200);
    expect((await call(admin.listFaqsAdminHandler, { clerk: 'stranger' })).status).toBe(403);
  });
});

describe('public endpoint', () => {
  it('exposes only id/question/answer of published FAQs and is not cached', async () => {
    await create({ question: 'Published?', answer: 'Yes', isPublished: true });
    await create({ question: 'Draft?', answer: 'Secret', isPublished: false });
    const res = await call(pub.pubModuleFaqsHandler);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['answer', 'id', 'question']);
    expect(JSON.stringify(res.body)).not.toContain('Secret');
  });

  it('answers 503 (not a crash) when the database fails', async () => {
    const res = await call(async (req: any, reply: any) => {
      req.server.prisma.$queryRawUnsafe = async () => { throw new Error('db down'); };
      return pub.pubModuleFaqsHandler(req, reply);
    });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});
