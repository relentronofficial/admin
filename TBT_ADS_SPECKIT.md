# TBT Advertisement Campaign System — Speckit

Fully dynamic, admin-controlled fullscreen ad campaigns across **backend + admin panel + user-web + Flutter app**.

Status: **specification — not yet implemented.**
Audit date: 2026-08-06. Written against commit `a25006a`.

Follow section-by-section. Sections 3–5 are foundation; 6–10 are per-client and can be parallelised once the API contract in §5 is frozen.

---

## 0. Stack Reconciliation — READ FIRST

The originating request specified a stack that does **not** match this repository. Every mismatch below is resolved in favour of what the repo actually uses. Do not implement against the assumptions in the left column.

| Request assumed | This repo actually uses | Consequence for this feature |
|---|---|---|
| Node.js / **Express** | **Fastify** (`backend/src/server.ts`, ESM, `tsx` dev) | Routes use `routes.ts` + `controller.ts` + `schema.ts`; `preHandler` middleware, not Express middleware |
| **Supabase Auth** | **Clerk** (admin) + **custom JWT cookies** (members) | `fastify.authenticate` for admin routes, `fastify.authenticateUser` for member routes. `req.memberId`, never `req.member` |
| **Supabase Storage** for media | **Cloudflare R2** (images, presigned PUT) + **Bunny Stream** (video, HLS) | Ad images → existing R2 presigned flow; ad videos → existing Bunny flow. No new bucket |
| **Supabase Realtime** | **Socket.IO** (`plugins/socket.ts`, rooms + `getSocket()` / `getAdminSocket()`) | Campaign invalidation broadcasts over Socket.IO |
| **Supabase RLS policies** | **No client-side Supabase access at all** | RLS is **not applicable** — see §0.1 |
| Supabase **SQL migration files** | Prisma schema + **idempotent raw SQL** in `plugins/prisma.ts` startup; `prisma db push` in CI | No migration files. Follow the documented convention (CLAUDE.md pitfall #28) |
| `/api/admin/ads/*` + `/api/ads/*` split | `/api/<module>` with dual-audience routes in one module | Single `/api/ads` module; `chat-groups` is the precedent |
| Supabase DB client | **Prisma ORM** against Supabase-hosted Postgres | `prisma.adCampaign.*`; raw SQL only where §3 says so |

### 0.1 Why RLS and Supabase Storage policies are out of scope

The `supabase` plugin (`backend/src/plugins/supabase.ts`) constructs a client with `SUPABASE_SERVICE_KEY` and is used in exactly **two** files (`modules/upload/controller.ts`, `modules/user/controller.ts`). Supabase here is the *Postgres host*; the app talks to it through Prisma over a direct connection.

No client — not user-web, not Flutter, not the admin panel — holds a Supabase anon key or opens a Supabase connection. Every read and write goes through an authenticated Fastify endpoint. Row-level security would therefore protect nothing that authentication does not already protect, while adding a policy surface nobody exercises and a second source of truth for authorization.

**Authorization for ads is enforced in the route layer**, exactly like every other module: `fastify.authenticate` (Clerk) for admin routes, `fastify.authenticateUser` (JWT) for member routes. This is a deliberate deviation from the request, not an oversight. If a genuine client-direct-to-Supabase path is ever introduced, RLS becomes necessary and this decision must be revisited.

### 0.2 Two consequences worth knowing before you design the admin UI

- **Uploaded images are silently converted to WebP.** `modules/upload/controller.ts` runs `sharp` over JPEG/PNG/WebP/GIF at quality 85 and stores `.webp` regardless of input. Ad creatives inherit this. Accept `image/*` in the file input and do not build a format guard; do surface the converted `publicUrl` in the preview so admins see what will actually ship.
- **Video goes through Bunny Stream, not raw file storage.** Ad videos use `useCreateBunnyVideo` and are served as HLS (`playlist.m3u8`), with the Bunny iframe as fallback — the same two-tier pattern as course and workshop episodes (CLAUDE.md pitfall #19). `BUNNY_CDN_URL` lacks the `https://` prefix; normalise it (pitfall #20).

---

## 1. Integration Point Inventory

Everything below was verified in the repo. These are the exact seams the feature attaches to.

### 1.1 Media players that must be pausable (the hard part)

**user-web**

| Player | File | Control surface |
|---|---|---|
| Plyr + hls.js | `components/features/video/PlyrPlayer.tsx` | `PlyrPlayerHandle` ref → `.pause()`, `.play()`, `.currentTime` |
| Bunny iframe (HLS fallback) | inline in course/workshop pages | `postMessage({context:"player.js", method:"pause"\|"play"}, "https://iframe.mediadelivery.net")` |
| Podcast audio | `components/features/podcasts/AudioController.tsx` | Single hidden `<audio>`; drive via `usePodcastPlayer` store `setPlaying(false)` |
| Community inline video | `components/features/community/{MediaViewer,PostCard,Composer}.tsx` | Raw `<video>` elements |
| LiveKit room | `app/(platform)/live/[webinarId]/page.tsx` | **Do not interrupt** — see §7.4 |

**Precedent already in the codebase:** `app/(platform)/learning/[courseId]/page.tsx` defines `pausePlayerRef` / `resumePlayerRef` that branch on HLS-vs-iframe, built for cue quizzes. **Generalise this, do not reinvent it** — it is proven against both transports.

**Flutter**

| Player | File | Control surface |
|---|---|---|
| `better_player_plus` | `features/courses/presentation/lesson_player_screen.dart`, `features/workshops/presentation/workshop_episode_player_screen.dart` | `BetterPlayerController.pause()/play()/videoPlayerController.position` |
| `just_audio` | `features/podcasts/data/podcast_player_controller.dart` | `PodcastPlayerController` (`ChangeNotifier`) — `pause()`, `seek()`, `player.position` |
| `video_player` | `features/auth/presentation/video_splash_screen.dart`, `features/community/presentation/video_viewer.dart` | `VideoPlayerController` |
| `webview_flutter` | `features/live/presentation/webinar_screen.dart` | **Do not interrupt** |

### 1.2 Mount points

| Client | Mount point | Notes |
|---|---|---|
| user-web | `app/(platform)/layout.tsx` | Already hosts `<AudioController />` + `<MiniPlayer />` — add `<AdHost />` as a sibling. Inside `SubscriptionGate`'s tree but outside the `max-w-[1440px]` container |
| Flutter | `_AppShell` in `lib/app.dart` (`StatefulShellRoute.indexedStack`) | Wrap the shell body in `AdHost`. `_handleBack()` already owns back-button policy — ad close rules hook in here |
| Admin | `admin-panel/app/ads/page.tsx` + sidebar entry | Under a Marketing/Communication group |
| Backend | `backend/src/modules/ads/` | Registered in `server.ts` at `/api/ads` |

### 1.3 Existing infrastructure to reuse

- **Rate limiting**: `@fastify/rate-limit` v9 already registered in `server.ts` with Redis backing. Reuse for tracking endpoints.
- **Device ID**: `tbt_device_id` in `localStorage` (user-web, `lib/api/client.ts`) and mirrored in Flutter (`core/utils/device_id.dart`). **Use this as the guest identity** — do not invent a second anonymous ID.
- **Server clock**: `getServerNow()` (user-web) corrects for client clock skew via the HTTP `Date` header. **All countdowns and schedule checks use it**, never `Date.now()`.
- **Cache invalidation**: `lib/cache.ts` → `invalidateCache(redis, key)`.
- **Upload**: `useGetPresignedUrl` from `useAdmin` (not `useTbt`), `useCreateBunnyVideo` for video.

---

## 2. Scope and Phasing

Ship in four phases. Each is independently deployable and leaves the system working.

| Phase | Contents | Exit criterion |
|---|---|---|
| **P1 — Foundation** | Data model, `/api/ads` module, eligibility engine, admin CRUD + list, R2/Bunny upload wiring | Admin can create/activate a campaign; `POST /api/ads/eligible` returns it. No client rendering yet |
| **P2 — Web client** | `AdHost`, fullscreen overlay, image + video ad, skip/close/CTA, media interruption on user-web, impression + event tracking | Criteria 15, 19–27 pass on web |
| **P3 — Mobile client** | Flutter `AdHost`, overlay, interruption coordinator, lifecycle handling | Criteria 14, 19–27 pass on mobile |
| **P4 — Analytics + realtime** | Admin analytics page, Socket.IO campaign invalidation, preview modes | Criteria 28, plus live campaign toggles without app release |

**Trigger types are also phased.** P1–P3 implement `app_launch`, `route_enter`, and `timed_interval` only. `content_playback`, `action`, and mid-roll timestamp triggers land in a follow-up — they need per-player instrumentation in six separate screens and would otherwise stall the whole feature. This is called out in §16 as a known scope limit, not silently dropped.

---

## 3. Data Model

Follow CLAUDE.md pitfall #28: add Prisma models to `schema.prisma` **and** idempotent `CREATE TABLE IF NOT EXISTS` to `plugins/prisma.ts` startup. `prisma db push` in CI keeps prod in sync.

All four tables get Prisma models — there is no reason for these to be raw-SQL-only, and Prisma models give the controller type safety on a large surface.

### 3.1 `ad_campaigns`

```prisma
model AdCampaign {
  id                     String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaignCode           String    @unique @map("campaign_code")
  name                   String
  description            String?
  status                 String    @default("draft")   // draft|scheduled|active|paused|completed|archived
  priority               Int       @default(0)

  // Creative
  mediaType              String    @map("media_type")  // image|video
  mediaUrl               String?   @map("media_url")
  bunnyVideoId           String?   @map("bunny_video_id")
  hlsUrl                 String?   @map("hls_url")
  thumbnailUrl           String?   @map("thumbnail_url")
  fallbackMediaUrl       String?   @map("fallback_media_url")
  mediaDurationSeconds   Int?      @map("media_duration_seconds")
  objectFit              String    @default("contain") @map("object_fit")  // contain|cover|fill
  backgroundColor        String?   @map("background_color")
  autoplay               Boolean   @default(true)
  muted                  Boolean   @default(true)
  loop                   Boolean   @default(false)

  // Schedule — stored UTC, evaluated in `timezone`
  startAt                DateTime  @map("start_at")  @db.Timestamptz(6)
  endAt                  DateTime  @map("end_at")    @db.Timestamptz(6)
  timezone               String    @default("Asia/Kolkata")
  dailyStartTime         String?   @map("daily_start_time")  // "HH:mm"
  dailyEndTime           String?   @map("daily_end_time")
  activeDays             Json?     @map("active_days")       // [0..6], null = all

  // Targeting
  targetPlatforms        Json      @map("target_platforms")  // ["mobile","web"]
  targetOs               Json?     @map("target_os")         // ["android","ios","web"]
  placements             Json                                 // ["app_launch","home",...]
  targetRoutes           Json?     @map("target_routes")
  audienceConfig         Json      @map("audience_config")
  batchIds               Json?     @map("batch_ids")          // reuses the project-wide batch access convention

  // Behaviour
  triggerType            String    @map("trigger_type")
  triggerConfig          Json      @map("trigger_config")
  frequencyConfig        Json      @map("frequency_config")
  skipConfig             Json      @map("skip_config")
  closeConfig            Json      @map("close_config")
  ctaConfig              Json?     @map("cta_config")
  analyticsConfig        Json?     @map("analytics_config")

  // Caps
  maxTotalImpressions    BigInt?   @map("max_total_impressions")
  currentImpressionCount BigInt    @default(0) @map("current_impression_count")

  createdBy              String?   @map("created_by") @db.Uuid
  updatedBy              String?   @map("updated_by") @db.Uuid
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt              DateTime? @map("deleted_at") @db.Timestamptz(6)

  impressions AdImpression[]
  events      AdEvent[]
  frequency   AdUserFrequency[]

  @@index([status, startAt, endAt])
  @@index([status, priority(sort: Desc), startAt])
  @@map("ad_campaigns")
}
```

**Time model.** `startAt` / `endAt` are absolute UTC instants — unambiguous, directly indexable. `dailyStartTime` / `dailyEndTime` / `activeDays` are wall-clock recurrence rules evaluated **in `timezone`** at request time. This split matters: a campaign running "09:00–17:00 IST daily" cannot be expressed as UTC instants once DST or a timezone change enters the picture. Evaluate recurrence with a real timezone library, never by adding a fixed offset.

`activeDays` uses `0 = Sunday` to match JS `getDay()` and Postgres `EXTRACT(DOW)`. Dart's `DateTime.weekday` is `1 = Monday, 7 = Sunday` — **convert at the boundary**; this is a live off-by-one waiting to happen.

**Embedded JSON config shapes** (validate with Zod in `schema.ts`):

```jsonc
// skipConfig
{ "enabled": true, "type": "seconds" | "percent" | "after_end" | "immediate", "value": 5 }

// closeConfig
{ "enabled": false, "autoClose": true, "autoCloseSeconds": 10 }

// ctaConfig
{ "enabled": true, "text": "Learn More", "type": "internal_route" | "external_url",
  "target": "/courses/abc", "showAfterSeconds": 3, "openInNewTab": true }

// frequencyConfig
{ "mode": "once_per_session" | "once_per_day" | "once_per_user" | "unlimited",
  "maxPerUser": 3, "maxPerSession": 1, "maxPerDay": 2, "minIntervalSeconds": 300 }

// audienceConfig
{ "scope": "all" | "guests" | "authenticated",
  "roles": [], "plans": ["premium"], "memberIds": [], "regions": [] }

// triggerConfig
{ "delaySeconds": 0, "afterNLaunches": 3, "repeatIntervalSeconds": 600 }
```

### 3.2 `ad_impressions`

One row per *shown* ad. `displayToken` is the idempotency key for the entire lifecycle.

```prisma
model AdImpression {
  id                        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaignId                String    @map("campaign_id") @db.Uuid
  memberId                  String?   @map("member_id") @db.Uuid
  anonymousId               String?   @map("anonymous_id")     // tbt_device_id
  displayToken              String    @unique @map("display_token")
  sessionId                 String    @map("session_id")
  platform                  String
  placement                 String
  route                     String?
  displayedAt               DateTime? @map("displayed_at") @db.Timestamptz(6)
  playbackStartedAt         DateTime? @map("playback_started_at") @db.Timestamptz(6)
  completedAt               DateTime? @map("completed_at") @db.Timestamptz(6)
  skippedAt                 DateTime? @map("skipped_at") @db.Timestamptz(6)
  closedAt                  DateTime? @map("closed_at") @db.Timestamptz(6)
  clickedAt                 DateTime? @map("clicked_at") @db.Timestamptz(6)
  watchedSeconds            Decimal   @default(0) @db.Decimal(10, 2) @map("watched_seconds")
  completionPercentage      Decimal   @default(0) @db.Decimal(5, 2) @map("completion_percentage")
  skipAvailableAfterSeconds Decimal?  @map("skip_available_after_seconds") @db.Decimal(10, 2)
  userAgent                 String?   @map("user_agent")
  deviceInfo                Json?     @map("device_info")
  metadata                  Json?
  createdAt                 DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  campaign AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, createdAt(sort: Desc)])
  @@index([memberId, campaignId])
  @@index([anonymousId, campaignId])
  @@index([sessionId, campaignId])
  @@map("ad_impressions")
}
```

**`displayedAt` is nullable and that is the point.** The row is created at selection time (when `/eligible` issues the token) but `displayedAt` stays null until the client confirms the ad actually rendered. An issued-but-never-shown token is a *selection*, not an *impression*. Analytics must count `displayedAt IS NOT NULL`, and the frequency cap in §6 must too — otherwise a user who never saw an ad (network died between selection and render) burns their daily cap.

### 3.3 `ad_events`

Append-only audit trail. `ad_impressions` holds the rolled-up state; this holds the sequence.

```prisma
model AdEvent {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaignId           String   @map("campaign_id") @db.Uuid
  impressionId         String?  @map("impression_id") @db.Uuid
  memberId             String?  @map("member_id") @db.Uuid
  eventType            String   @map("event_type")
  eventTimestamp       DateTime @map("event_timestamp") @db.Timestamptz(6)
  elapsedSeconds       Decimal? @db.Decimal(10, 2) @map("elapsed_seconds")
  completionPercentage Decimal? @db.Decimal(5, 2) @map("completion_percentage")
  platform             String?
  placement            String?
  metadata             Json?
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  campaign AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, eventType, createdAt(sort: Desc)])
  @@index([impressionId])
  @@map("ad_events")
}
```

Event types: `eligible` · `requested` · `impression` · `playback_started` · `playback_paused` · `playback_resumed` · `skip_available` · `skipped` · `completed` · `closed` · `cta_clicked` · `media_error` · `load_error` · `frequency_blocked` · `schedule_blocked`.

Write `frequency_blocked` / `schedule_blocked` **only when a campaign was otherwise eligible and lost on that specific rule** — logging a row per non-matching campaign per request would generate enormous write volume for no analytical value.

### 3.4 `ad_user_frequency`

Denormalised counters so the cap check is one indexed read, not an aggregate over `ad_impressions`.

```prisma
model AdUserFrequency {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaignId       String    @map("campaign_id") @db.Uuid
  memberId         String?   @map("member_id") @db.Uuid
  anonymousId      String?   @map("anonymous_id")
  sessionId        String    @map("session_id")
  impressionCount  Int       @default(0) @map("impression_count")
  lastImpressionAt DateTime? @map("last_impression_at") @db.Timestamptz(6)
  lastCompletedAt  DateTime? @map("last_completed_at") @db.Timestamptz(6)
  dayBucket        String    @map("day_bucket")   // "YYYY-MM-DD" in campaign timezone
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  campaign AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, memberId, anonymousId, sessionId, dayBucket], name: "ad_freq_identity")
  @@index([campaignId, memberId])
  @@map("ad_user_frequency")
}
```

Postgres treats `NULL`s as distinct in unique constraints, so a composite key mixing nullable `memberId` and `anonymousId` will **not** dedupe. Resolve identity to a single non-null `subjectKey` before writing:

```
subjectKey = memberId ? `m:${memberId}` : `a:${anonymousId}`
```

Store it in a dedicated non-null `subject_key` column and make the unique constraint `(campaignId, subjectKey, sessionId, dayBucket)`. Keep `memberId` / `anonymousId` alongside for querying. **Add this column when implementing — the shape above is otherwise silently broken.**

### 3.5 Check constraints

Add via raw SQL in `prisma.ts` (Prisma cannot express these):

```sql
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_status_chk
  CHECK (status IN ('draft','scheduled','active','paused','completed','archived'));
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_media_type_chk
  CHECK (media_type IN ('image','video'));
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_dates_chk
  CHECK (end_at > start_at);
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_priority_chk
  CHECK (priority BETWEEN 0 AND 1000);
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_impressions_chk
  CHECK (max_total_impressions IS NULL OR max_total_impressions >= 0);
```

Wrap each in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for idempotency.

---

## 4. Media Storage

**No new bucket.** Reuse the existing pipeline.

| Asset | Path | Mechanism |
|---|---|---|
| Image creative | bucket `site-assets`, prefix `ads/creatives` | `useGetPresignedUrl` → PUT → `publicUrl`. Auto-converted to WebP |
| Thumbnail / poster | `ads/thumbnails` | same |
| Fallback image | `ads/fallbacks` | same |
| Video creative | Bunny Stream library | `useCreateBunnyVideo` → upload → store `bunnyVideoId` + derived `hlsUrl` |

Construct the HLS URL with the normalisation from CLAUDE.md pitfall #20:

```ts
const cdn = env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`;
const hlsUrl = `${cdn.replace(/\/$/, '')}/${bunnyVideoId}/playlist.m3u8`;
```

**Deletion.** On hard-delete of a campaign, delete the Bunny video via `useDeleteBunnyVideo` **only after** confirming no other campaign references the same `bunnyVideoId` (duplicated campaigns share creatives by design). R2 objects are left in place — the repo has no reference-counting GC for R2 and building one for ads alone is out of scope. Soft-delete (`deletedAt`) is the default; hard delete is admin-explicit.

---

## 5. Backend API — `/api/ads`

New module `backend/src/modules/ads/` with `routes.ts`, `controller.ts`, `schema.ts`, plus `eligibility.ts` (pure selection logic, see §6).

Single module, dual audience — mirror `chat-groups`.

### 5.1 Admin routes (`preHandler: fastify.authenticate`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/ads/campaigns` | Paginated list; filters: status, mediaType, platform, placement, triggerType, dateRange, search |
| `GET` | `/api/ads/campaigns/:id` | Full campaign |
| `POST` | `/api/ads/campaigns` | Create (status forced to `draft`) |
| `PUT` | `/api/ads/campaigns/:id` | Update |
| `PATCH` | `/api/ads/campaigns/:id/status` | Activate / pause / archive / complete |
| `POST` | `/api/ads/campaigns/:id/duplicate` | Deep copy; new code, status `draft`, counters zeroed |
| `DELETE` | `/api/ads/campaigns/:id` | Soft delete (`?hard=true` for permanent) |
| `GET` | `/api/ads/campaigns/:id/analytics` | Per-campaign metrics |
| `GET` | `/api/ads/analytics/overview` | Cross-campaign rollup |

Media upload reuses `/api/upload/*` — **no new upload endpoints.**

### 5.2 Member routes (`preHandler: fastify.authenticateUser`)

Ads must also reach guests, but `authenticateUser` rejects unauthenticated requests. Register the client routes under **`/api/pub/ads/*`** with an *optional-auth* preHandler that resolves `memberId` when a valid `tbt_access` cookie is present and falls back to `anonymousId` otherwise. `/api/pub/*` is already the unauthenticated prefix (`pub/config/site` etc.), so this is consistent rather than a new pattern.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/pub/ads/eligible` | Select at most one campaign; issue `displayToken` |
| `POST` | `/api/pub/ads/impression` | Confirm actual render; sets `displayedAt`, increments counters |
| `POST` | `/api/pub/ads/events` | Batched event ingestion |
| `POST` | `/api/pub/ads/complete` | Completion (token in body) |
| `POST` | `/api/pub/ads/skip` | Skip |
| `POST` | `/api/pub/ads/close` | Close |
| `POST` | `/api/pub/ads/click` | CTA click — record **before** navigation |

Use `displayToken` in the body as the subject for all lifecycle calls rather than `:campaignId` in the path. The token already identifies the campaign, the user, and the session, and it is the thing that must be validated — a path campaign ID invites forged pairings.

Apply `@fastify/rate-limit` to the tracking routes: 60/min per IP on `/events`, 30/min on the lifecycle routes.

### 5.3 `POST /api/pub/ads/eligible`

Request:
```jsonc
{
  "sessionId": "uuid-per-app-session",
  "anonymousId": "tbt_device_id value",
  "platform": "web" | "mobile",
  "os": "android" | "ios" | "web",
  "placement": "app_launch",
  "route": "/dashboard",
  "triggerType": "app_launch",
  "contentId": null,
  "module": "dashboard",
  "appVersion": "1.0.0",
  "launchCount": 4,
  "deviceInfo": { "model": "...", "screen": "..." }
}
```

Response (ad available):
```jsonc
{
  "success": true,
  "data": {
    "showAd": true,
    "displayToken": "opaque-uuid",
    "campaign": {
      "id": "uuid",
      "name": "Diwali Promo",
      "mediaType": "video",
      "mediaUrl": "https://.../playlist.m3u8",
      "videoType": "hls",
      "thumbnailUrl": "https://...",
      "fallbackMediaUrl": null,
      "durationSeconds": 30,
      "objectFit": "contain",
      "backgroundColor": "#000000",
      "autoplay": true, "muted": true, "loop": false,
      "skipConfig":  { "enabled": true, "type": "seconds", "value": 5 },
      "closeConfig": { "enabled": false, "autoClose": true, "autoCloseSeconds": 10 },
      "ctaConfig":   { "enabled": true, "text": "Learn More", "type": "internal_route",
                       "target": "/courses/abc", "showAfterSeconds": 3 }
    }
  }
}
```

Response (nothing eligible):
```jsonc
{ "success": true, "data": { "showAd": false, "campaign": null } }
```

Note `videoType: "hls" | "iframe"` — same discriminator the course/workshop playback endpoints already return, so clients can reuse the existing two-tier player selection.

**The `apiClient` response interceptor unwraps `response.data`**, so hooks receive `{ success, data }` — access the payload as `data?.data`. Do not double-nest (CLAUDE.md pitfall #8).

**Never return the campaign list to the client.** Selection is server-side and final.

---

## 6. Eligibility Engine

Isolate in `backend/src/modules/ads/eligibility.ts` as **pure functions over injected inputs** — no Prisma calls, no `new Date()` inside. The controller fetches candidates and passes `now` explicitly. This is what makes the engine unit-testable (§15) and deterministic.

### 6.1 Selection pipeline

```
1. Candidates: status='active' AND deleted_at IS NULL
                AND start_at <= now AND end_at > now
                (indexed: [status, startAt, endAt])
2. Recurrence:  day-of-week ∈ activeDays  AND  daily window contains now,
                both evaluated in campaign.timezone
3. Platform:    request.platform ∈ targetPlatforms
4. OS:          targetOs null OR request.os ∈ targetOs
5. Placement:   request.placement ∈ placements
6. Route:       targetRoutes null OR request.route matches (prefix/glob)
7. Trigger:     request.triggerType === campaign.triggerType
                + triggerConfig satisfied (delay, afterNLaunches, repeatInterval)
8. Audience:    scope / roles / plans / memberIds / batchIds
9. Total cap:   max_total_impressions IS NULL OR current_impression_count < cap
10. Frequency:  per-subject caps from ad_user_frequency (§6.2)
11. Sort:       priority DESC, start_at ASC, created_at ASC, id ASC
12. Take first. Issue token. Emit `eligible`.
```

Step 11's tie-breaker chain must end in `id ASC` so ordering is **total** — priority, `startAt`, and `createdAt` can all collide (bulk-created campaigns share a timestamp), and a non-total sort makes selection non-deterministic across Postgres query plans. Criterion 18 is not met without this.

### 6.2 Frequency enforcement

Server-authoritative. Client-side storage is an optimisation only, never the source of truth.

Check against `ad_user_frequency` for `subjectKey` (§3.4):

| Mode | Check |
|---|---|
| `once_per_session` | no row for this `sessionId` with `impressionCount > 0` |
| `once_per_day` | no row for today's `dayBucket` (campaign timezone) |
| `once_per_user` | `SUM(impressionCount)` across all buckets = 0 |
| `maxPerSession` / `maxPerDay` / `maxPerUser` | respective counts below limit |
| `minIntervalSeconds` | `now - lastImpressionAt >= minIntervalSeconds` |

`dayBucket` is computed in the **campaign's** timezone, not the server's or the user's — "once per day" for an IST campaign must roll over at IST midnight.

### 6.3 Race conditions

Two devices requesting simultaneously can both pass a `maxPerUser: 1` check. Increment atomically at **impression confirmation** (`/impression`), not at selection:

```sql
INSERT INTO ad_user_frequency (campaign_id, subject_key, session_id, day_bucket, impression_count, last_impression_at)
VALUES ($1, $2, $3, $4, 1, NOW())
ON CONFLICT (campaign_id, subject_key, session_id, day_bucket)
DO UPDATE SET impression_count = ad_user_frequency.impression_count + 1,
              last_impression_at = NOW()
RETURNING impression_count;
```

Then enforce the total cap in the same transaction:

```sql
UPDATE ad_campaigns
SET current_impression_count = current_impression_count + 1
WHERE id = $1
  AND (max_total_impressions IS NULL OR current_impression_count < max_total_impressions)
RETURNING current_impression_count;
```

Zero rows returned ⇒ cap hit between selection and render. Accept the impression (the user has already seen it — refusing to record it only corrupts analytics) but flip the campaign to `completed` and log it. A small overshoot is the correct trade against holding a lock across a client round-trip.

### 6.4 Display token

UUIDv4, single-use per lifecycle phase. Validation on every tracking call:

- Token exists, and its `campaignId` matches the claim.
- Token's subject matches the caller's resolved identity (authenticated `memberId` from the JWT — **never** a client-supplied `memberId`).
- Token age < 30 minutes.
- Phase not already recorded: reject a second `completed` / `skipped` / `impression` for the same token (idempotent 200 with `{ duplicate: true }`, not a 4xx — clients retry on flaky networks and must not treat that as an error).

---

## 7. Media Interruption — Cross-Client Contract

The single highest-risk part of this feature. Both clients implement the **same contract**.

### 7.1 The contract

```ts
interface InterruptibleMedia {
  id: string;
  kind: "video" | "audio";
  isPlaying(): boolean;
  getPosition(): number;   // seconds
  pause(): void;
  resume(): void;
  seek(s: number): void;
}
```

Players **register** on mount and **deregister** on unmount. The coordinator never reaches into a player directly.

### 7.2 Interruption sequence

```
AD START
  1. snapshot = registry.map(p => ({ id, wasPlaying: p.isPlaying(), position: p.getPosition() }))
  2. for each p where wasPlaying: p.pause()
  3. store snapshot in the coordinator (NOT in component state — components may unmount)
  4. render ad overlay

AD END (completed | skipped | closed | errored | timed out)
  5. remove overlay
  6. for each entry in snapshot:
       - if player no longer registered → drop silently
       - if entry.wasPlaying === false → DO NOT resume        (criterion 21)
       - else: p.seek(entry.position); p.resume()
  7. clear snapshot
```

**`wasPlaying === false` must not resume.** This is criterion 21 and the single easiest thing to get wrong — a naive "resume everything" implementation passes every other test and fails this one.

**Restore even on the error paths.** Every ad-teardown route — media error, load timeout, campaign expiry mid-view, back button, tab close — runs step 6. Wire teardown through one `endAd(reason)` function so there is exactly one exit path; multiple exit paths is how "video never resumes" bugs ship.

### 7.3 Audio overlap

Pause happens **before** the overlay mounts and the ad's own media is created. Never overlap (criterion 22). On Flutter, `just_audio` background playback continues when the app is backgrounded — the coordinator must pause it explicitly rather than relying on lifecycle events.

### 7.4 Suppression contexts — do not show ads at all

Ads are **suppressed**, not queued, in these contexts:

| Context | Why |
|---|---|
| LiveKit live call / webinar (`live/[webinarId]`, `webinar_screen.dart`) | Real-time session; interrupting drops the user from a call they cannot rejoin mid-stream |
| Login / signup / OTP verification | Auth flows are off-limits per CLAUDE.md; an overlay here risks lockout |
| An open cue-quiz modal (course player) | Already a modal interruption; stacking two is incoherent |
| `PendingInterceptor` / `FreeInterceptor` overlays active | User is already gated |
| An ad is already showing | Criterion 30 |

The coordinator exposes `suppress(reason)` / `unsuppress(reason)` as a **ref-counted set**, not a boolean — nested suppressions (a cue quiz inside a course inside a gate) must not have the inner `unsuppress` clear the outer one.

---

## 8. Admin Panel

New page `admin-panel/app/ads/page.tsx`. Monolithic multi-tab, matching `courses/page.tsx` and `workshops/page.tsx`. Hooks appended to the bottom of `lib/hooks/useTbt.ts`.

Design system per CLAUDE.md: `bg-[#0f0f0f]` page, `bg-[#181818]` card, `bg-[#1a1a1a]` input, `#dc2626` accent, `font-rajdhani` uppercase labels.

### 8.1 Hooks (`useTbt.ts`)

`useListAdCampaigns(params)` · `useGetAdCampaign(id)` · `useCreateAdCampaign` · `useUpdateAdCampaign` · `useUpdateAdCampaignStatus` · `useDuplicateAdCampaign` · `useDeleteAdCampaign` · `useAdCampaignAnalytics(id, range)` · `useAdAnalyticsOverview(range)`

### 8.2 Tabs

**Campaigns** — table: name, code, media type, platform, placement, start, end, priority, status badge, impressions, clicks, completion %, updated, actions. Filters + search + pagination. Row actions: view, edit, duplicate, activate/pause, archive, delete, analytics.

**Create / Edit** — sectioned form: Basic · Media · Schedule · Platforms · Placement · Trigger · Audience · Frequency · Skip & Close · CTA · Tracking. Campaign code auto-slugs from name in **create mode only** (pitfall #4). Placement and platform are **multi-select checkboxes**, matching the batch-access convention.

Video duration is auto-detected client-side with the existing `detectDuration` helper before upload, so `mediaDurationSeconds` is populated without a round-trip — required to validate skip-seconds against duration.

**Preview** — renders the real overlay component in mobile-portrait / mobile-landscape / tablet / desktop frames, with live countdown, skip gating, CTA, and close behaviour. Preview imports the **same** overlay component the web client uses, parameterised by a `preview` flag that stubs tracking. A separate mock preview drifts from production behaviour and is worse than none.

**Analytics** — impressions, unique reach, video starts/completions, completion rate, skips + rate, CTA clicks + CTR, closes, errors, avg view duration; breakdowns by day / platform / placement / role. Date + campaign filters.

Charting: check for an existing library in `admin-panel` first (the `/analytics` page has precedent). If none, render tables and a CSS-bar sparkline rather than adding a charting dependency.

### 8.3 Sidebar

Add "Ad Campaigns" under the Communication group in `components/Sidebar.tsx`.

---

## 9. user-web Implementation

```
components/features/ads/
  AdHost.tsx                 # mounted once in (platform)/layout.tsx
  FullscreenAdOverlay.tsx    # portal, z-index above Navbar and MiniPlayer
  ImageAdView.tsx
  VideoAdView.tsx            # PlyrPlayer for HLS, Bunny iframe fallback
  AdCountdown.tsx
lib/ads/
  mediaRegistry.ts           # InterruptibleMedia registry (§7)
  adTriggers.ts              # launch / route / interval triggers
  session.ts                 # sessionId + anonymousId resolution
lib/hooks/useAds.ts
lib/api/services/ads.service.ts
```

Follow the project service-layer rule: hooks call `ads.service.ts`, never `apiClient` directly.

**Requirements**

- Mount `<AdHost />` in `app/(platform)/layout.tsx` beside `<AudioController />`.
- Render via `createPortal` to `document.body` — inside the layout tree it would sit under the `max-w-[1440px]` container and inherit stacking context.
- Lock `document.body.style.overflow` while shown; restore the **previous** value on teardown, not a hardcoded `""` (the podcast MiniPlayer may have set it).
- **Track the impression only when actually visible** — `IntersectionObserver` or a mount-confirmed effect, then `POST /impression`. Selection ≠ impression (§3.2).
- Autoplay: attempt unmuted only if `campaign.muted === false`; on rejection, fall back to muted and show an unmute affordance. Never let a rejected `play()` promise abort the flow.
- `visibilitychange`: pause ad playback when hidden, resume when visible. Do **not** count hidden time toward skip-gate elapsed — that is how skip gates get bypassed by backgrounding a tab.
- Escape key closes **only** when `closeConfig.enabled`.
- CTA: `POST /click` **before** navigating. Internal → `router.push`. External → `window.open(url, "_blank", "noopener,noreferrer")` after validating the protocol is `http:` or `https:` (§13).
- All strings from `uiStrings` (skip label, countdown, CTA fallback, error) — pitfall #1. Add keys to the config module; nothing hardcoded.
- Colors from CSS custom properties, not literals — pitfall #2.
- `useRef<T | undefined>(undefined)` — React 19 requires an initial value (pitfall #7).

**Skip-gate timing** is driven by the video element's own `currentTime` for video ads (not wall-clock), so buffering does not unlock skip early. For image ads, use a wall-clock timer seeded from `getServerNow()`, paused while the tab is hidden.

---

## 10. Flutter Implementation

```
lib/features/ads/
  data/
    ad_repository.dart
    ad_models.dart              # freezed + json_serializable
  providers/
    ad_campaign_provider.dart   # @riverpod
    ad_session_provider.dart
  presentation/
    ad_host.dart                # wraps _AppShell body
    fullscreen_ad_overlay.dart
    image_ad_view.dart
    video_ad_view.dart
lib/shared/media/
  media_interruption_coordinator.dart
  interruptible_media.dart
```

Add every endpoint to `lib/core/constants/api.dart` as `const String k*` — never inline paths (§1.3).

**Requirements**

- Wrap the `_AppShell` body in `AdHost` so the overlay covers the bottom nav and preserves branch state. Use an `Overlay` entry or a root `Stack`, **not** a route push — a pushed route destroys the current screen's state, violating the "do not destroy page state" requirement.
- Run codegen after adding any `@riverpod` / `@freezed` class: `dart run build_runner build --delete-conflicting-outputs`.
- `WidgetsBindingObserver` for lifecycle: on `paused`, pause ad playback and stop the skip timer; on `resumed`, continue. Elapsed time must not accrue while backgrounded.
- Back button: intercept in `_AppShell._handleBack()`. While an ad is showing, back is swallowed unless `closeConfig.enabled` and the close gate has opened. Never trap the user — the §11 timeout always fires.
- Dispose every controller in `dispose()`; guard against disposal races (`if (!mounted) return`) — the existing player screens show the pattern.
- Debounce eligibility calls. Riverpod rebuilds are cheap but HTTP is not; the `DedupInterceptor` already collapses duplicate in-flight GETs, but `/eligible` is a POST and is **not** covered — add an explicit in-flight guard in the provider.
- Video: reuse `better_player_plus` with `tbt_video_player_config.dart`. Do not add a second video package.
- Convert `DateTime.weekday` (1=Mon…7=Sun) to the `activeDays` convention (0=Sun) at the boundary (§3.1).
- Suppress on webinar/LiveKit screens (§7.4).

---

## 11. Reliability, Timeouts, Edge Cases

**Global rule: the ad must never be able to trap the user or lose their content.**

| Case | Handling |
|---|---|
| Media fails to load | 8s timeout → show `fallbackMediaUrl` if set, else `endAd("load_error")`. Emit `load_error` |
| Playback error mid-ad | `endAd("media_error")`, emit event, resume interrupted media |
| Total load timeout | Hard 15s ceiling from overlay mount regardless of state → `endAd("timeout")` |
| Campaign expires while viewing | Let it finish; do not yank. `/complete` accepts a token for a now-inactive campaign |
| Campaign paused before render | `/impression` returns `{ showAd: false }`; client tears down silently |
| Network lost during ad | Continue playback from buffer; queue tracking events, flush on reconnect, drop after 24h |
| Duplicate `/eligible` calls | In-flight guard client-side; server-side, token issuance is cheap and unconfirmed tokens expire in 30 min |
| Simultaneous triggers | Coordinator display lock — first wins, others no-op (criterion 30) |
| Player disposed before resume | Registry lookup returns nothing → skip silently, no throw |
| CTA navigation fails | Catch, log `cta_click_failed`, keep the ad open so the user can close it deliberately |
| Media deleted from storage | Same as load failure |
| Anonymous storage unavailable | Fall back to an in-memory session-scoped ID; frequency degrades to session-only. Never block the app |
| Tracking endpoint fails | Fire-and-forget with retry; **never** block the UI or gate teardown on a tracking response |
| Rotation / resize | Overlay is `MediaQuery`/viewport-driven; no re-fetch, no playback reset |

**Ad system failure must be invisible.** Wrap the whole eligibility path so that any unhandled error resolves to "no ad". A broken ad system must degrade to an app with no ads — never to a broken app.

---

## 12. Realtime Campaign Updates

Socket.IO, reusing existing infrastructure (no Supabase Realtime).

| Room | Event | Payload |
|---|---|---|
| broadcast | `ads:campaign_invalidated` | `{ campaignId, reason: "paused"\|"archived"\|"updated"\|"expired" }` |
| `'admin'` | `admin:ad_campaign_updated` | `{ campaignId, status }` |

Client behaviour:
- **Normal updates** (priority, schedule, creative): apply on the *next* eligibility check. Do not disturb a playing ad.
- **Urgent invalidation** (`paused` / `archived` for the campaign currently on screen): tear down via `endAd("invalidated")` — which restores interrupted media through the standard path.

Clients also re-check eligibility on app foreground and on route change; realtime is an optimisation, not a correctness requirement.

---

## 13. Validation

Zod schemas in `modules/ads/schema.ts`, mirrored in the admin form. Backend validation is authoritative.

- `endAt > startAt`
- `dailyEndTime > dailyStartTime` when both set
- `skipConfig.value <= mediaDurationSeconds` when `type === "seconds"`
- `skipConfig.value` ∈ [0, 100] when `type === "percent"`
- image campaigns: `mediaUrl` required, `mediaDurationSeconds > 0`
- video campaigns: `mediaUrl` or `bunnyVideoId` required
- `ctaConfig.target` required when `ctaConfig.enabled`
- `targetPlatforms.length >= 1`, `placements.length >= 1`
- `priority` ∈ [0, 1000]
- impression limits `>= 0`
- `campaignCode` unique (DB constraint + friendly pre-check)
- `timezone` must be a valid IANA identifier
- **activation gate**: `PATCH /status` → `active` re-runs full validation and rejects if media is missing or unreachable (criterion 33's "cannot activate without valid media")

**URL validation** (§14): internal routes must start with `/` and match a known route prefix; external URLs must parse and use `http:` / `https:`. Explicitly reject `javascript:`, `data:`, `vbscript:`, and `file:`.

---

## 14. Security

- Admin routes: `fastify.authenticate` + admin role check, consistent with existing admin modules.
- **Never trust a client-supplied `memberId`** — always take it from the verified JWT (`req.memberId`, pitfall #13). A guest request carries `anonymousId` only, and the server must not accept a `memberId` field from an unauthenticated caller.
- Display token bound to the resolved identity; mismatched token/subject ⇒ 403.
- Idempotent lifecycle phases per token (§6.4) — blocks inflated impression/completion counts.
- Rate limit tracking endpoints (§5.2).
- Sanitize campaign `name`, `description`, and `ctaConfig.text` — they render in both clients.
- Validate protocols on every URL (§13).
- File type + size validation on upload (existing `/api/upload` limits: 50 MB image body limit).
- `SUPABASE_SERVICE_KEY` stays server-side; it is already server-only and must not leak into any client bundle.
- All secrets via `config/env.ts` Zod schema.

**Forged impressions.** Token + identity binding + idempotency raises the cost meaningfully, but a determined authenticated client can still confirm impressions for ads it never rendered. Full prevention needs server-side rendering attestation, which is not achievable for a client-rendered overlay. This is an accepted limitation — documented, not solved. If ad spend is ever settled on these numbers, revisit.

---

## 15. Testing

**Reality check: this repo has no backend or web unit-test suite.** `npm run typecheck` and `flutter analyze` are the current gates (see CLAUDE.md → Testing & Load). The request asks for backend and web tests, which cannot use "the existing framework" because there isn't one.

**Recommendation — one new dev dependency, narrowly scoped.** Add `vitest` to `backend/` and test **only** `modules/ads/eligibility.ts`. That module is pure (§6), carries the highest correctness risk in the feature, and covers acceptance criteria 16–18 which are otherwise unverifiable by hand. Testing it is cheap precisely because it takes `now` and candidates as arguments. Do not retrofit tests across the rest of the backend as part of this work.

If adding vitest is rejected, the eligibility engine must instead be exercised through a documented manual matrix — and criteria 16–18 should be treated as unverified.

### Backend (vitest — new)
Campaign CRUD & authorization · schedule/recurrence across timezone + DST boundaries · platform/placement/route/audience matching · **priority tie-breaker determinism** (equal priority + equal timestamps ⇒ stable order) · frequency modes · total-impression cap race · token validation & phase idempotency · expired/paused campaigns · analytics aggregation.

### Flutter (`flutter test` — existing suite)
Image ad renders · video ad renders · skip countdown gating · skip disabled · auto-close · CTA internal + external · duplicate overlay prevention · **active video pauses** · **resumes from saved position** · **previously-paused media stays paused** · media load failure → teardown + restore · lifecycle pause/resume · route-based trigger · back-button gating.

Add to `tbt_app/integration_test/` alongside the existing `course_flow_test.dart` — the pause/resume criteria need a real player and cannot be widget-tested meaningfully.

### Web
No framework exists. Playwright **is** available at the repo root (used for Percy visual tests) — extend it rather than adding a second runner. Cover: overlay renders fullscreen · scroll lock + restore · skip countdown · CTA navigation · **HTML5 video pauses and resumes** · Escape gated on `closeConfig` · duplicate modal prevention · autoplay fallback to muted · media error teardown · responsive layout at 4 breakpoints.

### Commands
```bash
# backend
cd tbt-admin && npx tsc --noEmit -p backend/tsconfig.json
npm run typecheck
npx vitest run backend/src/modules/ads          # if vitest adopted

# user-web
cd tbt-user-web && npm run typecheck && npm run lint && npm run build

# admin
cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json && npm run build:admin

# flutter
cd tbt_app && flutter analyze && flutter test
flutter test integration_test/ad_flow_test.dart
flutter build apk --release
```

---

## 16. Acceptance Criteria Coverage

| # | Criterion | Section | Phase |
|---|---|---|---|
| 1–2 | Create image / video campaign | §4, §8.2 | P1 |
| 3–5 | Start/end date, time, timezone | §3.1, §8.2 | P1 |
| 6–7 | Platform + placement selection | §3.1, §8.2 | P1 |
| 8 | Trigger type | §6.1 | P1 (3 of 6 types) |
| 9–10 | Skip seconds / skip disabled | §3.1, §9, §10 | P2/P3 |
| 11–12 | Image duration, video behaviour | §9, §10 | P2/P3 |
| 13 | Activate/pause/edit/duplicate/archive/delete | §5.1, §8.2 | P1 |
| 14 | Fullscreen on Flutter | §10 | P3 |
| 15 | Fullscreen on web | §9 | P2 |
| 16 | Backend-controlled scheduling | §6.1 | P1 |
| 17 | Frequency limits enforced | §6.2, §6.3 | P1 |
| 18 | Deterministic priority resolution | §6.1 step 11 | P1 |
| 19–21 | Pause / resume / stay-paused | §7.2 | P2/P3 |
| 22 | No audio overlap | §7.3 | P2/P3 |
| 23 | Skip gated by config | §9, §10 | P2/P3 |
| 24–25 | Auto-close behaviour | §9, §10 | P2/P3 |
| 26 | CTA internal + external | §9, §10, §13 | P2/P3 |
| 27 | Full event tracking | §3.3, §5.2 | P2/P3 |
| 28 | Admin analytics | §8.2 | P4 |
| 29 | Guest + authenticated | §5.2, §3.4 | P1 |
| 30 | Duplicate prevention | §7.4, §11 | P2/P3 |
| 31 | Broken media never traps | §11 | P2/P3 |
| 32 | Secure policies | §14 (**RLS reinterpreted — see §0.1**) | P1 |
| 33 | Existing functionality intact | §7.4, §11 | all |
| 34–36 | Builds succeed | §15 | all |
| 37 | Tests pass | §15 (**needs vitest decision**) | all |

### Known scope limits — decide before starting

1. **Criterion 32 (RLS + storage policies)** is met by route-layer authorization, not RLS, for the reasons in §0.1. If RLS is genuinely required, the storage and data-access architecture has to change first, and that is a separate project.
2. **Criterion 37** depends on the vitest decision in §15. Without it, criteria 16–18 ship unverified.
3. **Trigger types** `content_playback`, `action`, and mid-roll timestamps are deferred past P3 (§2). Criterion 8 is partially met until then.
4. **Forged impressions** are mitigated, not eliminated (§14).

---

## 17. Open Decisions

Answer these before P1:

1. **Adopt vitest for the eligibility engine?** (§15) — recommended yes.
2. **Guest ads at all?** `SubscriptionGate` means most of user-web is authenticated. If guests never see ads, the `/api/pub/ads` optional-auth layer (§5.2) collapses into plain `authenticateUser` and the anonymous identity work in §3.4 disappears. This is the single biggest scope lever in the spec.
3. **Ads for paid members?** Showing ads to `premium` subscribers is a product call with revenue implications. Default assumption: `audienceConfig.plans` allows targeting, and admins choose — but confirm the default is not "everyone".
4. **Should ads appear on `(marketing)` public pages**, or platform-only?
5. **Charting library** in the admin panel — confirm whether `/analytics` already has one (§8.2).
