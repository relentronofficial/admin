# PROJECT_STATUS.md

Last updated: 2026-06-02
PRD source: `F:\admin\TBT_Admin_PRD.md`

---

## Implementation Roadmap — 18 Sections

| # | Section | Route | Status |
|---|---------|-------|--------|
| 3.1 | Site Config | `/settings/site` | ✅ DONE |
| 3.2 | UI Strings | `/settings/ui-strings` | ✅ DONE |
| 3.3 | Navigation Manager | `/settings/navigation` | ✅ DONE |
| 3.4 | Hero Carousel | `/hero-carousel` | ✅ DONE |
| 3.5 | Content Sections | `/content-sections` | ✅ DONE |
| 3.6 | Courses | `/courses` | ✅ DONE |
| 3.7 | Workshops | `/workshops` | ✅ DONE |
| 3.8 | Workshop Flow Builder | `/workshops/:id` (Flow tab) | ✅ DONE |
| 3.9 | Challenges | `/workshops/:id` (Challenges tab) | ✅ DONE (embedded in detail page) |
| 3.10 | Live Calls | `/workshops/:id` (Live Calls tab) | ✅ DONE (embedded in detail page) |
| 3.11 | Assignments | `/workshops/:id` (Assignments tab) | ✅ DONE (embedded in detail page, order field + table submissions) |
| 3.12 | Q&A Moderation | `/workshops/:id` (Q&A tab) | ✅ DONE (embedded in detail page) |
| 3.13 | Tiers | `/tiers` | ✅ DONE (pre-existing page) |
| 3.14 | Badges | `/display-badges` | ✅ DONE (pre-existing page) |
| 3.15 | Resources | `/app-resources` | ✅ DONE |
| 3.16 | Products | `/products` | ✅ DONE |
| 3.17 | Notifications | `/app-notifications` | ✅ DONE |
| 3.18 | Member Progress | `/members/:id` | ✅ DONE |

---

## Completed Work Detail

### 3.1 Site Config (`/settings/site`) ✅
- `ImageUploadField` component for logo/favicon/splash logo
- File upload to R2 (`bucket: "site-assets"`)
- Live theme preview panel (renders nav bar mockup with theme colors)
- All SiteConfig fields: siteName, logoUrl, faviconUrl, splashLogoUrl, splashDurationMs, footerText, accentColor, alertColor, successColor, bgPrimary, bgSurface

### 3.2 UI Strings (`/settings/ui-strings`) ✅
- All 17 UiStrings fields covered
- 3 groups: Empty States (6 fields), Countdown Labels (4 fields), Login Page (7 fields)
- API already existed at `/api/config/ui-strings`

### 3.3 Navigation Manager (`/settings/navigation`) ✅
- HTML5 drag-and-drop wired to `PUT /api/config/nav/reorder`
- `localItems` optimistic state + `isDirty` → "Save Order" button
- Added `useReorderNavItems` hook

### 3.4 Hero Carousel (`/hero-carousel`) ✅
- Added missing fields: `description`, `bgMuteDefault`, `badgeText`
- Fixed CTA types: `["internal", "external"]` (not `primary/secondary/ghost`)
- File uploads for Background Video (`.mp4/.webm`) and Background Image
- DnD reorder wired to `PUT /api/hero-slides/reorder`
- Added `useReorderHeroSlides` hook

### 3.5 Content Sections (`/content-sections`) ✅
- Two-level DnD (sections + items within each section)
- Item file upload: thumbnail to R2
- Slug auto-generated from title in create mode
- Item form: `contentType` = `["series", "standalone", "podcast"]`, lockBadgeText, categoryTag, isVisible, courseId dropdown
- Added `useReorderContentSections`, `useReorderContentItems` hooks

### 3.6 Courses (`/courses`) ✅
- Course thumbnail file upload
- Slug auto-gen from title (create mode)
- `EpisodesPanel` sub-component with DnD episodes reorder
- Episode video upload (`.mp4/.webm/.mov`) + thumbnail upload
- Duration auto-detection via HTML5 video element metadata
- Added `useReorderCourseEpisodes` hook (pre-existing in controller)

### 3.7 Workshops (`/workshops`) ✅
- List table: Title (+ thumbnail) | Batch | Mode | Tier | Active | Enrolled | Actions
- Form fields: title, slug (auto-gen), description, thumbnailUrl (upload), deliveryMode, requiredTier, batchId (dropdown), isActive toggle
- Fixed delivery modes: `["online", "offline", "hybrid"]` (removed "recorded")
- Added `GET /api/batches` backend endpoint (`backend/src/modules/batches/`)
- Added `useListBatches` hook

### 3.8 Workshop Flow Builder (Flow tab in `/workshops/:id`) ✅
- Real DnD reorder (not cosmetic) wired to `PUT /api/workshops/:id/flow/reorder`
- Three add buttons: **Pre-Req** / **Challenge** / **Live Call** (pre-set form type)
- Type-aware form:
  - `custom` (Pre-Req): label + description
  - `challenge_start`: challenge dropdown from existing challenges
  - `live_call`: live call dropdown from existing live calls
- Type-aware card display: color chips (amber/purple/blue), linked entity details
- Added `useReorderFlowItems` hook

### 3.9–3.12 Workshop Detail Tabs (all embedded in `/workshops/[id]/page.tsx`) ✅
All 7 tabs implemented: Info & Labels, Flow, Challenges, Live Calls, Assignments, Q&A, Enrollments.
Full details in `admin-panel/app/workshops/[id]/page.tsx`.

---

## What Was Pre-Existing Before This Session

The following pages/routes existed before the TBT PRD implementation began:
- `/dashboard` — stats page
- `/admins` + `/admins/create` — admin management
- `/members` + `/members/add` — member management
- `/tiers` — tier CRUD
- `/display-badges` — badge CRUD
- `/app-resources` — resource management (basic)
- `/products` — product management (basic)
- `/app-notifications` — notification sending (basic)
- `/webinar`, `/events`, `/banner`, `/support` — stubs

---

## Known Issues / Pre-Existing Bugs

1. `admin-panel/app/admins/create/page.tsx` — TypeScript errors on `contactNumber` and `dateOfBirth` fields (pre-existing, not introduced)
2. `backend/src/modules/notifications/controller.ts` — TypeScript errors (pre-existing)
3. `useUpdateCourseEpisode` hook URL uses `/api/courses/episodes/${id}` but the actual route is `/episodes/:eid` — mismatch in pre-existing hook, not changed
4. Content Sections PRD mentions "Episodes (if not linked to Course): add/edit episode list inline" — this requires a `ContentItemEpisode` schema that doesn't exist in Prisma. Not implemented.
