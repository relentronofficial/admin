/**
 * Advertisement campaign controller — TBT_ADS_SPECKIT.md §5.
 *
 * Two audiences in one module (same shape as chat-groups):
 *   Admin scope  (Clerk JWT) — campaign CRUD, status, duplicate, analytics
 *   Client scope (optional JWT cookie) — eligibility + tracking, for both
 *                                        authenticated members and guests
 *
 * Selection logic lives in ./eligibility.ts and is deliberately pure — this
 * file does the I/O and passes `now` in. Do not move predicate logic here.
 */

import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  createCampaignSchema,
  updateCampaignSchema,
  updateStatusSchema,
  listCampaignsQuerySchema,
  eligibleRequestSchema,
  impressionSchema,
  eventsSchema,
  completeSchema,
  skipSchema,
  closeSchema,
  clickSchema,
  analyticsQuerySchema,
  validateCampaignInvariants,
} from './schema.js';
import {
  selectCampaign,
  subjectKeyFor,
  dayBucket,
  skipAvailableAfterSeconds,
  type CandidateCampaign,
  type FrequencyState,
  type RequestContext,
} from './eligibility.js';
import { checkMediaReachable, cleanupCampaignCreative, resolveHlsUrl } from './media.js';

// ── Response helpers (project convention) ───────────────────────────────────

function ok<T>(reply: FastifyReply, data: T, meta?: unknown) {
  return reply.send({ success: true, data, error: null, ...(meta ? { meta } : {}) });
}

function fail(reply: FastifyReply, status: number, code: string, message: string, details?: unknown) {
  return reply
    .status(status)
    .send({ success: false, data: null, error: { code, message, ...(details ? { details } : {}) } });
}

/**
 * Prisma returns BigInt for the impression counters, and JSON.stringify throws
 * on BigInt ("Do not know how to serialize a BigInt"). Every campaign leaving
 * this module goes through here — forgetting it produces a 500 on an
 * otherwise-correct handler.
 */
function serializeCampaign(c: Record<string, any> | null): Record<string, any> | null {
  if (!c) return null;
  return {
    ...c,
    maxTotalImpressions:
      c.maxTotalImpressions === null || c.maxTotalImpressions === undefined
        ? null
        : Number(c.maxTotalImpressions),
    currentImpressionCount:
      c.currentImpressionCount === null || c.currentImpressionCount === undefined
        ? 0
        : Number(c.currentImpressionCount),
  };
}

/** Coerce a Prisma JsonValue to a string array, tolerating nulls and junk. */
function jsonArray<T = string>(value: unknown): T[] | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value as T[]) : null;
}

function jsonObject<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : fallback;
}

const DISPLAY_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Announce a campaign change — TBT_ADS_SPECKIT.md §12.
 *
 * Two audiences, two meanings:
 *
 *   broadcast `ads:campaign_invalidated` — every connected client. `paused` and
 *     `archived` tear down an ad that is currently on screen; `updated` and
 *     `expired` are advisory and apply on the next eligibility check, because
 *     yanking an ad mid-view to apply a priority change would be worse than the
 *     stale priority.
 *   `'admin'` room `admin:ad_campaign_updated` — keeps other admins' campaign
 *     lists live without polling.
 *
 * Never throws. A broadcast that did not land is not a reason to fail a
 * mutation that already committed — the next eligibility check picks the change
 * up regardless, which is exactly why §12 calls realtime an optimisation.
 */
function announceCampaignChange(
  server: FastifyRequest['server'],
  campaignId: string,
  reason: 'paused' | 'archived' | 'updated' | 'expired',
  status: string,
): void {
  try {
    server.io.emit('ads:campaign_invalidated', { campaignId, reason });
    server.io.to('admin').emit('admin:ad_campaign_updated', { campaignId, status });
  } catch {
    /* socket unavailable — see above */
  }
}

/**
 * Admin-room only. Used where there is nothing for member clients to react to —
 * a new draft has never been servable, so broadcasting it to every connected
 * member is traffic that every one of them would ignore.
 */
function announceToAdmins(
  server: FastifyRequest['server'],
  campaignId: string,
  status: string,
): void {
  try {
    server.io.to('admin').emit('admin:ad_campaign_updated', { campaignId, status });
  } catch {
    /* best effort */
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin handlers (Clerk)
// ═══════════════════════════════════════════════════════════════════════════

export async function listCampaignsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listCampaignsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten());
  }
  const q = parsed.data;

  const where: Record<string, any> = {};
  if (!q.includeDeleted) where.deletedAt = null;
  if (q.status) where.status = q.status;
  if (q.mediaType) where.mediaType = q.mediaType;
  if (q.triggerType) where.triggerType = q.triggerType;
  if (q.startFrom || q.startTo) {
    where.startAt = {
      ...(q.startFrom ? { gte: new Date(q.startFrom) } : {}),
      ...(q.startTo ? { lte: new Date(q.startTo) } : {}),
    };
  }
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { campaignCode: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    req.server.prisma.adCampaign.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    req.server.prisma.adCampaign.count({ where }),
  ]);

  // `platform` and `placement` live inside JSON columns, which Postgres can
  // filter but Prisma's `array_contains` handles awkwardly across driver
  // versions. Filtering the page in memory keeps behaviour predictable; the
  // page is at most 100 rows.
  let filtered = rows;
  if (q.platform) {
    filtered = filtered.filter((r) => (jsonArray(r.targetPlatforms) ?? []).includes(q.platform!));
  }
  if (q.placement) {
    filtered = filtered.filter((r) => (jsonArray(r.placements) ?? []).includes(q.placement!));
  }

  return ok(reply, filtered.map(serializeCampaign), {
    total,
    page: q.page,
    limit: q.limit,
    ...(q.platform || q.placement ? { filteredInPage: filtered.length } : {}),
  });
}

export async function getCampaignHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const campaign = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.deletedAt) {
    return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');
  }
  return ok(reply, serializeCampaign(campaign));
}

export async function createCampaignHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid campaign', parsed.error.flatten());
  }
  const d = parsed.data;

  const existing = await req.server.prisma.adCampaign.findUnique({
    where: { campaignCode: d.campaignCode },
  });
  if (existing) {
    return fail(reply, 409, 'DUPLICATE_CODE', `Campaign code "${d.campaignCode}" is already in use`);
  }

  try {
    const created = await req.server.prisma.adCampaign.create({
      data: {
        ...toPrismaData(d),
        // A campaign is never born live — it has to be activated explicitly so
        // the activation gate in updateStatusHandler always runs.
        status: 'draft',
      } as any,
    });
    req.server.log.info({ campaignId: created.id, code: created.campaignCode }, 'ad campaign created');
    announceToAdmins(req.server, created.id, created.status);
    return ok(reply, serializeCampaign(created));
  } catch (err: any) {
    req.server.log.error({ err: err.message }, 'ad campaign create failed');
    return fail(reply, 500, 'CREATE_FAILED', 'Could not create campaign');
  }
}

export async function updateCampaignHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid campaign', parsed.error.flatten());
  }

  const current = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!current || current.deletedAt) return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');

  // Status is deliberately NOT settable here — PATCH /status owns it, and that
  // is where the activation gate lives. Accepting it on the generic update
  // would let a campaign go live without ever passing the gate.
  const { status: _ignoredStatus, ...patch } = parsed.data;

  if (patch.campaignCode && patch.campaignCode !== current.campaignCode) {
    const clash = await req.server.prisma.adCampaign.findUnique({
      where: { campaignCode: patch.campaignCode },
    });
    if (clash) {
      return fail(reply, 409, 'DUPLICATE_CODE', `Campaign code "${patch.campaignCode}" is already in use`);
    }
  }

  // Cross-field rules run against the MERGED result — a patch on its own can
  // look valid while producing an incoherent campaign (e.g. shortening the
  // media below an already-configured skip threshold).
  const merged = { ...current, ...toPrismaData(patch as any) };
  const issues = validateCampaignInvariants(merged);
  if (issues.length) {
    return fail(reply, 400, 'VALIDATION_ERROR', issues[0], { issues });
  }

  const updated = await req.server.prisma.adCampaign.update({
    where: { id },
    data: toPrismaData(patch as any) as any,
  });

  // Advisory (§12): a priority, schedule or creative change applies on the next
  // eligibility check. Deliberately does NOT disturb an ad already playing —
  // the user is mid-view of a campaign that was valid when it started.
  announceCampaignChange(req.server, id, 'updated', updated.status);

  return ok(reply, serializeCampaign(updated));
}

export async function updateStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid status', parsed.error.flatten());
  }
  const { status } = parsed.data;

  const current = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!current || current.deletedAt) return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');

  // Activation gate (speckit §13). A campaign assembled over several patches
  // can be individually-valid-but-collectively-broken; this is the last point
  // at which that can be caught before members see it.
  if (status === 'active') {
    const issues = validateCampaignInvariants(current);
    if (issues.length) {
      return fail(reply, 400, 'NOT_ACTIVATABLE', `Cannot activate: ${issues[0]}`, { issues });
    }
    const hasMedia =
      current.mediaType === 'video'
        ? Boolean(current.mediaUrl || current.bunnyVideoId || current.hlsUrl)
        : Boolean(current.mediaUrl);
    if (!hasMedia) {
      return fail(reply, 400, 'NOT_ACTIVATABLE', 'Cannot activate a campaign without valid media');
    }

    // Criterion 33 asks for *valid* media, and a URL string is not validity —
    // an admin who deleted the R2 object or the Bunny video would otherwise
    // activate a campaign that shows every member a blank screen. Only a
    // definitive 404/410/403 blocks; anything ambiguous lets the activation
    // through (see checkMediaReachable).
    const creativeUrl = current.hlsUrl ?? current.mediaUrl;
    if (creativeUrl) {
      const reach = await checkMediaReachable(creativeUrl);
      if (!reach.reachable) {
        return fail(
          reply,
          400,
          'NOT_ACTIVATABLE',
          `Cannot activate: the creative could not be fetched (HTTP ${reach.status}). Re-upload it or fix the media URL.`,
        );
      }
      if ('unknown' in reach) {
        req.server.log.warn(
          { campaignId: id, url: creativeUrl, detail: reach.detail },
          'ad creative reachability check inconclusive — activating anyway',
        );
      }
    }
    if (current.endAt.getTime() <= Date.now()) {
      return fail(reply, 400, 'NOT_ACTIVATABLE', 'Cannot activate a campaign whose end date has passed');
    }
  }

  const updated = await req.server.prisma.adCampaign.update({ where: { id }, data: { status } });

  announceCampaignChange(
    req.server,
    id,
    status === 'paused' ? 'paused' : status === 'archived' ? 'archived' : 'updated',
    status,
  );

  req.server.log.info({ campaignId: id, status }, 'ad campaign status changed');
  return ok(reply, serializeCampaign(updated));
}

export async function duplicateCampaignHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const source = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!source || source.deletedAt) return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');

  // Find a free code. The suffix loop is bounded so a pathological data set
  // can't spin here.
  let code = `${source.campaignCode}-copy`;
  for (let i = 2; i <= 50; i++) {
    const clash = await req.server.prisma.adCampaign.findUnique({ where: { campaignCode: code } });
    if (!clash) break;
    code = `${source.campaignCode}-copy-${i}`;
    if (i === 50) return fail(reply, 409, 'DUPLICATE_CODE', 'Could not generate a free campaign code');
  }

  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source as any;
  const created = await req.server.prisma.adCampaign.create({
    data: {
      ...rest,
      campaignCode: code,
      name: `${source.name} (copy)`,
      status: 'draft',
      // Counters belong to the original campaign, not the copy.
      currentImpressionCount: BigInt(0),
      deletedAt: null,
    } as any,
  });

  announceToAdmins(req.server, created.id, created.status);
  return ok(reply, serializeCampaign(created));
}

export async function deleteCampaignHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { hard } = req.query as { hard?: string };

  const campaign = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!campaign) return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');

  if (hard === 'true') {
    // Reap the Bunny creative BEFORE the row goes away — the reference count
    // in cleanupCampaignCreative excludes this campaign by id, so it has to
    // still exist for the query to be meaningful. Duplicated campaigns share
    // a creative, so anything still pointing at the video blocks deletion (§4).
    const cleanup = await cleanupCampaignCreative(
      req.server.prisma,
      id,
      campaign.bunnyVideoId,
    );

    // Impressions and events cascade via FK. R2 images are intentionally left
    // in place — see cleanupCampaignCreative for why.
    await req.server.prisma.adCampaign.delete({ where: { id } });

    req.server.log.info(
      { campaignId: id, bunnyVideoId: campaign.bunnyVideoId, cleanup },
      'ad campaign hard-deleted',
    );

    // Treated as `archived` rather than a fifth reason: to a client holding a
    // display token for it, a deleted campaign and an archived one call for
    // exactly the same thing — stop showing it now (§12).
    announceCampaignChange(req.server, id, 'archived', 'archived');

    // Report the media outcome rather than swallowing it: "still_referenced"
    // is a normal, correct result an admin may want to understand, and
    // "delete_failed" means an orphaned asset someone has to reap by hand.
    return ok(reply, { id, deleted: 'hard', media: cleanup });
  }

  await req.server.prisma.adCampaign.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'archived' },
  });
  announceCampaignChange(req.server, id, 'archived', 'archived');
  return ok(reply, { id, deleted: 'soft' });
}

// ── Analytics ───────────────────────────────────────────────────────────────

export async function campaignAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = analyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid query', parsed.error.flatten());
  }
  const { from, to } = parsed.data;

  const campaign = await req.server.prisma.adCampaign.findUnique({ where: { id } });
  if (!campaign) return fail(reply, 404, 'NOT_FOUND', 'Campaign not found');

  // Only rows the client confirmed as rendered count as impressions (§3.2).
  const where: Record<string, any> = { campaignId: id, displayedAt: { not: null } };
  if (from || to) {
    where.displayedAt = {
      not: null,
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const impressions = await req.server.prisma.adImpression.findMany({
    where,
    select: {
      memberId: true, anonymousId: true, platform: true, placement: true,
      playbackStartedAt: true, completedAt: true, skippedAt: true,
      closedAt: true, clickedAt: true, watchedSeconds: true,
      completionPercentage: true, displayedAt: true,
    },
  });

  const total = impressions.length;
  const uniqueSubjects = new Set(
    impressions.map((i) => i.memberId ?? (i.anonymousId ? `a:${i.anonymousId}` : 'unknown')),
  ).size;

  const starts = impressions.filter((i) => i.playbackStartedAt).length;
  const completions = impressions.filter((i) => i.completedAt).length;
  const skips = impressions.filter((i) => i.skippedAt).length;
  const closes = impressions.filter((i) => i.closedAt).length;
  const clicks = impressions.filter((i) => i.clickedAt).length;

  const errorCount = await req.server.prisma.adEvent.count({
    where: { campaignId: id, eventType: { in: ['media_error', 'load_error'] } },
  });

  const avgWatched =
    total === 0
      ? 0
      : impressions.reduce((sum, i) => sum + Number(i.watchedSeconds ?? 0), 0) / total;

  const bucketBy = (key: 'platform' | 'placement') =>
    impressions.reduce<Record<string, number>>((acc, i) => {
      const k = (i[key] as string) ?? 'unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const byDay = impressions.reduce<Record<string, number>>((acc, i) => {
    if (!i.displayedAt) return acc;
    const k = dayBucket(i.displayedAt, campaign.timezone);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100);

  return ok(reply, {
    campaignId: id,
    campaignName: campaign.name,
    totalImpressions: total,
    uniqueUsersReached: uniqueSubjects,
    playbackStarts: starts,
    completions,
    completionRate: pct(completions, total),
    skips,
    skipRate: pct(skips, total),
    closes,
    ctaClicks: clicks,
    clickThroughRate: pct(clicks, total),
    playbackErrors: errorCount,
    averageWatchedSeconds: Math.round(avgWatched * 100) / 100,
    impressionsByDay: byDay,
    impressionsByPlatform: bucketBy('platform'),
    impressionsByPlacement: bucketBy('placement'),
  });
}

export async function analyticsOverviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const campaigns = await req.server.prisma.adCampaign.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, campaignCode: true, status: true, mediaType: true },
  });

  const grouped = await req.server.prisma.adImpression.groupBy({
    by: ['campaignId'],
    where: { displayedAt: { not: null } },
    _count: { _all: true },
  });
  const countByCampaign = new Map(grouped.map((g) => [g.campaignId, g._count._all]));

  const clickGrouped = await req.server.prisma.adImpression.groupBy({
    by: ['campaignId'],
    where: { clickedAt: { not: null } },
    _count: { _all: true },
  });
  const clicksByCampaign = new Map(clickGrouped.map((g) => [g.campaignId, g._count._all]));

  const rows = campaigns.map((c) => {
    const impressions = countByCampaign.get(c.id) ?? 0;
    const clicks = clicksByCampaign.get(c.id) ?? 0;
    return {
      ...c,
      impressions,
      clicks,
      clickThroughRate: impressions === 0 ? 0 : Math.round((clicks / impressions) * 10000) / 100,
    };
  });

  return ok(reply, {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    totalImpressions: rows.reduce((s, r) => s + r.impressions, 0),
    totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
    campaigns: rows.sort((a, b) => b.impressions - a.impressions),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Client handlers (optional auth — members and guests)
// ═══════════════════════════════════════════════════════════════════════════

export async function eligibleHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = eligibleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid request', parsed.error.flatten());
  }
  const body = parsed.data;

  // memberId comes ONLY from the verified cookie (§14). A body-supplied id is
  // ignored entirely — the schema does not even accept the field.
  const memberId = (req as any).memberId ?? null;
  const anonymousId = body.anonymousId ?? null;

  if (!memberId && !anonymousId) {
    return fail(reply, 400, 'NO_SUBJECT', 'Either an authenticated session or an anonymousId is required');
  }

  const now = new Date();

  try {
    const rows = await req.server.prisma.adCampaign.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      orderBy: [{ priority: 'desc' }, { startAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });

    if (rows.length === 0) return ok(reply, { showAd: false, campaign: null });

    let member: RequestContext['member'] = null;
    if (memberId) {
      const m = await req.server.prisma.member.findUnique({
        where: { id: memberId },
        select: { role: true, membershipPlan: true, batchId: true, city: true, state: true },
      });
      if (m) {
        member = {
          role: m.role ?? null,
          membershipPlan: (m.membershipPlan as unknown as string) ?? null,
          batchId: m.batchId ?? null,
          city: m.city ?? null,
          state: m.state ?? null,
        };
      }
    }

    const candidates: CandidateCampaign[] = rows.map((r) => ({
      id: r.id,
      campaignCode: r.campaignCode,
      status: r.status,
      priority: r.priority,
      startAt: r.startAt,
      endAt: r.endAt,
      timezone: r.timezone,
      dailyStartTime: r.dailyStartTime,
      dailyEndTime: r.dailyEndTime,
      activeDays: jsonArray<number>(r.activeDays),
      targetPlatforms: jsonArray<string>(r.targetPlatforms) ?? [],
      targetOs: jsonArray<string>(r.targetOs),
      placements: jsonArray<string>(r.placements) ?? [],
      targetRoutes: jsonArray<string>(r.targetRoutes),
      batchIds: jsonArray<string>(r.batchIds),
      audienceConfig: jsonObject(r.audienceConfig, { scope: 'all' as const }),
      triggerType: r.triggerType,
      triggerConfig: jsonObject(r.triggerConfig, {}),
      frequencyConfig: jsonObject(r.frequencyConfig, {}),
      maxTotalImpressions: r.maxTotalImpressions,
      currentImpressionCount: r.currentImpressionCount,
      createdAt: r.createdAt,
    }));

    const subjectKey = subjectKeyFor(memberId, anonymousId)!;
    const freqRows = await req.server.prisma.adUserFrequency.findMany({
      where: { campaignId: { in: candidates.map((c) => c.id) }, subjectKey },
      take: 1000,
    });

    // Roll the per-(campaign, session, day) rows up into the shape the engine
    // wants. Day buckets are per-campaign because each campaign has its own
    // timezone — "today" is not a single global value here.
    const freqByCampaign = new Map<string, FrequencyState>();
    for (const c of candidates) {
      const today = dayBucket(now, c.timezone);
      const mine = freqRows.filter((f) => f.campaignId === c.id);
      freqByCampaign.set(c.id, {
        campaignId: c.id,
        sessionCount: mine
          .filter((f) => f.sessionId === body.sessionId)
          .reduce((s, f) => s + f.impressionCount, 0),
        dayCount: mine
          .filter((f) => f.dayBucket === today)
          .reduce((s, f) => s + f.impressionCount, 0),
        totalCount: mine.reduce((s, f) => s + f.impressionCount, 0),
        lastImpressionAt: mine.reduce<Date | null>(
          (latest, f) =>
            f.lastImpressionAt && (!latest || f.lastImpressionAt > latest) ? f.lastImpressionAt : latest,
          null,
        ),
      });
    }

    const ctx: RequestContext = {
      memberId,
      anonymousId,
      sessionId: body.sessionId,
      platform: body.platform,
      os: body.os ?? null,
      placement: body.placement,
      route: body.route ?? null,
      triggerType: body.triggerType,
      launchCount: body.launchCount ?? null,
      sessionElapsedSeconds: body.sessionElapsedSeconds ?? null,
      member,
    };

    const { selected, rejections } = selectCampaign(candidates, ctx, now, freqByCampaign);

    if (!selected) {
      // Only log a block when a campaign lost on frequency or schedule
      // specifically — writing a row per non-matching campaign per request
      // would be enormous write volume for no analytical value (§3.3).
      const notable = rejections.filter(
        (r) => r.reason === 'frequency' || r.reason.startsWith('schedule'),
      );
      if (notable.length) {
        await req.server.prisma.adEvent
          .createMany({
            data: notable.slice(0, 5).map((r) => ({
              campaignId: r.campaignId,
              memberId,
              eventType: r.reason === 'frequency' ? 'frequency_blocked' : 'schedule_blocked',
              eventTimestamp: now,
              platform: body.platform,
              placement: body.placement,
            })),
          })
          .catch(() => {});
      }
      return ok(reply, { showAd: false, campaign: null });
    }

    const full = rows.find((r) => r.id === selected.id)!;
    const displayToken = crypto.randomUUID();
    const skipCfg = jsonObject(full.skipConfig, { enabled: false, type: 'seconds' as const });
    const skipAfter = skipAvailableAfterSeconds(skipCfg as any, full.mediaDurationSeconds);

    await req.server.prisma.adImpression.create({
      data: {
        campaignId: full.id,
        memberId,
        anonymousId,
        displayToken,
        sessionId: body.sessionId,
        platform: body.platform,
        placement: body.placement,
        route: body.route ?? null,
        skipAvailableAfterSeconds: skipAfter as any,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
        deviceInfo: (body.deviceInfo ?? null) as any,
        // The request carries content context the schema accepts but no column
        // exists for; keep it rather than dropping it on the floor — attributing
        // an impression to the content it interrupted is the whole point of
        // placement analytics.
        metadata: {
          contentId: body.contentId ?? null,
          module: body.module ?? null,
          appVersion: body.appVersion ?? null,
          triggerType: body.triggerType,
        } as any,
        // displayedAt intentionally left NULL — set by /impression once the
        // client confirms the ad actually rendered.
      },
    });

    await req.server.prisma.adEvent
      .create({
        data: {
          campaignId: full.id,
          memberId,
          eventType: 'eligible',
          eventTimestamp: now,
          platform: body.platform,
          placement: body.placement,
        },
      })
      .catch(() => {});

    const videoType = full.hlsUrl ? 'hls' : 'iframe';

    return ok(reply, {
      showAd: true,
      displayToken,
      campaign: {
        id: full.id,
        name: full.name,
        mediaType: full.mediaType,
        mediaUrl: full.hlsUrl ?? full.mediaUrl,
        videoType: full.mediaType === 'video' ? videoType : null,
        bunnyVideoId: full.bunnyVideoId,
        thumbnailUrl: full.thumbnailUrl,
        fallbackMediaUrl: full.fallbackMediaUrl,
        durationSeconds: full.mediaDurationSeconds,
        objectFit: full.objectFit,
        backgroundColor: full.backgroundColor,
        autoplay: full.autoplay,
        muted: full.muted,
        loop: full.loop,
        skipConfig: full.skipConfig,
        skipAvailableAfterSeconds: skipAfter,
        closeConfig: full.closeConfig,
        ctaConfig: full.ctaConfig,
      },
    });
  } catch (err: any) {
    // An ad-system failure must be invisible to the user (speckit §11). Any
    // unhandled error degrades to "no ad" rather than surfacing an error the
    // client would have to handle.
    req.server.log.error({ err: err.message }, 'ad eligibility failed — returning no-ad');
    return ok(reply, { showAd: false, campaign: null });
  }
}

/** Load + validate a display token against the caller. Shared by every
 *  lifecycle endpoint. */
async function resolveToken(
  req: FastifyRequest,
  displayToken: string,
  claimedAnonymousId?: string | null,
): Promise<{ impression: any } | { error: [number, string, string] }> {
  const impression = await req.server.prisma.adImpression.findUnique({
    where: { displayToken },
  });
  if (!impression) return { error: [404, 'INVALID_TOKEN', 'Unknown display token'] };

  if (Date.now() - impression.createdAt.getTime() > DISPLAY_TOKEN_TTL_MS) {
    return { error: [410, 'TOKEN_EXPIRED', 'Display token has expired'] };
  }

  // Bind the token to whoever is calling (§6.4). An authenticated caller must
  // own it — and `memberId` here is the one the JWT cookie proved, never a
  // body field.
  const memberId = (req as any).memberId ?? null;
  if (impression.memberId) {
    if (impression.memberId !== memberId) {
      return { error: [403, 'TOKEN_MISMATCH', 'Display token does not belong to this session'] };
    }
  } else if (impression.anonymousId) {
    // Guest-issued token: there is no cookie to check it against, so the
    // caller has to present the same device id the token was issued to. This
    // is weaker than the member branch (the device id is client-supplied), but
    // without it a leaked token is redeemable by anyone, and inflating a
    // campaign's completion numbers takes only a copied token.
    if (!claimedAnonymousId || claimedAnonymousId !== impression.anonymousId) {
      return { error: [403, 'TOKEN_MISMATCH', 'Display token does not belong to this session'] };
    }
  }

  return { impression };
}

/**
 * Confirms an ad actually rendered.
 *
 * **Accepted limitation (§14).** Token binding, identity binding and per-phase
 * idempotency raise the cost of forging impressions considerably, but they do
 * not eliminate it: a determined authenticated client can still confirm an
 * impression for an ad it never painted. Closing that gap needs server-side
 * rendering attestation, which is not achievable for a client-rendered
 * overlay. This is documented rather than solved — if ad spend is ever settled
 * against these numbers, that decision has to be revisited first.
 */
export async function impressionHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = impressionSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid request', parsed.error.flatten());
  }

  const resolved = await resolveToken(req, parsed.data.displayToken, parsed.data.anonymousId);
  if ('error' in resolved) {
    const [status, code, message] = resolved.error;
    return fail(reply, status, code, message);
  }
  const { impression } = resolved;

  // Idempotent: a retry after a flaky network must not double-count. 200 with
  // duplicate:true rather than a 4xx, because clients retry legitimately and
  // an error would be misreported as a failure. This read is only the cheap
  // path — the authoritative check is the conditional claim below.
  if (impression.displayedAt) {
    return ok(reply, { recorded: true, duplicate: true });
  }

  const now = new Date();
  const campaign = await req.server.prisma.adCampaign.findUnique({
    where: { id: impression.campaignId },
    select: { timezone: true, status: true, deletedAt: true, endAt: true },
  });

  // The campaign can be paused, archived or deleted between selection and the
  // client confirming the render (§11). Tell the client to tear down silently
  // and record nothing: an ad an admin pulled before it appeared must not
  // consume the user's frequency cap or count against the campaign's total.
  //
  // Note this is only about the window BEFORE the render. A campaign that
  // expires while the user is watching is left alone — /complete accepts a
  // token for a now-inactive campaign, because yanking an ad mid-view to
  // enforce a schedule boundary is worse than letting it finish.
  const campaignGone =
    !campaign || campaign.deletedAt !== null || campaign.status !== 'active';
  if (campaignGone) {
    req.server.log.info(
      { campaignId: impression.campaignId, status: campaign?.status ?? 'missing' },
      'ad impression rejected — campaign no longer servable',
    );
    return ok(reply, { showAd: false, recorded: false });
  }

  // Claim the impression conditionally. Two concurrent retries of the same
  // token both pass the read above (neither has written yet); only one can win
  // `displayedAt IS NULL`, and the loser must not go on to increment the
  // frequency and cap counters a second time.
  const claim = await req.server.prisma.adImpression.updateMany({
    where: { id: impression.id, displayedAt: null },
    data: { displayedAt: now },
  });
  if (claim.count === 0) {
    return ok(reply, { recorded: true, duplicate: true });
  }

  const subjectKey = subjectKeyFor(impression.memberId, impression.anonymousId);

  // Frequency and the cap move together (§6.3): a frequency row incremented
  // without its matching campaign counter — or vice versa — leaves the two
  // permanently out of step, and nothing in the system ever reconciles them.
  let capOverflow = false;
  try {
    await req.server.prisma.$transaction(async (tx) => {
      if (subjectKey) {
        // Atomic upsert — two devices racing must not both read 0 and write 1.
        await tx.$executeRawUnsafe(
          `INSERT INTO ad_user_frequency
             (campaign_id, subject_key, member_id, anonymous_id, session_id, day_bucket,
              impression_count, last_impression_at, updated_at)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, 1, NOW(), NOW())
           ON CONFLICT (campaign_id, subject_key, session_id, day_bucket)
           DO UPDATE SET impression_count = ad_user_frequency.impression_count + 1,
                         last_impression_at = NOW(),
                         updated_at = NOW()`,
          impression.campaignId,
          subjectKey,
          impression.memberId,
          impression.anonymousId,
          impression.sessionId,
          dayBucket(now, campaign?.timezone ?? 'UTC'),
        );
      }

      // Conditional increment doubles as the total-cap check.
      const capRows = await tx.$queryRawUnsafe<Array<{ current_impression_count: bigint }>>(
        `UPDATE ad_campaigns
            SET current_impression_count = current_impression_count + 1
          WHERE id = $1::uuid
            AND (max_total_impressions IS NULL OR current_impression_count < max_total_impressions)
          RETURNING current_impression_count`,
        impression.campaignId,
      );
      capOverflow = capRows.length === 0;
    });
  } catch (err: any) {
    // The impression itself is already recorded; only the counters were lost.
    // Log and carry on — tracking must never surface an error the client would
    // have to handle (§11).
    req.server.log.error({ err: err.message }, 'ad frequency/cap transaction failed');
  }

  if (capOverflow) {
    // Cap was hit between selection and render. Keep the impression — the user
    // has already seen the ad, and dropping it only corrupts analytics — but
    // retire the campaign so nobody else is selected into it.
    await req.server.prisma.adCampaign
      .update({ where: { id: impression.campaignId }, data: { status: 'completed' } })
      .catch(() => {});
    req.server.log.info(
      { campaignId: impression.campaignId },
      'ad campaign hit total impression cap — marked completed',
    );
    // `expired` is advisory: the user watching right now already saw it, and
    // pulling it off their screen to enforce a cap they did not breach would be
    // punishing the wrong person. Everyone else stops being selected into it.
    announceCampaignChange(req.server, impression.campaignId, 'expired', 'completed');
  }

  await req.server.prisma.adEvent
    .create({
      data: {
        campaignId: impression.campaignId,
        impressionId: impression.id,
        memberId: impression.memberId,
        eventType: 'impression',
        eventTimestamp: now,
        platform: impression.platform,
        placement: impression.placement,
      },
    })
    .catch(() => {});

  return ok(reply, { recorded: true, duplicate: false });
}

/** completed / skipped / closed / clicked all share one shape. */
function makeLifecycleHandler(
  phase: 'completed' | 'skipped' | 'closed' | 'clicked',
  schema: typeof completeSchema,
  eventType: 'completed' | 'skipped' | 'closed' | 'cta_clicked',
) {
  const column = `${phase}At` as 'completedAt' | 'skippedAt' | 'closedAt' | 'clickedAt';

  return async function handler(req: FastifyRequest, reply: FastifyReply) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid request', parsed.error.flatten());
    }
    const { displayToken, anonymousId, elapsedSeconds, completionPercentage } = parsed.data;

    const resolved = await resolveToken(req, displayToken, anonymousId);
    if ('error' in resolved) {
      const [status, code, message] = resolved.error;
      return fail(reply, status, code, message);
    }
    const { impression } = resolved;

    if (impression[column]) {
      return ok(reply, { recorded: true, duplicate: true });
    }

    const now = new Date();
    // Conditional on the phase column being unset, for the same reason as
    // /impression: concurrent retries must resolve to exactly one write.
    const claim = await req.server.prisma.adImpression.updateMany({
      where: { id: impression.id, [column]: null } as any,
      data: {
        [column]: now,
        ...(elapsedSeconds !== undefined ? { watchedSeconds: elapsedSeconds as any } : {}),
        ...(completionPercentage !== undefined
          ? { completionPercentage: completionPercentage as any }
          : {}),
      } as any,
    });
    if (claim.count === 0) {
      return ok(reply, { recorded: true, duplicate: true });
    }

    if (phase === 'completed') {
      await req.server.prisma
        .$executeRawUnsafe(
          `UPDATE ad_user_frequency SET last_completed_at = NOW()
            WHERE campaign_id = $1::uuid AND subject_key = $2 AND session_id = $3`,
          impression.campaignId,
          subjectKeyFor(impression.memberId, impression.anonymousId) ?? '',
          impression.sessionId,
        )
        .catch(() => {});
    }

    await req.server.prisma.adEvent
      .create({
        data: {
          campaignId: impression.campaignId,
          impressionId: impression.id,
          memberId: impression.memberId,
          eventType,
          eventTimestamp: now,
          elapsedSeconds: (elapsedSeconds ?? null) as any,
          completionPercentage: (completionPercentage ?? null) as any,
          platform: impression.platform,
          placement: impression.placement,
        },
      })
      .catch(() => {});

    return ok(reply, { recorded: true, duplicate: false });
  };
}

export const completeHandler = makeLifecycleHandler('completed', completeSchema, 'completed');
export const skipHandler = makeLifecycleHandler('skipped', skipSchema, 'skipped');
export const closeHandler = makeLifecycleHandler('closed', closeSchema, 'closed');
export const clickHandler = makeLifecycleHandler('clicked', clickSchema, 'cta_clicked');

export async function eventsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = eventsSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid request', parsed.error.flatten());
  }
  const { displayToken, anonymousId, events } = parsed.data;

  const resolved = await resolveToken(req, displayToken, anonymousId);
  if ('error' in resolved) {
    const [status, code, message] = resolved.error;
    return fail(reply, status, code, message);
  }
  const { impression } = resolved;

  await req.server.prisma.adEvent
    .createMany({
      data: events.map((e) => ({
        campaignId: impression.campaignId,
        impressionId: impression.id,
        memberId: impression.memberId,
        eventType: e.eventType,
        eventTimestamp: e.eventTimestamp ? new Date(e.eventTimestamp) : new Date(),
        elapsedSeconds: (e.elapsedSeconds ?? null) as any,
        completionPercentage: (e.completionPercentage ?? null) as any,
        platform: impression.platform,
        placement: impression.placement,
        metadata: (e.metadata ?? null) as any,
      })),
    })
    .catch((err: any) => {
      req.server.log.error({ err: err.message }, 'ad event batch insert failed');
    });

  // Tracking never gates the UI — always acknowledge.
  return ok(reply, { recorded: events.length });
}

// ── Shared mapping ──────────────────────────────────────────────────────────

/**
 * Map a validated payload onto Prisma's expected shape: ISO strings become
 * Dates, numeric caps become BigInt, and JSON columns are cast (the project
 * convention for Prisma Json writes).
 */
function toPrismaData(d: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...d };

  if (d.startAt !== undefined && typeof d.startAt === 'string') out.startAt = new Date(d.startAt);
  if (d.endAt !== undefined && typeof d.endAt === 'string') out.endAt = new Date(d.endAt);

  // Derive the playlist URL server-side (§4). Only when the payload actually
  // touches the video fields, so a PATCH of an unrelated field does not
  // resurrect an hlsUrl on a campaign that has none.
  if (d.bunnyVideoId !== undefined || d.hlsUrl !== undefined) {
    out.hlsUrl = resolveHlsUrl(d.bunnyVideoId, d.hlsUrl);
  }

  if (d.maxTotalImpressions !== undefined) {
    out.maxTotalImpressions =
      d.maxTotalImpressions === null ? null : BigInt(d.maxTotalImpressions);
  }

  for (const key of [
    'activeDays', 'targetPlatforms', 'targetOs', 'placements', 'targetRoutes',
    'batchIds', 'audienceConfig', 'triggerConfig', 'frequencyConfig',
    'skipConfig', 'closeConfig', 'ctaConfig', 'analyticsConfig',
  ]) {
    if (d[key] !== undefined) out[key] = d[key] as any;
  }

  return out;
}
