import { env } from '../config/env.js';
import { OTP_TTL } from './otp.js';

// Signup OTP by email — the second channel next to WhatsApp (SMS fallback), so a
// WhatsApp outage (e.g. an expired provider subscription) never blocks sign-up.
// Uses the existing Resend integration (RESEND_API_KEY). Never logs the OTP.

/** Sender address; OTP_EMAIL_FROM overrides (the domain must be verified in Resend). */
export const DEFAULT_OTP_EMAIL_FROM = 'TBT <noreply@tamilbusinesstribe.com>';

type ResendLike = { emails: { send: (msg: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string; name?: string } | null }> } };

let client: ResendLike | null | undefined;
async function resendClient(): Promise<ResendLike | null> {
  if (client !== undefined) return client;
  client = env.RESEND_API_KEY ? (new (await import('resend')).Resend(env.RESEND_API_KEY) as unknown as ResendLike) : null;
  return client;
}

/** Sends the signup OTP to `email`. true only when Resend accepted the message. */
export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const resend = await resendClient();
  if (!resend) {
    console.warn('[OTP email] RESEND_API_KEY not configured — skipping');
    return false;
  }
  const minutes = Math.round(OTP_TTL / 60);
  try {
    // Resend's SDK returns API errors (unverified domain, bad key, …) rather than throwing.
    const { error } = await resend.emails.send({
      from: env.OTP_EMAIL_FROM || DEFAULT_OTP_EMAIL_FROM,
      to: email,
      subject: 'Your TBT verification code',
      text: `Your Tamil Business Tribe verification code is ${otp}. It expires in ${minutes} minutes. If you didn't try to sign up, you can ignore this email.`,
      html: `<p>Your Tamil Business Tribe verification code is</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p><p>It expires in ${minutes} minutes. If you didn't try to sign up, you can ignore this email.</p>`,
    });
    if (error) {
      console.error('[OTP email] send failed', error.name ?? '', error.message ?? '');
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[OTP email] network error', err?.message);
    return false;
  }
}

/** Test hook: forget the cached client so a changed RESEND_API_KEY is picked up. */
export function resetOtpEmailClientForTests(): void {
  client = undefined;
}
