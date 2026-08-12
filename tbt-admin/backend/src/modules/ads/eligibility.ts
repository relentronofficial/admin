/**
 * Ad campaign eligibility engine — TBT_ADS_SPECKIT.md §6.
 *
 * PURE by design: no Prisma, no `new Date()`, no I/O. The controller fetches
 * candidate campaigns + frequency rows and passes `now` in explicitly. That
 * is what makes this module unit-testable and what makes selection
 * reproducible — the two properties acceptance criteria 16-18 depend on.
 *
 * Do not add a database call to this file. If you need more data, widen the
 * input types and fetch it in the controller.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type Platform = 'mobile' | 'web';

export interface SkipConfig {
  enabled: boolean;
  type: 'seconds' | 'percent' | 'after_end' | 'immediate';
  value?: number;
}

export interface FrequencyConfig {
  mode?: 'once_per_session' | 'once_per_day' | 'once_per_user' | 'unlimited';
  maxPerUser?: number;
  maxPerSession?: number;
  maxPerDay?: number;
  minIntervalSeconds?: number;
}

export interface AudienceConfig {
  scope?: 'all' | 'guests' | 'authenticated';
  roles?: string[];
  plans?: string[];
  memberIds?: string[];
  regions?: string[];
}

export interface TriggerConfig {
  delaySeconds?: number;
  afterNLaunches?: number;
  repeatIntervalSeconds?: number;
}

/** Campaign shape the engine needs. Mirrors the Prisma row, loosely typed on
 *  the JSON columns because Prisma returns them as `JsonValue`. */
export interface CandidateCampaign {
  id: string;
  campaignCode: string;
  status: string;
  priority: number;
  startAt: Date;
  endAt: Date;
  timezone: string;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  activeDays: number[] | null;
  targetPlatforms: string[];
  targetOs: string[] | null;
  placements: string[];
  targetRoutes: string[] | null;
  batchIds: string[] | null;
  audienceConfig: AudienceConfig;
  triggerType: string;
  triggerConfig: TriggerConfig;
  frequencyConfig: FrequencyConfig;
  maxTotalImpressions: bigint | null;
  currentImpressionCount: bigint;
  createdAt: Date;
}

/** Who is asking. `memberId` is ALWAYS derived from the verified JWT — never
 *  from the request body (speckit §14). */
export interface RequestContext {
  memberId: string | null;
  anonymousId: string | null;
  sessionId: string;
  platform: Platform;
  os: string | null;
  placement: string;
  route: string | null;
  triggerType: string;
  launchCount: number | null;
  sessionElapsedSeconds: number | null;
  member: {
    role: string | null;
    membershipPlan: string | null;
    batchId: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

/** Denormalised counters for one (campaign, subject) pair. */
export interface FrequencyState {
  campaignId: string;
  /** Impressions in the CURRENT session. */
  sessionCount: number;
  /** Impressions in the current day bucket (campaign timezone). */
  dayCount: number;
  /** Impressions across all time for this subject. */
  totalCount: number;
  lastImpressionAt: Date | null;
}

export type RejectionReason =
  | 'not_active'
  | 'schedule_window'
  | 'schedule_day'
  | 'schedule_time'
  | 'platform'
  | 'os'
  | 'placement'
  | 'route'
  | 'trigger'
  | 'audience'
  | 'batch'
  | 'total_cap'
  | 'frequency';

export interface Rejection {
  campaignId: string;
  reason: RejectionReason;
}

export interface SelectionResult {
  selected: CandidateCampaign | null;
  rejections: Rejection[];
}

// ── Timezone helpers ────────────────────────────────────────────────────────
//
// No timezone library is available in this workspace (no luxon / date-fns-tz),
// and adding one for this alone isn't warranted. `Intl.DateTimeFormat` with a
// `timeZone` is built into Node 18+ and handles DST correctly, which naive
// offset arithmetic does not.

/** Wall-clock parts of `instant` as observed in `timeZone`. */
export function zonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).formatToParts(instant);
  } catch {
    // Invalid IANA identifier — fall back to UTC rather than throwing. A
    // misconfigured campaign should degrade, not take down the whole
    // eligibility request for every other campaign.
    return zonedParts(instant, 'UTC');
  }

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    // Intl renders midnight as "24" under hour12:false in some ICU versions.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/** "YYYY-MM-DD" for `instant` in `timeZone`. The day-bucket key for
 *  once-per-day frequency — an IST campaign must roll over at IST midnight,
 *  not the server's. */
export function dayBucket(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Parse "HH:mm" to minutes-since-midnight. Returns null if malformed. */
function parseHhMm(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Is `now` inside the campaign's daily wall-clock window?
 *
 * Handles windows that cross midnight (22:00 → 02:00) by treating start > end
 * as a wrap. Both null means "all day".
 */
export function withinDailyWindow(
  now: Date,
  timeZone: string,
  dailyStartTime: string | null,
  dailyEndTime: string | null,
): boolean {
  const start = parseHhMm(dailyStartTime);
  const end = parseHhMm(dailyEndTime);
  if (start === null || end === null) return true;

  const p = zonedParts(now, timeZone);
  const current = p.hour * 60 + p.minute;

  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end; // wraps midnight
}

// ── Individual predicates ───────────────────────────────────────────────────

function matchesPlatform(c: CandidateCampaign, ctx: RequestContext): boolean {
  return Array.isArray(c.targetPlatforms) && c.targetPlatforms.includes(ctx.platform);
}

function matchesOs(c: CandidateCampaign, ctx: RequestContext): boolean {
  if (!c.targetOs || c.targetOs.length === 0) return true;
  if (!ctx.os) return false;
  return c.targetOs.includes(ctx.os);
}

function matchesPlacement(c: CandidateCampaign, ctx: RequestContext): boolean {
  return Array.isArray(c.placements) && c.placements.includes(ctx.placement);
}

/** Route match. Supports exact, `/prefix/*` glob, and bare prefix. */
function matchesRoute(c: CandidateCampaign, ctx: RequestContext): boolean {
  if (!c.targetRoutes || c.targetRoutes.length === 0) return true;
  if (!ctx.route) return false;
  const route = ctx.route;
  return c.targetRoutes.some((pattern) => {
    if (pattern === route) return true;
    if (pattern.endsWith('/*')) return route.startsWith(pattern.slice(0, -1));
    if (pattern.endsWith('*')) return route.startsWith(pattern.slice(0, -1));
    return false;
  });
}

function matchesTrigger(
  c: CandidateCampaign,
  ctx: RequestContext,
  freq: FrequencyState | undefined,
  now: Date,
): boolean {
  if (c.triggerType !== ctx.triggerType) return false;
  const cfg = c.triggerConfig ?? {};

  if (typeof cfg.afterNLaunches === 'number' && cfg.afterNLaunches > 0) {
    if (ctx.launchCount === null || ctx.launchCount < cfg.afterNLaunches) return false;
  }

  if (typeof cfg.delaySeconds === 'number' && cfg.delaySeconds > 0) {
    if (ctx.sessionElapsedSeconds === null || ctx.sessionElapsedSeconds < cfg.delaySeconds) {
      return false;
    }
  }

  // "Show every N seconds" (speckit §6.1 step 7). Distinct from
  // frequencyConfig.minIntervalSeconds even though both gate on elapsed time:
  // this one describes the CADENCE of a recurring trigger, the other is a cap
  // the admin sets to protect the user. A campaign can legitimately set both,
  // and the stricter of the two wins because each is checked independently.
  //
  // Measured from the last impression this subject actually saw — with no
  // prior impression there is nothing to space out, so the first one passes.
  if (typeof cfg.repeatIntervalSeconds === 'number' && cfg.repeatIntervalSeconds > 0) {
    const last = freq?.lastImpressionAt ?? null;
    if (last) {
      const elapsed = (now.getTime() - last.getTime()) / 1000;
      if (elapsed < cfg.repeatIntervalSeconds) return false;
    }
  }

  return true;
}

function matchesAudience(c: CandidateCampaign, ctx: RequestContext): boolean {
  const a = c.audienceConfig ?? {};
  const isAuthenticated = ctx.memberId !== null;

  switch (a.scope) {
    case 'guests':
      if (isAuthenticated) return false;
      break;
    case 'authenticated':
      if (!isAuthenticated) return false;
      break;
    default:
      break; // 'all' or unset
  }

  // Every narrowing rule below targets an attribute only a logged-in member
  // has. A guest cannot satisfy them, so a campaign that sets any of them is
  // implicitly authenticated-only.
  const hasNarrowing =
    (a.roles?.length ?? 0) > 0 ||
    (a.plans?.length ?? 0) > 0 ||
    (a.memberIds?.length ?? 0) > 0 ||
    (a.regions?.length ?? 0) > 0;

  if (!hasNarrowing) return true;
  if (!isAuthenticated || !ctx.member) return false;

  if (a.memberIds?.length && !a.memberIds.includes(ctx.memberId!)) return false;
  if (a.roles?.length && !(ctx.member.role && a.roles.includes(ctx.member.role))) return false;
  if (a.plans?.length && !(ctx.member.membershipPlan && a.plans.includes(ctx.member.membershipPlan))) {
    return false;
  }
  if (a.regions?.length) {
    const region = [ctx.member.city, ctx.member.state].filter(Boolean) as string[];
    if (!region.some((r) => a.regions!.includes(r))) return false;
  }

  return true;
}

/** Project-wide batch access convention: null = everyone, array = restricted. */
function matchesBatch(c: CandidateCampaign, ctx: RequestContext): boolean {
  if (!c.batchIds || c.batchIds.length === 0) return true;
  const batchId = ctx.member?.batchId ?? null;
  if (!batchId) return false;
  return c.batchIds.includes(batchId);
}

function underTotalCap(c: CandidateCampaign): boolean {
  if (c.maxTotalImpressions === null || c.maxTotalImpressions === undefined) return true;
  return c.currentImpressionCount < c.maxTotalImpressions;
}

/**
 * Frequency caps. Server-authoritative — client-side storage is only ever an
 * optimisation (speckit §6.2).
 */
export function underFrequencyCap(
  c: CandidateCampaign,
  freq: FrequencyState | undefined,
  now: Date,
): boolean {
  const f = c.frequencyConfig ?? {};
  const state: FrequencyState = freq ?? {
    campaignId: c.id,
    sessionCount: 0,
    dayCount: 0,
    totalCount: 0,
    lastImpressionAt: null,
  };

  switch (f.mode) {
    case 'once_per_session':
      if (state.sessionCount > 0) return false;
      break;
    case 'once_per_day':
      if (state.dayCount > 0) return false;
      break;
    case 'once_per_user':
      if (state.totalCount > 0) return false;
      break;
    default:
      break; // 'unlimited' or unset — numeric caps below still apply
  }

  if (typeof f.maxPerSession === 'number' && state.sessionCount >= f.maxPerSession) return false;
  if (typeof f.maxPerDay === 'number' && state.dayCount >= f.maxPerDay) return false;
  if (typeof f.maxPerUser === 'number' && state.totalCount >= f.maxPerUser) return false;

  if (typeof f.minIntervalSeconds === 'number' && f.minIntervalSeconds > 0 && state.lastImpressionAt) {
    const elapsed = (now.getTime() - state.lastImpressionAt.getTime()) / 1000;
    if (elapsed < f.minIntervalSeconds) return false;
  }

  return true;
}

// ── Selection ───────────────────────────────────────────────────────────────

/**
 * Deterministic tie-breaker: priority DESC, then startAt ASC, createdAt ASC,
 * and finally id ASC.
 *
 * The `id` tie-break is not decoration. Priority, startAt and createdAt can
 * all collide (bulk-created campaigns share a timestamp to the millisecond),
 * and without a total order the winner varies with Postgres' query plan —
 * which is exactly the non-determinism acceptance criterion 18 forbids.
 */
export function compareCampaigns(a: CandidateCampaign, b: CandidateCampaign): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const startDiff = a.startAt.getTime() - b.startAt.getTime();
  if (startDiff !== 0) return startDiff;
  const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Run the full pipeline and return at most one campaign.
 *
 * `frequencyByCampaign` is keyed by campaign id; a missing entry means "no
 * impressions yet for this subject".
 */
export function selectCampaign(
  candidates: CandidateCampaign[],
  ctx: RequestContext,
  now: Date,
  frequencyByCampaign: Map<string, FrequencyState>,
): SelectionResult {
  const rejections: Rejection[] = [];
  const eligible: CandidateCampaign[] = [];

  for (const c of candidates) {
    const reject = (reason: RejectionReason) => {
      rejections.push({ campaignId: c.id, reason });
    };
    const freq = frequencyByCampaign.get(c.id);

    if (c.status !== 'active') { reject('not_active'); continue; }
    if (!(c.startAt.getTime() <= now.getTime() && c.endAt.getTime() > now.getTime())) {
      reject('schedule_window'); continue;
    }

    if (Array.isArray(c.activeDays) && c.activeDays.length > 0) {
      const { weekday } = zonedParts(now, c.timezone);
      if (!c.activeDays.includes(weekday)) { reject('schedule_day'); continue; }
    }

    if (!withinDailyWindow(now, c.timezone, c.dailyStartTime, c.dailyEndTime)) {
      reject('schedule_time'); continue;
    }

    if (!matchesPlatform(c, ctx))  { reject('platform');  continue; }
    if (!matchesOs(c, ctx))        { reject('os');        continue; }
    if (!matchesPlacement(c, ctx)) { reject('placement'); continue; }
    if (!matchesRoute(c, ctx))     { reject('route');     continue; }
    if (!matchesTrigger(c, ctx, freq, now)) { reject('trigger'); continue; }
    if (!matchesAudience(c, ctx))  { reject('audience');  continue; }
    if (!matchesBatch(c, ctx))     { reject('batch');     continue; }
    if (!underTotalCap(c))         { reject('total_cap'); continue; }

    if (!underFrequencyCap(c, freq, now)) {
      reject('frequency'); continue;
    }

    eligible.push(c);
  }

  if (eligible.length === 0) return { selected: null, rejections };

  eligible.sort(compareCampaigns);
  return { selected: eligible[0], rejections };
}

/**
 * Resolve a subject to a single non-null key for the frequency table.
 * See the AdUserFrequency model comment for why this exists.
 */
export function subjectKeyFor(memberId: string | null, anonymousId: string | null): string | null {
  if (memberId) return `m:${memberId}`;
  if (anonymousId) return `a:${anonymousId}`;
  return null;
}

/**
 * When does the skip control unlock, in seconds from playback start?
 * Returned to the client for display; the client also re-derives it, but the
 * server value is authoritative and is what gets recorded on the impression.
 *
 * `null` means "never" (skip disabled, or only after the media ends).
 */
export function skipAvailableAfterSeconds(
  skip: SkipConfig | null | undefined,
  mediaDurationSeconds: number | null,
): number | null {
  if (!skip || !skip.enabled) return null;
  switch (skip.type) {
    case 'immediate':
      return 0;
    case 'seconds':
      return typeof skip.value === 'number' ? Math.max(0, skip.value) : 0;
    case 'percent': {
      if (!mediaDurationSeconds || typeof skip.value !== 'number') return null;
      const pct = Math.min(100, Math.max(0, skip.value));
      return Math.round((mediaDurationSeconds * pct) / 100);
    }
    case 'after_end':
      return null;
    default:
      return null;
  }
}
