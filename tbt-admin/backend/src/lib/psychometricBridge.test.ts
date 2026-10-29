import { describe, expect, it, vi } from 'vitest';
import {
  LOCK_KEY,
  TOKEN_KEY,
  canUsePsychometric,
  createPsychometricSession,
  resolveUpstreamPath,
  type BridgeStore,
} from './psychometricBridge.js';

/** In-memory Redis with the EX / NX semantics the session relies on. */
function memoryStore(): BridgeStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(k: string) { return data.get(k) ?? null; },
    async set(k: string, v: string, ...args: unknown[]) {
      if (args.includes('NX') && data.has(k)) return null;
      data.set(k, v);
      return 'OK';
    },
    async del(k: string) { return data.delete(k) ? 1 : 0; },
  };
}

describe('canUsePsychometric', () => {
  it('allows only admin and super_admin', () => {
    expect(canUsePsychometric('super_admin')).toBe(true);
    expect(canUsePsychometric('admin')).toBe(true);
    for (const r of ['mentor', 'moderator', 'account_manager', '', null, undefined]) expect(canUsePsychometric(r)).toBe(false);
  });
});

describe('resolveUpstreamPath', () => {
  it.each([
    '/admin/dashboard',
    '/admin/users',
    '/admin/users/generate-candidate-id',
    '/admin/questions/64f1c2/',
    '/admin/questions/reorder',
    '/admin/results/user/64f1c2',
    '/admin/export/pdf',
    '/admin/tts/questions/64f1c2/preview-explanation',
    '/admin/notifications/unread-count',
    '/admin/retest-requests/64f1c2/approve',
  ])('allows %s', (p) => {
    const path = p.replace(/\/$/, '');
    expect(resolveUpstreamPath(path)).toBe(path);
  });

  it.each([
    '/admin/login',
    '/admin/logout',
    '/admin/change-password',
    '/admin/profile',
    '/admin',
    '/admin/',
    '/user/login',
    '/assessment/start',
    '/admin/users/../login',
    '/admin/users/..',
    '/admin/users%2F..%2Flogin',
    '/admin/users/a.b',
    '//evil.example/admin/users',
    '/admin/unknown-section',
  ])('rejects %s', (p) => {
    expect(resolveUpstreamPath(p)).toBeNull();
  });
});

describe('createPsychometricSession', () => {
  it('signs in once, shares the token in the store and reuses it', async () => {
    const store = memoryStore();
    const login = vi.fn().mockResolvedValue('t1');
    const s = createPsychometricSession({ store, login });
    expect(await s.getToken()).toBe('t1');
    expect(await s.getToken()).toBe('t1');
    expect(login).toHaveBeenCalledTimes(1);
    expect(store.data.get(TOKEN_KEY)).toBe('t1');
    expect(store.data.has(LOCK_KEY)).toBe(false);
  });

  it("uses another instance's shared token instead of signing in", async () => {
    const store = memoryStore();
    store.data.set(TOKEN_KEY, 'shared');
    const login = vi.fn();
    const s = createPsychometricSession({ store, login });
    expect(await s.getToken()).toBe('shared');
    expect(login).not.toHaveBeenCalled();
  });

  it('after a rejected token, picks up a newer shared token without signing in again', async () => {
    const store = memoryStore();
    store.data.set(TOKEN_KEY, 'old');
    const login = vi.fn();
    const s = createPsychometricSession({ store, login });
    await s.getToken();
    store.data.set(TOKEN_KEY, 'new'); // another instance refreshed
    expect(await s.refresh('old')).toBe('new');
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in again when the shared token is the rejected one', async () => {
    const store = memoryStore();
    store.data.set(TOKEN_KEY, 'old');
    const login = vi.fn().mockResolvedValue('fresh');
    const s = createPsychometricSession({ store, login });
    await s.getToken();
    expect(await s.refresh('old')).toBe('fresh');
    expect(login).toHaveBeenCalledTimes(1);
    expect(store.data.get(TOKEN_KEY)).toBe('fresh');
  });

  it('concurrent refreshes in one instance sign in only once', async () => {
    const store = memoryStore();
    let resolve!: (t: string) => void;
    const login = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const s = createPsychometricSession({ store, login });
    const a = s.refresh(null);
    const b = s.refresh(null);
    await new Promise((r) => setTimeout(r, 0));
    resolve('t1');
    expect(await Promise.all([a, b])).toEqual(['t1', 't1']);
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('waits for the instance holding the lock instead of signing in itself', async () => {
    const store = memoryStore();
    store.data.set(LOCK_KEY, '1'); // another instance is signing in
    const login = vi.fn();
    let ticks = 0;
    const sleep = async () => { if (++ticks === 2) store.data.set(TOKEN_KEY, 'theirs'); };
    const s = createPsychometricSession({ store, login, sleep });
    expect(await s.refresh(null)).toBe('theirs');
    expect(login).not.toHaveBeenCalled();
  });

  it('gives up (without signing in) if the lock holder never produces a token', async () => {
    const store = memoryStore();
    store.data.set(LOCK_KEY, '1');
    const login = vi.fn();
    const s = createPsychometricSession({ store, login, sleep: async () => {}, waitAttempts: 3 });
    await expect(s.refresh(null)).rejects.toThrow(/taking too long/);
    expect(login).not.toHaveBeenCalled();
  });

  it('releases the lock when sign-in fails', async () => {
    const store = memoryStore();
    const s = createPsychometricSession({ store, login: () => Promise.reject(new Error('bad credentials')) });
    await expect(s.getToken()).rejects.toThrow('bad credentials');
    expect(store.data.has(LOCK_KEY)).toBe(false);
  });

  it('works without Redis, and when Redis errors', async () => {
    const noStore = createPsychometricSession({ store: null, login: vi.fn().mockResolvedValue('mem') });
    expect(await noStore.getToken()).toBe('mem');

    const broken: BridgeStore = {
      get: () => Promise.reject(new Error('down')),
      set: () => Promise.reject(new Error('down')),
      del: () => Promise.reject(new Error('down')),
    };
    const s = createPsychometricSession({ store: broken, login: vi.fn().mockResolvedValue('direct') });
    expect(await s.getToken()).toBe('direct');
  });
});
