// Member skills / growth profile fields that live in a side table.
//
// The production `members` table is at Postgres's 1600-column limit (CLAUDE.md
// pitfall #14), so the startup ALTERs that were meant to add these columns
// there never succeeded: reading them failed with 42703 (undefined_column),
// which broke the admin member page and onboarding saves, and writes were
// silently lost. They are stored in member_profile_extras (one row per
// member, created by the startup DDL in plugins/prisma.ts) instead.
// team_size does exist on members and stays there.
//
// The SQL builders below are pure, so the mapping is unit-tested.

type Prisma = any;

/** API field → member_profile_extras column (with the cast its parameter needs). */
export const PROFILE_EXTRA_COLUMNS = {
  hasWebsite: { col: 'has_website', cast: 'boolean' },
  weeklyWebsiteOrders: { col: 'weekly_website_orders', cast: 'int' },
  skillBusinessFoundation: { col: 'skill_business_foundation', cast: 'int' },
  skillContent: { col: 'skill_content', cast: 'int' },
  skillFunnels: { col: 'skill_funnels', cast: 'int' },
  skillAds: { col: 'skill_ads', cast: 'int' },
  skillSales: { col: 'skill_sales', cast: 'int' },
  skillOverallMarketing: { col: 'skill_overall_marketing', cast: 'int' },
  weeklyLearningHours: { col: 'weekly_learning_hours', cast: 'int' },
  businessStartedFrom: { col: 'business_started_from', cast: 'text' },
  instagramStats: { col: 'instagram_stats', cast: 'text' },
  facebookStats: { col: 'facebook_stats', cast: 'text' },
  websiteUrl: { col: 'website_url', cast: 'text' },
  revenueGoalAfterTbt: { col: 'revenue_goal_after_tbt', cast: 'text' },
  watchedVideoSteps: { col: 'watched_video_steps', cast: 'jsonb' },
} as const;

export type ProfileExtraField = keyof typeof PROFILE_EXTRA_COLUMNS;

export interface ProfileExtrasInput {
  hasWebsite?: boolean | null;
  weeklyWebsiteOrders?: number | null;
  skillBusinessFoundation?: number | null;
  skillContent?: number | null;
  skillFunnels?: number | null;
  skillAds?: number | null;
  skillSales?: number | null;
  skillOverallMarketing?: number | null;
  weeklyLearningHours?: number | null;
  businessStartedFrom?: string | null;
  instagramStats?: string | null;
  facebookStats?: string | null;
  websiteUrl?: string | null;
  revenueGoalAfterTbt?: string | null;
  watchedVideoSteps?: unknown[] | null;
  /** Stored on members.team_size (that column exists). */
  teamSize?: string | null;
}

const FIELDS = Object.keys(PROFILE_EXTRA_COLUMNS) as ProfileExtraField[];

/**
 * Upsert of the provided (non-undefined) side-table fields for one member, or
 * null when none was provided. Only the given columns are touched on conflict,
 * so a partial save never clears the others.
 */
export function buildProfileExtrasUpsert(memberId: string, fields: ProfileExtrasInput): { sql: string; values: unknown[] } | null {
  const given = FIELDS.filter((f) => fields[f] !== undefined);
  if (given.length === 0) return null;
  const cols = given.map((f) => PROFILE_EXTRA_COLUMNS[f].col);
  const values: unknown[] = [memberId];
  const params = given.map((f, i) => {
    const { cast } = PROFILE_EXTRA_COLUMNS[f];
    const v = fields[f];
    values.push(cast === 'jsonb' && v !== null ? JSON.stringify(v) : v);
    return `$${i + 2}::${cast}`;
  });
  return {
    sql:
      `INSERT INTO member_profile_extras (member_id, ${cols.join(', ')}, updated_at) ` +
      `VALUES ($1::uuid, ${params.join(', ')}, NOW()) ` +
      `ON CONFLICT (member_id) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`,
    values,
  };
}

/** SELECT list for the API fields, from member_profile_extras aliased `alias`. */
export function profileExtrasSelect(alias = 'x'): string {
  return FIELDS.map((f) => `${alias}.${PROFILE_EXTRA_COLUMNS[f].col} AS "${f}"`).join(', ');
}

/** The six onboarding skill ratings (1–10), in the order the forms show them. */
export const SKILL_RATING_FIELDS = [
  'skillBusinessFoundation', 'skillContent', 'skillFunnels', 'skillAds', 'skillSales', 'skillOverallMarketing',
] as const satisfies readonly ProfileExtraField[];

/** Skill ratings for a page of members, keyed by member id (absent = never rated). */
export function buildSkillRatingsQuery(): string {
  const cols = SKILL_RATING_FIELDS.map((f) => `x.${PROFILE_EXTRA_COLUMNS[f].col} AS "${f}"`).join(', ');
  return `SELECT x.member_id::text AS id, ${cols} FROM member_profile_extras x WHERE x.member_id = ANY($1::uuid[])`;
}

/** Copies each member's saved ratings onto the row; unrated fields become null. */
export function mergeSkillRatings(members: Array<Record<string, any>>, rows: Array<Record<string, any>>): void {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const m of members) {
    const r = byId.get(m.id);
    for (const f of SKILL_RATING_FIELDS) m[f] = r?.[f] ?? null;
  }
}

/** Saves the given fields (side table + members.team_size). Fields left undefined are untouched. */
export async function writeProfileExtras(prisma: Prisma, memberId: string, fields: ProfileExtrasInput): Promise<void> {
  const upsert = buildProfileExtrasUpsert(memberId, fields);
  await Promise.all([
    upsert ? prisma.$executeRawUnsafe(upsert.sql, ...upsert.values) : null,
    fields.teamSize !== undefined
      ? prisma.$executeRawUnsafe(`UPDATE members SET team_size = $1 WHERE id = $2::uuid`, fields.teamSize, memberId)
      : null,
  ]);
}

/** Every field for one member (null when never set; watchedVideoSteps defaults to []). */
export async function readProfileExtras(prisma: Prisma, memberId: string): Promise<Record<string, unknown>> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT m.team_size AS "teamSize", ${profileExtrasSelect('x')}
     FROM members m LEFT JOIN member_profile_extras x ON x.member_id = m.id
     WHERE m.id = $1::uuid`,
    memberId,
  )) as any[];
  const row = rows[0] ?? {};
  const out: Record<string, unknown> = { teamSize: row.teamSize ?? null };
  for (const f of FIELDS) out[f] = row[f] ?? null;
  out.watchedVideoSteps = Array.isArray(row.watchedVideoSteps) ? row.watchedVideoSteps : [];
  return out;
}
