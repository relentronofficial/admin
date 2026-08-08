/**
 * Ad creative storage — TBT_ADS_SPECKIT.md §4.
 *
 * No new bucket and no new upload endpoint: images go through the existing R2
 * presigned-URL flow (`POST /api/upload/presigned-url`) and videos through the
 * existing Bunny Stream flow (`POST /api/upload/bunny-video-create`). This
 * module only owns the ad-specific policy — where creatives live, what is
 * accepted, and when an asset may be destroyed.
 */

import type { PrismaClient } from '@prisma/client';
import { buildHlsUrl, deleteBunnyVideo } from '../../lib/bunny.js';

// ── Where ad creatives live ─────────────────────────────────────────────────

/** Existing shared bucket — deliberately not a new one (§4). */
export const AD_MEDIA_BUCKET = 'site-assets';

export const AD_PATH_PREFIXES = {
  creative: 'ads/creatives',
  thumbnail: 'ads/thumbnails',
  fallback: 'ads/fallbacks',
} as const;

export type AdAssetKind = keyof typeof AD_PATH_PREFIXES;

// ── What is accepted ────────────────────────────────────────────────────────

/**
 * Image creatives. The upload controller runs `sharp` over all of these and
 * stores WebP regardless of what was sent (CLAUDE.md pitfall #27), so this
 * list is about what we can *decode*, not what gets stored.
 */
export const AD_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Matches the 50 MB image body limit already configured on /api/upload. */
export const AD_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

export const AD_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

/** Matches the 500 MB video body limit on /api/upload. */
export const AD_VIDEO_MAX_BYTES = 500 * 1024 * 1024;

export interface MediaValidationResult {
  ok: boolean;
  error?: string;
}

export function validateAdImage(contentType: string, sizeBytes?: number): MediaValidationResult {
  if (!(AD_IMAGE_MIME_TYPES as readonly string[]).includes(contentType.toLowerCase())) {
    return { ok: false, error: `Unsupported image type "${contentType}". Allowed: JPG, PNG, WebP, GIF.` };
  }
  if (sizeBytes !== undefined && sizeBytes > AD_IMAGE_MAX_BYTES) {
    return { ok: false, error: `Image exceeds the ${AD_IMAGE_MAX_BYTES / 1024 / 1024} MB limit.` };
  }
  return { ok: true };
}

export function validateAdVideo(contentType: string, sizeBytes?: number): MediaValidationResult {
  if (!(AD_VIDEO_MIME_TYPES as readonly string[]).includes(contentType.toLowerCase())) {
    return { ok: false, error: `Unsupported video type "${contentType}". Allowed: MP4, WebM, MOV.` };
  }
  if (sizeBytes !== undefined && sizeBytes > AD_VIDEO_MAX_BYTES) {
    return { ok: false, error: `Video exceeds the ${AD_VIDEO_MAX_BYTES / 1024 / 1024} MB limit.` };
  }
  return { ok: true };
}

// ── Derived fields ──────────────────────────────────────────────────────────

/**
 * Resolve the HLS URL for a campaign payload.
 *
 * Derived SERVER-SIDE from `bunnyVideoId` rather than trusting whatever the
 * admin client posted: the client would have to duplicate the bare-hostname
 * normalisation, and a wrong value there means every member gets a silently
 * broken playlist URL. A client-supplied `hlsUrl` is honoured only when there
 * is no `bunnyVideoId` to derive from (externally hosted creatives).
 */
export function resolveHlsUrl(
  bunnyVideoId: string | null | undefined,
  clientSuppliedHlsUrl: string | null | undefined,
): string | null {
  const derived = buildHlsUrl(bunnyVideoId);
  if (derived) return derived;
  return clientSuppliedHlsUrl ?? null;
}

// ── Reachability ────────────────────────────────────────────────────────────

export type ReachabilityResult =
  | { reachable: true }
  | { reachable: false; status: number; url: string }
  /** Could not determine — treated as reachable by callers. */
  | { reachable: true; unknown: true; detail: string };

/**
 * Is this creative actually fetchable right now?
 *
 * Criterion 33 says a campaign cannot be activated without *valid* media, and
 * presence of a URL string is not validity: the commonest real failure is an
 * admin deleting an R2 object or a Bunny video and then activating a campaign
 * that points at it.
 *
 * Only a definitive rejection from the origin (404/410/403) blocks activation.
 * A timeout, DNS failure or 5xx resolves to "reachable" on purpose — the CDN
 * being briefly unhappy must not stop an admin shipping a campaign, and the
 * client already degrades to the fallback creative when a fetch fails at
 * display time (§11). This check exists to catch the typo and the deleted
 * asset, not to be a health monitor.
 */
export async function checkMediaReachable(
  url: string,
  timeoutMs = 5_000,
): Promise<ReachabilityResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal });

    // Some CDNs (and Bunny playlists) answer HEAD with 405 while serving GET
    // perfectly well. Retry once with a ranged GET before calling it broken.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      });
    }

    if (res.status === 404 || res.status === 410 || res.status === 403) {
      return { reachable: false, status: res.status, url };
    }
    return { reachable: true };
  } catch (err: any) {
    return {
      reachable: true,
      unknown: true,
      detail: err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'unknown'),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Destruction ─────────────────────────────────────────────────────────────

export type CreativeCleanupResult =
  | { deleted: false; reason: 'no_video' | 'still_referenced' | 'delete_failed'; referencedBy?: number; detail?: string }
  | { deleted: true; alreadyGone: boolean };

/**
 * Delete a campaign's Bunny video, but only if nothing else points at it.
 *
 * Duplicated campaigns intentionally SHARE a creative (the duplicate handler
 * copies `bunnyVideoId` verbatim), so deleting one campaign must not pull the
 * asset out from under its siblings.
 *
 * Soft-deleted campaigns COUNT as references. They still carry the id and can
 * be restored, and a restored campaign whose creative had been reaped would be
 * silently broken — the failure would surface to members, not to the admin who
 * caused it.
 *
 * R2 image objects are deliberately left in place: the repo has no
 * reference-counting GC for R2, and building one for ads alone is out of scope
 * (§4). Orphaned images cost storage but never break a campaign.
 */
export async function cleanupCampaignCreative(
  prisma: PrismaClient,
  campaignId: string,
  bunnyVideoId: string | null | undefined,
): Promise<CreativeCleanupResult> {
  if (!bunnyVideoId) return { deleted: false, reason: 'no_video' };

  const referencedBy = await prisma.adCampaign.count({
    where: {
      bunnyVideoId,
      id: { not: campaignId },
      // NOTE: no `deletedAt: null` filter — soft-deleted rows are references.
    },
  });

  if (referencedBy > 0) {
    return { deleted: false, reason: 'still_referenced', referencedBy };
  }

  const result = await deleteBunnyVideo(bunnyVideoId);
  if (!result.ok) {
    return { deleted: false, reason: 'delete_failed', detail: result.reason };
  }

  return { deleted: true, alreadyGone: result.alreadyGone };
}
