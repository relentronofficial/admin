/**
 * Advertisement campaign routes at `/api/ads` — TBT_ADS_SPECKIT.md §5.
 *
 *   `/api/ads/admin/*`  — Clerk auth. Campaign CRUD, status, analytics.
 *   `/api/ads/*`        — OPTIONAL JWT-cookie auth. Eligibility + tracking,
 *                         serving both signed-in members and guests.
 *
 * Note the deviation from the speckit, which put the client routes under
 * `/api/pub/ads`: keeping them here means the whole feature lives in one
 * module (matching chat-groups) instead of straddling two prefixes. The
 * optional-auth hook below provides the guest access that `/api/pub` would
 * otherwise have given us.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  listCampaignsHandler,
  getCampaignHandler,
  createCampaignHandler,
  updateCampaignHandler,
  updateStatusHandler,
  duplicateCampaignHandler,
  deleteCampaignHandler,
  campaignAnalyticsHandler,
  analyticsOverviewHandler,
  eligibleHandler,
  impressionHandler,
  eventsHandler,
  completeHandler,
  skipHandler,
  closeHandler,
  clickHandler,
} from './controller.js';

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }),
  );
}

/**
 * Resolve `request.memberId` when a valid session is present, and fall through
 * silently when it is not.
 *
 * This is deliberately NOT `authenticateUser`: ads must reach guests, and that
 * middleware 401s without a cookie. The security property that matters is
 * unchanged — `memberId` is still only ever derived from a verified token, and
 * a forged or expired one leaves the caller anonymous rather than
 * authenticated. Handlers must treat a null memberId as "guest", never as
 * "trust the body".
 */
/**
 * Admin gate — TBT_ADS_SPECKIT.md §14.
 *
 * `fastify.authenticate` proves the caller holds *a* valid Clerk token. It does
 * not prove they are an admin, and Clerk is also installed in user-web (for the
 * `(auth)` route group), so a member session can produce a token that passes
 * verification. This resolves the token subject to an actual `Admin` row and
 * rejects anything else.
 *
 * Soft-deleted and non-active admins are rejected too: an offboarded admin
 * whose Clerk user was not yet deleted would otherwise keep full campaign
 * control, which is exactly the case `status`/`deletedAt` exist to cover.
 *
 * Roles are NOT further narrowed here — every value in the `Role` enum is an
 * internal staff role, and the repo has no per-role permission model for other
 * admin modules to be consistent with. If campaign editing should be limited to
 * `super_admin`/`admin` later, this is the one place to add it.
 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const clerkId = (request as any).user as string | undefined;
  if (!clerkId) {
    return reply
      .status(401)
      .send({ success: false, data: null, error: 'Unauthorized' });
  }

  const admin = await request.server.prisma.admin.findUnique({
    where: { clerkId },
    select: { id: true, status: true, deletedAt: true, role: true },
  });

  if (!admin || admin.deletedAt !== null || admin.status !== 'active') {
    request.server.log.warn({ clerkId }, 'ad admin route rejected — not an active admin');
    return reply
      .status(403)
      .send({ success: false, data: null, error: 'Forbidden: admin access required' });
  }

  // Available to handlers for attribution (createdBy / updatedBy).
  (request as any).adminId = admin.id;
}

async function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  let token: string | null = null;
  const authHeader = request.headers.authorization;
  if (authHeader?.match(/^Bearer\s+/i)) {
    token = authHeader.slice(authHeader.indexOf(' ') + 1).trim();
  } else {
    token = parseCookies(request.headers.cookie)['tbt_access'] ?? null;
  }
  if (!token) return;

  try {
    const decoded = (await (request.server as any).jwt.verify(token)) as { memberId?: string };
    if (decoded?.memberId) {
      (request as any).memberId = decoded.memberId;
    }
  } catch {
    // Expired or invalid — proceed as a guest. Deliberately silent: an expired
    // cookie must not stop an ad from being served, and it is not an error the
    // caller can act on.
  }
}

export async function adsRoutes(fastify: FastifyInstance) {
  // ── Admin (Clerk) ───────────────────────────────────────────────
  fastify.register(
    async (adminScope) => {
      // Order matters: authenticate resolves the Clerk subject, requireAdmin
      // then checks that subject is an active admin.
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.addHook('preHandler', requireAdmin);

      adminScope.get('/campaigns', listCampaignsHandler);
      adminScope.post('/campaigns', createCampaignHandler);
      adminScope.get('/campaigns/:id', getCampaignHandler);
      adminScope.put('/campaigns/:id', updateCampaignHandler);
      adminScope.patch('/campaigns/:id/status', updateStatusHandler);
      adminScope.post('/campaigns/:id/duplicate', duplicateCampaignHandler);
      adminScope.delete('/campaigns/:id', deleteCampaignHandler);

      adminScope.get('/campaigns/:id/analytics', campaignAnalyticsHandler);
      adminScope.get('/analytics/overview', analyticsOverviewHandler);
    },
    { prefix: '/admin' },
  );

  // ── Client (optional auth: members + guests) ────────────────────
  fastify.register(async (clientScope) => {
    clientScope.addHook('preHandler', optionalAuth);

    // Eligibility is the expensive path (DB reads + selection), so it gets a
    // tighter budget than the fire-and-forget tracking routes below.
    clientScope.post('/eligible', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: eligibleHandler,
    });

    clientScope.post('/impression', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: impressionHandler,
    });

    clientScope.post('/events', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      handler: eventsHandler,
    });

    clientScope.post('/complete', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: completeHandler,
    });
    clientScope.post('/skip', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: skipHandler,
    });
    clientScope.post('/close', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: closeHandler,
    });
    clientScope.post('/click', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: clickHandler,
    });
  });
}
