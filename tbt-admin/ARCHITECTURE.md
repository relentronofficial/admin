# ARCHITECTURE.md

Complete technical reference for the TBT Admin Platform (tbt-admin/).

---

## Directory Structure

```
tbt-admin/
├── package.json                          # npm workspaces root
├── CLAUDE.md                             # Claude Code guidance
├── PROJECT_STATUS.md                     # PRD completion tracker
├── ARCHITECTURE.md                       # This file
├── PENDING_TASKS.md                      # Next steps
│
├── admin-panel/                          # Next.js 14 App Router
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (ClerkProvider + Providers)
│   │   ├── page.tsx                      # Redirects to /dashboard
│   │   ├── dashboard/page.tsx            # Stats dashboard
│   │   ├── admins/
│   │   │   ├── page.tsx                  # Admin list
│   │   │   └── create/page.tsx           # Create admin
│   │   ├── members/
│   │   │   ├── page.tsx                  # Member list
│   │   │   └── add/page.tsx              # Add member
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── tiers/page.tsx                # Tier CRUD
│   │   ├── display-badges/page.tsx       # Badge CRUD
│   │   ├── hero-carousel/page.tsx        # ✅ PRD 3.4
│   │   ├── content-sections/page.tsx     # ✅ PRD 3.5
│   │   ├── courses/page.tsx              # ✅ PRD 3.6
│   │   ├── workshops/
│   │   │   ├── page.tsx                  # ✅ PRD 3.7
│   │   │   └── [id]/page.tsx             # ✅ PRD 3.8–3.12 (7 tabs)
│   │   ├── products/page.tsx             # ⚠️ PRD 3.16 partial
│   │   ├── app-resources/page.tsx        # ⚠️ PRD 3.15 partial
│   │   ├── app-notifications/page.tsx    # ⚠️ PRD 3.17 partial
│   │   └── settings/
│   │       ├── site/page.tsx             # ✅ PRD 3.1
│   │       ├── ui-strings/page.tsx       # ✅ PRD 3.2
│   │       └── navigation/page.tsx       # ✅ PRD 3.3
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx       # Sidebar + Topbar wrapper
│   │   │   ├── Sidebar.tsx               # Navigation menu
│   │   │   └── Topbar.tsx                # Top bar
│   │   └── Providers.tsx                 # QueryClient + AuthInterceptor + Toaster
│   │
│   └── lib/
│       ├── api/
│       │   └── apiClient.ts              # Axios instance (baseURL → port 8000)
│       ├── hooks/
│       │   ├── useTbt.ts                 # All TBT-related hooks (600+ lines)
│       │   └── useAdmin.ts               # Admin/member/upload hooks
│       └── validators/                   # Zod schemas
│
└── backend/                              # Fastify ESM TypeScript
    ├── src/
    │   ├── server.ts                     # Entry: register plugins + routes
    │   ├── config/env.ts                 # Zod-validated env
    │   ├── plugins/
    │   │   ├── prisma.ts                 # Decorates fastify.prisma
    │   │   ├── clerk.ts                  # Decorates fastify.authenticate
    │   │   ├── redis.ts                  # Optional (skips if no env)
    │   │   ├── supabase.ts               # Optional
    │   │   ├── socket.ts                 # Socket.IO
    │   │   └── sentry.ts                 # Error tracking
    │   └── modules/
    │       ├── auth/          routes.ts + controller.ts + schema.ts
    │       ├── admins/        routes.ts + controller.ts + schema.ts
    │       ├── members/       routes.ts + controller.ts + schema.ts
    │       ├── config/        routes.ts + controller.ts   [site, ui-strings, nav, products-page, resources-page]
    │       ├── hero/          routes.ts + controller.ts   [hero slides + reorder]
    │       ├── content-sections/ routes.ts + controller.ts [sections + items + reorder]
    │       ├── courses/       routes.ts + controller.ts + schema.ts [courses + episodes + reorder]
    │       ├── workshops/     routes.ts + controller.ts   [workshops + flow + challenges + episodes + live-calls + assignments + qa + enrollments]
    │       ├── batches/       routes.ts + controller.ts   [GET /api/batches — list only]
    │       ├── tiers/         routes.ts + controller.ts
    │       ├── display-badges/ routes.ts + controller.ts
    │       ├── products/      routes.ts + controller.ts
    │       ├── app-resources/ routes.ts + controller.ts
    │       ├── app-notifications/ routes.ts + controller.ts
    │       ├── upload/        routes.ts + controller.ts   [presigned URL generation]
    │       ├── dashboard/     routes.ts + controller.ts
    │       ├── community/     routes.ts + controller.ts + schema.ts
    │       ├── webinar/       routes.ts + controller.ts + schema.ts
    │       ├── notifications/ routes.ts + controller.ts + schema.ts
    │       ├── tasks/         routes.ts + controller.ts + schema.ts
    │       ├── user/          routes.ts + controller.ts
    │       └── location/      routes.ts + controller.ts
    │
    └── prisma/
        ├── schema.prisma                 # Full DB schema
        └── seed.ts                       # Super admin seed

```

---

## Backend Route Map (relevant to TBT PRD)

All routes registered in `backend/src/server.ts`. All use `fastify.authenticate` (Clerk admin check).

| Prefix | Module | Key Routes |
|--------|--------|-----------|
| `/api/config` | config | GET/PUT `/site`, GET/PUT `/ui-strings`, GET/POST/PUT/DELETE `/nav`, PUT `/nav/reorder`, GET/PUT `/products-page`, GET/PUT `/resources-page` |
| `/api/hero-slides` | hero | GET, POST, PUT `/:id`, DELETE `/:id`, PUT `/reorder` |
| `/api/content-sections` | content-sections | GET, POST, PUT `/:id`, DELETE `/:id`, PUT `/reorder`; GET/POST `/:id/items`, PUT/DELETE `/items/:id`, PUT `/:id/items/reorder` |
| `/api/courses` | courses | GET, POST, PUT `/:id`, DELETE `/:id`; GET/POST `/:id/episodes`, PUT/DELETE `/episodes/:id`, PUT `/:id/episodes/reorder` |
| `/api/workshops` | workshops | Full CRUD + flow + challenges + episodes + live-calls + assignments + qa + enrollments |
| `/api/workshops/:id/flow` | workshops | GET, POST, PUT `/:itemId`, DELETE `/:itemId`, PUT `/reorder` |
| `/api/batches` | batches | GET (list only, no auth requirement for admin use) |
| `/api/tiers` | tiers | GET, POST, PUT `/:id`, DELETE `/:id` |
| `/api/display-badges` | display-badges | GET, POST, PUT `/:id`, DELETE `/:id` |
| `/api/products` | products | GET, POST, PUT `/:id`, DELETE `/:id`, PUT `/reorder` |
| `/api/app-resources` | app-resources | GET, POST, PUT `/:id`, DELETE `/:id`, PUT `/reorder` |
| `/api/app-notifications` | app-notifications | GET, POST, DELETE `/:id`, GET `/:id/stats` |
| `/api/upload` | upload | POST `/presigned-url` |

---

## Frontend Hook Map (`lib/hooks/useTbt.ts`)

All hooks exported from `useTbt.ts`:

**Workshops**
- `useListWorkshops(params)`, `useGetWorkshop(id)`, `useCreateWorkshop`, `useUpdateWorkshop`, `useDeleteWorkshop`
- `useWorkshopFlow(id)`, `useAddFlowItem(id)`, `useUpdateFlowItem(id)`, `useDeleteFlowItem(id)`, `useReorderFlowItems(id)`
- `useWorkshopChallenges(id)`, `useWorkshopLiveCalls(id)`, `useWorkshopAssignments(id)`, `useWorkshopQA(id)`, `useWorkshopEnrollments(id)`
- `useCreateChallenge(id)`, `useUpdateChallenge(id)`, `useDeleteChallenge(id)`
- `useCreateEpisode(id)`, `useUpdateEpisode(id)`, `useDeleteEpisode(id)`
- `useReorderChallengeEpisodes(id)`
- `useCreateLiveCall(id)`, `useUpdateLiveCall(id)`, `useDeleteLiveCall(id)`
- `useCreateAssignment(id)`, `useUpdateAssignment(id)`, `useDeleteAssignment(id)`
- `useReplyQA(id)`, `useDeleteQAPost(id)`, `useDeleteQAReply(id)`
- `useUpdateEnrollment(id)`, `useDeleteEnrollment(id)`, `useEnrollMembers(id)`
- `useListSubmissions(assignmentId)`
- `useMemberProgress(memberId)`

**Hero Carousel**
- `useListHeroSlides`, `useCreateHeroSlide`, `useUpdateHeroSlide`, `useDeleteHeroSlide`, `useReorderHeroSlides`

**Content Sections**
- `useListContentSections`, `useCreateContentSection`, `useUpdateContentSection`, `useDeleteContentSection`, `useReorderContentSections`
- `useContentSectionItems(sectionId)`, `useCreateContentItem(sectionId)`, `useUpdateContentItem(sectionId)`, `useDeleteContentItem(sectionId)`, `useReorderContentItems(sectionId)`

**Courses**
- `useListVodCourses(params)`, `useCreateVodCourse`, `useUpdateVodCourse`, `useDeleteVodCourse`
- `useListCourseEpisodes(courseId)`, `useCreateCourseEpisode(courseId)`, `useUpdateCourseEpisode(courseId)`, `useDeleteCourseEpisode(courseId)`, `useReorderCourseEpisodes(courseId)`

**Config**
- `useGetSiteConfig`, `useUpdateSiteConfig`
- `useGetUiStrings`, `useUpdateUiStrings`
- `useListNavItems`, `useCreateNavItem`, `useUpdateNavItem`, `useDeleteNavItem`, `useReorderNavItems`
- `useGetProductsPageConfig`, `useUpdateProductsPageConfig`
- `useGetResourcesPageConfig`, `useUpdateResourcesPageConfig`

**Other**
- `useListTiers`, `useCreateTier`, `useUpdateTier`, `useDeleteTier`
- `useListDisplayBadges`, `useCreateDisplayBadge`, `useUpdateDisplayBadge`, `useDeleteDisplayBadge`
- `useListProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useReorderProducts`
- `useListAppResources(search)`, `useCreateAppResource`, `useUpdateAppResource`, `useDeleteAppResource`, `useReorderAppResources`
- `useListAppNotifications`, `useSendAppNotification`, `useDeleteAppNotification`
- `useGetNotificationStats(notifId)`
- `useListAllBadges`, `useListMemberBadges(memberId)`, `useAssignBadge(memberId)`, `useRemoveBadge(memberId)`
- `useListBatches`

All hooks from `lib/hooks/useAdmin.ts`:
- `useMe`, `useGenerateAdminId`, `useCheckUsername`, `useCheckEmail`, `useSearchManagers`
- `useGetCountries`, `useGetStates`, `useGetCities`
- `useGetPresignedUrl` — for all R2 file uploads
- `useListAdmins`, `useGetAdmin`, `useCreateAdmin`, `useUpdateAdmin`, `useDeleteAdmin`
- `useListMembers`, `useGetMember`, `useCreateMember`, `useUpdateMember`, `useDeleteMember`

---

## Database Models (Prisma)

Schema at: `backend/prisma/schema.prisma`

**TBT-related models:**
- `SiteConfig` — singleton site branding/theme
- `UiStrings` — singleton UI label config
- `NavItem` — navbar items with order
- `HeroSlide` — hero carousel slides
- `ContentSection` + `ContentItem` — home page rows
- `Course` + `CourseEpisode` — VOD library
- `Workshop` + `WorkshopEnrollment` + `WorkshopFlowItem` — workshops
- `Challenge` + `WorkshopEpisode` + `MemberEpisodeProgress` — challenge content
- `LiveCall` — scheduled live sessions
- `Assignment` + `AssignmentSubmission` — challenge assignments
- `QAPost` + `QAReply` — Q&A
- `Tier` — membership tiers
- `Badge` + `MemberBadge` — display badges
- `Resource` — downloadable resources
- `Product` + `ProductCta` — product cards
- `ProductsPageConfig`, `ResourcesPageConfig` — page-level config
- `Notification` + `NotificationRecipient` — push notifications
- `Batch` — existing model (used for workshop-batch linking)

**WorkshopFlowItem type values** (string field):
- `"custom"` → Pre-Requisite (label + description)
- `"challenge_start"` → Challenge (challengeId FK)
- `"live_call"` → Live Call (liveCallId FK)

---

## Environment Variables

### backend/.env
```
DATABASE_URL=           # Supabase Postgres connection (pooled)
DIRECT_URL=             # Supabase Postgres direct connection
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
UPSTASH_REDIS_URL=      # Optional
UPSTASH_REDIS_TOKEN=    # Optional
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
BUNNY_STREAM_API_KEY=   # Optional (video hosting)
BUNNY_STREAM_LIBRARY_ID=
AGORA_APP_ID=           # Optional (live webinars)
AGORA_APP_CERTIFICATE=
FIREBASE_PROJECT_ID=    # Optional (push notifications)
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
RESEND_API_KEY=         # Optional (email)
TWILIO_ACCOUNT_SID=     # Optional (SMS)
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENTRY_DSN=             # Optional
BETTER_STACK_SOURCE_TOKEN= # Optional
PORT=8000
NODE_ENV=development
```

### admin-panel/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

---

## Dependencies

### Frontend (admin-panel)
- `next` 14.2.3, `react` 18, `react-dom` 18
- `@clerk/nextjs` 5.7.6 — auth
- `@tanstack/react-query` 5 — server state
- `axios` 1.7 — HTTP client
- `react-hook-form` 7 + `@hookform/resolvers` + `zod` — forms
- `react-hot-toast` 2 — notifications
- `lucide-react` 0.378 — icons
- `date-fns` 4 — date formatting
- `zustand` 4 — client state
- `tailwindcss` 3, `tailwind-merge`, `class-variance-authority`

### Backend
- `fastify` 4 + `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/jwt`
- `@prisma/client` 5.14 + `prisma` 5.14
- `@clerk/backend` 3, `@clerk/clerk-sdk-node` 5 — auth
- `@supabase/supabase-js` 2 — Supabase client
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — R2 uploads
- `bullmq` 5 + `ioredis` 5 — job queues
- `socket.io` 4 — real-time
- `zod` 3 — validation
- `resend` 6, `twilio` 6 — comms
- `@sentry/node` 8 — error tracking
- `tsx` 4 — TypeScript dev runner

---

## Important Architectural Decisions

1. **Single `useTbt.ts` file** — all TBT hooks in one file (~600+ lines). When adding new hooks, append to the bottom of this file.

2. **No mock DB in tests** — integration testing only (no test suite currently exists).

3. **Optimistic DnD** — always: local state update on drop, server sync only on explicit "Save Order" button click. Never auto-save on drop.

4. **Slug always auto-generates** from title in **create mode only**. Edit mode always shows the existing slug (manual edit only). Track with `slugManual` boolean state.

5. **File upload always uses presigned URL pattern** — never POST the file directly to the API. Always: presigned-url → PUT to R2 → store publicUrl.

6. **Workshop detail page is monolithic** — all 7 tabs (Info, Flow, Challenges, Live Calls, Assignments, Q&A, Enrollments) live in one `workshops/[id]/page.tsx` file (~960 lines). By design, not a bug.

7. **Backend plugins skip gracefully** — Redis, Supabase, Firebase plugins log a warning and continue if their env vars are missing. Only `DATABASE_URL` and Clerk keys are hard-required.

8. **Batches module** — added `backend/src/modules/batches/` (GET only) during session 3.7. No CUD routes for batches exist in the admin panel yet. Batches are managed elsewhere.

9. **Flow item types** map as: `"custom"` = Pre-Requisite, `"challenge_start"` = Challenge, `"live_call"` = Live Call. The PRD uses different terminology; the DB uses these string values.
