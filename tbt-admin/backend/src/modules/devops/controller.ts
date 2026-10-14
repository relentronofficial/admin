import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { sendWhatsappMessage } from '../../lib/whatsapp.js';

const GITHUB_OWNER = 'relentronofficial';
const GITHUB_REPO = 'admin';
const GITHUB_API = 'https://api.github.com';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Verify @zacx BSP webhook signature.
// Tries common HMAC-SHA256 header/format combinations since @zacx doesn't
// publicly document which header name they use. The whsec_ secret is used
// as-is (full string including prefix) as the HMAC key.
function verifyWebhookSignature(rawBody: string, headers: Record<string, string | string[] | undefined>, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const candidateHeaders = [
    'x-signature',
    'x-hub-signature-256',
    'x-zacx-signature',
    'x-webhook-signature',
    'x-waba-signature',
  ];

  for (const name of candidateHeaders) {
    const raw = headers[name];
    if (!raw) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    // Strip common prefixes: "sha256=", "sha1=", etc.
    const sig = value.replace(/^sha\d+=/, '');
    if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return true;
    }
  }

  return false;
}

// Flexible parser — handles @zacx BSP format and Meta Cloud API format.
// Returns null for non-text events (status updates, read receipts, etc.)
function parseIncomingMessage(body: any): { from: string; text: string } | null {
  // @zacx format: { event_type, event_object: { from, to, message: { type, text } } }
  if (body?.event_object?.from && body?.event_object?.message?.type === 'text') {
    const text = body.event_object.message.text;
    if (typeof text === 'string' && text) {
      return { from: body.event_object.from, text };
    }
  }

  // @zacx legacy: { data: { from, text, type } }
  if (body?.data?.from && typeof body?.data?.text === 'string' && body?.data?.type === 'text') {
    return { from: body.data.from, text: body.data.text };
  }

  // @zacx alternate: { messages: [{ from, text, type }] }
  if (Array.isArray(body?.messages) && body.messages.length > 0) {
    const msg = body.messages[0];
    if (msg?.from && msg?.type === 'text') {
      const text = typeof msg.text === 'string' ? msg.text : (msg.text?.body ?? '');
      if (text) return { from: msg.from, text };
    }
  }

  // Meta Cloud API format
  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      for (const change of (entry.changes ?? [])) {
        const messages = change?.value?.messages;
        if (Array.isArray(messages) && messages.length > 0) {
          const msg = messages[0];
          if (msg?.type === 'text' && msg?.from && msg?.text?.body) {
            return { from: msg.from, text: msg.text.body };
          }
        }
      }
    }
  }

  // Simple flat format: { from, text }
  if (body?.from && typeof body?.text === 'string') {
    return { from: body.from, text: body.text };
  }

  return null;
}

async function createGitHubIssue(
  title: string,
  body: string,
  labels: string[],
): Promise<{ number: number; html_url: string } | null> {
  if (!env.GITHUB_TOKEN) {
    console.warn('[devops] GITHUB_TOKEN not set — cannot create issue');
    return null;
  }

  try {
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[devops] GitHub issue creation failed', res.status, err);
      return null;
    }

    return res.json() as any;
  } catch (err: any) {
    console.error('[devops] GitHub API network error', err.message);
    return null;
  }
}

export async function whatsappIntakeHandler(
  fastify: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const body = req.body as any;
  const rawBody: string = (req as any).rawBody ?? '';

  // Some BSPs send hub.challenge via POST during webhook registration
  if (body?.['hub.mode'] === 'subscribe' && body?.['hub.challenge']) {
    return reply.send(body['hub.challenge']);
  }

  // HMAC signature verification — reject if secret is configured and sig is invalid.
  // On first delivery, @zacx header name is logged so we can confirm the format.
  if (env.WABA_WEBHOOK_SECRET) {
    const valid = verifyWebhookSignature(rawBody, req.headers as any, env.WABA_WEBHOOK_SECRET);
    if (!valid) {
      const sigHeaders = Object.keys(req.headers).filter(h => h.includes('sig') || h.includes('signature'));
      fastify.log.warn({ sigHeaders, headers: sigHeaders.map(h => ({ [h]: req.headers[h] })) },
        '[devops] WhatsApp intake: HMAC verification failed');
      return reply.status(401).send({ error: 'invalid signature' });
    }
  }

  const msg = parseIncomingMessage(body);
  if (!msg || !msg.text.trim()) {
    // Log the raw body so we can identify the BSP payload format
    fastify.log.warn({ bodyKeys: Object.keys(body ?? {}), body: JSON.stringify(body).slice(0, 500) }, '[devops] WhatsApp intake: could not parse message (status update or unknown format)');
    return reply.send({ ok: true });
  }

  const senderNorm = normalizePhone(msg.from);
  const adminNorm = normalizePhone(env.ADMIN_WHATSAPP_NUMBER ?? '');

  if (!adminNorm || senderNorm !== adminNorm) {
    fastify.log.warn({ from: senderNorm }, '[devops] WhatsApp intake: ignored message from non-admin number');
    return reply.send({ ok: true });
  }

  const text = msg.text.trim();
  const lines = text.split('\n');
  const title = lines[0].trim();
  const rawDescription = lines.slice(1).join('\n').trim();

  // Extract scope tags from message: [backend], [admin], [mobile], [user-web]
  const scopeMatches = [...text.matchAll(/\[(backend|admin|mobile|user-web)\]/gi)];
  const scopeLabels = scopeMatches.map((m) => `scope:${m[1].toLowerCase()}`);
  const labels = ['devops:pending', ...scopeLabels];

  const issueParts: string[] = [];
  if (rawDescription) issueParts.push(rawDescription);
  issueParts.push(`---\n_Queued via WhatsApp at ${new Date().toISOString()}_`);
  const issueBody = issueParts.join('\n\n');

  const issue = await createGitHubIssue(title, issueBody, labels);

  if (!issue) {
    await sendWhatsappMessage(
      msg.from,
      `❌ Failed to queue task. Check GITHUB_TOKEN in Cloud Run env vars.`,
    );
    return reply.status(500).send({ error: 'failed to create GitHub issue' });
  }

  await sendWhatsappMessage(
    msg.from,
    `✅ Task queued!\n\n#${issue.number}: ${title}\n${issue.html_url}`,
  );

  fastify.log.info({ issueNumber: issue.number, title }, '[devops] WhatsApp intake: created GitHub issue');
  return reply.send({ ok: true, issueNumber: issue.number });
}

// GET handler for Meta-style webhook verification (hub.challenge handshake)
export async function whatsappIntakeVerifyHandler(
  _fastify: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const query = req.query as any;
  if (query?.['hub.mode'] === 'subscribe' && query?.['hub.challenge']) {
    return reply.send(query['hub.challenge']);
  }
  return reply.status(400).send({ error: 'invalid webhook verification request' });
}
