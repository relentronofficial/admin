// TBT coin purchases via Razorpay. Every order gets a coin_orders row at
// creation time that fixes who it belongs to, how many coins it buys and the
// amount charged; crediting reads those values from the row, never from the
// client. The row's UUID is the tbt_activity_log reference, so /verify and the
// webhook can both run for the same payment and the coins land exactly once.
// (The old flow wrote the Razorpay payment id — "pay_…" — into the UUID
// reference_id column, so every verify failed after the member had paid.)

/** The single package sold before admin-managed packages existed (unchanged). */
export const LEGACY_COIN_PACKAGE = { coins: 200, priceInr: 99 } as const;

export interface CoinPackage {
  id: string | null;
  label: string;
  coins: number;
  priceInr: number;
}

export function legacyCoinPackage(): CoinPackage {
  return { id: null, label: `${LEGACY_COIN_PACKAGE.coins} TBT Coins`, coins: LEGACY_COIN_PACKAGE.coins, priceInr: LEGACY_COIN_PACKAGE.priceInr };
}

export function mapCoinPackage(r: any): CoinPackage {
  return { id: r.id as string, label: r.label as string, coins: Number(r.coins), priceInr: Number(r.price_inr) };
}

export function rupeesToPaise(priceInr: number): number {
  return Math.round(priceInr * 100);
}

/**
 * Orders created before coin_orders existed have no row. They are accepted
 * only when Razorpay's own record of the order says it is this member's
 * legacy coin order at the legacy price.
 */
export function isLegacyCoinOrderFor(rzpOrder: any, memberId: string): boolean {
  return (
    !!rzpOrder &&
    rzpOrder.notes?.type === 'coin_purchase' &&
    rzpOrder.notes?.memberId === memberId &&
    Number(rzpOrder.amount) === rupeesToPaise(LEGACY_COIN_PACKAGE.priceInr) &&
    !rzpOrder.notes?.packageId
  );
}

export type CreditResult =
  | { status: 'credited'; coins: number; memberId: string }
  | { status: 'already_credited'; coins: number; memberId: string }
  | { status: 'not_found' }
  | { status: 'amount_mismatch' };

type Tx = {
  $queryRawUnsafe: <T = any>(query: string, ...values: any[]) => Promise<T>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>;
};
type Prisma = { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

/**
 * Credits a paid coin order once. `memberId` (from /verify) scopes the lookup
 * to the caller — another member's order behaves as not found. `amountPaise`
 * (from the webhook's payment entity) must match what the order charged.
 */
export async function creditCoinOrder(
  prisma: Prisma,
  input: { razorpayOrderId: string; razorpayPaymentId: string; memberId?: string; amountPaise?: number },
): Promise<CreditResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<any[]>(
      `SELECT id, member_id, coins, amount_paise, status FROM coin_orders WHERE razorpay_order_id = $1 FOR UPDATE`,
      input.razorpayOrderId,
    );
    const order = rows[0];
    if (!order || (input.memberId && order.member_id !== input.memberId)) return { status: 'not_found' } as const;
    if (input.amountPaise != null && Number(order.amount_paise) !== Number(input.amountPaise)) {
      return { status: 'amount_mismatch' } as const;
    }
    const coins = Number(order.coins);
    const memberId = order.member_id as string;
    if (order.status === 'paid') return { status: 'already_credited', coins, memberId } as const;

    const inserted = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
       VALUES ($1::uuid, $2, 'coin_purchase', $3::uuid, NOW()::DATE)
       ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      memberId, coins, order.id,
    );
    await tx.$executeRawUnsafe(
      `UPDATE coin_orders SET status = 'paid', razorpay_payment_id = $2, paid_at = NOW(), failure_reason = NULL
       WHERE id = $1::uuid`,
      order.id, input.razorpayPaymentId,
    );
    if (inserted.length === 0) return { status: 'already_credited', coins, memberId } as const;
    // Keep the cached total in step so the new balance shows without waiting for the recalc.
    await tx.$executeRawUnsafe(
      `UPDATE members SET total_points = COALESCE(total_points, 0) + $1 WHERE id = $2::uuid`,
      coins, memberId,
    );
    return { status: 'credited', coins, memberId } as const;
  });
}
