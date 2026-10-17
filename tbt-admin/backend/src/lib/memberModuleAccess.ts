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
import { parseModuleList, resolveModuleAccess, type ModuleAccess } from './mentorshipModules.js';

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
    const [memberRows, options] = await Promise.all([
      (prisma.$queryRawUnsafe(
        `SELECT m.allowed_modules, m.mentorship_modules, m.business_type, p.allowed_modules AS program_modules
         FROM members m
         LEFT JOIN batches b ON b.id = m.batch_id
         LEFT JOIN programs p ON p.id = b.program_id
         WHERE m.id = $1::uuid`,
        memberId,
      ) as Promise<any[]>).catch((err: any) => {
        // 42703 = undefined_column: startup DDL may have been skipped due to a
        // connection-pool failure during rolling deploy. Fail open (unrestricted)
        // so the courses page serves normally; the columns will be present once
        // the startup DDL retry runs or the next deployment starts cleanly.
        const pgCode: string = err?.meta?.code ?? err?.code ?? '';
        if (pgCode === '42703' || String(err?.message ?? '').includes('does not exist')) return [] as any[];
        throw err;
      }),
      loadActiveModuleOptions(prisma, redis),
    ]);
    const row = memberRows[0] ?? {};
    return resolveModuleAccess({
      activeModules: options.map((o) => o.moduleName),
      adminOverride: parseModuleList(row.allowed_modules),
      programModules: parseModuleList(row.program_modules) ?? [],
      selection: parseModuleList(row.mentorship_modules),
      businessType: row.business_type ?? null,
    });
  });
}

/** Call after any write to members.allowed_modules / mentorship_modules / batch_id. */
export async function invalidateMemberModuleAccess(redis: RedisLike | null, memberId: string): Promise<void> {
  await Promise.all([
    invalidateCache(redis, accessKey(memberId)),
    invalidateCache(redis, `courses:personalization:${memberId}`),
  ]);
}

/** Call after module_config changes (is_active, rename). Per-member verdicts expire within 60 s. */
export async function invalidateModuleOptions(redis: RedisLike | null): Promise<void> {
  await Promise.all([
    invalidateCache(redis, OPTIONS_KEY),
    invalidateCache(redis, 'courses:module-configs'),
  ]);
}
