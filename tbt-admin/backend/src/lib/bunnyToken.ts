import crypto from 'crypto';

/**
 * Generates a time-limited Bunny Stream signed token for URL authentication.
 *
 * Setup in Bunny dashboard:
 *   Video Library → Security → Enable Token Authentication → copy "Token Authentication Key"
 *   Set it as BUNNY_TOKEN_AUTH_KEY in your environment.
 *
 * Token format (Bunny CDN/Stream standard):
 *   MD5(tokenAuthKey + "/" + videoGuid + expires)
 *
 * Append to URLs as: ?token={token}&expires={expires}
 */
export function generateBunnyToken(
  tokenAuthKey: string,
  videoGuid: string,
  expiresInSeconds = 21600, // 6h — covers any realistic single-session watch
): { token: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const raw = `${tokenAuthKey}/${videoGuid}${expires}`;
  const token = crypto.createHash('md5').update(raw).digest('hex');
  return { token, expires };
}
