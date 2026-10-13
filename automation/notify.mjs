#!/usr/bin/env node
/**
 * TBT Notification Helper
 *
 * Sends a Telegram message. Silently no-ops if TELEGRAM_BOT_TOKEN or
 * TELEGRAM_CHAT_ID are not set — so the system degrades gracefully.
 *
 * Setup:
 *   1. Message @BotFather on Telegram → /newbot → copy the token
 *   2. Start a chat with your new bot, then visit:
 *      https://api.telegram.org/bot<TOKEN>/getUpdates
 *      Copy the "id" from result[0].message.chat.id
 *   3. Set environment variables (User scope, persists across reboots):
 *      [System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN","<token>","User")
 *      [System.Environment]::SetEnvironmentVariable("TELEGRAM_CHAT_ID","<id>","User")
 *
 * Usage:
 *   import { notify } from './notify.mjs';
 *   await notify('✅ Task completed: Fix login bug');
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send a Telegram message. Returns true on success, false if not configured or failed.
 * @param {string} text — message text (supports Markdown)
 * @param {'HTML'|'MarkdownV2'|undefined} parseMode
 */
export async function notify(text, parseMode) {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  try {
    const body = {
      chat_id: CHAT_ID,
      text,
      disable_web_page_preview: true,
    };
    if (parseMode) body.parse_mode = parseMode;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[notify] Telegram error ${res.status}: ${err.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[notify] Failed to send Telegram message: ${err.message}`);
    return false;
  }
}

// When run directly: node automation/notify.mjs "test message"
if (process.argv[1] && process.argv[1].endsWith('notify.mjs')) {
  const msg = process.argv[2] || '🔔 TBT notification test';
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.');
    console.log('   See setup instructions at the top of this file.');
  } else {
    const ok = await notify(msg);
    console.log(ok ? '✅ Message sent.' : '❌ Failed to send message.');
  }
}
