/** Who may use the member assistant. Anything unexpected means no. */
export type Audience = 'testers' | 'all';

export const isAudience = (v: unknown): v is Audience => v === 'testers' || v === 'all';

export function mayUseHelpBot(o: { audience: unknown; isTester: unknown; memberStatus: unknown }): boolean {
  if (o.memberStatus !== 'active') return false;
  return o.audience === 'all' || (o.audience === 'testers' && o.isTester === true);
}

export interface HelpBotAccess {
  allowed: boolean;
  /** Not opened to this member yet: the button only says so. */
  comingSoon: boolean;
  dailyLimit: number;
}

export async function loadHelpBotAccess(
  prisma: { $queryRawUnsafe: <T = any>(q: string, ...v: any[]) => Promise<T> },
  memberId: string,
): Promise<HelpBotAccess> {
  const rows = await prisma.$queryRawUnsafe<Array<{ audience: string; daily_limit: number; is_tester: boolean; status: string }>>(
    `SELECT s.audience, s.daily_limit, m.status::text AS status,
            EXISTS (SELECT 1 FROM help_bot_testers t WHERE t.member_id = m.id) AS is_tester
       FROM members m CROSS JOIN help_bot_settings s
      WHERE m.id = $1::uuid AND m.deleted_at IS NULL`, memberId);
  const r = rows[0];
  const allowed = !!r && mayUseHelpBot({ audience: r.audience, isTester: r.is_tester, memberStatus: r.status });
  return {
    allowed,
    comingSoon: !allowed && r?.audience === 'testers' && r.status === 'active',
    dailyLimit: Number(r?.daily_limit ?? 0),
  };
}
