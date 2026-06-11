import type { RedisLike } from './cache.js';

const OTP_TTL = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

interface OtpRecord { otp: string; attempts: number; }

export async function storeOtp(redis: RedisLike | null, phone: string, otp: string): Promise<void> {
  const key = `otp:${phone}`;
  const value = JSON.stringify({ otp, attempts: 0 } satisfies OtpRecord);
  if (redis) {
    await redis.set(key, value, 'EX', OTP_TTL);
  } else {
    _devStore.set(key, { value, expiresAt: Date.now() + OTP_TTL * 1000 });
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
    raw = await redis.get(key);
  } else {
    const entry = _devStore.get(key);
    if (entry && Date.now() < entry.expiresAt) raw = entry.value;
  }

  if (!raw) return 'expired';

  let record: OtpRecord;
  try { record = JSON.parse(raw); } catch { return 'expired'; }

  if (record.attempts >= MAX_ATTEMPTS) {
    if (redis) await redis.del(key); else _devStore.delete(key);
    return 'max_attempts';
  }

  if (record.otp !== otp) {
    const updated = JSON.stringify({ ...record, attempts: record.attempts + 1 });
    if (redis) {
      await redis.set(key, updated, 'EX', OTP_TTL);
    } else {
      const existing = _devStore.get(key);
      if (existing) _devStore.set(key, { value: updated, expiresAt: existing.expiresAt });
    }
    return 'invalid';
  }

  // Valid — consume
  if (redis) await redis.del(key); else _devStore.delete(key);
  return 'ok';
}

// In-process fallback for dev environments without Redis
const _devStore = new Map<string, { value: string; expiresAt: number }>();
