/**
 * Admin Insights — pure helpers (no I/O, no clock: `now` is passed in).
 * Used by modules/insights and jobs/insightsDigest. Unit-tested in
 * insightsLogic.test.ts. All calendar dates are IST (Asia/Kolkata, +05:30).
 */

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 IST on a YYYY-MM-DD date. */
export function istMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

// ── Date ranges ──────────────────────────────────────────────────────────────

export type RangeKey = '7d' | '30d' | '90d' | 'custom';
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  key: RangeKey;
  /** first IST day included */
  from: string;
  /** last IST day included */
  to: string;
  days: number;
  /** the equally long period right before */
  prevFrom: string;
  prevTo: string;
  /** instants for SQL: [start, end) */
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  /** series bucket: day for ≤ 90 days, otherwise week */
  bucket: 'day' | 'week';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(q: { range?: unknown; from?: unknown; to?: unknown }, now: Date):
  { ok: true; range: DateRange } | { ok: false; error: string } {
  const today = istDate(now);
  let key: RangeKey = '30d';
  let from: string;
  let to = today;
  if (q.range === 'custom') {
    if (typeof q.from !== 'string' || typeof q.to !== 'string' || !DATE_RE.test(q.from) || !DATE_RE.test(q.to)) {
      return { ok: false, error: 'Custom range needs from and to dates (YYYY-MM-DD).' };
    }
    if (Number.isNaN(Date.parse(q.from)) || Number.isNaN(Date.parse(q.to))) return { ok: false, error: 'Invalid date.' };
    if (q.from > q.to) return { ok: false, error: 'The start date must be before the end date.' };
    if (q.to > today) to = today; else to = q.to;
    from = q.from;
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return { ok: false, error: `Pick at most ${MAX_RANGE_DAYS} days.` };
    if (from > to) return { ok: false, error: 'The range is in the future.' };
    key = 'custom';
  } else {
    key = q.range === '7d' || q.range === '90d' ? q.range : '30d';
    const n = key === '7d' ? 7 : key === '90d' ? 90 : 30;
    from = addDays(today, -(n - 1));
  }
  const days = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return {
    ok: true,
    range: {
      key, from, to, days, prevFrom, prevTo,
      start: istMidnight(from),
      end: istMidnight(addDays(to, 1)),
      prevStart: istMidnight(prevFrom),
      prevEnd: istMidnight(from),
      bucket: days > 90 ? 'week' : 'day',
    },
  };
}

/** % change, rounded to 1 decimal; null when there is no base to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Fill a sparse {date → value} series so every bucket in the range is present. */
export function fillSeries<T extends Record<string, number>>(
  range: Pick<DateRange, 'from' | 'to' | 'bucket'>,
  rows: Array<{ bucket: string; [k: string]: unknown }>,
  keys: Array<keyof T & string>,
): Array<{ bucket: string } & T> {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const out: Array<{ bucket: string } & T> = [];
  const step = range.bucket === 'week' ? 7 : 1;
  for (let d = range.from; d <= range.to; d = addDays(d, step)) {
    const r = byBucket.get(d);
    const row = { bucket: d } as { bucket: string } & T;
    for (const k of keys) (row as Record<string, number>)[k] = Number(r?.[k] ?? 0);
    out.push(row);
  }
  return out;
}

// ── Funnels ──────────────────────────────────────────────────────────────────

export interface FunnelStepInput {
  key: string;
  label: string;
  count: number;
}

export interface FunnelStep extends FunnelStepInput {
  /** % of the first step */
  ofStart: number | null;
  /** % of the step before */
  ofPrevious: number | null;
  /** people lost since the step before */
  dropped: number;
}

export function buildFunnel(steps: FunnelStepInput[]): FunnelStep[] {
  const first = steps[0]?.count ?? 0;
  return steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1].count;
    return {
      ...s,
      ofStart: first > 0 ? round1((s.count / first) * 100) : null,
      ofPrevious: prev == null ? null : prev > 0 ? round1((s.count / prev) * 100) : null,
      dropped: prev == null ? 0 : Math.max(0, prev - s.count),
    };
  });
}

// ── Cohort retention ─────────────────────────────────────────────────────────

export interface CohortRowInput {
  /** cohort month, YYYY-MM (IST sign-up month) */
  cohort: string;
  size: number;
  /** week index → members active in that week after sign-up (week 0 = sign-up week) */
  activeByWeek: Record<number, number>;
  /** earliest sign-up date in the cohort (YYYY-MM-DD) */
  firstSignup: string;
  /** latest sign-up date in the cohort */
  lastSignup: string;
}

export interface CohortRow {
  cohort: string;
  size: number;
  /** % active per week; null = not measurable (before tracking started, or not reached yet) */
  weeks: Array<number | null>;
}

/**
 * Week k of a cohort is measurable only when every member's k-th week has
 * started (latest sign-up + 7k ≤ today) and activity was being tracked for
 * every member's k-th week (earliest sign-up + 7k ≥ tracking start).
 */
export function buildCohortGrid(rows: CohortRowInput[], maxWeeks: number, today: string, trackingStart: string | null): CohortRow[] {
  return rows.map((r) => {
    const weeks: Array<number | null> = [];
    for (let k = 0; k <= maxWeeks; k++) {
      const reached = addDays(r.lastSignup, 7 * k) <= today;
      const tracked = trackingStart != null && addDays(r.firstSignup, 7 * k) >= trackingStart;
      if (!reached || !tracked || r.size === 0) weeks.push(null);
      else weeks.push(round1(((r.activeByWeek[k] ?? 0) / r.size) * 100));
    }
    return { cohort: r.cohort, size: r.size, weeks };
  });
}

// ── Predictive at-risk score ─────────────────────────────────────────────────

export interface RiskInput {
  /** days since last activity; null = never active */
  daysSinceActive: number | null;
  /** active days in the last 7 days / the 7 days before */
  activeDaysLast7: number;
  activeDaysPrev7: number;
  /** member has a course, so the weekly report applies */
  weeklyReportRequired: boolean;
  /** weekly reports missing among the last 2 finished weeks */
  missedWeeklyReports: number;
  /** average lesson rating (1–10) of their last ratings; null = none */
  avgLessonRating: number | null;
  /** days until the soonest course access ends; null = nothing ending */
  accessEndsInDays: number | null;
  /** enrolled course not finished and no lesson completed for this many days; null = not applicable */
  daysSinceLastLesson: number | null;
  /** open support tickets older than 3 days */
  staleOpenTickets: number;
}

export interface RiskResult {
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: string[];
}

/** Weighted 0–100 churn-risk score with plain-language reasons. */
export function riskScore(i: RiskInput): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (i.daysSinceActive == null) { score += 35; reasons.push('Never active'); }
  else if (i.daysSinceActive >= 14) { score += 35; reasons.push(`Inactive ${i.daysSinceActive} days`); }
  else if (i.daysSinceActive >= 7) { score += 25; reasons.push(`Inactive ${i.daysSinceActive} days`); }
  else if (i.daysSinceActive >= 3) { score += 10; reasons.push(`Inactive ${i.daysSinceActive} days`); }

  if (i.activeDaysPrev7 >= 3 && i.activeDaysLast7 <= i.activeDaysPrev7 / 2) {
    score += 15;
    reasons.push(`Activity fell from ${i.activeDaysPrev7} to ${i.activeDaysLast7} days a week`);
  }

  if (i.weeklyReportRequired && i.missedWeeklyReports > 0) {
    score += i.missedWeeklyReports >= 2 ? 20 : 10;
    reasons.push(i.missedWeeklyReports >= 2 ? 'Missed the last 2 weekly reports' : 'Missed last week’s report');
  }

  if (i.avgLessonRating != null && i.avgLessonRating <= 5) {
    score += 10;
    reasons.push(`Rates lessons low (avg ${round1(i.avgLessonRating)}/10)`);
  }

  if (i.daysSinceLastLesson != null && i.daysSinceLastLesson >= 14) {
    score += 10;
    reasons.push(`No lesson finished in ${i.daysSinceLastLesson} days`);
  }

  if (i.accessEndsInDays != null && i.accessEndsInDays >= 0 && i.accessEndsInDays <= 14) {
    score += 5;
    reasons.push(`Course access ends in ${i.accessEndsInDays} day${i.accessEndsInDays === 1 ? '' : 's'}`);
  }

  if (i.staleOpenTickets > 0) {
    score += 5;
    reasons.push(`${i.staleOpenTickets} support ticket${i.staleOpenTickets === 1 ? '' : 's'} open 3+ days`);
  }

  score = Math.min(100, score);
  return { score, level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', reasons };
}

// ── Page / feature usage ─────────────────────────────────────────────────────

export interface PageSection {
  section: string;
  /** course id for course pages; '' otherwise */
  refId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Known member-app sections, by first path segment. */
export const USAGE_SECTIONS: Record<string, string> = {
  community: 'Community',
  courses: 'Courses',
  'course-page': 'Course page',
  learning: 'Lesson player',
  mentorship: 'Mentorship',
  'batch-program': 'Batch program',
  dashboard: 'Dashboard',
  discover: 'Discover',
  workshops: 'Workshops',
  workshop: 'Workshops',
  events: 'Events',
  programs: 'Programs',
  ebooks: 'Ebooks',
  ebook: 'Ebooks',
  podcasts: 'Podcasts',
  messages: 'Messages',
  notifications: 'Notifications',
  support: 'Support',
  profile: 'Profile',
  search: 'Search',
  history: 'History',
  products: 'Products',
  resources: 'Resources',
  wins: 'Wins',
  live: 'Live sessions',
  watch: 'Video player',
  episode: 'Video player',
  onboarding: 'Onboarding',
  psychometric: 'Psychometric',
  'ai-buddy': 'AI Content Buddy',
};

/** Map a member-app path to a usage section. null = not a tracked page. */
export function pageSection(path: unknown): PageSection | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 300) return null;
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean).map((p) => p.toLowerCase());
  if (parts.length === 0) return null;
  const first = parts[0];
  if (first === 'courses' && parts[1] && UUID_RE.test(parts[1])) return { section: 'course-page', refId: parts[1] };
  if (first === 'learning' && parts[1] && UUID_RE.test(parts[1])) return { section: 'learning', refId: parts[1] };
  if (!(first in USAGE_SECTIONS)) return null;
  // workshop/ebook singulars share a label with the plural; store one key.
  const section = first === 'workshop' ? 'workshops' : first === 'ebook' ? 'ebooks' : first === 'episode' ? 'watch' : first;
  return { section, refId: '' };
}

// ── Weekly digest ────────────────────────────────────────────────────────────

export interface DigestInput {
  weekLabel: string;
  revenue: number;
  revenuePrev: number;
  newMembers: number;
  newMembersPrev: number;
  activeMembers: number;
  activeMembersPrev: number;
  lessonsCompleted: number;
  lessonsCompletedPrev: number;
  weeklyReportCompliance: number | null; // % of required members who submitted last week
  failedPayments: number;
  pendingPayments: number;
  openTickets: number;
  overdueTickets: number;
  highRiskMembers: number;
  topRisk: Array<{ name: string; score: number; reasons: string[] }>;
}

export const COMPLIANCE_ALERT_BELOW = 60;

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function change(cur: number, prev: number): string {
  const p = pctChange(cur, prev);
  return p == null ? '' : ` (${p >= 0 ? '+' : ''}${p}%)`;
}

/** Alerts worth calling out in the digest. */
export function digestAlerts(d: DigestInput): string[] {
  const alerts: string[] = [];
  if (d.weeklyReportCompliance != null && d.weeklyReportCompliance < COMPLIANCE_ALERT_BELOW) {
    alerts.push(`Weekly report compliance is ${d.weeklyReportCompliance}% (below ${COMPLIANCE_ALERT_BELOW}%)`);
  }
  if (d.failedPayments > 0) alerts.push(`${d.failedPayments} failed payment${d.failedPayments === 1 ? '' : 's'} last week`);
  if (d.overdueTickets > 0) alerts.push(`${d.overdueTickets} support ticket${d.overdueTickets === 1 ? '' : 's'} past the resolve deadline`);
  const activeDrop = pctChange(d.activeMembers, d.activeMembersPrev);
  if (activeDrop != null && activeDrop <= -20) alerts.push(`Active members fell ${Math.abs(activeDrop)}% week on week`);
  return alerts;
}

export function buildDigestText(d: DigestInput): string {
  const lines = [
    `TBT weekly summary — ${d.weekLabel}`,
    '',
    `Revenue: ${inr(d.revenue)}${change(d.revenue, d.revenuePrev)}`,
    `New members: ${d.newMembers}${change(d.newMembers, d.newMembersPrev)}`,
    `Active members: ${d.activeMembers}${change(d.activeMembers, d.activeMembersPrev)}`,
    `Lessons completed: ${d.lessonsCompleted}${change(d.lessonsCompleted, d.lessonsCompletedPrev)}`,
    `Weekly report compliance: ${d.weeklyReportCompliance == null ? 'n/a' : `${d.weeklyReportCompliance}%`}`,
    `Pending payments: ${d.pendingPayments} · Open tickets: ${d.openTickets}`,
    `High-risk members: ${d.highRiskMembers}`,
  ];
  const alerts = digestAlerts(d);
  if (alerts.length) lines.push('', 'Alerts:', ...alerts.map((a) => `• ${a}`));
  if (d.topRisk.length) {
    lines.push('', 'Members to contact first:');
    for (const r of d.topRisk.slice(0, 5)) lines.push(`• ${r.name} (${r.score}) — ${r.reasons.slice(0, 2).join('; ')}`);
  }
  return lines.join('\n');
}
