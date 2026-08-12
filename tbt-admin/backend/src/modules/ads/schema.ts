/**
 * Ad campaign validation — TBT_ADS_SPECKIT.md §13.
 *
 * Backend validation is authoritative; the admin form mirrors these rules for
 * fast feedback but must never be the only gate.
 */

import { z } from 'zod';

// ── Primitives ──────────────────────────────────────────────────────────────

const campaignCodeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Campaign code must be lowercase letters, digits, or hyphens');

const hhMmSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24-hour)');

/** IANA timezone. Validated by asking Intl to use it rather than shipping a
 *  hardcoded list that would go stale. */
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Not a valid IANA timezone identifier' },
);

/**
 * URL with an explicit protocol allowlist (speckit §13/§14).
 * `z.string().url()` happily accepts `javascript:alert(1)`, which lands in an
 * anchor href on two clients — reject anything that is not http(s).
 */
/**
 * Schemes that must never reach an anchor href, a `launchUrl`, or a WebView.
 * Named explicitly (§13) rather than relying on the allowlist alone: the
 * allowlist is what enforces this, but an admin who pastes one of these
 * deserves to be told which scheme was rejected instead of a generic
 * "invalid URL".
 */
const DANGEROUS_URL_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'] as const;

const safeExternalUrlSchema = z
  .string()
  .superRefine((value, ctx) => {
    const trimmed = value.trim().toLowerCase();
    const dangerous = DANGEROUS_URL_SCHEMES.find((s) => trimmed.startsWith(s));
    if (dangerous) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${dangerous}" URLs are not allowed — use http:// or https://`,
      });
      return;
    }

    let proto: string;
    try {
      proto = new URL(value).protocol;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Not a valid URL' });
      return;
    }

    // Allowlist, not a blocklist: the named schemes above are for the error
    // message, this is the actual gate. `z.string().url()` alone accepts
    // `javascript:alert(1)`, which lands in an href on two clients.
    if (proto !== 'http:' && proto !== 'https:') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must use http:// or https://',
      });
    }
  });

/**
 * Route prefixes a CTA may target. Kept in sync with the route tables in
 * `tbt-user-web/app/(platform)` and `tbt_app/lib/core/constants/routes.dart`.
 *
 * The point is not security — `internalRouteSchema` already blocks the
 * open-redirect shapes — it is that a CTA pointing at a route neither client
 * has is a dead end the admin only discovers from a member complaint. Adding a
 * new member-facing section means adding it here too.
 */
export const KNOWN_ROUTE_PREFIXES = [
  '/dashboard', '/tbt', '/courses', '/learning', '/workshops', '/workshop',
  '/events', '/programs', '/batch-program', '/podcasts', '/ebooks',
  '/community', '/messages', '/notifications', '/search', '/history',
  '/support', '/ai-content', '/Products', '/Resources', '/profile',
] as const;

/** Internal app route — must be root-relative and must not be protocol-relative
 *  (`//evil.com` is a same-origin-looking open redirect). */
const internalRouteSchema = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    if (!value.startsWith('/') || value.startsWith('//')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Internal route must start with "/" and cannot start with "//"',
      });
      return;
    }
    // Compare on the path only: `/courses/abc?ref=ad#top` is a legitimate
    // target and must not be rejected for carrying a query or fragment.
    const path = value.split(/[?#]/)[0];
    const known = KNOWN_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    if (!known) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${path}" is not a known app route. Allowed prefixes: ${KNOWN_ROUTE_PREFIXES.join(', ')}`,
      });
    }
  });

/**
 * Strip markup from a free-text field that renders in both clients (§14).
 *
 * user-web renders these as text nodes and Flutter as `Text` widgets, so
 * neither interprets HTML today — this is defence against the day one of them
 * gains a rich-text or `dangerouslySetInnerHTML` path, and against the campaign
 * name reaching somewhere less careful (an email, a CSV export, a webhook).
 *
 * Sanitised rather than rejected: an admin writing "Save 50% <today>" made a
 * typographic choice, not an attack, and bouncing the whole campaign for it
 * would be obnoxious.
 */
function sanitizeText(value: string): string {
  return value
    // Angle brackets first — everything else is cosmetic.
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // Control characters, which can hide payloads in logs and CSVs.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Free text displayed to members. `required` re-checks emptiness AFTER
 * sanitising — `"<b></b>"` passes a naive `min(1)` and then renders as nothing.
 */
const displayText = (max: number, required = false) => {
  const base = z.string().max(max).transform(sanitizeText);
  return required
    ? base.refine((v) => v.length > 0, { message: 'Cannot be empty' })
    : base;
};

export const AD_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'completed', 'archived'] as const;
export const AD_MEDIA_TYPES = ['image', 'video'] as const;
export const AD_OBJECT_FITS = ['contain', 'cover', 'fill'] as const;
export const AD_PLATFORMS = ['mobile', 'web'] as const;
export const AD_OS = ['android', 'ios', 'web'] as const;
export const AD_TRIGGER_TYPES = [
  'app_launch',
  'route_enter',
  'timed_interval',
  // Implemented in a later phase (speckit §2) — accepted by the API so
  // campaigns can be authored ahead of client support, but no client emits
  // these trigger types yet.
  'content_playback',
  'action',
] as const;

export const AD_EVENT_TYPES = [
  'eligible', 'requested', 'impression', 'playback_started', 'playback_paused',
  'playback_resumed', 'skip_available', 'skipped', 'completed', 'closed',
  // `cta_click_failed` is distinct from `cta_clicked`: the user did click, the
  // navigation is what broke (§11). Collapsing the two would make a campaign
  // with an unreachable target look like it was converting.
  'cta_clicked', 'cta_click_failed', 'media_error', 'load_error',
  'frequency_blocked', 'schedule_blocked',
] as const;

// ── Embedded JSON configs ───────────────────────────────────────────────────

const skipConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['seconds', 'percent', 'after_end', 'immediate']).default('seconds'),
  value: z.number().min(0).optional(),
});

const closeConfigSchema = z.object({
  enabled: z.boolean(),
  autoClose: z.boolean().optional(),
  autoCloseSeconds: z.number().int().min(1).max(600).optional(),
});

const ctaConfigSchema = z.object({
  enabled: z.boolean(),
  // Rendered on the CTA button in both clients (§14).
  text: displayText(60, true).optional(),
  type: z.enum(['internal_route', 'external_url']).optional(),
  target: z.string().optional(),
  showAfterSeconds: z.number().min(0).optional(),
  openInNewTab: z.boolean().optional(),
});

const frequencyConfigSchema = z.object({
  mode: z.enum(['once_per_session', 'once_per_day', 'once_per_user', 'unlimited']).default('unlimited'),
  maxPerUser: z.number().int().min(0).optional(),
  maxPerSession: z.number().int().min(0).optional(),
  maxPerDay: z.number().int().min(0).optional(),
  minIntervalSeconds: z.number().int().min(0).optional(),
});

const audienceConfigSchema = z.object({
  scope: z.enum(['all', 'guests', 'authenticated']).default('all'),
  roles: z.array(z.string()).optional(),
  plans: z.array(z.string()).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
  regions: z.array(z.string()).optional(),
});

const triggerConfigSchema = z.object({
  delaySeconds: z.number().int().min(0).optional(),
  afterNLaunches: z.number().int().min(1).optional(),
  repeatIntervalSeconds: z.number().int().min(0).optional(),
  atSeconds: z.array(z.number().min(0)).optional(),
});

const analyticsConfigSchema = z.object({
  trackImpressions: z.boolean().optional(),
  trackPlaybackStart: z.boolean().optional(),
  trackSkip: z.boolean().optional(),
  trackCompletion: z.boolean().optional(),
  trackClick: z.boolean().optional(),
  trackClose: z.boolean().optional(),
  trackErrors: z.boolean().optional(),
});

// ── Campaign create / update ────────────────────────────────────────────────

/**
 * Field validators WITHOUT defaults or required-ness.
 *
 * Defaults live only on the create schema below. This split is load-bearing:
 * `z.object({...}).partial()` does NOT strip `.default()`, so a shared base
 * carrying defaults would make a PATCH of a single field silently reset
 * priority, objectFit, timezone and every config object to their defaults —
 * clobbering the rest of the campaign.
 */
const campaignFields = {
  campaignCode: campaignCodeSchema,
  // Rendered in both clients (§14) — sanitised on the way in, so no client has
  // to be the last line of defence.
  name: displayText(255, true),
  description: displayText(2000).optional().nullable(),
  status: z.enum(AD_STATUSES),
  priority: z.number().int().min(0).max(1000),

  mediaType: z.enum(AD_MEDIA_TYPES),
  mediaUrl: z.string().url().optional().nullable(),
  bunnyVideoId: z.string().max(255).optional().nullable(),
  hlsUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  fallbackMediaUrl: z.string().url().optional().nullable(),
  mediaDurationSeconds: z.number().int().min(0).optional().nullable(),
  objectFit: z.enum(AD_OBJECT_FITS),
  backgroundColor: z.string().max(32).optional().nullable(),
  autoplay: z.boolean(),
  muted: z.boolean(),
  loop: z.boolean(),

  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: timezoneSchema,
  dailyStartTime: hhMmSchema.optional().nullable(),
  dailyEndTime: hhMmSchema.optional().nullable(),
  activeDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),

  targetPlatforms: z.array(z.enum(AD_PLATFORMS)).min(1, 'At least one platform is required'),
  targetOs: z.array(z.enum(AD_OS)).optional().nullable(),
  placements: z.array(z.string().min(1)).min(1, 'At least one placement is required'),
  targetRoutes: z.array(z.string()).optional().nullable(),
  batchIds: z.array(z.string().uuid()).optional().nullable(),
  audienceConfig: audienceConfigSchema,

  triggerType: z.enum(AD_TRIGGER_TYPES),
  triggerConfig: triggerConfigSchema,
  frequencyConfig: frequencyConfigSchema,
  skipConfig: skipConfigSchema,
  closeConfig: closeConfigSchema,
  ctaConfig: ctaConfigSchema.optional().nullable(),
  analyticsConfig: analyticsConfigSchema.optional().nullable(),

  maxTotalImpressions: z.number().int().min(0).optional().nullable(),
};

/** Create: required fields stay required, and defaults are applied here only. */
const campaignBaseSchema = z.object({
  ...campaignFields,
  status: campaignFields.status.optional(),
  priority: campaignFields.priority.default(0),
  objectFit: campaignFields.objectFit.default('contain'),
  autoplay: campaignFields.autoplay.default(true),
  muted: campaignFields.muted.default(true),
  loop: campaignFields.loop.default(false),
  timezone: campaignFields.timezone.default('Asia/Kolkata'),
  audienceConfig: campaignFields.audienceConfig.default({ scope: 'all' }),
  triggerConfig: campaignFields.triggerConfig.default({}),
  frequencyConfig: campaignFields.frequencyConfig.default({ mode: 'unlimited' }),
  skipConfig: campaignFields.skipConfig.default({ enabled: true, type: 'seconds', value: 5 }),
  closeConfig: campaignFields.closeConfig.default({ enabled: false }),
});

/**
 * Cross-field rules. Applied to both create and update via `superRefine` so
 * the same logic runs on a partial patch (after it has been merged with the
 * existing row — see `validateCampaignInvariants`).
 */
function refineCampaign(
  data: {
    startAt?: string; endAt?: string;
    dailyStartTime?: string | null; dailyEndTime?: string | null;
    mediaType?: string; mediaUrl?: string | null; bunnyVideoId?: string | null;
    mediaDurationSeconds?: number | null;
    skipConfig?: z.infer<typeof skipConfigSchema>;
    ctaConfig?: z.infer<typeof ctaConfigSchema> | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'End date must be after start date' });
  }

  // A window where start === end is rejected; start > end is a legitimate
  // overnight window (22:00 → 02:00) and is allowed.
  if (data.dailyStartTime && data.dailyEndTime && data.dailyStartTime === data.dailyEndTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['dailyEndTime'],
      message: 'Daily start and end time cannot be identical',
    });
  }

  if (data.mediaType === 'image') {
    if (!data.mediaUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mediaUrl'], message: 'Image campaigns require a media URL' });
    }
    if (!data.mediaDurationSeconds || data.mediaDurationSeconds <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ['mediaDurationSeconds'],
        message: 'Image campaigns require a display duration greater than zero',
      });
    }
  }

  if (data.mediaType === 'video' && !data.mediaUrl && !data.bunnyVideoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['mediaUrl'],
      message: 'Video campaigns require either a media URL or a Bunny video id',
    });
  }

  const skip = data.skipConfig;
  if (skip?.enabled) {
    if (skip.type === 'seconds') {
      if (typeof skip.value !== 'number') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['skipConfig', 'value'], message: 'Skip seconds is required' });
      } else if (data.mediaDurationSeconds && skip.value > data.mediaDurationSeconds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: ['skipConfig', 'value'],
          message: 'Skip seconds cannot exceed the media duration',
        });
      }
    }
    if (skip.type === 'percent' && (typeof skip.value !== 'number' || skip.value < 0 || skip.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ['skipConfig', 'value'],
        message: 'Skip percentage must be between 0 and 100',
      });
    }
  }

  const cta = data.ctaConfig;
  if (cta?.enabled) {
    if (!cta.text) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ctaConfig', 'text'], message: 'CTA text is required when CTA is enabled' });
    }
    if (!cta.type || !cta.target) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ctaConfig', 'target'], message: 'CTA target is required when CTA is enabled' });
    } else if (cta.type === 'external_url' || cta.type === 'internal_route') {
      const validator =
        cta.type === 'external_url' ? safeExternalUrlSchema : internalRouteSchema;
      const parsed = validator.safeParse(cta.target);
      if (!parsed.success) {
        // Forward the validator's own message rather than a generic one. It is
        // the difference between "invalid URL" and "javascript: URLs are not
        // allowed" / "/nope is not a known app route" — an admin can act on the
        // second, and only guess at the first.
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ctaConfig', 'target'],
          message: parsed.error.issues[0]?.message ?? 'Invalid CTA target',
        });
      }
    }
  }
}

export const createCampaignSchema = campaignBaseSchema.superRefine(refineCampaign);

/**
 * Partial patch, built from the default-free field set so an absent key stays
 * absent instead of resolving to a default and overwriting stored config.
 *
 * Cross-field rules cannot run here because the patch alone is an incomplete
 * picture — the controller merges it with the stored row and calls
 * `validateCampaignInvariants` on the result.
 */
export const updateCampaignSchema = z.object(campaignFields).partial();

export const updateStatusSchema = z.object({
  status: z.enum(AD_STATUSES),
});

/**
 * Re-run cross-field rules against a fully merged campaign. Used on update and
 * — critically — on activation, where a campaign assembled field-by-field over
 * several patches must still be coherent before it can go live.
 */
export function validateCampaignInvariants(merged: Record<string, any>): string[] {
  const issues: string[] = [];
  const collector: z.RefinementCtx = {
    addIssue: (issue: any) => {
      issues.push(issue.message ?? 'Invalid campaign configuration');
    },
    path: [],
  } as unknown as z.RefinementCtx;

  refineCampaign(
    {
      startAt: merged.startAt instanceof Date ? merged.startAt.toISOString() : merged.startAt,
      endAt: merged.endAt instanceof Date ? merged.endAt.toISOString() : merged.endAt,
      dailyStartTime: merged.dailyStartTime,
      dailyEndTime: merged.dailyEndTime,
      mediaType: merged.mediaType,
      mediaUrl: merged.mediaUrl,
      bunnyVideoId: merged.bunnyVideoId,
      mediaDurationSeconds: merged.mediaDurationSeconds,
      skipConfig: merged.skipConfig,
      ctaConfig: merged.ctaConfig,
    },
    collector,
  );

  return issues;
}

// ── Admin list query ────────────────────────────────────────────────────────

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(AD_STATUSES).optional(),
  mediaType: z.enum(AD_MEDIA_TYPES).optional(),
  platform: z.enum(AD_PLATFORMS).optional(),
  placement: z.string().optional(),
  triggerType: z.enum(AD_TRIGGER_TYPES).optional(),
  search: z.string().optional(),
  startFrom: z.string().datetime().optional(),
  startTo: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

// ── Client-facing ───────────────────────────────────────────────────────────

export const eligibleRequestSchema = z.object({
  sessionId: z.string().min(1).max(128),
  anonymousId: z.string().min(1).max(128).optional().nullable(),
  platform: z.enum(AD_PLATFORMS),
  os: z.enum(AD_OS).optional().nullable(),
  placement: z.string().min(1).max(100),
  route: z.string().max(500).optional().nullable(),
  triggerType: z.enum(AD_TRIGGER_TYPES),
  contentId: z.string().max(128).optional().nullable(),
  module: z.string().max(100).optional().nullable(),
  appVersion: z.string().max(50).optional().nullable(),
  launchCount: z.number().int().min(0).optional().nullable(),
  sessionElapsedSeconds: z.number().min(0).optional().nullable(),
  deviceInfo: z.record(z.any()).optional().nullable(),
});

/**
 * `anonymousId` on the tracking payloads is the guest half of the token
 * subject check (§6.4). An authenticated caller is bound to its token by the
 * verified cookie; a guest has no cookie, so it must present the same device
 * id the token was issued to. Optional in the schema because a token issued to
 * a signed-in member does not need it — the controller decides which binding
 * applies from the stored impression, never from the body.
 */
export const impressionSchema = z.object({
  displayToken: z.string().min(1).max(128),
  anonymousId: z.string().min(1).max(128).optional().nullable(),
});

const lifecycleBaseSchema = z.object({
  displayToken: z.string().min(1).max(128),
  anonymousId: z.string().min(1).max(128).optional().nullable(),
  elapsedSeconds: z.number().min(0).optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
});

export const completeSchema = lifecycleBaseSchema;
export const skipSchema = lifecycleBaseSchema;
export const closeSchema = lifecycleBaseSchema;
export const clickSchema = lifecycleBaseSchema;

export const eventsSchema = z.object({
  displayToken: z.string().min(1).max(128),
  anonymousId: z.string().min(1).max(128).optional().nullable(),
  events: z
    .array(
      z.object({
        eventType: z.enum(AD_EVENT_TYPES),
        eventTimestamp: z.string().datetime().optional(),
        elapsedSeconds: z.number().min(0).optional(),
        completionPercentage: z.number().min(0).max(100).optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  campaignId: z.string().uuid().optional(),
});
