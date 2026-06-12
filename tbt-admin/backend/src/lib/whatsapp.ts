import { env } from '../config/env.js';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendOtpWhatsapp(phone: string, otp: string): Promise<boolean> {
  if (!env.WABA_ACCESS_TOKEN || !env.WABA_FROM_NUMBER || !env.WABA_TEMPLATE_NAME) {
    console.warn('[WhatsApp] credentials not configured — skipping');
    return false;
  }

  const to = normalizePhone(phone);
  const url = `${env.WABA_API_BASE_URL}/message/send`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WABA_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        wabaNumber: env.WABA_FROM_NUMBER,
        recipient: { phoneNumber: to },
        type: 'template',
        template: {
          name: env.WABA_TEMPLATE_NAME,
          language: env.WABA_TEMPLATE_LANGUAGE,
          body: [otp],
        },
      }),
    });

    const body = await res.text().catch(() => '');

    if (!res.ok) {
      console.error('[WhatsApp] send failed', res.status, body);
      return false;
    }

    try {
      const json = JSON.parse(body);
      // Success: { "status": "success", "data": { "messageId": "..." } }
      if (json?.status !== 'success' || !json?.data?.messageId) {
        console.error('[WhatsApp] unexpected response', body);
        return false;
      }
    } catch {
      console.error('[WhatsApp] non-JSON response', body);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[WhatsApp] network error', err.message);
    return false;
  }
}
