# CDN & Storage Integration Spec

## 1. Current State

### Upload Architecture

All file uploads flow through a single endpoint:

```
Frontend → POST /api/upload/presigned-url → Backend → (R2 or Supabase) → presigned URL back → Frontend PUT file directly
```

The presigned URL handler (`backend/src/modules/upload/controller.ts`) has two branches:
- **If `CLOUDFLARE_R2_ACCESS_KEY` is set** → generates R2 S3-compatible presigned PUT URL, returns `publicUrl = https://{R2_BUCKET}.r2.dev/{key}` (public R2 URL — not CDN)
- **If not set (current state)** → falls through to Supabase Storage signed upload URL

**Current state: R2 keys are missing from `.env`** → 100% of uploads go to Supabase Storage.

### Frontend Upload Caller

`useGetPresignedUrl` in `admin-panel/lib/hooks/useAdmin.ts` is called from every upload point:

| Page | Bucket param | PathPrefix param | File type |
|------|-------------|-----------------|-----------|
| `hero-carousel/page.tsx` | `hero-slides` | `hero/video`, `hero/image` | Video + image |
| `courses/page.tsx` | `courses` (thumbnail), `course-videos` (episodes) | `thumbnails`, `courses/{id}`, `episode-thumbs` | Image + video |
| `workshops/page.tsx` | `workshops` | `thumbnails` | Image |
| `products/page.tsx` | `products` | `thumbnails` | Image |
| `content-sections/page.tsx` | `content-items` | `thumbnails` | Image |
| `app-resources/page.tsx` | `resources` | `files`, `previews`, `icons` | PDF/doc/image |
| `settings/site/page.tsx` | `site-assets` | `site/{fieldKey}` | Image |
| `members/page.tsx` | `kyc-documents` | `members/kyc` | Document |
| `members/add/page.tsx` | `profile-photos`, `kyc-documents` | `members/photos`, `members/kyc` | Image/doc |

> Note: The backend ignores the `bucket` param for R2 — all files go into the single `tbt-media` bucket, with the key set to `{pathPrefix}/{timestamp}-{filename}`. The `bucket` param only matters in the Supabase fallback branch, where it is used as a separate Supabase storage bucket.

### Video Handling

- **Workshop episodes** (`WorkshopEpisode.videoUrl`): Manual text input only — no upload widget, URL typed by hand.
- **Course episodes** (`CourseEpisode.videoUrl`): Upload widget exists but sends video file to R2/Supabase (same presigned URL path as images). No Bunny Stream integration.
- **Hero slides** (`HeroSlide.bgVideoUrl`): Upload widget exists, sends to R2/Supabase under `hero-slides` bucket.

### Image Display

Frontend uses plain `<img src={url}>` tags everywhere. `next.config.mjs` only allows `i.pravatar.cc` as a Next.js `<Image>` remote pattern. No Bunny CDN domain is configured.

### Env Variables — Current vs Credentials File

| env.ts key | credentials file key | Match? |
|------------|---------------------|--------|
| `CLOUDFLARE_R2_ACCESS_KEY` | `CLOUDFLARE_R2_ACCESS_KEY_ID` | NO — name mismatch |
| `CLOUDFLARE_R2_SECRET_KEY` | `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | NO — name mismatch |
| `CLOUDFLARE_R2_ACCOUNT_ID` | `CLOUDFLARE_R2_ACCOUNT_ID` | yes |
| `CLOUDFLARE_R2_BUCKET_NAME` | `CLOUDFLARE_R2_BUCKET_NAME` | yes |
| `BUNNY_STREAM_API_KEY` | `BUNNY_STREAM_API_KEY` | yes |
| `BUNNY_STREAM_LIBRARY_ID` | `BUNNY_STREAM_LIBRARY_ID` | yes |
| — (missing) | `BUNNY_STORAGE_HOSTNAME` | not in env.ts |
| — (missing) | `BUNNY_STORAGE_ZONE` | not in env.ts |
| — (missing) | `BUNNY_STORAGE_ACCESS_KEY` | not in env.ts |
| — (missing) | `BUNNY_CDN_URL` | not in env.ts |

### Known Bugs in Current Code

1. **publicUrl formula** (`controller.ts:69`): generates `https://${CLOUDFLARE_R2_BUCKET_NAME}.r2.dev/${key}`. This is the R2 public subdomain URL, not a Bunny CDN URL. Must change to `https://${BUNNY_CDN_URL}/${key}`.
2. **Env key mismatch**: Code reads `env.CLOUDFLARE_R2_ACCESS_KEY` but credential is named `CLOUDFLARE_R2_ACCESS_KEY_ID`. Will need to standardise to one name.
3. **S3Client initialised at module load time** (`controller.ts:6-13`): initialised once when the module loads. If env vars are absent, the client is created with empty strings — no error at boot, fails silently at runtime. Should be initialised lazily or guarded.

---

## 2. Required Architecture

### Image / Thumbnail / Document Flow

```
Admin Browser
  │
  ├─ POST /api/upload/presigned-url  (get R2 signed PUT URL)
  │    Backend generates: key = {pathPrefix}/{timestamp}-{filename}
  │    Returns: { uploadUrl: R2 presigned PUT, publicUrl: https://tamil-business-tribe-cdn.b-cdn.net/{key} }
  │
  ├─ PUT {uploadUrl}  (browser uploads file DIRECTLY to R2, not through backend)
  │    Cloudflare R2 bucket: tbt-media
  │
  └─ Store publicUrl in form state → save to DB
       DB field: thumbnailUrl / fileUrl / profilePhotoUrl / etc.

End users access via:
  https://tamil-business-tribe-cdn.b-cdn.net/{key}
  Bunny CDN pulls from R2 origin → caches at edge
```

**Pull Zone Setup Required (infrastructure, not code):**
The Bunny CDN pull zone `tamil-business-tribe-cdn.b-cdn.net` must be configured in the Bunny dashboard to pull from the R2 bucket's public endpoint as its origin. R2 bucket `tbt-media` must have public access enabled. This is a one-time Bunny dashboard configuration; no code changes required beyond `publicUrl` formula.

### Video Flow

```
Admin Browser
  │
  ├─ POST /api/upload/bunny-video-create  { title }
  │    Backend calls Bunny Stream API:
  │      POST https://video.bunnycdn.com/library/674791/videos  { "title": "..." }
  │    Returns to browser: { videoId, tusUploadUrl, embedUrl }
  │
  ├─ Browser uploads video DIRECTLY to Bunny Stream via TUS protocol
  │    (using tus-js-client; no backend proxy — avoids large file in memory)
  │    TUS endpoint: https://video.bunnycdn.com/tusupload
  │    Headers: AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId
  │
  └─ Browser stores embedUrl in form → save to DB
       DB field: videoUrl on WorkshopEpisode / CourseEpisode
       embedUrl format: https://iframe.mediadelivery.net/embed/674791/{videoId}

User-facing player (TBT app):
  <iframe src="https://iframe.mediadelivery.net/embed/674791/{videoId}?autoplay=false" />
  OR HLS: https://{library-cdn}.b-cdn.net/{videoId}/playlist.m3u8
```

### Storage Decision Matrix

| Content type | Storage | Delivery | Upload path |
|-------------|---------|----------|-------------|
| Thumbnails (workshop/course/product/content-item) | Cloudflare R2 | Bunny CDN pull zone | Presigned URL → browser PUT |
| Images (hero, site assets, profile photos) | Cloudflare R2 | Bunny CDN pull zone | Presigned URL → browser PUT |
| Documents (PDF, XLSX, KYC) | Cloudflare R2 | Bunny CDN pull zone | Presigned URL → browser PUT |
| Course episode videos | Bunny Stream | Bunny Stream HLS + embed | TUS → Bunny Stream directly |
| Workshop episode videos | Bunny Stream | Bunny Stream HLS + embed | TUS → Bunny Stream directly |
| Hero slide background video | Bunny Stream OR R2 | Bunny CDN | TUS or presigned (see note) |
| Supabase | Fallback only if R2 is missing | Supabase CDN | existing flow |

> Hero slide background video: if these are short ambient videos (looping, muted), R2 + Bunny CDN is sufficient. If they are full-quality videos that benefit from adaptive bitrate, use Bunny Stream. Recommend R2 path for hero videos to keep implementation simpler — hero videos already have an upload widget that works.

---

## 3. Image Upload Flow (Detailed)

### What Changes

Only two things change in the existing image upload flow:

1. **`publicUrl` formula** in `backend/src/modules/upload/controller.ts`:
   ```ts
   // Before (broken — R2 public subdomain):
   const publicUrl = `https://${env.CLOUDFLARE_R2_BUCKET_NAME}.r2.dev/${key}`;

   // After (Bunny CDN delivery):
   const publicUrl = `https://${env.BUNNY_CDN_URL}/${key}`;
   ```

2. **Env var names** reconciled — see Section 6.

Everything else — the presigned URL generation, the browser PUT, the `uploadUrl`/`publicUrl` shape returned to the frontend, the frontend upload components, the DB storage — stays exactly as-is.

### `next.config.mjs` Image Domain

If any component ever switches from `<img>` to Next.js `<Image>`, Bunny CDN must be listed:

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'i.pravatar.cc' },
    { protocol: 'https', hostname: 'tamil-business-tribe-cdn.b-cdn.net' },
    { protocol: 'https', hostname: '*.supabase.co' },  // fallback coverage
  ],
},
```

Add this proactively even if `<img>` tags are used today — it prevents breakage if any component switches.

---

## 4. Video Upload Flow (Detailed)

### New Backend Endpoint

`POST /api/upload/bunny-video-create`

Request body:
```json
{ "title": "Episode title" }
```

Step 1 — Create video in Bunny Stream:
```
POST https://video.bunnycdn.com/library/{BUNNY_STREAM_LIBRARY_ID}/videos
Headers: AccessKey: {BUNNY_STREAM_API_KEY}
Body: { "title": "Episode title" }
Response: { "videoId": "...", "guid": "...", ... }
```

Step 2 — Generate TUS upload credentials (signed):
```
Bunny TUS upload URL: https://video.bunnycdn.com/tusupload
Required headers for TUS upload (generated server-side, returned to browser):
  AuthorizationSignature: SHA256(libraryId + apiKey + expirationTime + videoId)
  AuthorizationExpire: unix timestamp (e.g. now + 1 hour)
  VideoId: {videoId}
  LibraryId: {libraryId}
```

Response to frontend:
```json
{
  "success": true,
  "data": {
    "videoId": "abc123",
    "tusUploadUrl": "https://video.bunnycdn.com/tusupload",
    "tusHeaders": {
      "AuthorizationSignature": "...",
      "AuthorizationExpire": 1234567890,
      "VideoId": "abc123",
      "LibraryId": "674791"
    },
    "embedUrl": "https://iframe.mediadelivery.net/embed/674791/abc123"
  }
}
```

### Frontend TUS Upload

Requires adding `tus-js-client` to admin-panel:
```
npm install tus-js-client -w admin-panel
```

Upload component pattern:
```ts
import * as tus from "tus-js-client";

const upload = new tus.Upload(file, {
  endpoint: tusUploadUrl,
  headers: tusHeaders,
  chunkSize: 5 * 1024 * 1024,  // 5MB chunks
  metadata: { filetype: file.type, title: videoTitle },
  onProgress(bytesUploaded, bytesTotal) { /* progress bar */ },
  onSuccess() { onUploaded(embedUrl); },
  onError(err) { toast.error("Upload failed"); },
});
upload.start();
```

### Where This Replaces Existing Upload Logic

- **`courses/page.tsx` — `handleVideoUpload()`**: Currently calls `getPresignedUrl.mutateAsync({ bucket: "course-videos" })` and uploads to R2. Replace with `POST /api/upload/bunny-video-create` + TUS upload. The `videoUrl` stored becomes the embedUrl.
- **`workshops/[id]/page.tsx` — episode form**: Currently a plain text `<input>` for Video URL. Add an upload button that triggers the Bunny Stream flow alongside the manual URL input (keep both — manual entry allows pasting existing URLs).

### Video ID Storage Consideration

Two options:
- **Option A — Store embed URL directly** (no DB change): `videoUrl = "https://iframe.mediadelivery.net/embed/674791/abc123"`. Simple, but embed URL is tightly coupled to library ID; migrating library requires a data migration.
- **Option B — Store videoId only** (requires adding a `bunnyVideoId` column): `videoUrl` stores the plain streaming URL, separate `bunnyVideoId` field stores `"abc123"`. More flexible, needs a DB migration.

**Recommendation: Option A** for now — storing the full embed URL avoids a DB migration and matches the existing pattern where `videoUrl` has always been a complete URL. If the library needs to change in future, a one-time SQL update can rewrite the URL.

---

## 5. Database Changes Required

### No Schema Changes Needed for Images

All image/thumbnail/document `*Url` fields already exist as `String?` — they just need to store `https://tamil-business-tribe-cdn.b-cdn.net/...` instead of a Supabase URL. No migration required.

### For Videos — Option A (recommended, no migration)

`WorkshopEpisode.videoUrl` and `CourseEpisode.videoUrl` are already `String?`. The value changes from an R2/Supabase URL to `https://iframe.mediadelivery.net/embed/674791/{videoId}`. No schema change.

**Existing video data**: Any records with old Supabase/R2 video URLs continue to work — the TBT app would render them as a `<video src>` or in an `<iframe>`. New uploads will get the Bunny embed URL.

### Optional — Bunny Video ID Tracking (Option B)

If you want to be able to delete videos from Bunny Stream via the admin panel, or track upload status:

```prisma
model WorkshopEpisode {
  // existing fields...
  bunnyVideoId  String?  @map("bunny_video_id")  // add this
}

model CourseEpisode {
  // existing fields...
  bunnyVideoId  String?  @map("bunny_video_id")  // add this
}
```

Run `npx prisma db push` from `backend/` after adding. This is purely additive — no breaking change.

---

## 6. API Changes Required

### 6.1 `backend/src/config/env.ts` — Add / Rename Variables

```ts
// Rename to match credentials file:
CLOUDFLARE_R2_ACCESS_KEY: → CLOUDFLARE_R2_ACCESS_KEY_ID:
CLOUDFLARE_R2_SECRET_KEY: → CLOUDFLARE_R2_SECRET_ACCESS_KEY:

// Add new Bunny Storage + CDN vars:
BUNNY_CDN_URL: z.string().optional().or(z.literal('')),
BUNNY_STORAGE_HOSTNAME: z.string().optional().or(z.literal('')),
BUNNY_STORAGE_ZONE: z.string().optional().or(z.literal('')),
BUNNY_STORAGE_ACCESS_KEY: z.string().optional().or(z.literal('')),
// BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID already exist
```

> The rename of `CLOUDFLARE_R2_ACCESS_KEY` → `CLOUDFLARE_R2_ACCESS_KEY_ID` also requires updating `controller.ts` references. One place each.

### 6.2 `backend/src/modules/upload/controller.ts` — Image Upload Fix

Changes:
1. Update S3Client to use renamed env vars
2. Fix `publicUrl` to use Bunny CDN URL
3. Fix lazy init (or guard) to avoid silent failure when R2 keys absent

```ts
// S3Client: change env.CLOUDFLARE_R2_ACCESS_KEY → env.CLOUDFLARE_R2_ACCESS_KEY_ID
// publicUrl: change .r2.dev formula → `https://${env.BUNNY_CDN_URL}/${key}`
```

### 6.3 New: `backend/src/modules/upload/controller.ts` — Bunny Stream Video

Add new handler `createBunnyVideoHandler`:

```ts
export async function createBunnyVideoHandler(request, reply) {
  const { title } = request.body;
  // 1. POST to Bunny Stream API — create video entry
  // 2. Compute TUS auth signature = SHA256(libraryId + apiKey + expiry + videoId)
  // 3. Return { videoId, tusUploadUrl, tusHeaders, embedUrl }
}
```

### 6.4 `backend/src/modules/upload/routes.ts` — Register New Route

```ts
fastify.post('/bunny-video-create', createBunnyVideoHandler);
```

The existing `/presigned-url` route is unchanged.

### 6.5 `admin-panel/lib/hooks/useAdmin.ts` — New Hook

```ts
export const useCreateBunnyVideo = () =>
  useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const res: any = await apiClient.post('/api/upload/bunny-video-create', { title });
      return res.data || res;
    },
  });
```

### 6.6 `admin-panel/next.config.mjs` — Image Domains

Add Bunny CDN hostname and Supabase wildcard to `remotePatterns` (see Section 3 above).

### 6.7 `backend/.env` and `admin-panel/.env.local` — Populate Keys

`backend/.env` — add:
```
CLOUDFLARE_R2_ACCOUNT_ID=36ea7b7f0d4a8c3eb476a7092a7d6a88
CLOUDFLARE_R2_ACCESS_KEY_ID=4927b62d8d208ebcda5940cdb5a68735
CLOUDFLARE_R2_SECRET_ACCESS_KEY=eebca74735813ed69b05f78f9866222704c1d3f7b6bca3fdab5e5603f4db5500
CLOUDFLARE_R2_BUCKET_NAME=tbt-media
BUNNY_CDN_URL=tamil-business-tribe-cdn.b-cdn.net
BUNNY_STORAGE_HOSTNAME=sg.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=tamil-business-tribe
BUNNY_STORAGE_ACCESS_KEY=3b3ebda2-dcce-4fc0-b436d4720eba-9918-41dc
BUNNY_STREAM_LIBRARY_ID=674791
BUNNY_STREAM_API_KEY=0290356b-c160-4368-b6107faf8a53-9950-4752
```

`admin-panel/.env.local` — no changes needed (all credentials stay backend-only).

---

## 7. Migration Plan

The goal is zero downtime and zero regression in existing uploads.

### Phase 1 — Fix Image Uploads (Cloudflare R2 + Bunny CDN)

All changes are additive or configuration-only. Existing Supabase-stored URLs continue to load.

1. Update `backend/src/config/env.ts` — rename R2 key vars, add Bunny CDN/Storage vars
2. Update `backend/src/modules/upload/controller.ts` — fix env var names, fix `publicUrl` formula
3. Update `backend/.env` — populate all R2 and Bunny credentials
4. Update `admin-panel/next.config.mjs` — add image domains
5. **Verify**: upload a workshop thumbnail → confirm URL is `https://tamil-business-tribe-cdn.b-cdn.net/...` and image loads

> Infrastructure prerequisite: Bunny CDN pull zone `tamil-business-tribe-cdn.b-cdn.net` must be pointed at R2 bucket `tbt-media` as origin. Confirm in Bunny dashboard before Phase 1 testing.

### Phase 2 — Add Bunny Stream Video Upload

New functionality layered on top — does not alter existing endpoints.

1. Install `tus-js-client` in `admin-panel`
2. Add `createBunnyVideoHandler` in upload controller
3. Register new route in upload routes
4. Add `useCreateBunnyVideo` hook in `useAdmin.ts`
5. Update `courses/page.tsx` — replace R2 video upload with Bunny Stream TUS upload
6. Update `workshops/[id]/page.tsx` — add Bunny Stream upload button to episode form (keep manual URL input)
7. **Verify**: upload a course episode video → confirm embed URL is stored → confirm iframe player works

### Phase 3 — Optional Cleanup

- Decide whether to add `bunnyVideoId` column (Option B in Section 5) for delete-from-Bunny support
- Add a `DELETE /api/upload/bunny-video/:videoId` backend endpoint if admins need to purge videos from Bunny Stream
- Update `backend/.env.example` with the new variable names

---

## 8. Implementation Checklist

### Phase 1 — Images

- [ ] `backend/src/config/env.ts` — rename `CLOUDFLARE_R2_ACCESS_KEY` → `CLOUDFLARE_R2_ACCESS_KEY_ID`
- [ ] `backend/src/config/env.ts` — rename `CLOUDFLARE_R2_SECRET_KEY` → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- [ ] `backend/src/config/env.ts` — add `BUNNY_CDN_URL`, `BUNNY_STORAGE_HOSTNAME`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_ACCESS_KEY`
- [ ] `backend/src/modules/upload/controller.ts` — update S3Client to use new env var names
- [ ] `backend/src/modules/upload/controller.ts` — change `publicUrl` formula to use `BUNNY_CDN_URL`
- [ ] `backend/src/modules/upload/controller.ts` — fix S3Client lazy init (guard with `if R2 configured`)
- [ ] `backend/.env` — populate all R2 + Bunny credentials
- [ ] `backend/.env.example` — update with new variable names
- [ ] `admin-panel/next.config.mjs` — add `tamil-business-tribe-cdn.b-cdn.net` and `*.supabase.co` to `remotePatterns`
- [ ] Infrastructure: confirm Bunny CDN pull zone points to R2 as origin
- [ ] Test: upload a thumbnail → check URL prefix → load image in browser

### Phase 2 — Videos

- [ ] `npm install tus-js-client -w admin-panel`
- [ ] `backend/src/modules/upload/controller.ts` — add `createBunnyVideoHandler`
- [ ] `backend/src/modules/upload/routes.ts` — register `POST /bunny-video-create`
- [ ] `admin-panel/lib/hooks/useAdmin.ts` — add `useCreateBunnyVideo` hook
- [ ] `admin-panel/app/courses/page.tsx` — replace R2 video upload with Bunny Stream TUS flow
- [ ] `admin-panel/app/workshops/[id]/page.tsx` — add Bunny Stream upload button to episode form
- [ ] Test: upload a course episode video → confirm `embedUrl` stored → render in iframe

### Phase 3 — Optional

- [ ] (optional) Add `bunnyVideoId` column to `WorkshopEpisode` and `CourseEpisode` — run `npx prisma db push`
- [ ] (optional) Add `DELETE /api/upload/bunny-video/:videoId` endpoint
- [ ] (optional) Remove Supabase fallback once R2 is confirmed stable in production

---

## Appendix: Bunny Stream TUS Signature Formula

```ts
import { createHash } from 'crypto';

function bunnyTusSignature(libraryId: string, apiKey: string, videoId: string): { signature: string; expiry: number } {
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const signature = createHash('sha256')
    .update(libraryId + apiKey + expiry + videoId)
    .digest('hex');
  return { signature, expiry };
}
```

TUS upload headers:
```
AuthorizationSignature: {signature}
AuthorizationExpire: {expiry}
VideoId: {videoId}
LibraryId: {libraryId}
```

## Appendix: Bunny Stream Embed URL Pattern

```
https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}
```

Optional query params: `?autoplay=false&loop=false&muted=false&preload=true`

## Appendix: Bunny CDN Public URL Pattern (after Phase 1)

```
https://tamil-business-tribe-cdn.b-cdn.net/{pathPrefix}/{timestamp}-{filename}
```

Example: `https://tamil-business-tribe-cdn.b-cdn.net/workshops/thumbnails/1717300000000-cover.jpg`
