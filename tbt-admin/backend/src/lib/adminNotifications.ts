import type { PrismaClient } from '@prisma/client';

export async function createAdminNotification(
  prisma: PrismaClient,
  payload: { title: string; body: string; type?: string; metadata?: Record<string, unknown> },
) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO admin_notifications (title, body, type, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      payload.title,
      payload.body,
      payload.type ?? 'info',
      payload.metadata ? JSON.stringify(payload.metadata) : null,
    );
  } catch (err) {
    // Non-fatal — socket event still fires even if DB write fails
    console.warn('[adminNotif] DB write failed:', err);
  }
}
