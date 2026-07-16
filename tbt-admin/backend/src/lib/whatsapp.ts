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

/// Diagnostic variant of [sendOtpWhatsapp]. Same wire call, but
/// returns the full request/response envelope instead of collapsing
/// to a boolean. Used by the admin `/whatsapp-diagnostic` endpoint
/// so failures can be diagnosed without SSHing into a Cloud Run
/// instance to read logs.
///
/// Sensitive data (the bearer token) is NEVER included in the
/// returned envelope — only the config that identifies which
/// credentials failed.
export interface WhatsappDiagnostic {
  configured: {
    hasAccessToken: boolean;
    accessTokenTail: string | null;     // last 4 chars only
    fromNumber: string | null;
    templateName: string | null;
    templateLanguage: string;
    apiBaseUrl: string;
  };
  request: {
    url: string;
    normalizedPhone: string;
    otpDigits: number;
  };
  response: {
    ok: boolean;
    status: number | null;
    body: string;                        // truncated to 2000 chars
    error?: string;
  };
  interpreted: 'success' | 'bsp_rejected' | 'bad_credentials' | 'network_error' | 'not_configured';
}

export async function sendOtpWhatsappDiagnostic(
  phone: string,
  otp: string,
): Promise<WhatsappDiagnostic> {
  const accessToken = env.WABA_ACCESS_TOKEN;
  const fromNumber = env.WABA_FROM_NUMBER;
  const templateName = env.WABA_TEMPLATE_NAME;
  const templateLanguage = env.WABA_TEMPLATE_LANGUAGE;
  const apiBaseUrl = env.WABA_API_BASE_URL;

  const configured = {
    hasAccessToken: !!accessToken,
    accessTokenTail: accessToken
      ? accessToken.slice(Math.max(0, accessToken.length - 4))
      : null,
    fromNumber: fromNumber || null,
    templateName: templateName || null,
    templateLanguage: templateLanguage,
    apiBaseUrl: apiBaseUrl,
  };

  const to = normalizePhone(phone);
  const url = `${apiBaseUrl}/message/send`;
  const request = { url, normalizedPhone: to, otpDigits: otp.length };

  if (!accessToken || !fromNumber || !templateName) {
    return {
      configured,
      request,
      response: {
        ok: false,
        status: null,
        body: '',
        error: 'One or more WABA_* env vars are unset',
      },
      interpreted: 'not_configured',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        wabaNumber: fromNumber,
        recipient: { phoneNumber: to },
        type: 'template',
        template: {
          name: templateName,
          language: templateLanguage,
          body: [otp],
        },
      }),
    });
    const rawBody = await res.text().catch(() => '');
    const body = rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}…[truncated]` : rawBody;
    const response = { ok: res.ok, status: res.status, body };

    if (!res.ok) {
      const isAuth = res.status === 401 || res.status === 403;
      return {
        configured,
        request,
        response,
        interpreted: isAuth ? 'bad_credentials' : 'bsp_rejected',
      };
    }

    try {
      const json = JSON.parse(rawBody);
      if (json?.status === 'success' && json?.data?.messageId) {
        return { configured, request, response, interpreted: 'success' };
      }
      return { configured, request, response, interpreted: 'bsp_rejected' };
    } catch {
      return { configured, request, response, interpreted: 'bsp_rejected' };
    }
  } catch (err: any) {
    return {
      configured,
      request,
      response: {
        ok: false,
        status: null,
        body: '',
        error: err.message ?? String(err),
      },
      interpreted: 'network_error',
    };
  }
}

export async function sendWhatsappMessage(phone: string, message: string): Promise<boolean> {
  if (!env.WABA_ACCESS_TOKEN || !env.WABA_FROM_NUMBER || !env.WABA_TEMPLATE_NAME) return false;
  const to = normalizePhone(phone);
  try {
    const res = await fetch(`${env.WABA_API_BASE_URL}/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.WABA_ACCESS_TOKEN}` },
      body: JSON.stringify({
        wabaNumber: env.WABA_FROM_NUMBER,
        recipient: { phoneNumber: to },
        type: 'template',
        template: { name: env.WABA_TEMPLATE_NAME, language: env.WABA_TEMPLATE_LANGUAGE, body: [message] },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
