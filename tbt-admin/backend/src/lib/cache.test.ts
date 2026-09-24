import { describe, it, expect, vi } from 'vitest';
import { cacheGet, cacheSet, type RedisLike } from './cache.js';

describe('cacheSet', () => {
  // Regression: a Prisma row with a BigInt column made JSON.stringify throw inside
  // cacheSet; callers use `void cacheSet(...)`, so the rejection was unhandled and
  // crash-looped the production backend (ads eligibleHandler, 351a8dd).
  it('resolves (never rejects) and skips caching when the value is not serializable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const redis: RedisLike = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 0),
      keys: vi.fn(async () => []),
    };

    await expect(cacheSet(redis, 'test:bigint', [{ count: BigInt(5) }], 30)).resolves.toBeUndefined();

    expect(redis.set).not.toHaveBeenCalled();
    expect(await cacheGet(null, 'test:bigint')).toBeNull();
    warn.mockRestore();
  });

  it('still caches serializable values in L1 and Redis', async () => {
    const redis: RedisLike = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 0),
      keys: vi.fn(async () => []),
    };

    await cacheSet(redis, 'test:ok', { count: 5 }, 30);

    expect(redis.set).toHaveBeenCalledWith('test:ok', '{"count":5}', 'EX', 30);
    expect(await cacheGet(null, 'test:ok')).toEqual({ count: 5 });
  });
});
