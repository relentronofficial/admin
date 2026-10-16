// DB access for Expert Support Call booking. Rules live in supportCallLogic.ts;
// this file only loads rows. `db` is the Prisma client or a transaction client.
import {
  computeSupportQuota,
  SUPPORT_USAGE_COUNTS_SQL,
  APPROVED_CREDIT_PURCHASES_SQL,
} from './supportQuota.js';
import { categoryQuota, quotaBucketFor, type CategoryQuota, type SupportCallCategory } from './supportCallLogic.js';

type Db = { $queryRawUnsafe: <T = any>(query: string, ...values: any[]) => Promise<T> };

export const SESSION_COLUMNS = `
  s.id, s.category, s.title, s.description, s.host_admin_id, s.host_name, s.starts_at,
  s.duration_minutes, s.capacity, s.status, s.created_at, s.updated_at,
  (s.meeting_url IS NOT NULL AND btrim(s.meeting_url) <> '') AS has_meeting_url`;

/** Session row → logic/session shape (never includes meeting_url). */
export function mapSession(r: any) {
  return {
    id: r.id as string,
    category: r.category as string,
    title: r.title as string,
    description: (r.description ?? null) as string | null,
    hostAdminId: (r.host_admin_id ?? null) as string | null,
    hostName: (r.host_name ?? null) as string | null,
    startsAt: new Date(r.starts_at),
    durationMinutes: Number(r.duration_minutes),
    capacity: Number(r.capacity),
    status: r.status as string,
    hasMeetingUrl: !!r.has_meeting_url,
  };
}

/** Reserved = this member's bookings still awaiting attendance on live sessions. */
export async function countReserved(db: Db, memberId: string, category: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS n FROM support_call_bookings b
     JOIN support_call_sessions s ON s.id = b.session_id
     WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled' AND s.category = $2`,
    memberId, category,
  );
  return rows[0]?.n ?? 0;
}

/** Member's quota for one category, computed exactly like GET /api/user/support-quota plus reservations. */
export async function loadCategoryQuota(
  db: Db,
  memberId: string,
  plan: string,
  category: SupportCallCategory,
): Promise<CategoryQuota> {
  const [entRows, usageRows, purchasedRows, reserved] = await Promise.all([
    db.$queryRawUnsafe<any[]>(
      `SELECT tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled,
              COALESCE(sales_call_count, 0) AS sales_call_count, COALESCE(content_call_count, 0) AS content_call_count
       FROM plan_entitlements WHERE plan = $1`,
      plan,
    ),
    db.$queryRawUnsafe<any[]>(SUPPORT_USAGE_COUNTS_SQL, memberId),
    db.$queryRawUnsafe<any[]>(APPROVED_CREDIT_PURCHASES_SQL, memberId),
    countReserved(db, memberId, category),
  ]);
  const quota = computeSupportQuota(plan, entRows, usageRows, [], purchasedRows);
  return categoryQuota(quotaBucketFor(quota, category), reserved);
}
