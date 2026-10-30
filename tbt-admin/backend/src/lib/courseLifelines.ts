import { debitCoins } from './supportCallData.js';

export interface CourseLifelineState {
  freeTotal: number;
  freeUsed: number;
  purchasedTotal: number;
  purchasedUsed: number;
  remaining: number;
  coinCost: number;
}

type Db = { $queryRawUnsafe: <T = any>(q: string, ...v: any[]) => Promise<T> };
type TxDb = Db & { $executeRawUnsafe: (q: string, ...v: any[]) => Promise<number> };

export const FREE_LIFELINES_PER_COURSE = 5;

async function loadCoinCost(db: Db): Promise<number> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT lifeline_coin_cost FROM site_configs LIMIT 1`,
  );
  return Math.max(1, Number(rows[0]?.lifeline_coin_cost ?? 50));
}

export async function getCourseLifelines(db: Db, memberId: string, courseId: string): Promise<CourseLifelineState> {
  const [rows, coinCost] = await Promise.all([
    db.$queryRawUnsafe<any[]>(
      `SELECT free_used, purchased_total, purchased_used
       FROM member_course_lifelines
       WHERE member_id = $1::uuid AND course_id = $2::uuid`,
      memberId, courseId,
    ),
    loadCoinCost(db),
  ]);
  const row = rows[0];
  const freeUsed = Math.max(0, Number(row?.free_used ?? 0));
  const purchasedTotal = Math.max(0, Number(row?.purchased_total ?? 0));
  const purchasedUsed = Math.max(0, Number(row?.purchased_used ?? 0));
  const remaining = Math.max(0, (FREE_LIFELINES_PER_COURSE - freeUsed) + (purchasedTotal - purchasedUsed));
  return { freeTotal: FREE_LIFELINES_PER_COURSE, freeUsed, purchasedTotal, purchasedUsed, remaining, coinCost };
}

// Consume 1 lifeline atomically (free first, then purchased).
// Throws with { code: 'exhausted' } if none remain.
export async function consumeCourseLifeline(db: TxDb, memberId: string, courseId: string): Promise<CourseLifelineState> {
  const current = await getCourseLifelines(db, memberId, courseId);
  if (current.remaining <= 0) {
    const err: any = new Error('No lifelines remaining');
    err.code = 'exhausted';
    throw err;
  }

  const freeAvailable = FREE_LIFELINES_PER_COURSE - current.freeUsed;
  if (freeAvailable > 0) {
    // Consume 1 free lifeline — WHERE guard prevents pushing past the cap
    const rows = await db.$queryRawUnsafe<any[]>(
      `INSERT INTO member_course_lifelines (member_id, course_id, free_used, updated_at)
       VALUES ($1::uuid, $2::uuid, 1, NOW())
       ON CONFLICT ON CONSTRAINT uq_mcl_member_course DO UPDATE
         SET free_used  = member_course_lifelines.free_used + 1,
             updated_at = NOW()
       WHERE member_course_lifelines.free_used < $3
       RETURNING free_used, purchased_total, purchased_used`,
      memberId, courseId, FREE_LIFELINES_PER_COURSE,
    );
    if (!rows[0]) {
      const err: any = new Error('No lifelines remaining');
      err.code = 'exhausted';
      throw err;
    }
    const freeUsed = Number(rows[0].free_used);
    const purchasedTotal = Number(rows[0].purchased_total ?? 0);
    const purchasedUsed = Number(rows[0].purchased_used ?? 0);
    return {
      freeTotal: FREE_LIFELINES_PER_COURSE, freeUsed, purchasedTotal, purchasedUsed,
      remaining: Math.max(0, (FREE_LIFELINES_PER_COURSE - freeUsed) + (purchasedTotal - purchasedUsed)),
      coinCost: current.coinCost,
    };
  }

  // Free exhausted — consume 1 purchased slot
  const rows = await db.$queryRawUnsafe<any[]>(
    `UPDATE member_course_lifelines
     SET purchased_used = purchased_used + 1, updated_at = NOW()
     WHERE member_id = $1::uuid AND course_id = $2::uuid
       AND purchased_used < purchased_total
     RETURNING free_used, purchased_total, purchased_used`,
    memberId, courseId,
  );
  if (!rows[0]) {
    const err: any = new Error('No lifelines remaining');
    err.code = 'exhausted';
    throw err;
  }
  const freeUsed = Number(rows[0].free_used);
  const purchasedTotal = Number(rows[0].purchased_total);
  const purchasedUsed = Number(rows[0].purchased_used);
  return {
    freeTotal: FREE_LIFELINES_PER_COURSE, freeUsed, purchasedTotal, purchasedUsed,
    remaining: Math.max(0, (FREE_LIFELINES_PER_COURSE - freeUsed) + (purchasedTotal - purchasedUsed)),
    coinCost: current.coinCost,
  };
}

export async function purchaseCourseLifelines(
  tx: TxDb,
  memberId: string,
  courseId: string,
  quantity: number,
  expectedCoinCostEach: number,
): Promise<{ purchased: number; coinsSpent: number; newBalance: number; lifelines: CourseLifelineState }> {
  const coinCostEach = await loadCoinCost(tx);
  if (expectedCoinCostEach !== coinCostEach) {
    throw Object.assign(new Error('Coin price has changed — please refresh and try again'), { code: 'price_changed' });
  }
  const totalCost = coinCostEach * quantity;
  const debit = await debitCoins(tx, memberId, totalCost, 'course_lifeline_purchase');
  if (!debit.ok) {
    throw Object.assign(new Error('Insufficient TBT coins'), { code: 'insufficient_coins' });
  }
  const rows = await tx.$queryRawUnsafe<any[]>(
    `INSERT INTO member_course_lifelines (member_id, course_id, purchased_total, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, NOW())
     ON CONFLICT ON CONSTRAINT uq_mcl_member_course DO UPDATE
       SET purchased_total = member_course_lifelines.purchased_total + $3,
           updated_at      = NOW()
     RETURNING free_used, purchased_total, purchased_used`,
    memberId, courseId, quantity,
  );
  const row = rows[0];
  const freeUsed = Number(row.free_used ?? 0);
  const purchasedTotal = Number(row.purchased_total);
  const purchasedUsed = Number(row.purchased_used ?? 0);
  const lifelines: CourseLifelineState = {
    freeTotal: FREE_LIFELINES_PER_COURSE, freeUsed, purchasedTotal, purchasedUsed,
    remaining: Math.max(0, (FREE_LIFELINES_PER_COURSE - freeUsed) + (purchasedTotal - purchasedUsed)),
    coinCost: coinCostEach,
  };
  return { purchased: quantity, coinsSpent: totalCost, newBalance: debit.balance, lifelines };
}
