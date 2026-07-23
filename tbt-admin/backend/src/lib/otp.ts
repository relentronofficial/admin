import type { RedisLike } from './cache.js';

const OTP_TTL = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

interface OtpRecord { otp: string; attempts: number; }

/**
 * Redis write with an in-memory fallback.
 *
 * Upstash Redis has intermittent ETIMEDOUT spikes (see Cloud Run logs
 * — Redis blips regularly since the initial deploy). Without this
 * fallback, a single Redis timeout during login makes the entire
 * user-auth flow 500 — mobile users see "Something went wrong. Please
 * try again." and cannot sign in until Upstash recovers.
 *
 * The in-memory store lives on the Cloud Run instance for the OTP's
 * 5-minute TTL. Because Cloud Run keeps instances warm and prefers
 * routing follow-up requests to the same container, the same instance
 * that stored the OTP is very likely to serve the verify-otp POST
 * that lands 30-60 seconds later — the OTP survives even without
 * Redis being reachable. Cross-instance fallback is intentionally
 * omitted: on the rare cold-start-into-new-instance case, the user
 * just taps "Resend" and gets a fresh OTP.
 */
export async function storeOtp(redis: RedisLike | null, phone: string, otp: string): Promise<void> {
  const key = `otp:${phone}`;
  const value = JSON.stringify({ otp, attempts: 0 } satisfies OtpRecord);
  const expiresAt = Date.now() + OTP_TTL * 1000;
  // Always mirror to in-memory so a verify that hits Redis timeout
  // still finds the OTP locally.
  _devStore.set(key, { value, expiresAt });
  if (redis) {
    try {
      await redis.set(key, value, 'EX', OTP_TTL);
    } catch (err) {
      console.warn('[otp.storeOtp] Redis write failed, using in-memory fallback:', err);
    }
  }
}

export async function verifyAndConsumeOtp(
  redis: RedisLike | null,
  phone: string,
  otp: string,
): Promise<'ok' | 'invalid' | 'expired' | 'max_attempts'> {
  const key = `otp:${phone}`;

  let raw: string | null = null;
  if (redis) {
    try {
      raw = await redis.get(key);
    } catch (err) {
      console.warn('[otp.verifyAndConsumeOtp] Redis read failed, falling back to in-memory:', err);
    }
  }
  if (raw == null) {
    const entry = _devStore.get(key);
    if (entry && Date.now() < entry.expiresAt) raw = entry.value;
  }

  if (!raw) return 'expired';

  let record: OtpRecord;
  try { record = JSON.parse(raw); } catch { return 'expired'; }

  if (record.attempts >= MAX_ATTEMPTS) {
    await _deleteBoth(redis, key);
    return 'max_attempts';
  }

  if (record.otp !== otp) {
    const updated = JSON.stringify({ ...record, attempts: record.attempts + 1 });
    const existing = _devStore.get(key);
    if (existing) _devStore.set(key, { value: updated, expiresAt: existing.expiresAt });
    if (redis) {
      try {
        await redis.set(key, updated, 'EX', OTP_TTL);
      } catch (err) {
        console.warn('[otp.verifyAndConsumeOtp] Redis write failed on attempt++, in-memory only:', err);
      }
    }
    return 'invalid';
  }

  // Valid — consume
  await _deleteBoth(redis, key);
  return 'ok';
}

async function _deleteBoth(redis: RedisLike | null, key: string) {
  _devStore.delete(key);
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      console.warn('[otp._deleteBoth] Redis del failed (in-memory already cleared):', err);
    }
  }
}

// In-process fallback: (a) primary store when Redis isn't configured,
// (b) resilience layer when Redis is configured but times out mid-flow.
const _devStore = new Map<string, { value: string; expiresAt: number }>();
