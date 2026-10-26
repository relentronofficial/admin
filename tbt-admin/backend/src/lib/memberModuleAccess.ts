// I/O loader for lib/mentorshipModules.ts — reads the member's ceiling and
// selection plus the active module list, then delegates the verdict to the
// pure resolver. Cached per member for 60 s; every write path that changes an
// input calls invalidateMemberModuleAccess().
//
// Uses cacheGet/cacheSet rather than cacheGetOrCompute on purpose: these loaders
// throw on DB failure (fail closed), and cacheGetOrCompute's internal
// `p.finally()` would turn a thrown compute into an unhandled rejection.

/** Read-through cache that lets compute() errors propagate to the caller only. */
async function cached<T>(redis: RedisLike | null, key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(redis, key);
  if (hit !== null) return hit;
  const value = await compute();
  void cacheSet(redis, key, value, ttlSeconds);
  return value;
}
import { cacheGet, cacheSet, invalidateCache, type RedisLike } from './cache.js';
import { modulesForProductServiceType, parseModuleList, resolveModuleAccess, type ModuleAccess } from './mentorshipModules.js';

export interface MentorshipModuleOption {
  moduleName: string;
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  accentColor: string | null;
}

const accessKey = (memberId: string) => `mentorship:access:${memberId}`;
const OPTIONS_KEY = 'mentorship:module-options';

/** Active module_config rows, in sort order. Shared across members. */
export async function loadActiveModuleOptions(prisma: any, redis: RedisLike | null): Promise<MentorshipModuleOption[]> {
  return cached<MentorshipModuleOption[]>(redis, OPTIONS_KEY, 300, async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT module_name, display_name, tagline, description, icon_url, accent_color
       FROM module_config WHERE is_active = true ORDER BY sort_order, module_name`,
    ) as any[];
    return rows.map((r) => ({
      moduleName: r.module_name,
      displayName: r.display_name ?? null,
      tagline: r.tagline ?? null,
      description: r.description ?? null,
      iconUrl: r.icon_url ?? null,
      accentColor: r.accent_color ?? null,
    }));
  });
}

/**
 * Resolve the member's module access. Throws on DB failure rather than
 * returning an unrestricted verdict — callers must not fail open into
 * modules the member did not select.
 */
export async function loadMemberModuleAccess(prisma: any, redis: RedisLike | null, memberId: string): Promise<ModuleAccess> {
  return cached<ModuleAccess>(redis, accessKey(memberId), 60, async () => {
    // No error is special-cased here — e.g. a missing member_module_settings
    // table. Returning no row for it would drop the program ceiling too and
    // grant every module.
    const [memberRows, options] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT s.allowed_modules, s.mentorship_modules, m.business_type, m.product_service_type, p.allowed_modules AS program_modules,
                (SELECT mc.module_name FROM module_config mc
                 WHERE mc.is_active = true
                   AND lower(m.business_type) = ANY(
                     SELECT lower(k) FROM jsonb_array_elements_text(COALESCE(mc.business_type_keys, '[]'::jsonb)) AS k
                   )
                 LIMIT 1) AS resolved_module_key
         FROM members m
         LEFT JOIN member_module_settings s ON s.member_id = m.id
         LEFT JOIN batches b ON b.id = m.batch_id
         LEFT JOIN programs p ON p.id = b.program_id
         WHERE m.id = $1::uuid`,
        memberId,
      ) as Promise<any[]>,
      loadActiveModuleOptions(prisma, redis),
    ]);
    const row = memberRows[0] ?? {};
    // resolved_module_key is the canonical module_name matched via business_type_keys;
    // falls back to raw business_type for backward compatibility (exact-match case).
    const resolvedBusinessType: string | null = row.resolved_module_key ?? row.business_type ?? null;
    return resolveModuleAccess({
      activeModules: options.map((o) => o.moduleName),
      adminOverride: parseModuleList(row.allowed_modules),
      programModules: parseModuleList(row.program_modules) ?? [],
      selection: parseModuleList(row.mentorship_modules),
      businessType: resolvedBusinessType,
      businessTypeModules: modulesForProductServiceType(row.product_service_type),
    });
  });
}

/**
 * The two writes to member_module_settings. Each upserts one column and leaves
 * the other untouched. `modules` null clears it. Callers invalidate afterwards.
 */
export async function saveMemberAdminOverride(prisma: any, memberId: string, modules: string[] | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO member_module_settings (member_id, allowed_modules, updated_at) VALUES ($1::uuid, $2::jsonb, now())
     ON CONFLICT (member_id) DO UPDATE SET allowed_modules = EXCLUDED.allowed_modules, updated_at = now()`,
    memberId, modules === null ? null : JSON.stringify(modules),
  );
}

export async function saveMemberModuleSelection(prisma: any, memberId: string, modules: string[]): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO member_module_settings (member_id, mentorship_modules, updated_at) VALUES ($1::uuid, $2::jsonb, now())
     ON CONFLICT (member_id) DO UPDATE SET mentorship_modules = EXCLUDED.mentorship_modules, updated_at = now()`,
    memberId, JSON.stringify(modules),
  );
}

/** Call after any write to member_module_settings or members.batch_id. */
export async function invalidateMemberModuleAccess(redis: RedisLike | null, memberId: string): Promise<void> {
  await Promise.all([
    invalidateCache(redis, accessKey(memberId)),
    invalidateCache(redis, `courses:personalization:v2:${memberId}`), // key used by the /courses handler
  ]);
}

/** Call after module_config changes (is_active, rename). Per-member verdicts expire within 60 s. */
export async function invalidateModuleOptions(redis: RedisLike | null): Promise<void> {
  await Promise.all([
    invalidateCache(redis, OPTIONS_KEY),
    invalidateCache(redis, 'courses:module-configs'),
  ]);
}
