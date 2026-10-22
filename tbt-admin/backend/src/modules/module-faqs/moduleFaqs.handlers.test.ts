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

type Row = {
  id: string; question: string; answer: string; is_published: boolean; sort_order: number; created_at: number; updated_at: Date;
  updated_by: string | null; video_url: string | null; bunny_video_id: string | null; category: string | null;
};
let table: Row[];
let seq = 0;
const uuid = () => `9${String(++seq).padStart(7, '0')}-0000-4000-8000-000000000000`;
const out = (r: Row) => ({
  id: r.id, question: r.question, answer: r.answer, is_published: r.is_published, sort_order: r.sort_order, updated_at: r.updated_at,
  video_url: r.video_url, bunny_video_id: r.bunny_video_id, category: r.category,
});
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
    if (failInsertAt !== null && ++insertCount === failInsertAt) throw new Error('connection terminated');
    const r: Row = {
      id: uuid(), question: a[0], answer: a[1], is_published: a[2], video_url: a[3], bunny_video_id: a[4],
      sort_order: Math.max(-1, ...table.map((x) => x.sort_order)) + 1, created_at: seq, updated_at: new Date(), updated_by: a[5],
      category: a[6] ?? null,
    };
    table.push(r);
    return [out(r)];
  }
  if (q.startsWith('UPDATE module_faqs SET question')) {
    const r = table.find((x) => x.id === a[0]);
    if (!r) return [];
    Object.assign(r, { question: a[1], answer: a[2], is_published: a[3], updated_by: a[4], video_url: a[5], bunny_video_id: a[6], category: a[7] });
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

let failInsertAt: number | null = null;
let insertCount = 0;

function server() {
  const prisma: any = {
    $queryRawUnsafe: sql,
    $executeRawUnsafe: sql,
    // A failing transaction rolls back every write it made (as Postgres does).
    $transaction: async (fn: any) => {
      const snapshot = table.map((r) => ({ ...r }));
      try {
        return await fn(prisma);
      } catch (err) {
        table = snapshot;
        throw err;
      }
    },
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

/** Existing tests predate categories: default one so they keep testing what they tested. */
const withCategory = (body: any) => (body && typeof body === 'object' && !Array.isArray(body) && !('category' in body) ? { category: 'service', ...body } : body);
const create = (body: any, clerk = 'clerk_admin') => call(admin.createFaqHandler, { clerk, body: withCategory(body) });
const createRaw = (body: any, clerk = 'clerk_admin') => call(admin.createFaqHandler, { clerk, body });
const publicList = async () => (await call(pub.pubModuleFaqsHandler)).body.data as Array<{ id: string; question: string; answer: string; videoUrl: string | null; bunnyVideoId: string | null }>;

beforeEach(() => {
  table = [];
  unhandled.length = 0;
  failInsertAt = null;
  insertCount = 0;
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
    expect(await publicList()).toEqual([{ id, question: 'How do modules unlock?', answer: 'Updated answer', videoUrl: null, bunnyVideoId: null, category: 'service' }]);

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
  it('exposes id/question/answer/videoUrl/bunnyVideoId/category of published FAQs and is not cached', async () => {
    await create({ question: 'Published?', answer: 'Yes', isPublished: true });
    await create({ question: 'Draft?', answer: 'Secret', isPublished: false });
    const res = await call(pub.pubModuleFaqsHandler);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['answer', 'bunnyVideoId', 'category', 'id', 'question', 'videoUrl']);
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

const VIDEO = 'https://iframe.mediadelivery.net/embed/12345/0b8a7c1e-1111-4222-8333-444455556666';
const VIDEO_ID = '0b8a7c1e-1111-4222-8333-444455556666';
const bulk = (body: any, clerk = 'clerk_admin') =>
  call(admin.createFaqsBulkHandler, { clerk, body: Array.isArray(body?.items) ? { ...body, items: body.items.map(withCategory) } : body });
const adminList = async () => (await call(admin.listFaqsAdminHandler, { clerk: 'clerk_admin' })).body.data as any[];

describe('FAQ videos and multiple questions', () => {
  it('one FAQ without a video still works exactly as before (video fields are null)', async () => {
    const c = await create({ question: 'Q?', answer: 'A.' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ question: 'Q?', answer: 'A.', videoUrl: null, bunnyVideoId: null });
    expect((await adminList())[0]).toMatchObject({ videoUrl: null, bunnyVideoId: null });
  });

  it('saves an uploaded video with the FAQ and returns it from the admin list', async () => {
    const c = await create({ question: 'Q?', answer: 'A.', videoUrl: VIDEO, bunnyVideoId: VIDEO_ID });
    expect(c.body.data).toMatchObject({ videoUrl: VIDEO, bunnyVideoId: VIDEO_ID });
    expect((await adminList())[0]).toMatchObject({ id: c.body.data.id, videoUrl: VIDEO, bunnyVideoId: VIDEO_ID });
  });

  it('editing text keeps the video; it can be replaced or removed', async () => {
    const id = (await create({ question: 'Q?', answer: 'A.', videoUrl: VIDEO, bunnyVideoId: VIDEO_ID })).body.data.id;
    const kept = await call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id }, body: { question: 'Q2?', answer: 'A2.' } });
    expect(kept.body.data).toMatchObject({ question: 'Q2?', videoUrl: VIDEO, bunnyVideoId: VIDEO_ID });
    const other = 'https://iframe.mediadelivery.net/embed/12345/9f9f9f9f-1111-4222-8333-444455556666';
    const replaced = await call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id }, body: { videoUrl: other, bunnyVideoId: '9f9f9f9f-1111-4222-8333-444455556666' } });
    expect(replaced.body.data).toMatchObject({ videoUrl: other, bunnyVideoId: '9f9f9f9f-1111-4222-8333-444455556666' });
    const removed = await call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id }, body: { videoUrl: null } });
    expect(removed.body.data).toMatchObject({ videoUrl: null, bunnyVideoId: null });
  });

  it('rejects a non-https or malformed video URL and an invalid video id', async () => {
    for (const body of [
      { question: 'Q?', answer: 'A.', videoUrl: 'http://example.com/v.mp4' },
      { question: 'Q?', answer: 'A.', videoUrl: 'not a url' },
      { question: 'Q?', answer: 'A.', videoUrl: VIDEO, bunnyVideoId: 'bad id!' },
    ]) {
      expect((await create(body)).status).toBe(400);
    }
    expect(table).toEqual([]);
  });

  it('saves several questions at once, in order, each with its own video (or none)', async () => {
    const res = await bulk({
      items: [
        { question: 'First?', answer: 'One.', isPublished: true, videoUrl: VIDEO, bunnyVideoId: VIDEO_ID },
        { question: 'Second?', answer: 'Two.', isPublished: true },
        { question: 'Third?', answer: 'Three.', isPublished: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.map((f: any) => [f.question, f.videoUrl])).toEqual([['First?', VIDEO], ['Second?', null], ['Third?', null]]);
    const list = await adminList();
    expect(list.map((f: any) => [f.question, f.sortOrder, f.isPublished, f.videoUrl])).toEqual([
      ['First?', 0, true, VIDEO], ['Second?', 1, true, null], ['Third?', 2, true, null],
    ]);
    // members get question/answer plus video fields
    expect(await publicList()).toEqual(list.map((f: any) => ({ id: f.id, question: f.question, answer: f.answer, videoUrl: f.videoUrl, bunnyVideoId: f.bunnyVideoId, category: f.category })));
  });

  it('appends after existing FAQs', async () => {
    await create({ question: 'Existing?', answer: 'Yes.' });
    await bulk({ items: [{ question: 'New 1?', answer: 'A.' }, { question: 'New 2?', answer: 'B.' }] });
    expect((await adminList()).map((f: any) => f.question)).toEqual(['Existing?', 'New 1?', 'New 2?']);
  });

  it('an empty question or answer in any entry rejects the whole batch — nothing is saved', async () => {
    const missingQ = await bulk({ items: [{ question: 'OK?', answer: 'Fine.' }, { question: '   ', answer: 'No question.' }] });
    expect(missingQ).toMatchObject({ status: 400, body: { error: 'Question 2: Question is required' } });
    const missingA = await bulk({ items: [{ question: 'OK?', answer: '' }] });
    expect(missingA).toMatchObject({ status: 400, body: { error: 'Question 1: Answer is required' } });
    expect((await bulk({ items: [] })).status).toBe(400);
    expect(table).toEqual([]);
  });

  it('a database failure part-way through saves nothing (one transaction)', async () => {
    failInsertAt = 2;
    await expect(bulk({ items: [{ question: 'A?', answer: 'a' }, { question: 'B?', answer: 'b' }] })).rejects.toThrow();
    expect(table).toEqual([]);
  });

  it('caps a batch and keeps it admin-only', async () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ question: `Q${i}?`, answer: 'A.' }));
    expect((await bulk({ items: many })).status).toBe(400);
    expect((await bulk({ items: [{ question: 'Q?', answer: 'A.' }] }, 'clerk_mentor')).status).toBe(403);
    expect(table).toEqual([]);
  });
});

describe('FAQ category (Ecommerce / Service / CoachX)', () => {
  const update = (id: string, body: any) => call(admin.updateFaqHandler, { clerk: 'clerk_admin', params: { id }, body });

  it('a new FAQ must have a category — nothing is saved without one or with an unknown one', async () => {
    expect(await createRaw({ question: 'Q?', answer: 'A.' })).toMatchObject({ status: 400, body: { error: 'Category is required' } });
    expect((await createRaw({ question: 'Q?', answer: 'A.', category: 'coaching' })).status).toBe(400);
    expect((await createRaw({ question: 'Q?', answer: 'A.', category: null })).status).toBe(400);
    expect(table).toEqual([]);
  });

  it('saves each category and returns it to the admin list and to members', async () => {
    for (const category of ['ecommerce', 'service', 'coachx']) {
      const c = await createRaw({ question: `${category}?`, answer: 'A.', isPublished: true, category });
      expect(c.status).toBe(201);
      expect(c.body.data.category).toBe(category);
    }
    expect((await adminList()).map((f: any) => f.category)).toEqual(['ecommerce', 'service', 'coachx']);
    expect((await publicList()).map((f: any) => [f.question, (f as any).category])).toEqual([
      ['ecommerce?', 'ecommerce'], ['service?', 'service'], ['coachx?', 'coachx'],
    ]);
  });

  it('editing loads and keeps the saved category, and it can be changed', async () => {
    const id = (await createRaw({ question: 'Q?', answer: 'A.', category: 'ecommerce' })).body.data.id;
    expect((await update(id, { answer: 'B.' })).body.data.category).toBe('ecommerce');
    expect((await update(id, { category: 'coachx' })).body.data.category).toBe('coachx');
    expect((await update(id, { category: 'nope' })).status).toBe(400);
    expect(table[0].category).toBe('coachx');
  });

  it('older FAQs without a category stay valid and are listed with category null', async () => {
    table.push({
      id: '80000000-0000-4000-8000-000000000001', question: 'Old?', answer: 'Old.', is_published: true, sort_order: 0, created_at: 0,
      updated_at: new Date(), updated_by: null, video_url: null, bunny_video_id: null, category: null,
    });
    expect((await publicList())[0]).toMatchObject({ question: 'Old?', category: null });
    // editing text without choosing a category keeps it uncategorised; choosing one sets it
    expect((await update('80000000-0000-4000-8000-000000000001', { answer: 'New.' })).body.data).toMatchObject({ answer: 'New.', category: null });
    expect((await update('80000000-0000-4000-8000-000000000001', { category: 'service' })).body.data.category).toBe('service');
  });

  it('several new questions save with their category; a missing category rejects the whole batch', async () => {
    const ok = await call(admin.createFaqsBulkHandler, { clerk: 'clerk_admin', body: { items: [
      { question: 'A?', answer: 'a', category: 'service' }, { question: 'B?', answer: 'b', category: 'service' },
    ] } });
    expect(ok.body.data.map((f: any) => f.category)).toEqual(['service', 'service']);
    const bad = await call(admin.createFaqsBulkHandler, { clerk: 'clerk_admin', body: { items: [
      { question: 'C?', answer: 'c', category: 'ecommerce' }, { question: 'D?', answer: 'd' },
    ] } });
    expect(bad).toMatchObject({ status: 400, body: { error: 'Question 2: Category is required' } });
    expect(table).toHaveLength(2);
  });
});
