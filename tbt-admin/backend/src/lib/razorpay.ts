import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';

let _instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_instance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    _instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return _instance;
}

/** Constant-time hex comparison; false for a missing or malformed signature. */
function safeEqualHex(expected: string, signature: unknown): boolean {
  if (typeof signature !== 'string') return false;
  // Compare byte lengths, not string lengths: a same-length string with
  // multi-byte characters would otherwise make timingSafeEqual throw (→ 500).
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
}
