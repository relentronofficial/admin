import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real GET/PUT /api/user/mentorship/modules handlers against a small in-memory
// store. Reproduces the onboarding step-2 production failure (members.
// mentorship_modules missing → Postgres 42703 → bare 500) and checks the fixed
// behaviour: validation, own-record-only writes, persistence across reloads,
// and a clear 503 instead of "Internal Server Error" when the database fails.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');
const { invalidateMemberModuleAccess } = await import('../../lib/memberModuleAccess.js');

const MEMBER = '30000000-0000-4000-8000-0000000000a1';
const OTHER = '30000000-0000-4000-8000-0000000000a2';
const MODULES = [
  { module_name: 'Introduction', display_name: 'Introduction' },
  { module_name: 'Product', display_name: 'Product Mastery' },
  { module_name: 'Service', display_name: 'Service Excellence' },
  { module_name: 'Coaching', display_name: 'Business Coaching' },
];

let selections: Record<string, unknown>;
let columnMissing: boolean;
let updateFails: boolean;
const updates: Array<{ memberId: string; value: string }> = [];

const missingColumn = () =>
  Object.assign(new Error('Raw query failed. Code: `42703`. Message: `column "mentorship_modules" of relation "members" does not exist`'), {
    code: 'P2010', meta: { code: '42703' },
  });

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.includes('FROM module_config WHERE is_active = true')) {
    return MODULES.map((m) => ({ ...m, tagline: null, description: null, icon_url: null, accent_color: null }));
  }
  if (q.startsWith('SELECT m.allowed_modules, m.mentorship_modules')) {
    if (columnMissing) throw missingColumn();
    const sel = selections[a[0]];
    return [{ allowed_modules: null, mentorship_modules: sel === undefined ? null : sel, business_type: null, program_modules: null }];
  }
  if (q.startsWith('UPDATE members SET mentorship_modules')) {
    if (columnMissing) throw missingColumn();
    if (updateFails) throw new Error('connection terminated');
    updates.push({ memberId: a[1], value: a[0] });
    selections[a[1]] = JSON.parse(a[0]);
    return 1;
  }
  throw new Error(`unhandled SQL: ${q.slice(0, 80)}`);
}

async function call(handler: any, opts: { memberId?: string; body?: any } = {}) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = {
    memberId: opts.memberId ?? MEMBER, body: opts.body, params: {}, query: {}, headers: {},
    server: { prisma: { $queryRawUnsafe: sql, $executeRawUnsafe: sql }, redis: null },
    log: { error() {}, warn() {} },
  };
  await handler(req, reply);
  return sent;
}
const save = (modules: unknown, memberId?: string) => call(user.updateMentorshipModulesHandler, { memberId, body: { modules } });
const load = (memberId?: string) => call(user.getMentorshipModulesHandler, { memberId });

beforeEach(async () => {
  selections = {};
  columnMissing = false;
  updateFails = false;
  updates.length = 0;
  await invalidateMemberModuleAccess(null, MEMBER);
  await invalidateMemberModuleAccess(null, OTHER);
});

describe('onboarding step 2 — save mentorship modules', () => {
  it('reproduces the production failure: with the column missing, the save is a clear 503, not a bare 500', async () => {
    columnMissing = true;
    const r = await save(['Product']);
    expect(r.status).toBe(503);
    // Fails closed at the access lookup — the missing column is never read as "no restrictions".
    expect(r.body).toMatchObject({ success: false, data: null, error: { message: 'Could not load your mentorship modules' } });
    expect(JSON.stringify(r.body)).not.toMatch(/42703|mentorship_modules|relation/);
    expect(updates).toEqual([]);
  });

  it('with the column missing, reading modules is a 503, not an unrestricted module list', async () => {
    columnMissing = true;
    const r = await load();
    expect(r.status).toBe(503);
    expect(r.body.data).toBeNull();
  });

  it.each([
    [['Product'], 'Product Mastery'],
    [['Service'], 'Service Excellence'],
    [['Coaching'], 'Business Coaching'],
    [['Introduction'], 'Introduction'],
  ])('saves %j and returns the saved selection', async (modules) => {
    const r = await save(modules);
    expect(r.status).toBe(200);
    expect(r.body.data.selection).toEqual(modules);
    expect(r.body.data.selectionRequired).toBe(false);
    expect(r.body.data.effective).toEqual(modules);
  });

  it('a multi-module selection is saved in module order and survives a reload (page refresh)', async () => {
    await save(['Coaching', 'Product']);
    await invalidateMemberModuleAccess(null, MEMBER); // a fresh request, nothing cached
    const r = await load();
    expect(r.body.data.selection).toEqual(['Product', 'Coaching']);
    expect(r.body.data.effective).toEqual(['Product', 'Coaching']);
  });

  it('the saved selection decides which modules the member sees', async () => {
    await save(['Service']);
    const r = await load();
    expect(r.body.data.effective).toEqual(['Service']);
    expect(r.body.data.options.map((o: any) => o.moduleName)).toEqual(['Introduction', 'Product', 'Service', 'Coaching']);
  });

  it.each([
    [undefined, 'modules must be an array of module names'],
    ['Product', 'modules must be an array of module names'],
    [[1, 2], 'modules must be an array of module names'],
    [[], 'Select at least one mentorship module'],
    [['  '], 'Select at least one mentorship module'],
    [['Product', 'Hacking'], 'Module not available: Hacking'],
  ])('rejects invalid payload %j with 400 and writes nothing', async (modules, error) => {
    const r = await save(modules);
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe(error);
    expect(updates).toEqual([]);
  });

  it('only ever writes the authenticated member’s own record', async () => {
    const r = await call(user.updateMentorshipModulesHandler, { memberId: MEMBER, body: { modules: ['Product'], memberId: OTHER } });
    expect(r.status).toBe(200);
    expect(updates).toEqual([{ memberId: MEMBER, value: '["Product"]' }]);
    expect(selections[OTHER]).toBeUndefined();
  });

  it('a database write failure returns 503 with a retryable message, and a retry then succeeds', async () => {
    updateFails = true;
    expect((await save(['Product'])).status).toBe(503);
    updateFails = false;
    const retry = await save(['Product']);
    expect(retry.status).toBe(200);
    expect(retry.body.data.selection).toEqual(['Product']);
  });

  it('saving the same selection twice (duplicate submit) is harmless', async () => {
    await save(['Product']);
    const again = await save(['Product']);
    expect(again.status).toBe(200);
    expect(selections[MEMBER]).toEqual(['Product']);
  });
});
