import { env } from '../config/env.js';

// ── Low-balance side-channel ────────────────────────────────────────────────
//
// The BSP returns HTTP 402 with body `{ code: 'INSUFFICIENT_BALANCE', ... }`
// once the @zacx wallet is empty. Every OTP send after that fails silently
// as far as the user is concerned — the mobile client just shows "Failed to
// send OTP" without any signal to the operator that the account is out of
// funds. This module raises an admin-side alert the first time it sees a
// low-balance rejection so the ops team finds out from a red banner in
// their console instead of from a wave of customer complaints.
//
// The alert path is decoupled from the caller — `sendOtpWhatsapp` /
// `sendWhatsappMessage` stay pure boolean-returning functions. Server boot
// wires a handler via [registerLowBalanceHandler] that writes to
// `admin_notifications` and emits a socket event; when no handler is
// registered (unit tests, dev boot without full plugin stack) the detection
// is a no-op.

/// Fires when the BSP explicitly reports insufficient balance. Called at
/// most once per [_lowBalanceCooldown] window to avoid flooding the admin
/// panel with duplicate banners during a burst of failed sends.
export type LowBalanceHandler = (details: {
  status: number;
  body: string;
  at: Date;
}) => void | Promise<void>;

let _lowBalanceHandler: LowBalanceHandler | null = null;
let _lastLowBalanceAlert = 0;
const _lowBalanceCooldown = 60 * 60 * 1000; // 1 hour

export function registerLowBalanceHandler(handler: LowBalanceHandler): void {
  _lowBalanceHandler = handler;
}

/// Inspect a BSP response and, if it indicates the wallet is empty,
/// dispatch the low-balance alert (subject to the once-per-hour cooldown).
/// Returns true when the response WAS a low-balance signal, so the caller
/// can log it explicitly.
function detectAndAlertLowBalance(status: number, body: string): boolean {
  // BSPs vary in how they signal this. Cover the common shapes:
  //   * HTTP 402 (RFC "Payment Required")
  //   * Any status with body containing "INSUFFICIENT_BALANCE" (the @zacx
  //     shape observed 2026-07-16)
  //   * "insufficient balance" case-insensitive (safety net for BSPs that
  //     use a different code but the same wording)
  const isLowBalance =
    status === 402 ||
    body.includes('INSUFFICIENT_BALANCE') ||
    /insufficient\s+balance/i.test(body);
  if (!isLowBalance) return false;

  const now = Date.now();
  if (now - _lastLowBalanceAlert < _lowBalanceCooldown) return true;
  _lastLowBalanceAlert = now;

  const handler = _lowBalanceHandler;
  if (handler) {
    // Fire-and-forget — the caller is on the OTP hot path and shouldn't
    // wait on the admin-notif write. Errors are swallowed so a broken
    // handler can't fault the OTP call.
    Promise.resolve(handler({ status, body, at: new Date() })).catch((err) => {
      console.warn('[WhatsApp] low-balance handler threw:', err);
    });
  }
  return true;
}

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
      detectAndAlertLowBalance(res.status, body);
      return false;
    }

    try {
      const json = JSON.parse(body);
      // Success: { "status": "success", "data": { "messageId": "..." } }
      if (json?.status !== 'success' || !json?.data?.messageId) {
        console.error('[WhatsApp] unexpected response', body);
        detectAndAlertLowBalance(res.status, body);
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      detectAndAlertLowBalance(res.status, body);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
