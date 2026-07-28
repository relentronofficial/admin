import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '@clerk/backend';
import { env } from '../../config/env.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';

export async function pubSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

  const redis = req.server.redis ?? null;
  const CACHE_KEY = 'pub:site-config:v2';
  const cached = await cacheGet<object>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });

  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({
      data: { siteName: 'TBT', footerText: '© TBT' },
    });
  }

  const data = {
    siteName: config.siteName,
    logoUrl: config.logoUrl ?? null,
    faviconUrl: config.faviconUrl ?? null,
    footerText: config.footerText,
    theme: {
      accentColor: config.accentColor,
      alertColor: config.alertColor,
      successColor: config.successColor,
      bgPrimary: config.bgPrimary,
      bgSurface: config.bgSurface,
    },
    splashLogoUrl: config.splashLogoUrl ?? null,
    splashDurationMs: config.splashDurationMs,
    loginBgUrl: config.loginBgUrl ?? null,
    loginBgMobileUrl: config.loginBgMobileUrl ?? null,
    loginBgImages: Array.isArray(config.loginBgImages) ? config.loginBgImages as string[] : null,
  };
  await cacheSet(redis, CACHE_KEY, data, 300);
  return reply.send({ success: true, data, error: null });
}

export async function pubNavItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

  const redis = req.server.redis ?? null;
  const CACHE_KEY = 'pub:nav';
  const cached = await cacheGet<object>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });

  const [items, config] = await Promise.all([
    req.server.prisma.navItem.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
    }),
    req.server.prisma.siteConfig.findFirst(),
  ]);

  const data = {
    items,
    rightIcons: {
      notifications: config?.navShowNotifications ?? true,
      messages: config?.navShowMessages ?? true,
      profile: config?.navShowProfile ?? true,
    },
  };
  await cacheSet(redis, CACHE_KEY, data, 300);
  return reply.send({ success: true, data, error: null });
}

export async function pubUiStringsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

  const redis = req.server.redis ?? null;
  const CACHE_KEY = 'pub:ui-strings';
  const cached = await cacheGet<object>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });

  let strings = await req.server.prisma.uiStrings.findFirst();
  if (!strings) {
    strings = await req.server.prisma.uiStrings.create({ data: {} });
  }
  await cacheSet(redis, CACHE_KEY, strings, 600);
  return reply.send({ success: true, data: strings, error: null });
}

// ── POST /api/pub/auth/sync ───────────────────────────────────────────────────
// Called by the user web on first sign-in. Verifies the Clerk token and
// upserts a Member record so subsequent authenticateUser calls succeed.
export async function pubMemberSyncHandler(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, data: null, error: 'No token' });
  }

  let clerkId: string;
  try {
    const verified = await verifyToken(authHeader.slice(7), {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_PUBLIC_KEY || undefined,
    });
    if (!verified?.sub) throw new Error('Missing sub');
    clerkId = verified.sub;
  } catch (err: any) {
    return reply.status(401).send({ success: false, data: null, error: `Unauthorized: ${err.message}` });
  }

  // Return early if member already exists (or proceed to create)
  let member = await req.server.prisma.member.findFirst({ where: { clerkId } as any });
  
  if (!member) {
    // Fetch Clerk user profile for name/email/phone
    let clerkUser: any = null;
    try {
      clerkUser = await req.server.clerk.users.getUser(clerkId);
    } catch {
      // Non-fatal — fall back to clerkId-derived values
    }

    const email      = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.tbt`;
    const firstName  = clerkUser?.firstName ?? email.split('@')[0] ?? 'Member';
    const lastName   = clerkUser?.lastName ?? '';
    const phone      = clerkUser?.phoneNumbers?.[0]?.phoneNumber || `clerk:${clerkId}`;
    const memberId   = `TBT-${Math.floor(1000 + Math.random() * 9000)}`;

    member = await req.server.prisma.member.create({
      data: { clerkId, memberId, firstName, lastName, email, phone } as any,
    });

    // Give new members a 1-year active subscription
    await req.server.prisma.subscription.create({
      data: {
        memberId: member.id,
        plan: 'premium',
        status: 'active',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        amount: 0,
      } as any,
    }).catch(() => { /* non-fatal */ });
  }

  // ── Device Tracking & Telemetry ──
  const deviceId = req.headers['x-device-id'] as string | undefined;
  const userAgent = req.headers['user-agent'] as string | undefined;
  const ipAddress = req.ip;

  if (deviceId) {
    const existingSession = await req.server.prisma.memberSession.findFirst({
      where: { memberId: member.id, deviceId },
    });

    if (existingSession) {
      await req.server.prisma.memberSession.update({
        where: { id: existingSession.id },
        data: { lastActiveAt: new Date(), ipAddress, userAgent }
      });
    } else {
      await req.server.prisma.memberSession.create({
        data: { memberId: member.id, deviceId, ipAddress, userAgent } as any
      });
    }

    // Check for concurrent devices in the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSessions = await req.server.prisma.memberSession.findMany({
      where: { memberId: member.id, lastActiveAt: { gt: oneHourAgo } },
      select: { deviceId: true }
    });

    const uniqueDevices = new Set(recentSessions.map(s => s.deviceId).filter(Boolean));
    if (uniqueDevices.size > 2) {
      // Log suspicious activity if more than 2 distinct devices are active in an hour
      await req.server.prisma.securityLog.create({
        data: {
          memberId: member.id,
          eventType: 'MULTIPLE_DEVICES',
          metadata: { deviceCount: uniqueDevices.size, devices: Array.from(uniqueDevices), ipAddress }
        } as any
      }).catch(() => {});
    }
  }

  return reply.send({ success: true, data: { memberId: member.id, status: (member as any).status }, error: null });
}

// ── POST /api/pub/workshops/livekit/webhook ────────────────────────────────────
// LiveKit server sends webhook events here (no auth required).
export async function livekitWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  let event: any;
  try {
    if (env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) {
      const { WebhookReceiver } = await import('livekit-server-sdk');
      const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      const authHeader = req.headers['authorization'] as string | undefined;
      event = receiver.receive(rawBody, authHeader ?? '');
    } else {
      event = JSON.parse(rawBody);
    }
  } catch {
    return reply.status(400).send({ success: false });
  }

  const roomName: string = event?.room?.name ?? '';
  const prefix = 'workshop-live-';
  if (!roomName.startsWith(prefix)) return reply.send({ success: true });

  const liveCallId = roomName.slice(prefix.length);

  if (event.event === 'egress_ended') {
    const fileResults: any[] = event?.egressInfo?.fileResults ?? [];
    const downloadUrl: string | undefined = fileResults[0]?.downloadUrl;
    if (downloadUrl && liveCallId) {
      await req.server.prisma.liveCall.update({
        where: { id: liveCallId },
        data: { recordingUrl: downloadUrl, egressId: null },
      }).catch(() => {});
    }
    if (liveCallId && env.ANTHROPIC_API_KEY) {
      const { generateLiveCallSummary } = await import('../workshops/controller.js');
      void generateLiveCallSummary(req.server.prisma, liveCallId);
    }
  }

  if (event.event === 'participant_joined') {
    const identity: string = event?.participant?.identity ?? '';
    if (identity && liveCallId) {
      // Resolve memberId from identity (members use their DB UUID as identity)
      const isHost = identity.startsWith('user_'); // Clerk admin ID
      const memberId = isHost ? null : identity;
      await req.server.prisma.liveCallAttendance.create({
        data: { liveCallId, memberId, identity, joinedAt: new Date() },
      }).catch(() => {});
    }
  }

  if (event.event === 'participant_left') {
    const identity: string = event?.participant?.identity ?? '';
    if (identity && liveCallId) {
      // Find the latest open attendance record for this identity
      const record = await req.server.prisma.liveCallAttendance.findFirst({
        where: { liveCallId, identity, leftAt: null },
        orderBy: { joinedAt: 'desc' },
      }).catch(() => null);
      if (record) {
        const durationSec = Math.round((Date.now() - record.joinedAt.getTime()) / 1000);
        await req.server.prisma.liveCallAttendance.update({
          where: { id: record.id },
          data: { leftAt: new Date(), durationSec },
        }).catch(() => {});
      }
    }
  }

  return reply.send({ success: true });
}

// ── Public home endpoints (SSR-safe — no auth required) ───────────────────────

export async function pubHomeHeroHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
  const redis = req.server.redis ?? null;
  const CACHE_KEY = 'home:hero:v2';
  const cached = await cacheGet<object>(redis, CACHE_KEY);
  if (cached) return reply.send({ success: true, data: cached, error: null });

  const [slides, siteConfig] = await Promise.all([
    req.server.prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    req.server.prisma.siteConfig.findFirst({ select: { heroAutoPlayIntervalMs: true } }),
  ]);

  const data = {
    slides: slides.map((s) => ({
      id: s.id, order: s.order, title: s.title, description: s.description ?? null,
      bgVideoUrl: s.bgVideoUrl ?? null, bgImageUrl: s.bgImageUrl ?? null,
      bgMobileImageUrl: (s as any).bgMobileImageUrl ?? null,
      bgMuteDefault: s.bgMuteDefault, ctaLabel: s.ctaLabel, ctaUrl: s.ctaUrl,
      ctaType: s.ctaType, badgeText: s.badgeText ?? null, isActive: s.isActive,
    })),
    autoPlayIntervalMs: siteConfig?.heroAutoPlayIntervalMs ?? 5000,
  };
  await cacheSet(redis, CACHE_KEY, data, 120);
  return reply.send({ success: true, data, error: null });
}

export async function pubHomeSectionsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  const { memberTier } = req.query as { memberTier?: string };
  const tierNum = parseInt(memberTier || '1', 10);

  const redis = req.server.redis ?? null;
  const CACHE_KEY = 'home:sections:v1';
  let sections = await cacheGet<any[]>(redis, CACHE_KEY);

  if (!sections) {
    sections = await req.server.prisma.contentSection.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
      include: {
        items: {
          where: { isVisible: true },
          orderBy: { order: 'asc' },
          include: {
            course: {
              select: {
                id: true, slug: true,
                _count: { select: { courseEpisodes: { where: { isVisible: true } } } },
                courseEpisodes: {
                  where: { isVisible: true }, orderBy: { order: 'asc' }, take: 20,
                  select: { id: true, order: true, title: true, thumbnailUrl: true, durationSeconds: true },
                },
              },
            },
            workshop: {
              select: {
                id: true, slug: true,
                challenges: {
                  orderBy: { order: 'asc' },
                  select: { episodes: { orderBy: { order: 'asc' }, take: 20, select: { id: true, order: true, title: true, durationSeconds: true } } },
                },
              },
            },
          },
        },
      },
    }) as any[];
    await cacheSet(redis, CACHE_KEY, sections, 300);
  }

  // Apply tier locks in memory
  const mapped = (sections as any[]).map((s: any) => {
    const isLocked = tierNum < s.requiredTier;
    return {
      id: s.id, title: s.title, slug: s.slug, order: s.order,
      isVisible: s.isVisible, requiredTier: s.requiredTier,
      isLocked, lockLabel: isLocked ? (s.lockBadgeText ?? null) : null,
      items: s.items.map((item: any) => {
        const workshopEpisodes = (item.workshop?.challenges ?? []).flatMap((ch: any) => ch.episodes ?? []);
        const resolvedPlayUrl = item.workshop
          ? `/workshop/${item.workshop.slug}`
          : item.course
          ? `/learning/${item.course.slug}`
          : (item.externalUrl ?? null);
        return {
          id: item.id, title: item.title, thumbnailUrl: item.thumbnailUrl ?? null,
          categoryTag: item.categoryTag ?? null, isLocked: isLocked || item.isLocked,
          lockBadgeText: item.lockBadgeText ?? null,
          episodeCount: item.workshop
            ? workshopEpisodes.length || null
            : item.course
            ? (item.course._count?.courseEpisodes ?? null)
            : null,
          playUrl: isLocked ? null : resolvedPlayUrl,
          contentType: item.contentType ?? null,
        };
      }),
    };
  });

  return reply.send({ success: true, data: { sections: mapped }, error: null });
}

// GET /api/pub/session-check
// Always returns 200 — never 401. Used by the login page to check if the user
// already has a valid session (avoids a 401 console error on every login page load).
export async function pubSessionCheckHandler(req: FastifyRequest, reply: FastifyReply) {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.match(/(?:^|;\s*)tbt_access=([^;]+)/);
  const token = match?.[1] ?? null;
  if (!token) return reply.send({ success: true, data: { loggedIn: false } });

  try {
    await (req.server as any).jwt.verify(token);
    return reply.send({ success: true, data: { loggedIn: true } });
  } catch {
    return reply.send({ success: true, data: { loggedIn: false } });
  }
}

// ── Certificate verification (public) ─────────────────────────────────────────

export async function pubCourseCertVerifyHandler(req: FastifyRequest, reply: FastifyReply) {
  const { certId } = req.params as { certId: string };

  let memberId: string;
  let courseId: string;
  try {
    const decoded = Buffer.from(certId, 'base64url').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon === -1) throw new Error('bad format');
    memberId = decoded.slice(0, colon);
    courseId = decoded.slice(colon + 1);
    if (!memberId || !courseId) throw new Error('empty parts');
  } catch {
    return reply.status(400).send({ success: false, data: null, error: 'Invalid certificate ID' });
  }

  const [enrollment, course, member] = await Promise.all([
    req.server.prisma.courseEnrollment.findUnique({
      where: { memberId_courseId: { memberId, courseId } },
      select: { completedAt: true },
    }),
    req.server.prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    req.server.prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } }),
  ]);

  if (!enrollment?.completedAt || !course || !member) {
    return reply.status(404).send({ success: false, data: null, error: 'Certificate not found' });
  }

  reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  return reply.send({
    success: true,
    data: {
      memberName: `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`,
      courseTitle: course.title,
      completedAt: (enrollment.completedAt as Date).toISOString(),
      issuedAt: (enrollment.completedAt as Date).toISOString(),
    },
    error: null,
  });
}

// ── Legal pages (Terms & Conditions / Privacy Policy) ─────────────────
// Public endpoint — no auth. Fetches from the legal_pages table (seeded
// at startup with placeholder bodies for 'terms' and 'privacy'). Slug
// must match one of the seeded rows; admin can edit body_markdown via
// direct DB access until a management UI is built.

export async function pubLegalPageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { slug } = req.params as { slug: string };
  reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=60');

  const rows = await req.server.prisma.$queryRawUnsafe<
    Array<{ slug: string; title: string; body_markdown: string; updated_at: Date }>
  >(
    'SELECT slug, title, body_markdown, updated_at FROM legal_pages WHERE slug = $1 LIMIT 1',
    slug,
  );

  if (rows.length === 0) {
    return reply.status(404).send({ success: false, data: null, error: 'Not found' });
  }

  const row = rows[0]!;
  return reply.send({
    success: true,
    data: {
      slug: row.slug,
      title: row.title,
      bodyMarkdown: row.body_markdown,
      updatedAt: row.updated_at.toISOString(),
    },
    error: null,
  });
}
