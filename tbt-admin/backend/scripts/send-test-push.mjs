// Dev helper: send a test push notification to the first active member
// that has a registered FCM token.
// Run with:  node scripts/send-test-push.mjs
import { PrismaClient } from '@prisma/client';
import { createSign } from 'crypto';
import 'dotenv/config';

const prisma = new PrismaClient();

// ── 1. Find a member with a registered FCM token ──────────────────────────────

const devices = await prisma.notificationDevice.findMany({
  take: 10,
  orderBy: { lastSeenAt: 'desc' },
  include: { member: { select: { id: true, firstName: true, phone: true } } },
});

if (!devices.length) {
  // Fallback: legacy single pushToken column
  const member = await prisma.member.findFirst({
    where: { pushToken: { not: null } },
    select: { id: true, firstName: true, phone: true, pushToken: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!member?.pushToken) {
    console.error('No FCM tokens found. Login on the device first so a token is registered.');
    process.exit(1);
  }
  devices.push({ fcmToken: member.pushToken, member, lastSeenAt: null });
}

const target = devices[0];
console.log(`Sending to: ${target.member.firstName} (${target.member.phone})`);
console.log(`Token (last 20 chars): ...${target.fcmToken.slice(-20)}`);

// ── 2. Mint a short-lived FCM OAuth token ─────────────────────────────────────

const { FIREBASE_PROJECT_ID: projectId, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL: clientEmail } = process.env;
if (!projectId || !FIREBASE_PRIVATE_KEY || !clientEmail) {
  console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL in backend/.env');
  process.exit(1);
}
const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: clientEmail,
  scope: 'https://www.googleapis.com/auth/firebase.messaging',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
})).toString('base64url');

const signingInput = `${header}.${payload}`;
const sign = createSign('RSA-SHA256');
sign.update(signingInput);
const sig = sign.sign(privateKey, 'base64url');

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${signingInput}.${sig}`,
  }),
});

if (!tokenRes.ok) {
  const err = await tokenRes.text();
  console.error('Failed to get FCM OAuth token:', err);
  process.exit(1);
}

const { access_token: accessToken } = await tokenRes.json();

// ── 3. Send the push ──────────────────────────────────────────────────────────

const pushRes = await fetch(
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token: target.fcmToken,
        notification: {
          title: '🔔 TBT Test Push',
          body: 'Push notification is working correctly!',
        },
        data: {
          type: 'announcement',
        },
      },
    }),
  }
);

const result = await pushRes.json();
if (pushRes.ok) {
  console.log('✅ Push sent successfully!');
  console.log('FCM message ID:', result.name);
} else {
  console.error('❌ Push failed:', JSON.stringify(result, null, 2));
  if (result?.error?.status === 'UNREGISTERED' || result?.error?.status === 'NOT_FOUND') {
    console.error('Token is stale/invalid. Ask the user to reopen the app to re-register a fresh token.');
  }
}

await prisma.$disconnect();
