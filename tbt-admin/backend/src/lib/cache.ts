export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

// In-process fallback cache used when Redis is unavailable.
// Shared within a single Cloud Run instance; each instance caches independently.
const memCache = new Map<string, { value: string; expiresAt: number }>();
const memNxKeys = new Map<string, number>(); // key → expiresAt

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { memCache.delete(key); return null; }
  try { return JSON.parse(entry.value) as T; } catch { return null; }
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  memCache.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheGet<T>(redis: RedisLike | null, key: string): Promise<T | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  return memGet<T>(key);
}

export async function cacheSet(
  redis: RedisLike | null,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (redis) {
    try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch {}
    return;
  }
  memSet(key, value, ttlSeconds);
}

/** Returns true if the key was newly set (caller should proceed), false if already locked. */
export async function cacheNxSet(
  redis: RedisLike | null,
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  if (redis) {
    try {
      const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return true;
    }
  }
  // In-process NX: works within a single instance
  const existing = memNxKeys.get(key);
  if (existing && existing > Date.now()) return false;
  memNxKeys.set(key, Date.now() + ttlSeconds * 1000);
  return true;
}

export async function invalidateCache(redis: RedisLike | null, pattern: string): Promise<void> {
  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) await redis.del(key);
      }
    } catch {}
    return;
  }
  // In-process: delete keys matching the prefix (pattern is a prefix glob like "pub:*")
  const prefix = pattern.replace(/\*$/, '');
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}
