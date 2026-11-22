import { describe, expect, it } from 'vitest';
import { reconcileCoursePayment, type RzpPaymentLite } from './razorpayReconcile.js';

const cap = (amount: number, extra: Partial<RzpPaymentLite> = {}): RzpPaymentLite => ({ id: `pay_${amount}`, status: 'captured', amount, ...extra });
const row = (status: string, amount = 90000, razorpayOrderId: string | null = 'order_1') => ({ status, amount, razorpayOrderId });

describe('reconcileCoursePayment', () => {
  it('completed + captured same amount → ok, returns the payment id', () => {
    const r = reconcileCoursePayment(row('completed'), [{ id: 'pay_f', status: 'failed', amount: 9000000 }, cap(9000000)]);
    expect(r.verdict).toBe('ok');
    expect(r.capturedPaymentId).toBe('pay_9000000');
    expect(r.capturedAmount).toBe(90000);
    expect(r.attempts).toBe(2);
  });

  it('completed but nothing captured → not_paid_on_razorpay', () => {
    expect(reconcileCoursePayment(row('completed'), []).verdict).toBe('not_paid_on_razorpay');
    expect(reconcileCoursePayment(row('completed'), [{ id: 'p', status: 'failed', amount: 9000000 }]).verdict).toBe('not_paid_on_razorpay');
    expect(reconcileCoursePayment(row('completed'), [{ id: 'p', status: 'authorized', amount: 9000000 }]).verdict).toBe('not_paid_on_razorpay');
  });

  it('pending but captured on Razorpay → paid_not_recorded', () => {
    expect(reconcileCoursePayment(row('pending'), [cap(9000000)]).verdict).toBe('paid_not_recorded');
    expect(reconcileCoursePayment(row('failed'), [cap(9000000)]).verdict).toBe('paid_not_recorded');
  });

  it('pending with no captured payment → unpaid_checkout', () => {
    expect(reconcileCoursePayment(row('pending'), [{ id: 'p', status: 'failed', amount: 9000000 }]).verdict).toBe('unpaid_checkout');
    expect(reconcileCoursePayment(row('pending'), []).verdict).toBe('unpaid_checkout');
  });

  it('amount differs → amount_mismatch (compared to the paisa)', () => {
    expect(reconcileCoursePayment(row('completed', 90000), [cap(8999900)]).verdict).toBe('amount_mismatch');
    expect(reconcileCoursePayment(row('completed', 4999.5), [cap(499950)]).verdict).toBe('ok');
  });

  it('refund states', () => {
    expect(reconcileCoursePayment(row('completed'), [cap(9000000, { status: 'refunded' })]).verdict).toBe('refund_mismatch');
    expect(reconcileCoursePayment(row('completed'), [cap(9000000, { amount_refunded: 100000 })]).verdict).toBe('refund_mismatch');
    expect(reconcileCoursePayment(row('refunded'), [cap(9000000, { status: 'refunded', amount_refunded: 9000000 })]).verdict).toBe('ok');
    expect(reconcileCoursePayment(row('refunded'), [cap(9000000)]).verdict).toBe('refund_mismatch');
  });

  it('no order id → no_order; API failure → error', () => {
    expect(reconcileCoursePayment(row('completed', 90000, null), []).verdict).toBe('no_order');
    expect(reconcileCoursePayment(row('completed'), null).verdict).toBe('error');
  });
});
