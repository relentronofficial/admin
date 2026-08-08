/**
 * Bunny Stream helpers.
 *
 * Extracted so the ad campaign module and the upload module share one
 * implementation instead of each carrying its own copy of the REST call and
 * the CDN URL construction.
 */

import { env } from '../config/env.js';

/**
 * Normalise `BUNNY_CDN_URL` to an absolute origin with no trailing slash.
 *
 * The env var is stored as a BARE HOSTNAME (e.g. `tbt-cdn.b-cdn.net`) with no
 * scheme — see CLAUDE.md pitfall #20. Concatenating it directly produces a
 * relative URL that silently 404s.
 */
export function bunnyCdnOrigin(): string | null {
  const raw = env.BUNNY_CDN_URL;
  if (!raw) return null;
  const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
}

/**
 * HLS playlist URL for a Bunny Stream video, or null when Bunny/CDN is not
 * configured (the caller then falls back to the iframe embed).
 */
export function buildHlsUrl(bunnyVideoId: string | null | undefined): string | null {
  if (!bunnyVideoId) return null;
  const origin = bunnyCdnOrigin();
  if (!origin) return null;
  return `${origin}/${bunnyVideoId}/playlist.m3u8`;
}

export type BunnyDeleteResult =
  | { ok: true; alreadyGone: boolean }
  | { ok: false; reason: 'not_configured' | 'api_error'; detail?: string };

/**
 * Delete a video from the Bunny Stream library.
 *
 * A 404 is reported as success (`alreadyGone: true`) — the desired end state
 * is "the video is not there", and treating an already-deleted asset as a
 * failure would make cleanup non-idempotent.
 *
 * Never throws; callers decide whether a failure matters.
 */
export async function deleteBunnyVideo(videoId: string): Promise<BunnyDeleteResult> {
  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      { method: 'DELETE', headers: { AccessKey: env.BUNNY_STREAM_API_KEY } },
    );

    if (res.status === 404) return { ok: true, alreadyGone: true };

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, reason: 'api_error', detail };
    }

    return { ok: true, alreadyGone: false };
  } catch (err: any) {
    return { ok: false, reason: 'api_error', detail: err?.message };
  }
}
