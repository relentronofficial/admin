import { createSign } from 'crypto';
import { env } from '../config/env.js';

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL: clientEmail } = env;
  const privateKey = (FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (!projectId || !privateKey || !clientEmail) return null;

  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiry - 60) return _cachedToken;

  try {
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

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${signingInput}.${sig}`,
      }),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as any;
    _cachedToken = data.access_token ?? null;
    _tokenExpiry = now + (data.expires_in ?? 3600);
    return _cachedToken;
  } catch {
    return null;
  }
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  if (!fcmToken || !env.FIREBASE_PROJECT_ID) return false;
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: { token: fcmToken, notification: { title, body }, data: data ?? {} },
        }),
      },
    );
    if (!resp.ok) {
      _cachedToken = null; // invalidate on 401
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
