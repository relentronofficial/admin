import { describe, expect, it } from 'vitest';
import { checkLifelinePayment, checkOrderOwnership, priceInrToPaise, type LifelineOrderRow } from './lifelinePurchaseLogic.js';

const ME = 'member-me';
const order: LifelineOrderRow = { orderId: 'order_1', memberId: ME, amountPaise: 19900, currency: 'INR', status: 'created', paymentId: null };
const rzpOrder = { id: 'order_1', amount: 19900, currency: 'INR', status: 'paid', notes: { memberId: ME, type: 'lifeline_purchase' } };
const rzpPayment = { id: 'pay_1', order_id: 'order_1', amount: 19900, currency: 'INR', status: 'captured' };
const check = (o: Partial<typeof rzpOrder> = {}, p: Partial<typeof rzpPayment> = {}) =>
  checkLifelinePayment({ memberId: ME, order, rzpOrder: { ...rzpOrder, ...o }, rzpPayment: { ...rzpPayment, ...p } });

describe('priceInrToPaise', () => {
  it('converts the configured credit_pricing price (DECIMAL string or number) to paise', () => {
    expect(priceInrToPaise('199.00')).toBe(19900);
    expect(priceInrToPaise(249)).toBe(24900);
    expect(priceInrToPaise('99.99')).toBe(9999);
  });
  it('reads the Prisma.Decimal that a raw DECIMAL query returns (the production create-order 503)', async () => {
    const { Prisma } = await import('@prisma/client');
    expect(priceInrToPaise(new Prisma.Decimal('199.00'))).toBe(19900);
    expect(priceInrToPaise(new Prisma.Decimal('249.5'))).toBe(24950);
    expect(priceInrToPaise(new Prisma.Decimal(0))).toBeNull();
    expect(priceInrToPaise({})).toBeNull();
  });
  it('rejects missing, zero, negative or non-numeric prices', () => {
    for (const v of [undefined, null, '', '0', 0, -5, 'abc', NaN]) expect(priceInrToPaise(v)).toBeNull();
  });
});

describe('checkOrderOwnership', () => {
  it('requires a stored order owned by the member', () => {
    expect(checkOrderOwnership(null, ME)).toEqual({ ok: false, httpStatus: 404, code: 'ORDER_NOT_FOUND' });
    expect(checkOrderOwnership({ ...order, memberId: 'someone-else' }, ME)).toEqual({ ok: false, httpStatus: 403, code: 'ORDER_NOT_YOURS' });
    expect(checkOrderOwnership(order, ME)).toEqual({ ok: true });
  });
});

describe('checkLifelinePayment', () => {
  it('passes only a captured payment on this paid lifeline order, for the stored amount and currency', () => {
    expect(check()).toEqual({ ok: true });
  });
  it('rejects a payment for another order', () => {
    expect(check({}, { order_id: 'order_2' })).toMatchObject({ ok: false, code: 'PAYMENT_ORDER_MISMATCH' });
    expect(check({ id: 'order_2' })).toMatchObject({ ok: false, code: 'PAYMENT_ORDER_MISMATCH' });
  });
  it('rejects an order for another product or member (e.g. a coin or course order)', () => {
    expect(check({ notes: { memberId: ME, type: 'coin_purchase' } })).toMatchObject({ ok: false, code: 'ORDER_PRODUCT_MISMATCH' });
    expect(check({ notes: { memberId: 'other', type: 'lifeline_purchase' } })).toMatchObject({ ok: false, code: 'ORDER_PRODUCT_MISMATCH' });
    expect(check({ notes: [] as any })).toMatchObject({ ok: false, code: 'ORDER_PRODUCT_MISMATCH' });
  });
  it('rejects an amount or currency that differs from the stored order', () => {
    expect(check({}, { amount: 100 })).toMatchObject({ ok: false, httpStatus: 400, code: 'AMOUNT_MISMATCH' });
    expect(check({ amount: 100 })).toMatchObject({ ok: false, code: 'AMOUNT_MISMATCH' });
    expect(check({ currency: 'USD' }, { currency: 'USD' })).toMatchObject({ ok: false, code: 'CURRENCY_MISMATCH' });
  });
  it('a failed payment is a failure; an authorized/created one or an unpaid order is pending — never credited', () => {
    expect(check({}, { status: 'failed' })).toEqual({ ok: false, httpStatus: 402, code: 'PAYMENT_FAILED' });
    expect(check({}, { status: 'authorized' })).toEqual({ ok: false, httpStatus: 202, code: 'PAYMENT_PENDING', pending: true });
    expect(check({}, { status: 'created' })).toMatchObject({ pending: true });
    expect(check({ status: 'attempted' })).toMatchObject({ pending: true });
    expect(check({}, { status: 'refunded' })).toMatchObject({ ok: false, code: 'PAYMENT_NOT_CAPTURED' });
  });
});

describe('CI schema guard keeps the lifeline order table (deploys must not drop or block on it)', () => {
  it('a Prisma diff that would drop lifeline_razorpay_orders, its columns or indexes is skipped — never applied or blocked', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { extractStartupManagedObjects, guardSchemaDiff } = await import('./schemaGuardLogic.js');
    const prismaTs = fileURLToPath(new URL('../plugins/prisma.ts', import.meta.url));
    const managed = extractStartupManagedObjects(readFileSync(prismaTs, 'utf8'));
    const diff = [
      'DROP TABLE "lifeline_razorpay_orders";',
      'ALTER TABLE "lifeline_razorpay_orders" DROP COLUMN "last_checked_at";',
      'DROP INDEX "idx_lifeline_rzp_orders_member";',
      'DROP INDEX "idx_lifeline_rzp_orders_unpaid";',
    ].join('\n');
    const r = guardSchemaDiff(diff, managed);
    expect(r.blocked).toEqual([]);
    expect(r.apply).toEqual([]);
    expect(r.skipped).toHaveLength(4);
  });
});
