import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '@clerk/backend';
import { env } from '../../config/env.js';

export async function pubSiteConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  let config = await req.server.prisma.siteConfig.findFirst();
  if (!config) {
    config = await req.server.prisma.siteConfig.create({
      data: { siteName: 'TBT', footerText: '© TBT' },
    });
  }

  // Shape the response exactly as specified in TBT_PRD_Dynamic.md §2
  return reply.send({
    success: true,
    data: {
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
    },
    error: null,
  });
}

export async function pubNavItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  const [items, config] = await Promise.all([
    req.server.prisma.navItem.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
    }),
    req.server.prisma.siteConfig.findFirst(),
  ]);

  return reply.send({
    success: true,
    data: {
      items,
      rightIcons: {
        notifications: config?.navShowNotifications ?? true,
        messages: config?.navShowMessages ?? true,
        profile: config?.navShowProfile ?? true,
      },
    },
    error: null,
  });
}

export async function pubUiStringsHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  let strings = await req.server.prisma.uiStrings.findFirst();
  if (!strings) {
    strings = await req.server.prisma.uiStrings.create({ data: {} });
  }
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
