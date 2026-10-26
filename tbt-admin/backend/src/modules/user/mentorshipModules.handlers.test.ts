import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real GET/PUT /api/user/mentorship/modules handlers against a small in-memory
// store. The production failure was members.mentorship_modules missing (the
// members table is at Postgres's 1600-column limit) → 42703 → bare 500. The
// selection now lives in member_module_settings. Checks validation,
// own-record-only writes, persistence across reloads, and a clear 503 (never an
// unrestricted verdict) when the settings can't be read or written.

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
/** The member's saved onboarding answers / program, as the members + programs rows hold them. */
let profiles: Record<string, { business_type?: string | null; product_service_type?: string | null; program_modules?: unknown }>;
let tableMissing: boolean;
let updateFails: boolean;
const updates: Array<{ memberId: string; value: string }> = [];

const missingTable = () =>
  Object.assign(new Error('Raw query failed. Code: `42P01`. Message: `relation "member_module_settings" does not exist`'), {
    code: 'P2010', meta: { code: '42P01' },
  });

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.includes('FROM module_config WHERE is_active = true')) {
    return MODULES.map((m) => ({ ...m, tagline: null, description: null, icon_url: null, accent_color: null }));
  }
  if (q.startsWith('SELECT s.allowed_modules, s.mentorship_modules') && q.includes('LEFT JOIN member_module_settings s')) {
    if (tableMissing) throw missingTable();
    const sel = selections[a[0]];
    const p = profiles[a[0]] ?? {};
    return [{
      allowed_modules: null, mentorship_modules: sel === undefined ? null : sel,
      business_type: p.business_type ?? null, product_service_type: p.product_service_type ?? null,
      program_modules: p.program_modules ?? null, resolved_module_key: p.business_type ?? null,
    }];
  }
  if (q.startsWith('INSERT INTO member_module_settings (member_id, mentorship_modules')) {
    if (tableMissing) throw missingTable();
    if (updateFails) throw new Error('connection terminated');
    updates.push({ memberId: a[0], value: a[1] });
    selections[a[0]] = JSON.parse(a[1]);
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
  profiles = {};
  tableMissing = false;
  updateFails = false;
  updates.length = 0;
  await invalidateMemberModuleAccess(null, MEMBER);
  await invalidateMemberModuleAccess(null, OTHER);
});

describe('onboarding step 2 — save mentorship modules', () => {
  it('reproduces the production failure: with the settings table missing, the save is a clear 503, not a bare 500', async () => {
    tableMissing = true;
    const r = await save(['Product']);
    expect(r.status).toBe(503);
    // Fails closed at the access lookup — a missing table is never read as "no restrictions".
    expect(r.body).toMatchObject({ success: false, data: null, error: { message: 'Could not load your mentorship modules' } });
    expect(JSON.stringify(r.body)).not.toMatch(/42P01|42703|member_module_settings|relation/);
    expect(updates).toEqual([]);
  });

  it('with the settings table missing, reading modules is a 503, not an unrestricted module list', async () => {
    tableMissing = true;
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

describe('/courses modules from the onboarding business type (no explicit module selection)', () => {
  const effective = async () => {
    await invalidateMemberModuleAccess(null, MEMBER); // a fresh request: what a refresh or a new login reads
    return (await load()).body.data;
  };

  it('Product-based → E-commerce (Product) only', async () => {
    profiles[MEMBER] = { product_service_type: 'Product-based' };
    const d = await effective();
    expect(d.effective).toEqual(['Product']);
    expect(d.selectionRequired).toBe(false);
  });

  it('Service-based → Service and Coaching', async () => {
    profiles[MEMBER] = { product_service_type: 'Service-based' };
    const d = await effective();
    expect(d.effective).toEqual(['Service', 'Coaching']);
    expect(d.selectionRequired).toBe(false);
  });

  it('Both → Product, Service and Coaching', async () => {
    profiles[MEMBER] = { product_service_type: 'Both' };
    expect((await effective()).effective).toEqual(['Product', 'Service', 'Coaching']);
  });

  it('the optional Course Track adds its module to the business type ones', async () => {
    profiles[MEMBER] = { product_service_type: 'Product-based', business_type: 'Coaching' };
    expect((await effective()).effective).toEqual(['Product', 'Coaching']);
  });

  it('missing or "Other" business type keeps the existing fallback (choose modules), never an error', async () => {
    for (const p of [{}, { product_service_type: 'Other' }, { product_service_type: '  ' }]) {
      profiles[MEMBER] = p;
      const d = await effective();
      expect(d.effective).toEqual([]);
      expect(d.selectionRequired).toBe(true);
    }
  });

  it('an explicit module selection still wins over the business type', async () => {
    profiles[MEMBER] = { product_service_type: 'Service-based' };
    await save(['Product']);
    expect((await effective()).effective).toEqual(['Product']);
  });

  it("the program's module ceiling still applies (never widens access)", async () => {
    profiles[MEMBER] = { product_service_type: 'Service-based', program_modules: ['Service'] };
    expect((await effective()).effective).toEqual(['Service']);
  });

  it('changing the saved business type changes the modules on the next read', async () => {
    profiles[MEMBER] = { product_service_type: 'Product-based' };
    expect((await effective()).effective).toEqual(['Product']);
    profiles[MEMBER] = { product_service_type: 'Service-based' };
    expect((await effective()).effective).toEqual(['Service', 'Coaching']);
  });
});
