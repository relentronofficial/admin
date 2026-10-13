#!/usr/bin/env node
/**
 * TBT Notification Helper — WhatsApp via WABA (@zacx BSP)
 *
 * Sends a WhatsApp message to the admin's phone number.
 * Silently no-ops if any required env var is missing.
 *
 * Required env vars (copy from tbt-admin/backend/.env):
 *   WABA_API_BASE_URL   — e.g. https://api.zacx.in/v1
 *   WABA_ACCESS_TOKEN   — bearer token from zacx dashboard
 *   WABA_FROM_NUMBER    — business WhatsApp number (e.g. 919876543210)
 *   NOTIFY_TO_NUMBER    — admin's personal WhatsApp number (e.g. 919876543210)
 *
 * One-time setup (run in PowerShell):
 *   [System.Environment]::SetEnvironmentVariable("WABA_API_BASE_URL","https://api.zacx.in/v1","User")
 *   [System.Environment]::SetEnvironmentVariable("WABA_ACCESS_TOKEN","<token>","User")
 *   [System.Environment]::SetEnvironmentVariable("WABA_FROM_NUMBER","91XXXXXXXXXX","User")
 *   [System.Environment]::SetEnvironmentVariable("NOTIFY_TO_NUMBER","91XXXXXXXXXX","User")
 *
 * Usage:
 *   import { notify } from './notify.mjs';
 *   await notify('✅ Task completed: Fix login bug');
 */

const WABA_API_BASE_URL  = process.env.WABA_API_BASE_URL;
const WABA_ACCESS_TOKEN  = process.env.WABA_ACCESS_TOKEN;
const WABA_FROM_NUMBER   = process.env.WABA_FROM_NUMBER;
const NOTIFY_TO_NUMBER   = process.env.NOTIFY_TO_NUMBER;

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Send a WhatsApp message to the admin's number.
 * Returns true on success, false if not configured or failed.
 * @param {string} text — plain text (no Markdown — WhatsApp plain-text messages only)
 */
export async function notify(text) {
  if (!WABA_API_BASE_URL || !WABA_ACCESS_TOKEN || !WABA_FROM_NUMBER || !NOTIFY_TO_NUMBER) {
    return false;
  }

  const to = normalizePhone(NOTIFY_TO_NUMBER);
  const url = `${WABA_API_BASE_URL.replace(/\/$/, '')}/message/send`;

  // Strip markdown formatting characters that look odd in plain WhatsApp messages
  const plainText = text
    .replace(/\*([^*]+)\*/g, '$1')      // *bold* → bold
    .replace(/_([^_]+)_/g, '$1')        // _italic_ → italic
    .replace(/`([^`]+)`/g, '$1')        // `code` → code
    .replace(/\\([._*[\]()~`>#+=|{}])/g, '$1'); // unescape MarkdownV2

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WABA_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        wabaNumber: WABA_FROM_NUMBER,
        recipient: { phoneNumber: to },
        type: 'text',
        text: plainText,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const rawBody = await res.text().catch(() => '');

    if (!res.ok) {
      console.error(`[notify] WhatsApp send failed: HTTP ${res.status} — ${rawBody.slice(0, 200)}`);
      return false;
    }

    try {
      const json = JSON.parse(rawBody);
      if (json?.status !== 'success' || !json?.data?.messageId) {
        console.error(`[notify] WhatsApp provider rejected: ${rawBody.slice(0, 200)}`);
        return false;
      }
    } catch {
      console.error(`[notify] WhatsApp non-JSON response: ${rawBody.slice(0, 200)}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[notify] WhatsApp network error: ${err.message}`);
    return false;
  }
}

// When run directly: node automation/notify.mjs "test message"
if (process.argv[1] && process.argv[1].endsWith('notify.mjs')) {
  const configured = WABA_API_BASE_URL && WABA_ACCESS_TOKEN && WABA_FROM_NUMBER && NOTIFY_TO_NUMBER;
  if (!configured) {
    console.log('⚠️  One or more required env vars not set:');
    console.log(`   WABA_API_BASE_URL  : ${WABA_API_BASE_URL  ? '✅' : '❌ missing'}`);
    console.log(`   WABA_ACCESS_TOKEN  : ${WABA_ACCESS_TOKEN  ? '✅' : '❌ missing'}`);
    console.log(`   WABA_FROM_NUMBER   : ${WABA_FROM_NUMBER   ? '✅' : '❌ missing'}`);
    console.log(`   NOTIFY_TO_NUMBER   : ${NOTIFY_TO_NUMBER   ? '✅' : '❌ missing'}`);
    console.log('');
    console.log('   Copy WABA_* values from tbt-admin/backend/.env, then set:');
    console.log('   [System.Environment]::SetEnvironmentVariable("NOTIFY_TO_NUMBER","91XXXXXXXXXX","User")');
  } else {
    const msg = process.argv[2] || '🔔 TBT DevOps notification test';
    const ok = await notify(msg);
    console.log(ok ? `✅ Message sent to ${NOTIFY_TO_NUMBER}` : '❌ Failed to send message.');
  }
}
