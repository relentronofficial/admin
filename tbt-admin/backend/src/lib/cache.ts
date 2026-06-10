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

// L1_TTL: how long in-process cache holds a value when Redis is also available.
// 60s ensures L1 outlasts the entire burst test window without a second Redis fetch.
const L1_TTL = 60;

// Per-instance inflight map: prevents N simultaneous VUs from all issuing a Redis GET
// for the same key when L1 is cold. Only 1 Redis call fires; the rest await it.
// Critical at 1 000-VU burst — without this, 100 VUs × 10 instances = 1 000 concurrent
// Redis GETs per key, which exhausts the Upstash free-tier RPS limit.
const _inflightGets = new Map<string, Promise<string | null>>();

function redisGetCoalesced(redis: RedisLike, key: string): Promise<string | null> {
  let p = _inflightGets.get(key);
  if (!p) {
    p = redis.get(key).then(
      (v) => { _inflightGets.delete(key); return v; },
      () => { _inflightGets.delete(key); return null; },
    );
    _inflightGets.set(key, p);
  }
  return p;
}

export async function cacheGet<T>(redis: RedisLike | null, key: string): Promise<T | null> {
  // L1: in-process memCache — microseconds, no network hop.
  // Always check first regardless of whether Redis is available.
  const l1 = memGet<T>(key);
  if (l1 !== null) return l1;

  if (redis) {
    try {
      const raw = await redisGetCoalesced(redis, key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        // Backfill L1 so subsequent requests within this instance skip Redis.
        memSet(key, parsed, L1_TTL);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function cacheSet(
  redis: RedisLike | null,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  // Always populate L1 (capped at L1_TTL so per-instance data doesn't go stale).
  memSet(key, value, Math.min(ttlSeconds, L1_TTL));

  if (redis) {
    try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch {}
    return;
  }
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
