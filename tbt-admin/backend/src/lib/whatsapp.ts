import { env } from '../config/env.js';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendOtpWhatsapp(phone: string, otp: string): Promise<boolean> {
  if (!env.WABA_ACCESS_TOKEN || !env.WABA_PHONE_NUMBER_ID || !env.WABA_TEMPLATE_NAME) {
    console.warn('[WhatsApp] credentials not configured — skipping');
    return false;
  }

  const to = normalizePhone(phone);
  const url = `${env.WABA_API_BASE_URL}/${env.WABA_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WABA_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: env.WABA_TEMPLATE_NAME,
          language: { code: env.WABA_TEMPLATE_LANGUAGE },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }],
            },
          ],
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
      // Success: { "messages": [{ "id": "..." }] }
      // Error:   { "error": { "message": "...", "code": ... } }
      if (json?.error) {
        console.error('[WhatsApp] API error', json.error.message ?? body);
        return false;
      }
      if (!json?.messages?.length) {
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
