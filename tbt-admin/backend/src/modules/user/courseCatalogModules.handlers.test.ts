import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real GET /api/user/courses (listUserCoursesHandler) against an in-memory
// store. Production case (Shami Fayiz): the member chose Product at onboarding,
// an admin later limited them to Coaching and granted the CoachX course. The
// effective modules were (Product ∩ Coaching) = none, so the catalog dropped the
// granted course and sent allowedModules [] — the mentorship page showed no
// module. An admin grant must always show its course and its module.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const user = await import('./controller.js');
const { invalidateMemberModuleAccess } = await import('../../lib/memberModuleAccess.js');

let seq = 0;
let MEMBER = '';
const MODULES = ['Product', 'Service', 'Coaching'];
const COURSES = [
  { id: 'c-product', title: 'Ecommerce Mentorship', module: 'Product', required_tier: 1 },
  { id: 'c-service', title: 'Service Mentorship', module: 'Service', required_tier: 1 },
  { id: 'c-coach', title: 'CoachX Mentorship', module: 'Coaching', required_tier: 2 },
];

let member: { allowedModules: string[] | null; selection: string[] | null; productServiceType: string | null };
let grants: Array<{ courseId: string; isActive: boolean; accessType: string; expiresAt: Date | null }>;

async function sql(text: string, ..._a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT c.id, c.title')) {
    return COURSES.map((c) => ({
      ...c, slug: c.id, description: null, thumbnail_url: null, level: 'beginner', duration_hours: null, price: null,
      is_published: true, is_featured: false, created_at: new Date(0), xp_per_episode: 10,
      applicable_business_types: null, batch_visibility_ids: [], course_type: 'mentorship',
      creator_id: null, lesson_count: 1, total_secs: 0, total_timer_secs: 0, missing_secs_count: 1,
      task_minutes: null, enrollment_count: 0, total_count: COURSES.length,
    }));
  }
  if (q.startsWith('SELECT m.batch_id, s.allowed_modules')) {
    return [{ batch_id: null, allowed_modules: member.allowedModules, current_tier: 1, business_type: null, business_categories: [] }];
  }
  if (q.startsWith('SELECT s.allowed_modules, s.mentorship_modules')) {
    return [{
      allowed_modules: member.allowedModules, mentorship_modules: member.selection, business_type: null,
      product_service_type: member.productServiceType, program_modules: null, resolved_module_key: null,
    }];
  }
  if (q.includes('FROM module_config WHERE is_active = true')) {
    return MODULES.map((m) => ({ module_name: m, display_name: m, tagline: null, description: null, icon_url: null, accent_color: null }));
  }
  if (q.startsWith('SELECT module_name, display_name, tagline')) {
    return MODULES.map((m, i) => ({ module_name: m, display_name: m, sort_order: i }));
  }
  throw new Error(`unhandled SQL: ${q.slice(0, 90)}`);
}

async function listCourses() {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(c: number) { sent.status = c; return reply; }, code(c: number) { sent.status = c; return reply; },
    header() { return reply; }, send(b: any) { sent.body = b; return reply; },
  };
  const req: any = {
    memberId: MEMBER, query: { limit: 100, courseType: 'mentorship' }, params: {}, headers: {},
    server: {
      redis: null,
      prisma: {
        $queryRawUnsafe: sql,
        courseAccess: {
          findMany: async () => grants,
          findFirst: async () => (grants.find((g) => g.isActive) ? { id: 'x' } : null),
        },
      },
    },
    log: { error() {}, warn() {}, info() {} },
  };
  await user.listUserCoursesHandler(req, reply);
  return sent;
}
const titles = (r: any) => (r.body.data as any[]).map((c) => c.title);
const grant = (courseId: string, isActive = true) => ({ courseId, isActive, accessType: 'lifetime', expiresAt: null });

beforeEach(async () => {
  // A fresh member per test: the handler caches per-member results in memory.
  MEMBER = `40000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  member = { allowedModules: null, selection: null, productServiceType: null };
  grants = [];
  await invalidateMemberModuleAccess(null, MEMBER);
});

describe('course list — admin-granted courses always show, with their module', () => {
  it('chose Product, admin limited to Coaching and granted CoachX → CoachX and Coaching are shown', async () => {
    member = { allowedModules: ['Coaching'], selection: ['Product'], productServiceType: 'Coaching' };
    grants = [grant('c-coach'), grant('c-product', false)];
    const r = await listCourses();
    expect(r.status).toBe(200);
    expect(titles(r)).toEqual(['CoachX Mentorship']);
    expect(r.body.meta.allowedModules).toEqual(['Coaching']);
    expect(r.body.meta.personalizationState).toBe('program');
  });

  it('a grant outside the chosen module is added next to it, in module order', async () => {
    member = { allowedModules: ['Product'], selection: ['Product'], productServiceType: null };
    grants = [grant('c-coach'), grant('c-service')];
    const r = await listCourses();
    expect(titles(r)).toEqual(['Ecommerce Mentorship', 'Service Mentorship', 'CoachX Mentorship']);
    expect(r.body.meta.allowedModules).toEqual(['Product', 'Service', 'Coaching']);
  });

  it('admin module limit only (no choice yet) still shows a granted course from another module', async () => {
    member = { allowedModules: ['Product'], selection: null, productServiceType: null };
    grants = [grant('c-service')];
    const r = await listCourses();
    expect(r.body.meta.allowedModules).toEqual(['Product', 'Service']);
    expect(titles(r)).toContain('Service Mentorship');
  });

  it('without grants, other modules stay hidden (the module rule still applies)', async () => {
    member = { allowedModules: null, selection: ['Product'], productServiceType: null };
    const r = await listCourses();
    expect(titles(r)).toEqual(['Ecommerce Mentorship']);
    expect(r.body.meta.allowedModules).toEqual(['Product']);
  });

  it('a revoked (inactive) grant does not count', async () => {
    member = { allowedModules: null, selection: ['Product'], productServiceType: null };
    grants = [grant('c-coach', false)];
    const r = await listCourses();
    expect(titles(r)).toEqual(['Ecommerce Mentorship']);
    expect(r.body.meta.allowedModules).toEqual(['Product']);
  });
});
