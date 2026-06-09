import type { Redis } from 'ioredis';

type RedisLike = Pick<Redis, 'get' | 'set' | 'del' | 'keys'>;

export async function cacheGet<T>(redis: RedisLike | null, key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  redis: RedisLike | null,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // non-fatal
  }
}

/** Returns true if the key was newly set (i.e. caller should proceed), false if already locked. */
export async function cacheNxSet(
  redis: RedisLike | null,
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  if (!redis) return true; // no redis → always allow
  try {
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return true;
  }
}

export async function invalidateCache(redis: RedisLike | null, pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) await redis.del(key);
    }
  } catch {
    // non-fatal
  }
}
