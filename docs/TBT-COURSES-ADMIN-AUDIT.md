# TBT Courses — Website vs Admin Dashboard Audit

| | |
|---|---|
| **Audit date** | 2026-10-13 |
| **Code audited** | `origin/main` at commit `a77eca4e` (identical to the `production` branch — what is live) |
| **Live URLs** | Courses website: `https://app.tamilbusinesstribe.com/courses` · Admin: `https://v0-tbt-ott-admin.vercel.app/dashboard` |
| **Changes made** | None to code, data or configuration. This document is the only output. |

---

## 1. Executive summary

**Short answer:** Most course *content* (courses, lessons, videos, sections, resources, tasks, quizzes, prices, access) **can** be managed from Admin → Courses, and the Courses website reads it from the same backend and database. But the Admin Dashboard is **not yet the single source of truth**:

- **3 admin controls do nothing on the website** (2 reproduced on a local copy of the live code, 1 found in code):
  - **Required Tier** — a course set to "Tier 5" is still listed and opened for a Tier-1 member.
  - **Active** (on/off) — an "inactive" course still appears in the catalog.
  - **External Payment URL** — saved, but the website never reads it.
- **Draft courses are not fully hidden.** The catalog hides them, but anyone signed in who has the course's link (`/learning/<course id>`) can open a draft course and see its title, description and lesson list. Videos stay hidden.
- **The course card design is hardcoded.** The cover on every card is a fixed design ("✦ TBT BUSINESS", "Chapter N", "WWW.TAMILBUSINESSTRIBE.COM"). The **thumbnail you upload in Admin is not shown on the catalog card** (it is shown on the course detail page).
- **No admin control exists** for: course **category**, **level**, **featured/sort order**, **offer (discount) price**, **trailer video**, **course preview before publishing**, **archive**, or the **text labels** on the Courses page.
- **Delete is permanent.** Deleting a course removes it from the database immediately — there is no archive or undo.
- **New courses are published by default.** A course goes live the moment it is first saved unless the admin switches "Published" off.
- **Changes can take up to 5 minutes** to appear on the Courses page (catalog cache is not cleared when a course is edited).

### Result counts

| Area | Count |
|---|---|
| Website features inventoried (§4) | **56** — Present 42 · Not present 12 · Not verified 2 |
| Admin features inventoried (§5) | **45** |
| Field mappings (§6) — status | **WORKING 0** · **PARTIAL 7** · **MISSING 10** · **HARDCODED 5** · **BROKEN 3** · **NOT VERIFIED 25** (total 50) |

> **Why "WORKING = 0":** the rules for this audit only allow "WORKING" when the full flow *Admin click → save → live website* was observed. Admin and website both require logins that were not available, so no flow could be observed end-to-end. Items marked **NOT VERIFIED** are fully connected in code (and many were confirmed at the API level on a local copy) — they are *likely* working, but were not seen working live.

---

## 2. Scope and inspection limitations

**What was inspected**

| Source | How | Result |
|---|---|---|
| Code (`origin/main` `a77eca4e`) | Read-only export; full read of the Courses page, course APIs, admin Courses page, data model | Complete |
| Live Courses website | Headless browser, not signed in | Redirects to `/login`. API returns **401**. Course pages could **not** be viewed. |
| Live Admin Dashboard | Headless browser, not signed in | `/dashboard` and `/courses` redirect to `/sign-in` (Clerk). Admin pages could **not** be viewed. |
| Runtime behaviour | The **live backend code** run locally against a **throwaway local database** with test data (no production data, no production credentials) | 12 checks run — results in §5.1 |

**Limitations**

1. **No admin or member login was available.** No screen was clicked live. Menu paths below come from the admin code (`Sidebar.tsx`, `courses/page.tsx`), not from live screenshots.
2. **No production data was read or changed.** Course counts, real course names and real prices are therefore **Not verified**.
3. **Mobile app** (Flutter) is out of scope — this audit covers the Courses *website* only.
4. Mobile-browser rendering of the website was checked in code (responsive layout) but not on a device.

---

## 3. Architecture and technology

| Part | Technology | Where |
|---|---|---|
| Courses website | Next.js 15 (App Router), React, TanStack Query | `tbt-user-web/` — hosted on Google Cloud Run (`app.tamilbusinesstribe.com`) |
| Admin Dashboard | Next.js 14 (App Router), TanStack Query | `tbt-admin/admin-panel/` — hosted on Vercel (`v0-tbt-ott-admin.vercel.app`) |
| Backend API | Fastify (Node.js, TypeScript) | `tbt-admin/backend/` — Google Cloud Run (`tbt-backend-464464507912.asia-south1.run.app`) |
| Database | PostgreSQL (Supabase) via Prisma + raw SQL | `backend/prisma/schema.prisma` + tables created at startup in `backend/src/plugins/prisma.ts` |
| Images / files | Cloudflare R2 (upload via presigned URL; images converted to WebP) | `backend/src/modules/upload/` |
| Videos | Bunny Stream (HLS + iframe, optional DRM) | episode editor in admin |
| Cache | Upstash Redis + in-memory cache | `backend/src/lib/cache.ts` |
| Admin login | Clerk | `backend/src/plugins/clerk.ts` |
| Member login | Phone + password + OTP → JWT cookie | `backend/src/plugins/jwt.ts` |

**Same backend and database?** **Yes (verified).** Network requests captured from both live sites go to the same backend host, and that backend uses one database connection. The admin writes with `/api/courses/*` (admin login required); the website reads with `/api/user/courses/*` (member login required).

```
Admin → Courses (form)                                  Courses website
   │  PUT /api/courses/:id  (Clerk login)                  │  GET /api/user/courses        (catalog)
   ▼                                                       │  GET /api/user/courses/:id    (detail + lessons)
 backend  modules/courses/controller.ts                    ▼
   │                                               backend  modules/user/controller.ts
   ▼                                                       │  (catalog cached 5 min)
 PostgreSQL  courses, course_episodes, course_sections, … ◄┘
```

---

## 4. Courses website — feature inventory

Status: **Present** / **Not present** / **Not verified**. "Code" = confirmed in source; live screens could not be viewed (login required).

### 4.1 Catalog page `/courses` (`tbt-user-web/app/(platform)/courses/page.tsx`)

| # | Feature | Status | Notes |
|---|---|---|---|
| W1 | Mentorship dashboard block at top of page | Present | `MentorshipDashboard` component |
| W2 | Page heading "Modules" | Present | Text is a code fallback — not editable (see §13) |
| W3 | Search box | Not present | Backend supports `?search=` but the page has no search box |
| W4 | Filters (level, category, price) | Not present | |
| W5 | Course categories / tags shown | Not present | |
| W6 | Module tabs (Product / Service / Coaching) | Present | Only for members in a program with more than one allowed module |
| W7 | Single-module banner (image, name, tagline, colour) | Present | From `module_config` table |
| W8 | Program name badge | Present | From member's program |
| W9 | "Your Progress" bar (Done / Active / Total) | Present | Program views only |
| W10 | Course cards grid (1/2/3 columns) | Present | |
| W11 | Card cover image from course thumbnail | **Not present** | Cover is a fixed design; uploaded thumbnail is ignored on the card |
| W12 | "Chapter N" label on card | Present | N = position in the list, not admin-set |
| W13 | Module name on card | Present | |
| W14 | Course title on card | Present | |
| W15 | Course description on card | Not present | Only on detail page |
| W16 | Video duration on card | Present | Calculated from lesson durations |
| W17 | Task duration on card | Present | Calculated from lesson focus-timers |
| W18 | Price on card (₹) | Present | Shown when member has no access |
| W19 | Offer / discount price | Not present | No such field exists |
| W20 | Lesson count on card | Not present | API returns it; card does not show it |
| W21 | Instructor on card | Not present | Detail page only |
| W22 | Progress bar + status icon on card | Present | From member's enrollment |
| W23 | Lock overlay with reason ("Purchase to unlock — ₹…", "Not included in your program", …) | Present | Messages are fixed English text |
| W24 | Card ordering | Present | Featured first, then newest — no admin sort control |
| W25 | "Load more" (first 6, then all) | Present | Maximum 100 courses ever load |
| W26 | Pagination | Not present | Only the single "Load more" |
| W27 | Loading skeleton | Present | |
| W28 | Empty state ("No modules found") | Present | |
| W29 | Error state when the API fails | Not present | A failed load looks the same as "no courses" |
| W30 | New-member view ("Explore Programs" / "View Plans") | Present | |
| W31 | "Saved Videos" (last 3 watched) + "View All" | Present | From watch history |
| W32 | Footer with phone + email | Present | Hardcoded `+91 80151 39542`, `helpdesk@tamilbusinesstribe.com` |
| W33 | Mobile layout | Not verified | Responsive classes present in code; not checked on a device |

### 4.2 Course detail and player `/learning/<course id>` (`learning/[courseId]/page.tsx`)

| # | Feature | Status | Notes |
|---|---|---|---|
| W34 | Course title, description, thumbnail | Present | |
| W35 | Level badge | Present | Level cannot be set in Admin (§13) |
| W36 | Instructor card (name, designation, photo) | Present | Taken from the admin who created the course |
| W37 | Price + "Get Access" / Razorpay payment / "Contact us for pricing" | Present | |
| W38 | Access duration ("Lifetime access" / expiry) | Present | |
| W39 | Sections (chapters) with lesson lists | Present | |
| W40 | Course "modules" grouping of lessons | Not verified | API returns it; rendering not confirmed |
| W41 | Sequential lesson locking | Present | Server enforced |
| W42 | Video player (HLS, iframe fallback, DRM) | Present | |
| W43 | Lesson resources (downloads) | Present | |
| W44 | Lesson tasks (with proof upload, focus timer) | Present | |
| W45 | End-of-lesson quiz + mid-video quizzes | Present | |
| W46 | Video feedback questions | Present | |
| W47 | Lesson rating 1–10 + feedback | Present | |
| W48 | Reflections journal | Present | |
| W49 | Practice Arena | Present | Uses quiz questions; client-only |
| W50 | XP, stats, leaderboard | Present | |
| W51 | Lifelines and coin purchases | Present | |
| W52 | Certificate eligibility / download | Present | |
| W53 | "You might also like" (upsell) and "Related Courses" (cross-sell) | Present | |
| W54 | Weekly report page `/learning/<id>/weekly` | Present | |
| W55 | Trailer video | Not present | Field exists in DB, never used |
| W56 | Draft course blocked from members | **Not present** | Reproduced: draft opens by direct link (§5.1 R7) |

**Totals:** Present 42 · Not present 12 · Not verified 2 (56 items).

---

## 5. Admin Dashboard — course-management inventory

Columns: **UI** = a control exists on the admin page · **API** = backend endpoint exists · **DB** = value is saved · **Site** = website uses the value · **E2E** = observed live from admin click to website (impossible without login — always "No").

All course admin pages are under **Admin Dashboard → Content → Courses** (`/courses`) unless stated. All admin APIs require an admin (Clerk) login — confirmed at runtime (§5.1 R11–R12).

| # | Admin feature | UI | API | DB | Site | E2E | Notes |
|---|---|---|---|---|---|---|---|
| A1 | View course list, search, Draft badge, totals | Yes | `GET /api/courses` | — | — | No | |
| A2 | Create course ("+ New Course") | Yes | `POST /api/courses` | Yes | Yes | No | **Defaults to Published** |
| A3 | Edit title, slug, description | Yes | `PUT /api/courses/:id` | Yes | Yes | No | Title required; slug auto from title |
| A4 | Upload / change thumbnail | Yes (R2 upload) | upload + `PUT` | Yes | Detail page only | No | Ignored on catalog card |
| A5 | Module (Product / Service / Coaching) | Yes | `PUT` | Yes (`courses.module`) | Yes | No | Options hardcoded in the form |
| A6 | Required Tier | Yes | `PUT` | Yes | **No** | No | Reproduced: ignored (R3, R8) |
| A7 | Active on/off | Yes | `PUT` | Yes | **No** | No | Reproduced: ignored (R4) |
| A8 | Published on/off (draft) | Yes (toggle in form) | `PUT`; also `POST /:id/publish` | Yes | Catalog yes · detail **no** | No | R2 pass, R7 fail |
| A9 | Price (₹) | Yes | `PUT` (validated) | Yes | Yes | No | |
| A10 | Offer / discount price | **No** | No | No | No | No | |
| A11 | Access Days (blank = lifetime) | Yes | `PUT` | Yes | Yes | No | Used when access is granted after payment |
| A12 | Max Enrollments | Yes | `PUT` | Yes | **No** | No | Not checked anywhere when members enrol/pay |
| A13 | External Payment URL | Yes | `PUT` | Yes | **No** | No | Website never reads it |
| A14 | XP / Episode, Pass Score % | Yes | `PUT` | Yes | Yes | No | |
| A15 | Sequential unlock + completion threshold % | Yes | `PUT` | Yes | Yes | No | Server-enforced; unit-tested |
| A16 | Upsell / Cross-sell courses | Yes | `PUT` | Yes | Yes | No | |
| A17 | Category | **No** | No (DB field only) | Field exists | No | No | |
| A18 | Level (beginner/intermediate/advanced) | **No** | `PUT` accepts `level` | Yes | Yes (detail badge) | No | No form field |
| A19 | Featured / course sort order | **No** | No | Fields exist | Ordering uses `is_featured` | No | |
| A20 | Trailer video | **No** | No | Field exists | No | No | |
| A21 | Instructor | Auto | — | `created_by` | Yes | No | Always the creating admin; not editable |
| A22 | Preview course before publishing | **No** | — | — | — | No | |
| A23 | Delete course | Yes (confirm dialog) | `DELETE /api/courses/:id` | Hard delete | Removed | No | **Permanent, no archive** |
| A24 | Archive course | **No** | — | `deleted_at` exists, unused | — | No | |
| A25 | Episodes: add / edit / delete | Yes (Episodes tab) | `/:id/episodes`, `/episodes/:eid` | Yes | Yes | No | |
| A26 | Episodes: drag to reorder | Yes | `PUT /:id/episodes/reorder` | Yes | Yes | No | |
| A27 | Episode video (Bunny upload), duration, thumbnail, hide/show, DRM | Yes | episode `PUT` | Yes | Yes | No | |
| A28 | Sections (chapters): add / rename / delete / reorder / timer | Yes | `/:id/sections*` | Yes | Yes | No | |
| A29 | Course "Modules" tab (group lessons) | Yes | `/:id/modules*` | Yes | API yes, render not verified | No | |
| A30 | Lesson resources (file + preview image) | Yes | `/episodes/:eid/resources*` | Yes | Yes | No | |
| A31 | Lesson tasks + review submissions | Yes | `/episodes/:eid/tasks*` | Yes | Yes | No | |
| A32 | End quiz, quiz unlock %, mid-video quizzes | Yes | episode `PUT` | Yes | Yes | No | |
| A33 | Focus timer, lifelines, coin cost, streak points | Yes | episode `PUT` | Yes | Yes | No | |
| A34 | Video feedback questions | Yes | `/api/video-feedback/admin/*` | Yes | Yes | No | |
| A35 | Grant / revoke member access (Access tab) | Yes | `/:id/grant-access`, `/:id/access/:accessId` | Yes | Yes | No | Clears member's access cache |
| A36 | Payments: list / approve / refund | Yes (Payments toggle) | `/payments`, `/:id/payments/:pid/approve|refund` | Yes | Yes | No | |
| A37 | Badges: create / edit / delete / award | Yes (Badges tab) | `/:id/badges*` | Yes | Yes | No | |
| A38 | Analytics, Top XP leaderboard | Yes | `/:id/analytics`, `/:id/leaderboard` | — | — | No | |
| A39 | Reset a member's progress / unlock all lessons | **No** | Yes | — | — | No | Hooks exist but no button anywhere |
| A40 | Module banners / tagline / colour | Yes — **hidden page** `/settings/modules` | `GET/PUT /api/config/modules` | Yes | Yes | No | Not in the sidebar |
| A41 | Member's allowed modules | Yes (Members → edit) | members API | Yes | Yes | No | |
| A42 | Program's allowed modules | Not found | — | `programs.allowed_modules` | Yes | No | **Not verified** — no admin control found |
| A43 | Courses page text labels | **No** | — | — | Fallback text | No | Not in UI Strings |
| A44 | Validation + save messages | Yes | — | — | — | No | "Title is required", price validation, success/error toasts |
| A45 | Weekly course reports + feedback | Yes (Analytics → Weekly Course Reports) | `/api/course-reports/admin/*` | Yes | Yes | No | |

### 5.1 Runtime checks (local copy of live code + throwaway database)

| ID | Check | Result | Evidence |
|---|---|---|---|
| R1 | Catalog returns published courses | PASS | HTTP 200 |
| R2 | Catalog hides a draft course | PASS | Draft not in list |
| R3 | "Required Tier 5" course hidden from a Tier-1 member | **FAIL** | Course listed |
| R4 | Course with Active = off hidden | **FAIL** | Course listed |
| R5 | Catalog returns thumbnail, duration, lesson count | PASS | `durationDisplay=10m` from a 600-second lesson |
| R6 | Catalog returns module/program personalisation | PASS | `personalizationState`, `moduleConfigs` present |
| R7 | Draft course detail refused for members | **FAIL** | HTTP 200, title + lesson list returned; video URL withheld |
| R8 | Tier-5 course detail refused for Tier-1 member | **FAIL** | HTTP 200 |
| R9 | Videos withheld without access | PASS | `videoUrl = null` |
| R10 | Catalog needs member login | PASS | HTTP 401 without login |
| R11–R12 | Admin course API refuses a member login (read and edit) | PASS | HTTP 401 |
| Cache | Course title changed → catalog shows new title immediately | **Stale** | Old title returned right after the change; catalog cache is 5 minutes |

---

## 6. Website-to-admin field mapping

Base paths: admin API = `/api/courses`, website API = `/api/user/courses`. Files: **AC** = `admin-panel/app/courses/page.tsx`, **CC** = `backend/src/modules/courses/controller.ts`, **UC** = `backend/src/modules/user/controller.ts`, **CP** = `tbt-user-web/app/(platform)/courses/page.tsx`, **LP** = `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`.

| # | Website element | Example | Admin path | Admin control | API | DB table.field | Shows on website | Status | Evidence | Required action |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Course title | "Facebook Ads Mastery" | Content → Courses → New Course / ✎ Edit | Title | `POST/PUT /api/courses` → `GET /api/user/courses` | courses.title | Card + detail | NOT VERIFIED | AC 222; UC 493; R1 | Verify live after login |
| 2 | Course description | Paragraph | same | Description | same | courses.description | Detail page | NOT VERIFIED | LP | — |
| 3 | Catalog card cover | Fixed artwork | — | (Thumbnail ignored) | — | courses.thumbnail_url | Card | HARDCODED | CP 65–156 | Show thumbnail on card (P2) |
| 4 | Detail thumbnail | Image | same | Thumbnail (upload) | R2 upload + `PUT` | courses.thumbnail_url | Detail page | NOT VERIFIED | AC `FileUploadBtn`; LP | — |
| 5 | "Chapter N" on card | "Chapter 3" | — | — | — | (list position) | Card | HARDCODED | CP 112 | Use a real order/number or remove |
| 6 | Module label + module tabs | "Product" | same | Module (dropdown) | `PUT` | courses.module | Card + tabs | PARTIAL | AC 439–441 options hardcoded | Load options from `module_config` |
| 7 | Module banner, name, tagline, colour | Banner image | `/settings/modules` (type URL — not in sidebar) | Display name, tagline, banner, colour | `PUT /api/config/modules/:name` | module_config.* | Single-module hero | PARTIAL | Sidebar.tsx has no link | Add to sidebar |
| 8 | Which modules a member sees | Program view | Members → edit member | Allowed modules | members API | members.allowed_modules | Tabs/filter | NOT VERIFIED | UC 730–770 | Program-level control not found (P1) |
| 9 | Price on card / lock | "₹4,999" | same | Price (₹) | `PUT` (validated) | courses.price | Card + detail | NOT VERIFIED | CC `validateCoursePrice` | — |
| 10 | Offer / discount price | — | — | — | — | — | — | MISSING | no field | Add if needed (P2) |
| 11 | Free vs paid | Lock text | same | Price blank = free | — | courses.price (`access_type` unused) | Lock overlay | PARTIAL | `access_type` never read | Decide one source |
| 12 | Video duration | "1.5h" | Episodes tab | Duration (seconds) per lesson | episode `PUT` | course_episodes.duration_seconds | Card | NOT VERIFIED | UC catalog SQL; R5 | — |
| 13 | Task duration | "40m" | Episodes tab | Episode timer | episode `PUT` | course_episodes.timer_seconds | Card | NOT VERIFIED | UC catalog SQL | — |
| 14 | Lesson count | — | — | — | returned by API | count of visible episodes | Not shown | MISSING | CP doesn't render `_count.lessons` | Show on card (P3) |
| 15 | Instructor | Name + photo | — (auto) | — | — | courses.created_by → admins | Detail page | PARTIAL | UC catalog SQL | Add instructor field (P2) |
| 16 | Level badge | "Beginner" | — | — | `PUT` accepts `level` | courses.level | Detail page | MISSING | AC form has no field | Add dropdown (P2) |
| 17 | Category | — | — | — | `/api/user/courses/categories` exists, unused | courses.category_id | Not shown | MISSING | no UI either side | Add category management + filter (P2) |
| 18 | Search | — | — | — | `?search=` supported | — | Not shown | MISSING | CP has no search box | Add search box (P2) |
| 19 | Card order | Featured, newest | — | — | — | courses.is_featured, created_at (`sort_order` unused) | Catalog | MISSING | UC `ORDER BY` | Add featured toggle + drag order (P2) |
| 20 | Published / draft in catalog | Draft hidden | same | Published toggle | `PUT` | courses.is_published | Catalog | NOT VERIFIED | R2 pass | — |
| 21 | Draft hidden on detail page | — | same | Published toggle | `GET /api/user/courses/:id` | courses.is_published | Detail | BROKEN | R7 | Return 404 for drafts (P0) |
| 22 | Required tier | — | same | Required Tier | `PUT` | courses.required_tier | — | BROKEN | R3, R8 | Enforce or remove (P0) |
| 23 | Active on/off | — | same | Active | `PUT` | courses.is_active | — | BROKEN | R4 | Enforce or remove (P0) |
| 24 | Max enrollments | — | same | Max Enrollments | `PUT` | courses.max_enrollments | — | MISSING | Saved in CC; no check in UC/payments (code review, not reproduced) | Enforce or remove (P1) |
| 25 | External payment link | — | same | External Payment URL | `PUT` | courses.payment_link_url | — | MISSING | not referenced in tbt-user-web | Show button or remove field (P1) |
| 26 | Access duration | "Lifetime access" | same | Access Days | `PUT` | courses.access_duration_days | Detail | NOT VERIFIED | UC payment grant | — |
| 27 | Get Access / Razorpay pay | Button | Content → Courses → Payments | Approve / Refund | `/api/user/courses/:id/razorpay/*` | course_payments | Detail | NOT VERIFIED | LP, CC | — |
| 28 | Lock overlay messages | "Upgrade your plan…" | — | — | — | — | Card | HARDCODED | CP 45–50 | Move to UI Strings (P3) |
| 29 | Page heading, empty state, load-more, new-member text | "Modules", "No modules found" | — | — | — | not in `ui_strings` | Catalog | HARDCODED | keys missing from schema + admin | Add to UI Strings (P3) |
| 30 | Footer phone/email | "+91 80151 39542" | — | — | — | — | Catalog footer | HARDCODED | CP 819–820 | Read from Site Config (P3) |
| 31 | Sections (chapters) | "Week 1" | Courses → (course) → Episodes tab | Add/rename/delete section | `/:id/sections*` | course_sections | Detail | NOT VERIFIED | UC 8xx | — |
| 32 | Lesson list, titles, order | "Lesson 1" | Episodes tab | Add/edit/drag | `/:id/episodes*` | course_episodes | Detail | NOT VERIFIED | — | — |
| 33 | Lesson video | Player | Episodes tab | Video upload (Bunny), DRM | episode `PUT` | course_episodes.video_url, bunny_drm_token | Player | NOT VERIFIED | R9 (withheld without access) | — |
| 34 | Hidden lessons | — | Episodes tab | Visible toggle | episode `PUT` | course_episodes.is_visible | Detail + durations | NOT VERIFIED | UC `isVisible: true` | — |
| 35 | Lesson grouping ("Modules" tab) | — | Modules tab | Add/edit/reorder | `/:id/modules*` | course_modules, course_episode_modules | Detail | NOT VERIFIED | UC 912 | Confirm rendering |
| 36 | Lesson resources | PDF | Episodes → Resources | File + preview image | `/episodes/:eid/resources*` | app_resources | Lesson | NOT VERIFIED | — | — |
| 37 | Lesson tasks | Task card | Episodes → Tasks | Task + review | `/episodes/:eid/tasks*` | tasks, task_submissions | Lesson | NOT VERIFIED | — | — |
| 38 | Quizzes | Quiz modal | Episodes → edit | Quiz, mid-video quizzes, unlock % | episode `PUT` | course_episodes.quiz_data | Lesson | NOT VERIFIED | — | — |
| 39 | Video feedback questions | Modal | Episodes → Feedback | Questions | `/api/video-feedback/admin/*` | video_feedback_questions | Lesson | NOT VERIFIED | — | — |
| 40 | Focus timer, lifelines, streak points | Timer badge | Episodes → edit | Timer, lifelines, coin cost, streak points | episode `PUT` | course_episodes.* | Lesson | NOT VERIFIED | — | — |
| 41 | Sequential unlock | Locked lessons | Edit course → Progression | Sequential + threshold % | `PUT` | courses.require_sequential, completion_threshold_percent | Detail | NOT VERIFIED | `lessonProgression.test.ts` | — |
| 42 | XP + pass score | XP flash | Edit course → Gamification | XP / Episode, Pass Score % | `PUT` | courses.xp_per_episode, passing_score_percent | Lesson | NOT VERIFIED | — | — |
| 43 | Upsell / cross-sell | "You might also like" | Edit course → Upsell / Cross-sell | Course pickers | `PUT` | courses.upsell_course_ids, cross_sell_course_ids | Detail | NOT VERIFIED | LP 3857–3861 | — |
| 44 | Badges / certificate | Badge | Badges tab | Create/award | `/:id/badges*` | course_badges | Learning | NOT VERIFIED | — | — |
| 45 | Member access | Unlocked course | Access tab | Grant / revoke | `/:id/grant-access` | course_access | Card + detail | NOT VERIFIED | access cache cleared | — |
| 46 | Trailer | — | — | — | — | courses.trailer_url | — | MISSING | unused | Add or drop (P3) |
| 47 | Course preview before publish | — | — | — | — | — | — | MISSING | no button | Add "Preview" (P2) |
| 48 | Delete / archive | — | Courses list → 🗑 | Delete | `DELETE /api/courses/:id` | hard delete | Removed | PARTIAL | CC 166 `course.delete` | Soft delete + archive (P0) |
| 49 | Update freshness | Edited title | any course edit | Save | `PUT` clears only `home:*` | cache `courses:catalog:v2:*` (5 min) | Catalog | PARTIAL | CC `bustHome`; cache test | Clear catalog cache on save (P1) |
| 50 | New course default | — | + New Course | Published (default ON) | `POST` | courses.is_published | Catalog | PARTIAL | AC 48, CC create | Default to draft (P1) |

**Status totals (50 rows):** WORKING 0 · PARTIAL 7 · MISSING 10 · HARDCODED 5 · BROKEN 3 · NOT VERIFIED 25.

---

## 7. Admin navigation guide

All paths start from the left sidebar of the Admin Dashboard.

| Menu path | What it does for courses |
|---|---|
| **Content → Courses** | The main course manager. Top-right toggle switches between **Courses** and **Payments**. **+ New Course** creates a course. Each row has ✎ (edit) and 🗑 (delete). Clicking a row opens the course panel. |
| Content → Courses → *(click a course)* | Course panel with tabs: **Episodes**, **Modules**, **Access**, **Badges**, **Analytics**, **Top XP**. |
| Content → Courses → **Payments** | Course payment requests: approve, refund. A yellow number shows pending requests. |
| Members → *(edit member)* | Allowed modules for that member (overrides their program). |
| `/settings/modules` *(type this address — not in the sidebar)* | Module display name, tagline, description, banner, colour, order. |
| Settings → UI Strings | Site text — **does not include** the Courses page labels. |
| Analytics → Weekly Course Reports | Weekly progress reports and member feedback per course. |

---

## 8. How to update each supported field (step by step)

> Menu paths come from the admin code. Field names are the labels in the form.

**Change a course title, description, slug or thumbnail**
1. Admin Dashboard → Content → **Courses**.
2. Find the course (use the **Search courses…** box) and click **✎ Edit**.
3. Change **Title**, **Slug**, **Description**, or click **Thumbnail** to upload a new image.
4. Click **Save**. You should see "Course updated".
5. Note: the new thumbnail appears on the course **detail** page, not on the catalog card.

**Set or change the price**
1. Content → Courses → **✎ Edit** → section **Pricing & Access**.
2. Enter **Price (₹)**. Leave empty for a free course.
3. **Access Days**: leave empty for lifetime access, or enter a number of days.
4. Save.

**Choose the module (Product / Service / Coaching)**
1. Content → Courses → **✎ Edit** → **Module** dropdown → choose → Save.

**Change a module's banner, name or tagline**
1. Type `https://v0-tbt-ott-admin.vercel.app/settings/modules` in the browser (no menu link).
2. Edit the module → Save.

**Add, edit, reorder or hide lessons**
1. Content → Courses → click the course → **Episodes** tab.
2. Add an episode: title, description, video upload, thumbnail, **Duration (seconds)** (or M:SS).
3. Drag lessons to reorder. Use the eye toggle to hide a lesson.
4. Use **Resources**, **Tasks**, **Feedback** buttons on a lesson for downloads, tasks and feedback questions.
5. Use sections ("chapters") to group lessons — add, rename (✎), delete (🗑).

**Give a member access**
1. Content → Courses → click the course → **Access** tab → grant (or **Revoke**).

**Approve a payment**
1. Content → Courses → **Payments** toggle → find the request → **Approve** (or **Refund**).

---

## 9. Course creation and publishing workflow

1. Content → Courses → **+ New Course**.
2. **Before saving, switch "Published" OFF.** New courses are published by default and go live on first save.
3. Fill title, description, thumbnail, module, price and other fields → **Save**.
4. Open the course → **Episodes** tab → add sections and lessons, upload videos, add quizzes, resources and tasks.
5. When ready: **✎ Edit** → switch **Published** ON → **Save**.
6. Wait up to **5 minutes**, then check the live site (§11).

> ⚠️ While a course is a draft, it is hidden from the catalog but **anyone signed in with its link can still open its detail page** (see P0-1).

## 10. Course edit and update workflow

1. Content → Courses → **✎ Edit** (course fields) or click the course (lessons and other tabs).
2. Save. A green "Course updated" message confirms the save.
3. The catalog may show the old version for **up to 5 minutes** (cache).
4. To **unpublish**: ✎ Edit → switch **Published** OFF → Save. (There is no separate "Unpublish" button.)
5. To **delete**: 🗑 → confirm. **This is permanent** — all lessons are removed. There is no archive or undo.

## 11. How to check an update on the live Courses website

1. Sign in at `https://app.tamilbusinesstribe.com` with a member account that can see the course.
2. Open **/courses**. Wait up to 5 minutes after saving, then refresh.
3. Find the card. It shows the title, module, video and task duration, price (if locked), and progress.
4. Click the card to open `/learning/<course id>`. Check the title, description, thumbnail, lessons, price and access.
5. To check a draft is hidden, use a member account: it must **not** appear in /courses. (It can still be opened by direct link — known issue P0-1.)

---

## 12. API endpoints, backend files and database mapping

**Admin APIs** (`backend/src/modules/courses/routes.ts`; all require Clerk admin login):

| Purpose | Endpoint |
|---|---|
| Courses | `GET/POST /api/courses` · `GET/PUT/DELETE /api/courses/:id` · `POST /api/courses/:id/publish` |
| Payments | `GET /api/courses/payments` · `POST /api/courses/:id/payments/:paymentId/approve` · `…/refund` |
| Access | `GET /api/courses/:id/access` · `POST /api/courses/:id/grant-access` · `DELETE /api/courses/:id/access/:accessId` |
| Sections | `GET/POST /api/courses/:id/sections` · `PUT …/reorder` · `PUT/DELETE …/:sectionId` |
| Modules (lesson groups) | `GET/POST /api/courses/:id/modules` · `PUT …/reorder` · `PUT/DELETE …/:moduleId` |
| Episodes | `GET/POST /api/courses/:id/episodes` · `PUT /api/courses/:id/episodes/reorder` · `PUT/DELETE /api/courses/episodes/:eid` |
| Resources | `GET/POST /api/courses/episodes/:eid/resources` · `PUT …/reorder` · `PUT/DELETE …/:rid` |
| Tasks | `GET/POST /api/courses/episodes/:eid/tasks` · `PUT …/reorder` · `PUT/DELETE …/:tid` · submissions + review |
| Badges | `GET/POST /api/courses/:id/badges` · `PUT/DELETE …/:badgeId` · `POST …/:badgeId/award` |
| Analytics | `GET /api/courses/:id/analytics` · `/leaderboard` · `/enrollments` |
| Member tools (no UI) | `POST /api/courses/:id/members/:memberId/reset-progress` · `…/unlock-all` |
| Module config | `GET /api/config/modules` · `PUT /api/config/modules/:name` |

**Website APIs** (`backend/src/modules/user/routes.ts`; member login required): `GET /api/user/courses` (catalog) · `GET /api/user/courses/:id` (detail) · `/courses/categories` (unused) · `/courses/module-tabs` · `/courses/:id/enroll` · `/courses/:id/request-access` · `/courses/:id/razorpay/create-order|verify` · certificate, reflections, lesson feedback, quiz, XP, leaderboard.

**Main database tables:** `courses`, `course_episodes`, `course_sections`, `course_modules`, `course_episode_modules`, `course_access`, `course_payments`, `course_enrollments`, `course_badges`, `module_config`, `programs.allowed_modules`, `members.allowed_modules`, `app_resources`, `tasks`, `video_feedback_questions`. Several are created at server startup (`backend/src/plugins/prisma.ts`) instead of in `schema.prisma`.

**Key files**

| Area | File |
|---|---|
| Website catalog | `tbt-user-web/app/(platform)/courses/page.tsx` |
| Website detail/player | `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` |
| Website hooks/services | `tbt-user-web/lib/hooks/useCourses.ts`, `lib/api/services/courses.service.ts` |
| Admin Courses page | `tbt-admin/admin-panel/app/courses/page.tsx` |
| Admin hooks | `tbt-admin/admin-panel/lib/hooks/useTbt.ts` |
| Admin module settings | `tbt-admin/admin-panel/app/settings/modules/page.tsx` |
| Backend admin course logic | `tbt-admin/backend/src/modules/courses/controller.ts` |
| Backend member course logic | `tbt-admin/backend/src/modules/user/controller.ts` (`listUserCoursesHandler`, `getUserCourseHandler`) |
| Lesson locking | `tbt-admin/backend/src/lib/lessonProgression.ts` |
| Data model | `tbt-admin/backend/prisma/schema.prisma` (`model Course`) |

---

## 13. Missing, partial, hardcoded and broken features

**BROKEN (reproduced)**
1. Draft courses open by direct link (R7).
2. "Required Tier" has no effect (R3, R8).
3. "Active" has no effect (R4).


**MISSING**
- Max Enrollments enforcement (saved but never checked — found in code, not reproduced) · Category management and filter · Level field · Featured flag and course sort order · Offer price · Trailer · Preview before publish · Search box on the website · Lesson count on card · Archive · External payment link on the website.

**PARTIAL**
- Thumbnail only on the detail page · Module options hardcoded (Product/Service/Coaching) · Module settings page hidden from the sidebar · Program-level allowed modules (no admin control found) · Instructor fixed to the creating admin · Free/paid determined only by price (`access_type` unused) · Hard delete · 5-minute stale catalog · New courses published by default · Reset progress / unlock-all have no buttons · Course "Modules" grouping display not confirmed.

**HARDCODED**
- Card cover artwork · "Chapter N" numbering · Lock messages · Courses page labels ("Modules", "No modules found", "Load more", new-member text) · Footer phone and email.

**Code clean-up noticed (no user impact)**
- `backend/src/modules/courses/schema.ts` lists the modules as `'Product','Service','Coach'` but is not used anywhere.
- Startup code assigns modules to five specific course IDs (`plugins/prisma.ts` lines 56–58, 2070).

---

## 14. Prioritised implementation plan

### P0 — data integrity, security, publishing

| ID | Problem | Evidence | Files | Expected behaviour | Acceptance criteria | Tests |
|---|---|---|---|---|---|---|
| P0-1 | Draft courses visible by direct link | R7 | `user/controller.ts` `getUserCourseHandler` | Members get 404 for unpublished courses | Draft → 404; published → 200 | Backend test: draft vs published |
| P0-2 | Delete is permanent | CC 166 | `courses/controller.ts`, admin page | Delete = archive (set `deleted_at`, unpublish); member queries exclude archived | Archived course hidden; restorable | Test archive + hidden from catalog/detail |
| P0-3 | "Required Tier" ignored | R3, R8 | `user/controller.ts` catalog + detail | Decide: enforce (lock or hide) **or** remove the field | Tier-1 member cannot access Tier-5 course | Catalog + detail tests per tier |
| P0-4 | "Active" ignored | R4 | same | Decide: enforce **or** remove (it duplicates "Published") | Inactive course hidden, or field gone | Catalog test |

### P1 — essential course management

| ID | Problem | Evidence | Files | Expected behaviour | Acceptance criteria | Tests |
|---|---|---|---|---|---|---|
| P1-1 | Catalog stale up to 5 min after edits | cache test; `bustHome` | `courses/controller.ts` | Clear `courses:catalog:*` on create/update/publish/delete | Edit visible on next page load | Cache invalidation test |
| P1-2 | New courses go live immediately | AC 48; CC create | admin page + create handler | Default to draft | New course hidden until published | Create → not in catalog |
| P1-3 | Max Enrollments not enforced | no check | enroll/payment/grant code | Block or waitlist when full | Enrollment N+1 refused | Enroll test |
| P1-4 | External Payment URL unused | not referenced | detail page | Show "Pay" button when set, or remove the field | Link opens payment page | UI test |
| P1-5 | Module settings page hidden; module options hardcoded | Sidebar; AC 439 | `Sidebar.tsx`, course form | Sidebar link; dropdown loads from `module_config` | New module appears in course form | UI test |
| P1-6 | No program-level allowed-modules control found | — | programs/batches admin | Admin can set modules per program | Program members see only allowed modules | Integration test |

### P2 — editing, filters, pricing, media

| ID | Problem | Files | Expected behaviour | Acceptance criteria | Tests |
|---|---|---|---|---|---|
| P2-1 | Thumbnail not on catalog card | `courses/page.tsx` | Card shows thumbnail (artwork as fallback) | Uploaded image visible on card | Visual check |
| P2-2 | No category management/filter | admin + website + API | Category CRUD; filter on /courses | Filter returns matching courses | API + UI tests |
| P2-3 | No level field | admin form | Level dropdown | Badge matches admin value | UI test |
| P2-4 | No featured/sort control | admin list + catalog query | Featured toggle + drag order | Catalog follows admin order | Ordering test |
| P2-5 | No search box | `courses/page.tsx` | Search box using `?search=` | Typing filters courses | UI test |
| P2-6 | No offer price | schema + form + card | Optional offer price with strike-through | Card shows both prices | Price display test |
| P2-7 | Instructor not editable | schema + form | Pick instructor | Detail shows chosen instructor | UI test |
| P2-8 | No preview before publish | admin page | "Preview" opens member view of a draft (admin only) | Admin can view draft | Access test |

### P3 — usability and testing

| ID | Item |
|---|---|
| P3-1 | Move Courses page text, lock messages and footer contact into UI Strings / Site Config |
| P3-2 | Show lesson count on cards; replace "Chapter N" with real numbering or remove it |
| P3-3 | Add "Reset progress" / "Unlock all" buttons (APIs and hooks already exist) |
| P3-4 | Show an error state when the catalog fails to load |
| P3-5 | Trailer video: implement or drop `trailer_url` |
| P3-6 | Remove unused `courses/schema.ts`; move startup course-ID module assignments out of `prisma.ts` |
| P3-7 | Add automated tests for catalog/detail visibility rules (draft, tier, active, archived) |

---

## 15. Testing checklist

- [ ] Create a course → it is **not** visible to members until published (after P1-2).
- [ ] Publish → appears in /courses within seconds (after P1-1).
- [ ] Unpublish → disappears from /courses **and** its detail link returns "not found" (after P0-1).
- [ ] Edit title, description, thumbnail → updated on card and detail page.
- [ ] Price set/cleared → lock overlay shows price / "Request access".
- [ ] Add, reorder, hide lessons → detail page follows; durations update.
- [ ] Sections and resources, tasks, quizzes → visible on the lesson.
- [ ] Grant/revoke access → card unlocks/locks.
- [ ] Approve a payment → member gains access.
- [ ] Delete/archive → hidden everywhere, data recoverable (after P0-2).
- [ ] Tier / Active / Max Enrollments behave as decided (P0-3, P0-4, P1-3).
- [ ] Member token cannot call admin APIs (verified: 401).
- [ ] Mobile browser: grid, tabs and player usable.

## 16. Deployment and production verification checklist

- [ ] Changes merged to `main` via an approved PR; CI green.
- [ ] Deploy (Actions → "Deploy to production (one click)", or push `main` → `production`).
- [ ] In the backend deploy log, the guarded schema step shows **"Blocked: 0"** and the expected additive changes only.
- [ ] Backend health returns 200; `/api/user/courses` returns 401 without login.
- [ ] Sign in as admin: create a **draft** test course → confirm hidden on the live site → publish → confirm visible → unpublish → confirm hidden → archive.
- [ ] Sign in as a member: check catalog, detail, video playback, and payment flow on a test course.
- [ ] Remove the test course afterwards (archive).

## 17. Unverified items and information still required

| Item | Why not verified | What is needed |
|---|---|---|
| Live course list, names, prices, counts | Login required; production data not read | A member login (read-only) or a screen share |
| Admin screens as they actually look | Clerk login required | An admin login, or screenshots |
| Every "NOT VERIFIED" row in §6 | No end-to-end live run | Run the §15 checklist on staging with logins |
| Course "Modules" grouping on the detail page | Rendering not confirmed in code | Live check with a course that uses the Modules tab |
| Program-level allowed modules management | No admin control found | Confirm with the team whether another tool sets `programs.allowed_modules` |
| Mobile-browser behaviour | No device test | Check on a phone |
| Whether "Required Tier" and "Active" should be enforced or removed | Business decision | Decision from the product owner |
