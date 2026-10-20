// lifeline_razorpay_orders — DDL for Extra Lifeline Razorpay orders (raw SQL, no Prisma model).
//
// Run idempotently at startup by plugins/prisma.ts, and by the real-Postgres
// integration test (lifelineCredit.pg.test.ts) so both use the same schema.
//
//   status: 'created' → 'paid' (credited once; payment_id UNIQUE)
//           'created' → 'expired' (reconciliation: unpaid for 7 days; a late
//                                 captured payment can still credit it)
//   last_checked_at: reconciliation lease/backoff — a run claims an order by
//                    setting it, so overlapping runs never check the same order.
export const LIFELINE_ORDERS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS lifeline_razorpay_orders (
    order_id     TEXT PRIMARY KEY,
    member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    batch_id     UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    amount_paise INT NOT NULL,
    currency     VARCHAR(10) NOT NULL DEFAULT 'INR',
    status       VARCHAR(20) NOT NULL DEFAULT 'created',
    payment_id   TEXT UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at      TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lifeline_rzp_orders_member ON lifeline_razorpay_orders(member_id)`,
  `ALTER TABLE lifeline_razorpay_orders ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS idx_lifeline_rzp_orders_unpaid ON lifeline_razorpay_orders(created_at) WHERE status = 'created'`,
];
