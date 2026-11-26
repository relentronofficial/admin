import { describe, expect, it } from 'vitest';
import { balanceAlertAction, checkProviderBalance, fetchProviderBalance } from './aiProviderBalance.js';

const KEY = 'sk-or-v1-test';

/** Fake fetch: `credits` / `key` are [status, body] per OpenRouter endpoint. */
const fakeFetch = (credits: [number, any], key: [number, any]) => async (url: string) => {
  const [status, body] = url.endsWith('/credits') ? credits : key;
  return { ok: status === 200, status, json: async () => body };
};

const keyBody = (limitRemaining: number | null) => ({ data: { limit: limitRemaining == null ? null : 50, limit_remaining: limitRemaining, usage_daily: 1.5, usage_monthly: 12 } });

describe('fetchProviderBalance', () => {
  it('uses the account balance when OpenRouter shares it', async () => {
    const b = await fetchProviderBalance(KEY, fakeFetch([200, { data: { total_credits: 100, total_usage: 92.5 } }], [200, keyBody(null)]));
    expect(b).toMatchObject({ remainingUsd: 7.5, source: 'account', usageDailyUsd: 1.5, usageMonthlyUsd: 12 });
  });

  it("falls back to the key's limit when the account balance needs a management key", async () => {
    const b = await fetchProviderBalance(KEY, fakeFetch([403, { error: { message: 'Only management keys' } }], [200, keyBody(4.25)]));
    expect(b).toMatchObject({ remainingUsd: 4.25, limitUsd: 50, source: 'key_limit' });
  });

  it('reports unknown (with a reason) when neither is available, and never throws', async () => {
    const noLimit = await fetchProviderBalance(KEY, fakeFetch([403, null], [200, keyBody(null)]));
    expect(noLimit).toMatchObject({ remainingUsd: null, source: 'unknown' });
    expect(noLimit.error).toMatch(/credit limit/);
    const down = await fetchProviderBalance(KEY, async () => { throw new Error('network'); });
    expect(down).toMatchObject({ remainingUsd: null, source: 'unknown', error: 'Could not reach OpenRouter.' });
    expect((await fetchProviderBalance(null)).error).toMatch(/not set/);
  });
});

describe('balanceAlertAction', () => {
  it('alerts once per drop below the threshold and re-arms above it', () => {
    expect(balanceAlertAction(4, 10, false)).toBe('alert');
    expect(balanceAlertAction(4, 10, true)).toBe('none');
    expect(balanceAlertAction(12, 10, true)).toBe('rearm');
    expect(balanceAlertAction(12, 10, false)).toBe('none');
    expect(balanceAlertAction(null, 10, false)).toBe('none');
  });
});

/** In-memory ai_credit_settings row plus admin_notifications. */
function fakeDb() {
  const row = { threshold: 10, checkedAt: null as number | null, alertedAt: null as number | null, last: null as number | null };
  const notifications: string[] = [];
  const db: any = {
    row,
    notifications,
    now: 1,
    async $queryRawUnsafe(sql: string, ...v: any[]) {
      if (sql.includes('SET balance_checked_at = NOW()')) {
        const [force, mins] = v;
        if (!force && row.checkedAt != null && db.now - row.checkedAt < mins * 60_000) return [];
        row.checkedAt = db.now;
        return [{ low_balance_alert_usd: row.threshold, balance_alerted_at: row.alertedAt }];
      }
      if (sql.includes('SET balance_alerted_at = NOW()')) {
        if (row.alertedAt != null) return [];
        row.alertedAt = db.now;
        return [{}];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    async $executeRawUnsafe(sql: string, ...v: any[]) {
      if (sql.includes('SET last_balance_usd')) { row.last = v[0]; return 1; }
      if (sql.includes('SET balance_alerted_at = NULL')) { row.alertedAt = null; return 1; }
      if (sql.includes('INSERT INTO admin_notifications')) { notifications.push(v[1]); return 1; }
      throw new Error(`unexpected exec: ${sql}`);
    },
  };
  return db;
}

describe('checkProviderBalance', () => {
  const at = (usd: number) => fakeFetch([200, { data: { total_credits: 100, total_usage: 100 - usd } }], [200, keyBody(null)]);

  it('checks at most every 10 minutes unless forced', async () => {
    const db = fakeDb();
    expect(await checkProviderBalance(db, { key: KEY, fetchImpl: at(50) })).toMatchObject({ remainingUsd: 50, alerted: false });
    db.now = 1 + 5 * 60_000;
    expect(await checkProviderBalance(db, { key: KEY, fetchImpl: at(50) })).toBeNull();
    expect(await checkProviderBalance(db, { key: KEY, fetchImpl: at(40), force: true })).toMatchObject({ remainingUsd: 40 });
    expect(db.row.last).toBe(40);
  });

  it('alerts admins once when the balance drops below the threshold, and again after it recovers', async () => {
    const db = fakeDb();
    const emitted: unknown[] = [];
    const io = { to: () => ({ emit: (_ev: string, p: unknown) => emitted.push(p) }) };
    await checkProviderBalance(db, { key: KEY, io, fetchImpl: at(8), force: true });
    await checkProviderBalance(db, { key: KEY, io, fetchImpl: at(6), force: true });
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]).toContain('US$8.00');
    expect(emitted).toEqual([{ remainingUsd: 8, thresholdUsd: 10, source: 'account' }]);
    await checkProviderBalance(db, { key: KEY, io, fetchImpl: at(30), force: true });
    expect(db.row.alertedAt).toBeNull();
    await checkProviderBalance(db, { key: KEY, io, fetchImpl: at(3), force: true });
    expect(db.notifications).toHaveLength(2);
  });

  it('does not alert when the balance is unknown', async () => {
    const db = fakeDb();
    const r = await checkProviderBalance(db, { key: KEY, fetchImpl: fakeFetch([403, null], [200, keyBody(null)]), force: true });
    expect(r).toMatchObject({ remainingUsd: null, source: 'unknown', alerted: false });
    expect(db.notifications).toHaveLength(0);
  });
});
