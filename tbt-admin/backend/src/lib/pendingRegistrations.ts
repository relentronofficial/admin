// I/O for pending self-registrations (raw SQL — pending_registrations has no
// Prisma model; created by the startup DDL in plugins/prisma.ts). Rules live in
// registrationLogic.ts.

import { PENDING_REGISTRATION_TTL_MINUTES } from './registrationLogic.js';

type Prisma = any;

export interface PendingRegistrationPayload {
  firstName: string;
  lastName: string | null;
  email: string;
  passwordHash: string;
  businessName: string | null;
  city: string | null;
  state: string | null;
  productServiceType: string | null;
}

export interface PendingRegistration {
  phoneE164: string;
  email: string;
  payload: PendingRegistrationPayload;
  claimMemberId: string | null;
}

/**
 * Save (or replace) the pending registration for a phone. Expired rows, and
 * any other pending row for the same email under a different phone, are
 * dropped first: the latest attempt wins, so a mistyped number never blocks a
 * corrected retry.
 */
export async function savePendingRegistration(prisma: Prisma, reg: PendingRegistration): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM pending_registrations
     WHERE expires_at < NOW() OR (lower(email) = lower($1) AND phone_e164 <> $2)`,
    reg.email, reg.phoneE164,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO pending_registrations (phone_e164, email, payload, claim_member_id, created_at, expires_at)
     VALUES ($1, $2, $3::jsonb, $4::uuid, NOW(), NOW() + make_interval(mins => $5))
     ON CONFLICT (phone_e164) DO UPDATE
       SET email = EXCLUDED.email, payload = EXCLUDED.payload, claim_member_id = EXCLUDED.claim_member_id,
           created_at = NOW(), expires_at = EXCLUDED.expires_at`,
    reg.phoneE164, reg.email, JSON.stringify(reg.payload), reg.claimMemberId, PENDING_REGISTRATION_TTL_MINUTES,
  );
}

/** The unexpired pending registration for an E.164 phone, or null. */
export async function findPendingRegistration(prisma: Prisma, phoneE164: string): Promise<PendingRegistration | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT phone_e164 AS "phoneE164", email, payload, claim_member_id::text AS "claimMemberId"
     FROM pending_registrations WHERE phone_e164 = $1 AND expires_at > NOW() LIMIT 1`,
    phoneE164,
  )) as any[];
  const r = rows[0];
  if (!r) return null;
  const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
  return { phoneE164: r.phoneE164, email: r.email, payload, claimMemberId: r.claimMemberId ?? null };
}

export async function deletePendingRegistration(prisma: Prisma, phoneE164: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM pending_registrations WHERE phone_e164 = $1`, phoneE164);
}
