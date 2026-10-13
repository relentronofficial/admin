# TBT — Website-to-Admin Complete Control Audit

| | |
|---|---|
| **Date** | 2026-10-13 |
| **Code base** | branch `feat/admin-member-activity`, created from `main` = `production` = `a77eca4e` |
| **Live URLs** | Website `https://app.tamilbusinesstribe.com` · Admin `https://v0-tbt-ott-admin.vercel.app` |
| **Companion doc** | `docs/TBT-COURSES-ADMIN-AUDIT.md` (course-by-course detail, written 2026-10-13 before the fixes below) |

---

## 1. Executive summary

- **Inspected:** all **52 website pages** and **45 admin pages**, traced through the backend to the database.
- **Mostly covered already:** most website content already has an admin control (courses, workshops, e-books, podcasts, community, resources, products, hero carousel, content sections, notifications, support/FAQs, onboarding, batches/programs, gamification, ads, credits).
- **Built in this branch — Daily Time Spent:** accurate, server-side activity tracking, plus a new **Activity** tab on each member's admin profile (today, previous days, weekly, monthly, last active, active vs. watching time). Verified on a local copy with real HTTP, database and browser tests (§11).
- **Fixed in this branch — 3 course publishing problems:**
  1. **Every backend deploy re-published every unpublished course** (a July backfill left running at startup). **Fixed** — verified a draft now stays a draft after a restart.
  2. **Draft courses opened by direct link.** **Fixed** — members without access/enrollment now get "not found".
  3. **Course edits took up to 5 minutes to show** on /courses. **Fixed** — saves now clear the catalog cache.
- **Still missing (not built here):** admin management for **Events** and **Webinars/Live**, program-level allowed modules, course category/level/featured/order/offer-price/preview/archive, Courses-page text labels, and the course-card thumbnail. Full list in §5 and §14.
- **Not verified live:** nothing was deployed. Live admin and member screens need logins that were not available (§2).

| Website inventory (§3, 31 page groups covering all 52 pages) | Count |
|---|---|
| WORKING (verified end to end, live) | 0 |
| IMPLEMENTED (code added + tested locally; deployment/live check pending) | 1 |
| PARTIAL | 3 |
| MISSING | 2 |
| BLOCKED | 0 |
| NOT VERIFIED (admin control exists in code; not seen working live) | 25 |
| **Missing admin controls identified (§5)** | **15** (M1–M15) |
| **Features implemented in this branch (§6)** | **8**, all IMPLEMENTED (I1–I8) |

> **Why WORKING = 0:** "WORKING" requires end-to-end proof on the live system. No change has been deployed and no admin/member login was available, so nothing qualifies yet — this is a statement about evidence, not about quality.

---

## 2. Scope and limitations

| Item | What was possible |
|---|---|
| Code | Full read of website pages, admin pages, backend routes/handlers, database model |
| Live website / admin | Only the sign-in pages (both require login). No live screen could be inspected. |
| Production data | Not read, not changed |
| Runtime testing | New/changed backend code run **locally** against a **throwaway database**; website built and tested **locally** in Microsoft Edge (headless). Never production. |
| Admin UI | New Activity tab typechecks; **not viewed in a browser** (admin needs a Clerk login) |
| Mobile app (Flutter) | Out of scope except where it shares the backend (noted in §8) |

---

## 3. Website feature inventory (all 52 pages)

Status here is about **admin control**: **NOT VERIFIED** = an admin control exists in code but was not seen working live; **MISSING** = no admin control; **PARTIAL** = some of it; **IMPLEMENTED** = added in this branch.

| # | Website page | What it shows | Data from (API) | Admin control (menu path) | Status |
|---|---|---|---|---|---|
| 1 | `/dashboard` | Welcome, stats, continue learning | `/api/user/dashboard/*` | Derived from member activity — no editing needed | NOT VERIFIED |
| 2 | `/discover` (home / TBT) | Hero carousel, content rows, continue/recently watched | `/api/pub/home/*` | Content → Hero Carousel; Content → Content Sections | NOT VERIFIED |
| 3 | `/courses` | Mentorship block, modules, course cards, saved videos | `/api/user/courses` | Content → Courses; `/settings/modules` (hidden page) | PARTIAL (card art, labels, footer hardcoded — see course doc) |
| 4 | `/learning`, `/learning/[courseId]`, `/learning/[courseId]/[lessonId]` | Course detail, lessons, player, quizzes, tasks, resources | `/api/user/courses/:id`, `/enrollments/*` | Content → Courses → (course) → Episodes / Modules / Access / Badges | NOT VERIFIED |
| 5 | `/learning/[courseId]/weekly` | Weekly report + feedback | `/api/course-reports/*` | Analytics → Weekly Course Reports | NOT VERIFIED |
| 6 | `/learning/badges` | Earned badges | `/api/user/badges` | Content → Courses → Badges tab; Settings → Badges | NOT VERIFIED |
| 7 | `/programs`, `/programs/[id]` | Course list / detail (uses course data) | `/api/user/courses` | Content → Courses | NOT VERIFIED |
| 8 | `/workshops`, `/workshop/[slug]` | Workshops, flow, challenges, live calls, Q&A, assignments | `/api/user/workshops/*` | Content → Workshops (+ Analytics → Assignments) | NOT VERIFIED |
| 9 | `/episode/...`, `/watch/...` | Full-screen players | episode APIs | Content → Workshops | NOT VERIFIED |
| 10 | `/events` | Events list + register | `/api/user/events` | **None** (no admin page, no admin API) | **MISSING** |
| 11 | `/live/[webinarId]` | Live webinar room | `/api/user/webinars/*` | **No admin page** (backend admin API exists, unused) | **MISSING** |
| 12 | `/batch-program`, `/batch-program/[day]` | 90-day program days, tasks, attendance, breaks, lifelines, certificate | `/api/user-batch/*` | Batches; Tasks | NOT VERIFIED |
| 13 | `/batch-program/mentorship` | Mentorship dashboard | `/api/user/mentorship/*` | Members → (member) (revenue editing exists via API) | PARTIAL (no dedicated admin view of all mentorship stats) |
| 14 | `/community` (+ hashtag, saved) | Feed, posts, comments | `/api/community/*` | Communication → Community (moderation) | NOT VERIFIED |
| 15 | `/ebooks` (+ author, book, read, bookmarks, highlights) | Library, banners, categories, reader | `/api/ebooks/*` | Content → E-Books | NOT VERIFIED |
| 16 | `/podcasts` (+ episode, series) | Podcasts, series, player | `/api/podcasts/*` | Content → Podcasts | NOT VERIFIED |
| 17 | `/Resources` | Downloadable resources | `/api/user/resources` | Content → Resources | NOT VERIFIED |
| 18 | `/Products` | Products + inquiry | `/api/user/products` | Content → Products (incl. inquiries) | NOT VERIFIED |
| 19 | `/messages` (+ group, starred) | DMs and group chats | `/api/conversations`, `/api/chat-groups` | Communication → Messages; Group Chats | NOT VERIFIED |
| 20 | `/notifications` | Notification centre | `/api/user/notifications` | Communication → Notifications | NOT VERIFIED |
| 21 | `/search` | Search across workshops, courses, events | several | Uses content above | NOT VERIFIED |
| 22 | `/history` | Watch history | `/api/user/dashboard/watch-history` | Members → (member) → Analytics (watch history) | NOT VERIFIED |
| 23 | `/profile` | Profile, devices, credits, psychometric, notification prefs, streak points | `/api/user/*` | Members → (member); Billing → Credits; `/psychometric` (not in sidebar) | PARTIAL (psychometric page not in sidebar) |
| 24 | `/support` (+ new, tickets, feedback) | FAQs, categories, tickets | `/api/helpdesk/*` | Support → Support | NOT VERIFIED |
| 25 | `/onboarding` (+ meeting) | KYC wizard, content steps, meetings | `/api/onboarding*` | Onboarding | NOT VERIFIED |
| 26 | Header | Streak, tier badge, notifications, messages, profile | `/api/user/streak`, `/me` | Settings → Navigation (visibility); Settings → Tiers | NOT VERIFIED |
| 27 | Ads | Ad overlays | `/api/ads/*` | Communication → Ad Campaigns | NOT VERIFIED |
| 28 | Site-wide theme, logos, labels | Theme, logo, nav, UI strings, light/dark | `/api/pub/config/*` | Settings → Site Config / Navigation / UI Strings | NOT VERIFIED |
| 29 | Morning ritual card | Daily habits | `/api/rituals/*` | Settings → Morning Ritual | NOT VERIFIED |
| 30 | Member time spent (not shown to members) | — | `/api/user/activity/heartbeat` (new) | Members → (member) → **Activity** (new) | **IMPLEMENTED** |
| 31 | Public pages: `/`, `/login`, `/signup`, `/verify`, `/verify/course/[certId]`, `/ebook/[slug]` | Landing, sign-in, certificate check, public e-book | `/api/pub/*`, `/api/user-auth/*` | Login/sign-up are off-limits by project rule; certificate data comes from courses | NOT VERIFIED |

---

## 4. Existing admin controls (sidebar)

| Group | Pages |
|---|---|
| (top) | Dashboard · Admins · **Members** · Onboarding · Batches · Tasks |
| Content | Hero Carousel · Content Sections · **Courses** · Payments · Workshops · Podcasts · E-Books · Resources · Products |
| Communication | Community · Notifications · Batch Reports · Messages · Group Chats · Ad Campaigns · AI Content |
| Settings | Site Config · Navigation · UI Strings · Plan Entitlements · Tiers · Badges · TBT Gamification · Morning Ritual |
| Billing | Credits · Grant Coins |
| Support | Support |
| Analytics | Analytics · Challenges · Assignments · Weekly Course Reports |
| Security | Security Logs |
| **Pages that exist but are not in the sidebar** | `/settings/modules` (course module banners) · `/psychometric` |

---

## 5. Missing admin controls

| # | Missing control | Website impact | Priority |
|---|---|---|---|
| M1 | **Events** — create/edit/publish/delete events | `/events` can only show events inserted directly in the database | P1 |
| M2 | **Webinars / Live** admin page (backend API exists) | `/live/[webinarId]` sessions cannot be scheduled from Admin | P1 |
| M3 | **Program allowed modules** (`programs.allowed_modules`) | Which course modules a program's members see cannot be set from Admin | P1 |
| M4 | Course **category**, **level**, **featured**, **sort order**, **offer price**, **trailer** | Shown/used by website or schema, no admin field | P2 |
| M5 | Course **preview before publish** and **archive** (delete is permanent) | — | P1 (archive), P2 (preview) |
| M6 | Courses-page **text labels**, lock messages, footer phone/email | Hardcoded on `/courses` | P3 |
| M7 | Course **card thumbnail** | Uploaded thumbnail ignored on cards | P2 |
| M8 | **Required Tier**, **Active**, **Max Enrollments**, **External Payment URL** have no effect on the website | Admin controls that do nothing | P0 (decide: enforce or remove) |
| M9 | Sidebar links for `/settings/modules` and `/psychometric` | Pages reachable only by URL | P2 |
| M10 | Reset a member's course progress / unlock all lessons (API + hooks exist) | No button | P3 |
| M11 | Admin view of per-member **login/logout history** | Not reliably recorded today (see §8.6) | P2 |
| M12 | Role-based restriction of member data (e.g. account managers see only their members) | All signed-in admins see all members | P2 |
| M13 | Startup code still overrides two admin settings: `plan_entitlements` call counts reset to defaults when set to 0; five course IDs get their module re-filled when cleared | Admin edits silently undone on deploy | P1 |
| M14 | Mobile app does not send activity heartbeats | Mobile time counted only while video plays | P2 |
| M15 | Aggregate engagement reports (all members, by day/week) built on the new activity data | — | P2 |

---

## 6. Features implemented in this branch

| # | Feature | Status | Evidence |
|---|---|---|---|
| I1 | Activity tracking table `member_daily_activity` | IMPLEMENTED | Created on local startup; §11 |
| I2 | Member heartbeat API `POST /api/user/activity/heartbeat` | IMPLEMENTED | T1–T5, T7 |
| I3 | Server-side "watching" signal from course + workshop video progress | IMPLEMENTED | T6a–T6c |
| I4 | Website tracker (visible + recent interaction or playing media) on all member pages and full-screen players | IMPLEMENTED | Browser B1–B4 |
| I5 | Admin API `GET /api/members/:id/daily-activity` | IMPLEMENTED | T8–T12, T14 |
| I6 | Admin **Members → (member) → Activity** tab | IMPLEMENTED | Typechecks; **not viewed in a browser** |
| I7 | Stop re-publishing unpublished courses on every deploy | IMPLEMENTED | Draft stayed unpublished after restart |
| I8 | Draft course by direct link → "not found" (keeps access for enrolled/paid members); course saves refresh the catalog | IMPLEMENTED | T13a–T13c (catalog refresh: code only) |

---

## 7. How to use: Daily Time Spent

**Menu path:** Admin Dashboard → **Members** → click a member → **Activity** tab.

1. **Top cards:**
   - **Today**: active time today.
   - **Last 7 days** and **Last 30 days**: total active time, plus "active days of tracked days".
   - **Last active**: date and time of the last recorded activity, plus "last connected" from the live connection.
2. **Range buttons:** **30 / 90 / 180 days**.
3. **Chart:** one bar per day. Red = active minutes. Grey = tracked but no activity. **Striped** = before tracking started, meaning *unknown*, not zero.
4. **Weekly (Mon–Sun)** and **Monthly** tables: active time and "active days / tracked days".
5. **Daily detail** table: active time, watching/listening time, first and last activity of each day.

All times are **IST (Asia/Kolkata)**. Values are calculated and **cannot be edited**.

---

## 8. Daily Time Spent — how it is measured

### 8.1 What counts as an "active minute"
A minute counts if, during that minute, **any** of these happened:
- **Website heartbeat.** The member's browser sends one when the tab is **visible** AND either:
  - the member clicked, typed, scrolled, touched or moved the mouse in the **last 5 minutes**, **or**
  - a video or audio on the page is **playing**.
- **Video progress.** A course or workshop video reports **real watched seconds** (`deltaSeconds > 0`). This is checked only *after* the server has confirmed access and that the lesson exists.

A minute is also a **watching/listening minute** if media was playing (heartbeat) or a video reported progress.

### 8.2 What never counts
- Hidden or background tabs (heartbeat not sent; the server also rejects `visible:false`).
- Visible tabs idle for more than 5 minutes with nothing playing.
- Closed browsers, disconnections and gaps — missing minutes are **never filled in**.
- Paused video (progress posts with `deltaSeconds = 0`).
- Progress for lessons that don't exist or that the member can't access.

### 8.3 Accuracy rules
- **Server clock only:** the minute and the date come from the **database clock**, never the browser, so a client cannot backdate or invent activity.
- **No double counting:** each minute is one bit in a per-day map. Setting a bit twice has no effect, so retries, several tabs and several devices in the same minute count **once**.
- **Timezone:** days are counted in **IST (Asia/Kolkata)**. Members have no stored timezone, and the platform already defaults to IST. Midnight IST starts a new day.
- **History:** activity before this feature went live was **never recorded**. Those days are shown as **"Not tracked"**, never as 0. Tracking start = the first day any activity was recorded.
- **Privacy:** only member ID, date, a 1,440-bit minute map, a heartbeat count and first/last activity time are stored. No pages visited, no IP addresses, no content.
- **Access:** only signed-in admins (Clerk) can read it (`/api/members/*`). Members cannot see other members' data (T8).

### 8.4 Known limitations
- **Reading counts for up to 5 minutes:** a member reading a page without touching anything for more than 5 minutes stops being counted after 5 minutes.
- **Embedded players:** iframe videos can't be inspected by the browser tracker; they are counted through the server-side video progress signal instead.
- **Mobile app:** time is counted only while course/workshop video plays (no app heartbeat yet — M14).
- **Bursty traffic:** at most one heartbeat a minute per tab. A member active for a few seconds in a minute counts as that whole minute.

### 8.5 Storage size
One row per member per day they are active, about 400 bytes each. For example, 2,000 daily-active members is about 0.8 MB a day, or 0.3 GB a year.

### 8.6 Login and logout sessions
These are **not reliably tracked** today:
- `member_sessions` keeps one row per device, updated at most every 5 minutes when the app loads the member profile, and never closed on logout.
- The existing "Active Devices (30 days)" list on **Members → (member) → Analytics** is the best available signal.
- Proper login/logout history is item M11.

---

## 9. Database changes

| Change | How | Notes |
|---|---|---|
| New table `member_daily_activity (member_id, activity_date, active_bits BIT(1440), media_bits BIT(1440), heartbeat_count, first_active_at, last_active_at)` with primary key `(member_id, activity_date)`, FK to `members` (cascade), index on `activity_date` | Idempotent `CREATE TABLE IF NOT EXISTS` in `backend/src/plugins/prisma.ts` (the project's convention) | Additive only. The CI schema guard (PR #56) automatically protects startup-created tables from being dropped. |
| Removed startup statement `UPDATE courses SET is_published = true WHERE is_active = true AND is_published = false` | Code removal | **No data is changed.** Stops future overrides. |

No tables or columns were dropped; no production data was touched.

---

## 10. APIs created or modified

| API | Change | Auth |
|---|---|---|
| `POST /api/user/activity/heartbeat` | **New.** Body `{visible, interacted, media}` → `{recorded}` | Member login (JWT cookie) |
| `GET /api/members/:id/daily-activity?days=30` | **New.** Returns timezone, todayDate, trackingStartDate, lastActiveAt, lastSeenAt, today, last7Days, last30Days, days[], weekly[], monthly[] | Admin login (Clerk) |
| `POST /api/user/enrollments/:courseId/progress/:lessonId` | Records a watching minute after validation when `deltaSeconds > 0` | Member |
| `POST /api/user/episodes/:id/progress` | Same, for workshop episodes | Member |
| `GET /api/user/courses/:id` | Unpublished course → 404 unless the member has access or an enrollment | Member |
| Admin course/episode mutations (`/api/courses/*`) | Also clear `courses:catalog:*` cache | Admin |

**Files changed** (all on branch `feat/admin-member-activity`):
- Backend:
  - `src/lib/memberActivity.ts` *(new)*
  - `src/lib/memberActivityLogic.ts` *(new)*
  - `src/lib/memberActivityLogic.test.ts` *(new)*
  - `src/plugins/prisma.ts`
  - `src/modules/user/controller.ts`, `src/modules/user/routes.ts`
  - `src/modules/members/controller.ts`, `src/modules/members/routes.ts`
  - `src/modules/courses/controller.ts`
  - `vitest.config.ts`
- Website:
  - `lib/api/services/activity.service.ts` *(new)*
  - `lib/hooks/useActivityHeartbeat.ts` *(new)*
  - `components/guards/ActivityHeartbeat.tsx` *(new)*
  - `app/(platform)/layout.tsx`, `app/(player)/layout.tsx`
- Admin:
  - `components/members/MemberDailyActivity.tsx` *(new)*
  - `app/members/[id]/page.tsx`
  - `lib/hooks/useTbt.ts`
- Docs: this file, and `docs/TBT-COURSES-ADMIN-AUDIT.md`

---

## 11. Test results (actual)

All runtime tests used a **local** backend and a **throwaway local database**. Nothing touched production.

**Automated**
- Backend unit tests: **233/233 passed** (19 files), including **13 new** activity-logic tests.
- Typecheck: backend ✅ · admin panel ✅ · website ✅.
- Website production build ✅.

**Runtime — backend API + database**

| ID | Test | Result |
|---|---|---|
| T1 | Visible + interacted heartbeat records 1 active minute | PASS |
| T2 | Two devices + a retry in the same minute → 1 minute (3 heartbeats) | PASS |
| T3 | Hidden tab not counted | PASS |
| T4 | Visible idle tab not counted | PASS |
| T5 | Playing media counts as active + watching | PASS |
| T6a | Paused video (`deltaSeconds = 0`) not counted | PASS |
| T6b | Progress for a non-existent lesson → 404, not counted | PASS |
| T6c | Real lesson progress → active + watching minute | PASS |
| T7 | Heartbeat needs member login (401) | PASS |
| T8 | Admin activity API refuses no login and member tokens (401/401) | PASS |
| T9a–d | Admin view: today, historical days (45 m, 90 m), "not tracked" before start, 7-day total, weekly/monthly groups | PASS |
| T10 | Member with no activity: zeros, no invented history | PASS |
| T11 | Unknown member → 404 | PASS |
| T12 | IST boundary: 23:59 IST → minute 1439 of that day; 00:00 IST → minute 0 of the next day | PASS |
| T13a–c | Draft course by link → 404; enrolled member still allowed; published unaffected | PASS |
| T14 | Interrupted session: heartbeats ~2 min apart → 2 minutes (gap not filled) | PASS |
| Restart | Draft course **stays unpublished** after backend restart (previously re-published) | PASS |

**Runtime — real browser (Edge), website built from this branch**

| ID | Test | Result |
|---|---|---|
| B1 | Visible page sends a heartbeat within seconds (accepted, recorded) | PASS |
| B2 | Hidden tab sends **no** heartbeat for 70 s | PASS |
| B3 | Returning to the tab sends a heartbeat immediately | PASS |
| B4 | Every heartbeat accepted; database shows 2 active minutes for 2 heartbeats | PASS |

**Not tested**
- Admin Activity tab in a browser (needs Clerk login).
- Live production.
- Mobile app.
- Catalog cache clearing through a real admin save (needs Clerk; code path only).
- The 5-minute idle rule in a browser (needs a 5-minute idle; covered by the server rule tests T3/T4).

---

## 12. Remaining issues and unverified items

1. **Production courses may have been re-published.** Every deploy since 2026-07-14 published all courses with Active on. **Admins should review Content → Courses after this branch is deployed** and switch off "Published" on anything that should be hidden.
2. All items in §5 (M1–M15).
3. All **NOT VERIFIED** rows in §3 need a live check with admin and member logins.
4. Daily Time Spent shows data only from the day it is deployed. Earlier days stay "Not tracked".

---

## 13. Deployment and verification

1. **Review and merge** the PR for `feat/admin-member-activity` into `main` (needs approval). CI runs the backend tests, Prisma validation and builds.
2. **Staging deploy** (automatic on merge). In the backend deploy log, the **schema guard** should show **0 blocked** and **0 additive statements**, because the new table is created by startup code, not by the schema step.
3. **Staging checks:**
   - Sign in as a member, browse for 2–3 minutes, then switch tabs for a few minutes.
   - Admin → Members → that member → **Activity**: today shows roughly 2–3 minutes, and nothing while the tab was hidden.
   - Unpublish a test course → it is hidden from `/courses` within seconds, and its direct link shows "not found" to a member without access.
   - Restart or redeploy the backend → the test course is **still unpublished**.
4. **Production:** only with explicit approval (Actions → "Deploy to production (one click)", or push `main` → `production`). Repeat step 3 on production with a test member and a test course.
5. **After production deploy:** review all courses' Published flags (§12.1).

---

## 14. Prioritised implementation checklist

### P0 — security, data integrity, critical
- [x] Stop startup code re-publishing unpublished courses (**done**, I7)
- [x] Block draft courses by direct link (**done**, I8)
- [ ] Decide and implement **Required Tier**, **Active**, **Max Enrollments**: enforce on the website or remove from the form (M8). *Needs a product decision.*
- [ ] Replace permanent course delete with **archive** (M5)

### P1 — essential admin controls
- [ ] **Events** admin (list/create/edit/publish/delete) — page + API (M1)
- [ ] **Webinars/Live** admin page on the existing API (M2)
- [ ] **Program allowed modules** editor in Batches (M3)
- [ ] Stop the remaining startup overrides (plan entitlements, course module IDs) (M13)
- [x] Course saves refresh the catalog immediately (**done**, I8)

### P2 — analytics, reporting, secondary controls
- [x] Daily Time Spent per member (**done**, I1–I6)
- [ ] Mobile app heartbeat (M14)
- [ ] Platform-wide engagement report (daily/weekly active members, average time) on the new table (M15)
- [ ] Login/logout session history (M11)
- [ ] Role-based access to member data (M12)
- [ ] Course category, level, featured/order, offer price, preview; card thumbnail; sidebar links for hidden pages (M4, M5, M7, M9)

### P3 — UX and enhancements
- [ ] Courses-page labels, lock messages and footer contact into UI Strings / Site Config (M6)
- [ ] Reset-progress / unlock-all buttons (M10)
- [ ] Automated tests for course visibility rules
