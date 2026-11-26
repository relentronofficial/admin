// AI provider (OpenRouter) balance watch.
//
// Members pay us in AI credits; we pay OpenRouter from one prepaid account.
// If that account runs dry every assistant (member and admin) stops working, so
// admins get an alert when the balance drops below ai_credit_settings.low_balance_alert_usd.
//
// Where the number comes from:
//   • GET /api/v1/credits  — account balance; OpenRouter only answers it for a
//     management key, so with a normal key it returns 403 and we fall back to
//   • GET /api/v1/key      — limit_remaining of the key's own spending limit
//     (null when the key has no limit; then the balance is unknown).
//
// There is no timer: the check runs after assistant answers (spending is the only
// thing that lowers the balance) and when an admin opens the AI Credits page.
// A claim on ai_credit_settings.balance_checked_at limits it to one check per
// 10 minutes across all instances, and balance_alerted_at makes each drop below
// the threshold alert once; going back above re-arms it.

export type BalanceSource = 'account' | 'key_limit' | 'unknown';

export interface ProviderBalance {
  remainingUsd: number | null;
  limitUsd: number | null;
  usageDailyUsd: number | null;
  usageMonthlyUsd: number | null;
  source: BalanceSource;
  error?: string;
}

export const BALANCE_CHECK_MINUTES = 10;

type FetchLike = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function getJson(fetchImpl: FetchLike, url: string, key: string): Promise<{ status: number; body: any }> {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8_000) });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status, body };
}

/** Reads the balance from OpenRouter. Never throws. */
export async function fetchProviderBalance(key: string | null, fetchImpl: FetchLike = fetch as any): Promise<ProviderBalance> {
  const empty: ProviderBalance = { remainingUsd: null, limitUsd: null, usageDailyUsd: null, usageMonthlyUsd: null, source: 'unknown' };
  if (!key) return { ...empty, error: 'The OpenRouter key is not set.' };
  let keyInfo: any = null;
  try {
    const k = await getJson(fetchImpl, 'https://openrouter.ai/api/v1/key', key);
    if (k.status === 200) keyInfo = k.body?.data ?? null;
  } catch { /* fall through */ }
  const base: ProviderBalance = {
    ...empty,
    limitUsd: num(keyInfo?.limit),
    usageDailyUsd: num(keyInfo?.usage_daily),
    usageMonthlyUsd: num(keyInfo?.usage_monthly),
  };
  try {
    const c = await getJson(fetchImpl, 'https://openrouter.ai/api/v1/credits', key);
    const total = num(c.body?.data?.total_credits);
    const used = num(c.body?.data?.total_usage);
    if (c.status === 200 && total != null && used != null) return { ...base, remainingUsd: total - used, source: 'account' };
  } catch { /* fall through */ }
  const left = num(keyInfo?.limit_remaining);
  if (left != null) return { ...base, remainingUsd: left, source: 'key_limit' };
  return {
    ...base,
    error: keyInfo
      ? 'OpenRouter does not share the account balance with this key. Set a credit limit on the key in OpenRouter to track it here.'
      : 'Could not reach OpenRouter.',
  };
}

/** What a fresh balance reading means for the alert. */
export function balanceAlertAction(remainingUsd: number | null, thresholdUsd: number, alreadyAlerted: boolean): 'alert' | 'rearm' | 'none' {
  if (remainingUsd == null) return 'none';
  if (remainingUsd < thresholdUsd) return alreadyAlerted ? 'none' : 'alert';
  return alreadyAlerted ? 'rearm' : 'none';
}

type Db = {
  $queryRawUnsafe: <T = any>(query: string, ...values: any[]) => Promise<T>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>;
};
type Io = { to: (room: string) => { emit: (ev: string, payload: unknown) => void } } | null | undefined;
type Log = { warn: (obj: unknown, msg?: string) => void };

export interface BalanceCheck extends ProviderBalance {
  thresholdUsd: number;
  checkedAt: string;
  alerted: boolean;
}

/**
 * Checks the balance (at most once per BALANCE_CHECK_MINUTES unless `force`)
 * and alerts admins on a drop below the threshold. Returns null when throttled.
 */
export async function checkProviderBalance(
  prisma: Db,
  opts: { key: string | null; io?: Io; log?: Log; force?: boolean; fetchImpl?: FetchLike },
): Promise<BalanceCheck | null> {
  const claim = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE ai_credit_settings SET balance_checked_at = NOW()
      WHERE id = TRUE AND ($1::boolean OR balance_checked_at IS NULL OR balance_checked_at < NOW() - make_interval(mins => $2::int))
      RETURNING low_balance_alert_usd, balance_alerted_at, balance_checked_at`,
    !!opts.force, BALANCE_CHECK_MINUTES,
  );
  if (!claim.length) return null;
  const thresholdUsd = Number(claim[0].low_balance_alert_usd ?? 10);
  const b = await fetchProviderBalance(opts.key, opts.fetchImpl);
  await prisma.$executeRawUnsafe(
    `UPDATE ai_credit_settings SET last_balance_usd = $1, last_balance_source = $2 WHERE id = TRUE`,
    b.remainingUsd, b.source,
  );
  const action = balanceAlertAction(b.remainingUsd, thresholdUsd, !!claim[0].balance_alerted_at);
  let alerted = !!claim[0].balance_alerted_at;
  if (action === 'rearm') {
    await prisma.$executeRawUnsafe(`UPDATE ai_credit_settings SET balance_alerted_at = NULL WHERE id = TRUE`);
    alerted = false;
  } else if (action === 'alert') {
    // Only the instance that sets the flag sends the alert.
    const won = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE ai_credit_settings SET balance_alerted_at = NOW() WHERE id = TRUE AND balance_alerted_at IS NULL RETURNING 1`,
    );
    alerted = true;
    if (won.length) {
      const payload = { remainingUsd: b.remainingUsd, thresholdUsd, source: b.source };
      try {
        opts.io?.to('admin').emit('admin:ai_provider_low_balance', payload);
        await prisma.$executeRawUnsafe(
          `INSERT INTO admin_notifications (title, body, type, metadata) VALUES ($1, $2, 'ai_provider_low_balance', $3::jsonb)`,
          'AI provider balance is low',
          `OpenRouter has US$${(b.remainingUsd ?? 0).toFixed(2)} left (alert below US$${thresholdUsd.toFixed(2)}). Top it up so TBT Assistant keeps answering.`,
          JSON.stringify(payload),
        );
      } catch (err) {
        opts.log?.warn({ err }, '[ai-balance] alert failed');
      }
    }
  }
  return { ...b, thresholdUsd, checkedAt: new Date().toISOString(), alerted };
}

/** Fire-and-forget check after an assistant answer. */
export function checkProviderBalanceSoon(prisma: Db, opts: { key: string | null; io?: Io; log?: Log }): void {
  void checkProviderBalance(prisma, opts).catch((err) => opts.log?.warn({ err }, '[ai-balance] check failed'));
}
