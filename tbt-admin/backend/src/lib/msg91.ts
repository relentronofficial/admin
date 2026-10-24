import { env } from '../config/env.js';
import { phoneDigitsForMessaging } from './phoneNumber.js';

// International numbers keep their own country code (phoneDigitsForMessaging);
// a bare 10-digit number is a legacy Indian mobile.
function normalizePhone(phone: string): string {
  return phoneDigitsForMessaging(phone);
}

export async function sendOtp(phone: string, otp: string): Promise<boolean> {
  const mobile = normalizePhone(phone);
  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': env.MSG91_AUTH_KEY ?? '',
      },
      body: JSON.stringify({
        flow_id: env.MSG91_TEMPLATE_ID ?? '',
        sender: env.MSG91_SENDER_ID ?? '',
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
    try {
      const json = JSON.parse(body);
      if (json?.type === 'error') {
        console.error('[MSG91] delivery rejected', json.message ?? body);
        return false;
      }
    } catch { /* non-JSON body — fall through to success */ }
    return true;
  } catch (err: any) {
    console.error('[MSG91] network error', err.message);
    return false;
  }
}
