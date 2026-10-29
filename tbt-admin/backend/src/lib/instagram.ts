/**
 * Instagram Graph API helpers.
 * All exports gracefully return null / throw a descriptive error when the
 * INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET env vars are absent.
 */

import { env } from '../config/env.js';

const FB_API = 'https://graph.facebook.com/v21.0';

function appConfigured(): boolean {
  return !!(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.INSTAGRAM_REDIRECT_URI);
}

/** Build the Facebook / Instagram OAuth dialog URL. */
export function buildInstagramOAuthUrl(stateJwt: string): string {
  if (!appConfigured()) throw new Error('Instagram app not configured');
  const params = new URLSearchParams({
    client_id:     env.INSTAGRAM_APP_ID!,
    redirect_uri:  env.INSTAGRAM_REDIRECT_URI!,
    scope:         'instagram_basic,instagram_manage_insights,pages_show_list',
    response_type: 'code',
    state:         stateJwt,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

/** Exchange an authorisation code for a short-lived access token. */
async function exchangeCodeForShortToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id:     env.INSTAGRAM_APP_ID!,
    client_secret: env.INSTAGRAM_APP_SECRET!,
    redirect_uri:  env.INSTAGRAM_REDIRECT_URI!,
    code,
  });
  const res = await fetch(`${FB_API}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Instagram token exchange failed: ${err}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Exchange a short-lived token for a 60-day long-lived token. */
async function exchangeForLongLivedToken(shortToken: string): Promise<{ token: string; expiresAt: Date }> {
  const params = new URLSearchParams({
    grant_type:       'fb_exchange_token',
    client_id:        env.INSTAGRAM_APP_ID!,
    client_secret:    env.INSTAGRAM_APP_SECRET!,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${FB_API}/oauth/access_token?${params}`);
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Instagram long-lived token exchange failed: ${err}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  return { token: data.access_token, expiresAt };
}

/** Full code → long-lived token flow. */
export async function exchangeCodeForLongLivedToken(
  code: string,
): Promise<{ token: string; expiresAt: Date }> {
  const short = await exchangeCodeForShortToken(code);
  return exchangeForLongLivedToken(short);
}

/** Refresh a long-lived token (valid for another 60 days). */
export async function refreshLongLivedToken(
  token: string,
): Promise<{ token: string; expiresAt: Date }> {
  const params = new URLSearchParams({
    grant_type:   'ig_refresh_token',
    access_token: token,
  });
  const res = await fetch(`${FB_API}/refresh_access_token?${params}`);
  if (!res.ok) throw new Error('Instagram token refresh failed');
  const data = await res.json() as { access_token: string; expires_in: number };
  return {
    token:     data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export type InstagramUserInfo = {
  igUserId:        string;
  username:        string;
  followersCount:  number;
  mediaCount:      number;
};

/**
 * Retrieve the connected Instagram Business / Creator account.
 * Flow: token → FB Pages → IG account linked to first page.
 */
export async function getInstagramUserInfo(accessToken: string): Promise<InstagramUserInfo> {
  // Step 1: get the user's Facebook Pages
  const pagesRes = await fetch(
    `${FB_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`,
  );
  if (!pagesRes.ok) throw new Error('Failed to fetch Facebook pages');
  const pages = await pagesRes.json() as { data: { id: string; name: string; instagram_business_account?: { id: string } }[] };

  const igAccountId = pages.data.find(p => p.instagram_business_account)?.instagram_business_account?.id;
  if (!igAccountId) throw new Error('No Instagram Business account connected to this Facebook account');

  // Step 2: get the IG account details
  const igRes = await fetch(
    `${FB_API}/${igAccountId}?fields=id,username,followers_count,media_count&access_token=${accessToken}`,
  );
  if (!igRes.ok) throw new Error('Failed to fetch Instagram account details');
  const ig = await igRes.json() as { id: string; username: string; followers_count: number; media_count: number };

  return {
    igUserId:       ig.id,
    username:       ig.username,
    followersCount: ig.followers_count ?? 0,
    mediaCount:     ig.media_count ?? 0,
  };
}

export type InstagramInsights = {
  followersCount:  number;
  videoViews:      number;
  contentUploads:  number;
  interactions:    number;
  bioLinkClicks:   number;
};

/** Fetch weekly Instagram insights for a Business / Creator account. */
export async function getInstagramInsights(
  igUserId: string,
  accessToken: string,
): Promise<InstagramInsights> {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 60 * 60;

  // Basic profile (followers_count)
  const profileRes = await fetch(
    `${FB_API}/${igUserId}?fields=followers_count&access_token=${accessToken}`,
  );
  const profile = profileRes.ok
    ? (await profileRes.json() as { followers_count?: number })
    : {};

  // Weekly insights: website_clicks, total_interactions, video_views
  const insightMetrics = 'website_clicks,total_interactions,video_views';
  const insightRes = await fetch(
    `${FB_API}/${igUserId}/insights?metric=${insightMetrics}&period=week&access_token=${accessToken}`,
  );
  let websiteClicks = 0;
  let totalInteractions = 0;
  let videoViews = 0;
  if (insightRes.ok) {
    const insightData = await insightRes.json() as { data: { name: string; values: { value: number }[] }[] };
    for (const metric of insightData.data ?? []) {
      const latest = metric.values?.[metric.values.length - 1]?.value ?? 0;
      if (metric.name === 'website_clicks') websiteClicks = latest;
      if (metric.name === 'total_interactions') totalInteractions = latest;
      if (metric.name === 'video_views') videoViews = latest;
    }
  }

  // Content uploads: count media posted in the last 7 days
  const mediaRes = await fetch(
    `${FB_API}/${igUserId}/media?fields=id,timestamp,media_type&since=${weekAgo}&until=${now}&access_token=${accessToken}`,
  );
  let contentUploads = 0;
  if (mediaRes.ok) {
    const mediaData = await mediaRes.json() as { data?: any[] };
    contentUploads = mediaData.data?.length ?? 0;
  }

  return {
    followersCount:  profile.followers_count ?? 0,
    videoViews,
    contentUploads,
    interactions:    totalInteractions,
    bioLinkClicks:   websiteClicks,
  };
}

export { appConfigured as isInstagramConfigured };
