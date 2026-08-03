import type { RedisLike } from './cache.js';

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * Sliding-window rate limit via Redis INCR + EXPIRE. Increments a
 * counter keyed by `key`; TTL is set on the first hit and inherited
 * for the rest of the window. Returns `ok: false` once `count > max`.
 *
 * Fails OPEN on any Redis error — we'd rather serve a genuine user
 * during an Upstash blip than lock everyone out. Ops sees the
 * fallback via a console.warn.
 *
 * Not intended for high-precision windows (e.g. token-bucket for
 * billing). Precision here is "roughly correct across a window";
 * skew of a couple seconds is fine for abuse-prevention.
 */
export async function checkRateLimit(
  redis: RedisLike | null,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!redis) return { ok: true, remaining: max };
  try {
    const anyRedis = redis as unknown as {
      incr?: (key: string) => Promise<number>;
      expire?: (key: string, seconds: number) => Promise<number>;
    };
    if (typeof anyRedis.incr !== 'function') {
      // In-memory RedisLike fallback (unit tests, no-redis dev) —
      // don't attempt rate limiting.
      return { ok: true, remaining: max };
    }
    const count = await anyRedis.incr(key);
    if (count === 1 && typeof anyRedis.expire === 'function') {
      await anyRedis.expire(key, windowSeconds);
    }
    if (count > max) {
      return { ok: false, retryAfterSeconds: windowSeconds };
    }
    return { ok: true, remaining: Math.max(0, max - count) };
  } catch (err) {
    console.warn(`[checkRateLimit] redis error key=${key}, failing open`, err);
    return { ok: true, remaining: max };
  }
}
