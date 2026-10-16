// Mentorship dashboard demo mode — a read-time overlay for ONE configured member.
//
// Pure: no Prisma, no Fastify, no clock. The controller resolves the signed-in
// member (req.memberId from the verified tbt_access cookie + their email read
// from the DB) and passes it in; nothing here trusts client input.
//
// Nothing is written to the database. Demo values replace the API responses of
// GET /api/user/mentorship/{stats,revenue,social} for the target member only;
// their real rows stay untouched underneath, so unsetting the config restores
// their real view immediately. Every other member's responses are unchanged.
//
// Configured by two backend env vars (both required, see config/env.ts):
//   MENTORSHIP_DEMO_MEMBER_ID — the target member's stable members.id (UUID)
//   MENTORSHIP_DEMO_EMAIL     — the same member's email as stored in members.email
// Unset either one to disable demo mode.

export interface MentorshipDemoConfig {
  memberId?: string | null;
  email?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Cheap pre-check (no DB): is demo mode configured at all, and could this member be the target? */
export function mightBeDemoMember(memberId: string, config: MentorshipDemoConfig): boolean {
  return !!norm(config.memberId) && !!norm(config.email) && norm(memberId) === norm(config.memberId);
}

/**
 * Demo mode applies only when BOTH the authenticated member's id and their
 * stored email match the configured target. A partial config never enables it.
 */
export function isMentorshipDemoMember(
  member: { id: string; email: string | null | undefined },
  config: MentorshipDemoConfig,
): boolean {
  return mightBeDemoMember(member.id, config) && !!norm(member.email) && norm(member.email) === norm(config.email);
}

// ── Demo payloads (same shapes as the real handlers) ─────────────────────────

const DAILY_REVENUE = [52000, 61500, 48800, 70200, 88400, 96300, 82700];
const DAILY_ORDERS = [64, 75, 59, 86, 108, 117, 101];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function demoRevenue(week: { isoWeek: number; isoYear: number }) {
  const revenueGenerated = sum(DAILY_REVENUE); // 499,900
  const numberOfOrders = sum(DAILY_ORDERS);    // 610
  return {
    weekNumber: week.isoWeek,
    year: week.isoYear,
    revenueGenerated,
    revenuePrev: 412000,
    numberOfOrders,
    ordersPrev: 528,
    adBudgetSpent: 48500,
    roas: Math.round((revenueGenerated / 48500) * 100) / 100,
    customerAcqCost: Math.round(48500 / numberOfOrders),
    organicLeads: 142,
    leadsPrev: 118,
    avgOrderValue: Math.round(revenueGenerated / numberOfOrders),
    rtoReturnsPercent: 4.2,
    conversionRate: 3.8,
    platformBadge: null,
    dailyRevenue: DAILY_REVENUE,
    dailyOrders: DAILY_ORDERS,
    updatedAt: null,
  };
}

export function demoSocial(week: { isoWeek: number; isoYear: number }) {
  return {
    weekNumber: week.isoWeek,
    year: week.isoYear,
    totalFollowers: 12450,
    followersPrev: 11280,
    videoViews: 186000,
    videoViewsPrev: 142500,
    contentUploads: 6,
    contentUploadTarget: 7,
    interactions: 9840,
    interactionsPrev: 7610,
    dmLeads: 58,
    bioLinkClicks: 1320,
    bioLinkClicksPrev: 1045,
    updatedAt: null,
  };
}

export interface MentorshipStats {
  dailyTimeSpentHrs: number;
  dailyTimeGoalHrs: number;
  weeklyReportSubmitted: boolean;
  streakDays: number;
  totalEpisodes: number;
  completedEpisodes: number;
  tasksCompleted: number;
  tasksTotal: number;
  leaderboardRank: number | null;
  daysElapsed: number;
  activeDays: number;
  totalDays: number;
  programName: string | null;
}

/**
 * Overlays the activity counters; keeps the member's real program identity
 * (programName, totalDays, dailyTimeGoalHrs). Day counts never exceed totalDays.
 */
export function demoStats(real: MentorshipStats): MentorshipStats {
  const totalDays = real.totalDays > 0 ? real.totalDays : 90;
  const daysElapsed = Math.min(30, totalDays);
  return {
    ...real,
    dailyTimeSpentHrs: 1.6,
    weeklyReportSubmitted: true,
    streakDays: Math.min(12, daysElapsed),
    totalEpisodes: 24,
    completedEpisodes: 18,
    tasksCompleted: 14,
    tasksTotal: 20,
    leaderboardRank: 7,
    daysElapsed,
    activeDays: Math.min(26, daysElapsed),
  };
}
