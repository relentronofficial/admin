import { env } from '../config/env.js';
import { phoneDigitsForMessaging } from './phoneNumber.js';

// International numbers keep their own country code (phoneDigitsForMessaging);
// a bare 10-digit number is a legacy Indian mobile.
function normalizePhone(phone: string): string {
  return phoneDigitsForMessaging(phone);
}

/**
 * The request id from a successful Flow API response ({ "type": "success",
 * "message": "<request id>" }), or null. Accepted only when it looks like an
 * opaque id, so a free-text message (which could echo the number) is never logged.
 */
export function msg91RequestId(json: unknown): string | null {
  const msg = (json as { message?: unknown } | null)?.message;
  if (typeof msg !== 'string') return null;
  const id = msg.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) && !/^\d+$/.test(id) ? id : null;
}

export async function sendOtp(phone: string, otp: string): Promise<boolean> {
  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID || !env.MSG91_SENDER_ID) {
    console.warn('[MSG91] credentials not configured — skipping');
    return false;
  }
  const mobile = normalizePhone(phone);
  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        flow_id: env.MSG91_TEMPLATE_ID,
        sender: env.MSG91_SENDER_ID,
        short_url: '0',
        mobiles: mobile,
        VAR1: otp,
      }),
    });
    const body = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[MSG91] send failed', res.status, body);
      return false;
    }
    // MSG91 returns HTTP 200 even on failure (e.g. zero balance, DLT rejection).
    // The actual result is in the JSON body: { "type": "success" | "error", ... }
    let requestId: string | null = null;
    try {
      const json = JSON.parse(body);
      if (json?.type === 'error') {
        console.error('[MSG91] delivery rejected', json.message ?? body);
        return false;
      }
      requestId = msg91RequestId(json);
    } catch { /* non-JSON body — fall through to success */ }
    // Accepted is not delivered: the request id is what MSG91's delivery report
    // is searched by. Only the id is logged — never the OTP, phone or key.
    console.info(requestId ? `[MSG91] accepted request_id=${requestId}` : '[MSG91] accepted (no request id in response)');
    return true;
  } catch (err: any) {
    console.error('[MSG91] network error', err.message);
    return false;
  }
}
