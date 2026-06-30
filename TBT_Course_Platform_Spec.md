# TBT Course Platform — Spec Kit

This document covers the full spec for the TBT VOD course platform extension, including pricing, access control, gamification, DRM, upsell/cross-sell, badges, and certificates. Implementation is complete as of 2026-06-24.

---

## Section 2 — DB Models

All new columns on existing tables are added via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `backend/src/plugins/prisma.ts`. New models use `prisma db push`.

### 2.1 Course (extended fields)

| Field | Type | Default | Notes |
|---|---|---|---|
| `price` | `Decimal?` | — | Listing price in INR (null = free) |
| `accessDurationDays` | `Int?` | — | null = lifetime access |
| `maxEnrollments` | `Int?` | — | null = unlimited |
| `xpPerEpisode` | `Int` | `10` | XP awarded on episode or quiz completion |
| `passingScorePercent` | `Int` | `70` | Minimum % to pass a quiz |
| `upsellCourseIds` | `String[]` | `[]` | IDs of courses to suggest instead (upsell) |
| `crossSellCourseIds` | `String[]` | `[]` | IDs of courses to suggest additionally (cross-sell) |

### 2.2 CourseEpisode (extended fields)

| Field | Type | Default | Notes |
|---|---|---|---|
| `quizData` | `Json?` | — | `{ questions: [{ id, question, options: [{ id, text, correct }] }] }` |
| `quizUnlockPercent` | `Int` | `80` | % of episode watched before quiz unlocks |
| `drmEnabled` | `Boolean` | `false` | Whether Bunny DRM is active |
| `bunnyDrmToken` | `String?` | — | DRM token from Bunny Stream |

### 2.3 CoursePayment (new model)

Records every payment (manual or gateway) associated with course access.

```prisma
model CoursePayment {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId  String    @map("member_id") @db.Uuid
  courseId  String    @map("course_id") @db.Uuid
  amount    Decimal
  currency  String    @default("INR")
  method    String    @default("manual")   // manual | razorpay | bank_transfer | upi | free
  status    String    @default("completed") // completed | pending | refunded
  reference String?
  paidAt    DateTime? @map("paid_at") @db.Timestamptz(6)
  notes     String?
  grantedBy String?   @map("granted_by") @db.Uuid   // admin who created
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  member Member @relation(...)
  course Course @relation(...)
}
```

### 2.4 CourseAccess (new model)

Authorisation record — separates who is allowed to access a course from `CourseEnrollment` (progress tracking).

```prisma
model CourseAccess {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId    String    @map("member_id") @db.Uuid
  courseId    String    @map("course_id") @db.Uuid
  accessType  String    @default("lifetime")  // lifetime | duration
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz(6)
  isActive    Boolean   @default(true) @map("is_active")
  paymentId   String?   @map("payment_id") @db.Uuid
  grantedAt   DateTime  @default(now()) @map("granted_at") @db.Timestamptz(6)
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz(6)
  revokedBy   String?   @map("revoked_by") @db.Uuid

  @@unique([memberId, courseId])
}
```

**Access validity rule:**
- `lifetime` → valid as long as `isActive = true`
- `duration` → valid if `isActive = true` AND `expiresAt > now()`

### 2.5 MemberXP (new model)

XP ledger per episode/quiz. Used for leaderboards and total XP display.

```prisma
model MemberXP {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId  String   @map("member_id") @db.Uuid
  courseId  String   @map("course_id") @db.Uuid
  episodeId String?  @map("episode_id") @db.Uuid
  source    String   // episode_complete | quiz_pass
  amount    Int
  earnedAt  DateTime @default(now()) @map("earned_at") @db.Timestamptz(6)
}
```

### 2.6 CourseStreak (new model)

Per member+course daily streak.

```prisma
model CourseStreak {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId       String   @map("member_id") @db.Uuid
  courseId       String   @map("course_id") @db.Uuid
  currentStreak  Int      @default(1) @map("current_streak")
  longestStreak  Int      @default(1) @map("longest_streak")
  lastActivityAt DateTime @map("last_activity_at") @db.Timestamptz(6)

  @@unique([memberId, courseId])
}
```

### 2.7 CourseQuizAttempt (new model)

One row per quiz submission.

```prisma
model CourseQuizAttempt {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId  String   @map("member_id") @db.Uuid
  episodeId String   @map("episode_id") @db.Uuid
  answers   Json
  score     Int
  passed    Boolean
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
}
```

### 2.8 CourseBadge + MemberCourseBadge (new models)

```prisma
model CourseBadge {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug     String  @unique
  label    String
  iconUrl  String? @map("icon_url")
  courseId String? @map("course_id") @db.Uuid
  criteria Json    // e.g. { "type": "completion" } — informational only, no auto-award logic

  course  Course?             @relation(...)
  members MemberCourseBadge[]
}

model MemberCourseBadge {
  id       String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId String      @map("member_id") @db.Uuid
  badgeId  String      @map("badge_id") @db.Uuid
  earnedAt DateTime    @default(now()) @map("earned_at") @db.Timestamptz(6)

  @@unique([memberId, badgeId])
}
```

---

## Section 3 — API Endpoints

### 3.1 Admin Endpoints (`fastify.authenticate` — Clerk JWT)

All routes under `/api/courses/`.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/courses/payments` | `listCoursePaymentsHandler` | All payments; query: `?courseId, status, page, limit` |
| GET | `/api/courses/:id/access` | `listCourseAccessHandler` | Access grants for a course |
| POST | `/api/courses/:id/grant-access` | `grantCourseAccessHandler` | Grant access; creates `CoursePayment` if `amount > 0`, upserts `CourseAccess` + `CourseEnrollment` |
| DELETE | `/api/courses/:id/access/:accessId` | `revokeCourseAccessHandler` | Soft-revoke: sets `isActive=false`, `revokedAt`, `revokedBy` |
| GET | `/api/courses/:id/analytics` | `getCourseAnalyticsHandler` | totalEnrollments, completedEnrollments, completionRate, totalXpAwarded, totalRevenue, per-episode quizAttempts |
| GET | `/api/courses/:id/leaderboard` | `getCourseLeaderboardAdminHandler` | Top members by XP for a course |
| GET | `/api/courses/:id/badges` | `listCourseBadgesHandler` | Badges for a course (with `_count.members`) |
| POST | `/api/courses/:id/badges` | `createCourseBadgeHandler` | Body: `{ label, slug?, iconUrl?, criteria? }` |
| PUT | `/api/courses/:id/badges/:badgeId` | `updateCourseBadgeHandler` | Partial update of any badge field |
| DELETE | `/api/courses/:id/badges/:badgeId` | `deleteCourseBadgeHandler` | Hard delete (cascades to MemberCourseBadge) |
| POST | `/api/courses/:id/badges/:badgeId/award` | `awardCourseBadgeHandler` | Body: `{ memberId }` — upserts MemberCourseBadge |

**`grantCourseAccessHandler` body:**
```json
{
  "memberId": "uuid",
  "accessType": "lifetime | duration",
  "expiresAt": "ISO date (required if duration)",
  "amount": 4999,
  "currency": "INR",
  "method": "manual | razorpay | bank_transfer | upi | free",
  "reference": "txn_id or notes",
  "notes": "optional"
}
```

**Route ordering note:** `/api/courses/payments` must be registered BEFORE `/:id` in Fastify to prevent `"payments"` being captured as the `:id` param.

### 3.2 User Endpoints (`fastify.authenticateUser` — JWT cookie, sets `req.memberId`)

All routes under `/api/user/`.

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/user/courses/:id/episodes/:epId/quiz` | `submitCourseQuizHandler` | Body: `{ answers: { [questionId]: optionId } }`. Returns `{ score, passed, correct, total }`. Awards XP if passed. |
| GET | `/api/user/courses/:id/xp` | `getCourseXpHandler` | Returns `{ totalXp, currentStreak, longestStreak, history[] }` |
| GET | `/api/user/courses/:id/leaderboard` | `getUserCourseLeaderboardHandler` | Returns `{ leaderboard[], myRank }` |
| GET | `/api/user/badges` | `getUserBadgesHandler` | All `MemberCourseBadge` rows for member, includes `badge` relation |
| GET | `/api/user/courses/:courseId/certificate-eligibility` | `getCertificateEligibilityHandler` | Returns `{ eligible, completionPercentage, remainingLessons, securityStatus }` |
| GET | `/api/user/courses/:courseId/certificate` | `getCourseCertificateHandler` | Returns certificate metadata if all lessons completed; 403 otherwise |

**Quiz data shape** (stored in `CourseEpisode.quizData`):
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is X?",
      "options": [
        { "id": "a", "text": "Answer A", "correct": false },
        { "id": "b", "text": "Answer B", "correct": true }
      ]
    }
  ]
}
```

**Certificate response shape:**
```json
{
  "certificateId": "ABCD1234EFGH5678",
  "memberName": "First Last",
  "courseTitle": "Course Title",
  "completedAt": "ISO date",
  "issuedAt": "ISO date"
}
```

### 3.3 Access Middleware Behaviour

- **`listUserCoursesHandler`** — batch-fetches `CourseAccess` for all returned courses; adds `hasAccess: boolean`, `price` to each course in the list response.
- **`getUserCourseHandler`** — checks `CourseAccess`; hides `videoUrl` on all lessons when `hasAccess = false`; adds `hasAccess`, `accessType`, `accessExpiresAt` to course response; resolves `upsellCourseIds`/`crossSellCourseIds` to lightweight course objects.
- **`enrollCourseHandler`** — returns 403 `"Purchase is required..."` if no valid `CourseAccess`.
- **`markLessonCompleteHandler`** — fires `awardEpisodeXp()` (fire-and-forget) on first completion of an episode.

**XP award logic** (in `awardEpisodeXp`):
- Creates `MemberXP` row with `source = 'episode_complete'` or `'quiz_pass'`
- Updates/creates `CourseStreak`:
  - Same day → no change to streak count
  - Next day → increment streak
  - Gap > 1 day → reset to 1

---

## Section 4 — Frontend UI

### 4.1 Admin Panel — Courses Page (`/courses`)

**File:** `admin-panel/app/courses/page.tsx`
**Hooks (from `useTbt.ts`):** `useListCourseAccess`, `useGrantCourseAccess`, `useRevokeCourseAccess`, `useCourseAnalyticsAdmin`, `useListCoursePayments`, `useListCourseBadges`, `useCreateCourseBadge`, `useUpdateCourseBadge`, `useDeleteCourseBadge`, `useAwardCourseBadge`

#### Course Form Modal — New Sections

**Pricing & Access:**
- Price (₹) — number input
- Access Days — number input (blank = lifetime)
- Max Enrollments — number input (blank = unlimited)

**Gamification:**
- XP / Episode — number input (default 10)
- Pass Score % — number input (default 70)

**Upsell / Cross-sell:**
- "Upsell — suggest instead" — scrollable checkbox list of all other courses (multi-select)
- "Cross-sell — suggest additionally" — separate scrollable checkbox list

#### CourseDetailPanel — 4 Tabs

**Episodes tab** (existing DnD reorder, episode form extended):
- Episode form: `quizUnlockPercent` (% watched before quiz unlocks), `drmEnabled` toggle, `bunnyDrmToken` field

**Access tab:**
- Table of access grants (member name/email, status badge, access type, expiry)
- "Grant" button → inline form with member typeahead search, access type, expiry date, amount, payment method, notes
- "Revoke" button per active grant

**Analytics tab:**
- Stat cards: Total Enrollments, Completed, Completion %, Revenue, XP Awarded
- Per-episode table: quiz attempt counts

**Badges tab:**
- Table of badges (icon, label, slug, awarded count)
- "New Badge" button → form: label, slug (auto-generated from label in create mode), icon URL, criteria JSON
- Per-badge: "Award" button (opens member search modal), edit, delete

### 4.2 User Web — Program Detail (`/programs/[id]`)

**File:** `tbt-user-web/app/(platform)/programs/[id]/page.tsx`

**Access gate (enroll/CTA card):**
| State | CTA shown |
|---|---|
| `isEnrolled = true` | "Continue Learning" → `/learning/:id` |
| `hasAccess = true, isEnrolled = false` | "Enroll Now" button (calls enroll mutation) |
| `hasAccess = false` | "Purchase required" message + lock icon overlay on thumbnail |

**Sidebar card shows:**
- Price with access type label ("Lifetime access" / "until DATE")
- Lesson count + duration hours
- XP per episode + pass score % (if set)

**Tabs (left column):**
- **Curriculum** — lesson list with "Watch" links (locked icon if no access)
- **Leaderboard** — ranked list with 🥇🥈🥉 medals, XP counts, "you" marker, myRank banner

**Upsell/Cross-sell sections (below tabs):**
- "You Might Prefer" — upsell course cards (thumbnail, title, level)
- "Students Also Buy" — cross-sell course cards

### 4.3 User Web — Learning Page (`/learning/[courseId]`)

**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Quiz modal** (auto-triggered on first episode completion if `lesson.hasQuiz = true`):
- Questions view: one question at a time with radio-style option buttons
- Results view: score %, pass/fail, correct count, retry option
- On pass: XP flash notification (bouncing badge bottom-right, 3 second auto-dismiss)
- Uses `useSubmitCourseQuiz(courseId, episodeId)` — single-use ref prevents re-trigger on re-render

**Certificate CTA** (shown below lesson list when `certData.eligible = true`):
- Banner with Award icon
- "Get Certificate" button → opens `GET /api/user/courses/:courseId/certificate` in new tab
- Uses `useCertificateEligibility(courseId)` hook

**Hooks used:** `useCourse`, `useLessonProgress`, `useMarkLessonComplete`, `useSubmitCourseQuiz`, `useCourseXp`, `useCertificateEligibility`

### 4.4 User Web — Badges Gallery

**File:** `tbt-user-web/app/(platform)/learning/badges/page.tsx`
**Hook:** `useUserBadges()`

- 2–4 column responsive grid of badge cards
- Each card: icon image (or fallback Award icon with accent tint), badge label, earned date
- Empty state with "Browse Courses" CTA
- Link to this page: "My Badges" button in `/learning` page header

---

## Hook Reference (User Web)

**File:** `tbt-user-web/lib/hooks/useCourses.ts`

| Hook | Query key | Description |
|---|---|---|
| `useCourses(params)` | `["courses", params]` | Course catalogue list |
| `useCourse(id)` | `["courses", id]` | Single course detail with lessons, upsell/crossSell |
| `useMyEnrollments()` | `["user", "enrollments"]` | All enrolled courses |
| `useEnrollCourse()` | mutation | Enroll in a course |
| `useLessonProgress(courseId)` | `["user", "progress", courseId]` | Per-lesson completion status |
| `useMarkLessonComplete(courseId)` | mutation | POST progress heartbeat |
| `useSubmitCourseQuiz(courseId, episodeId)` | mutation | Submit quiz answers |
| `useCourseXp(courseId)` | `["course-xp", courseId]` | XP total, streak, history |
| `useCourseLeaderboard(courseId)` | `["course-leaderboard", courseId]` | Leaderboard + myRank |
| `useUserBadges()` | `["user", "badges"]` | All earned badges |
| `useCertificateEligibility(courseId)` | `["certificate-eligibility", courseId]` | Eligibility + completion % |

**File:** `tbt-user-web/lib/api/services/courses.service.ts`

All methods use the Axios client (cookies auto-sent via `withCredentials: true`).

---

## Hook Reference (Admin Panel)

**File:** `admin-panel/lib/hooks/useTbt.ts`

| Hook | Description |
|---|---|
| `useListCourseAccess(courseId)` | Access grants for a course |
| `useGrantCourseAccess(courseId)` | Mutation — grant access + optional payment |
| `useRevokeCourseAccess(courseId)` | Mutation — revoke by accessId |
| `useCourseAnalyticsAdmin(courseId)` | Analytics stats for a course |
| `useListCoursePayments(params)` | All payments across courses |
| `useListCourseBadges(courseId)` | Badges for a course |
| `useCreateCourseBadge(courseId)` | Mutation — create badge |
| `useUpdateCourseBadge(courseId)` | Mutation — update `{ badgeId, data }` |
| `useDeleteCourseBadge(courseId)` | Mutation — delete by badgeId |
| `useAwardCourseBadge(courseId)` | Mutation — award `{ badgeId, memberId }` |

---

## Key Implementation Notes

1. **Route ordering** — `/api/courses/payments` must be registered before `/:id` in `courses/routes.ts` to prevent Fastify capturing "payments" as the `:id` param.

2. **Prisma cast** — All new models (`courseAccess`, `coursePayment`, `memberXP`, `courseStreak`, `courseQuizAttempt`, `courseBadge`, `memberCourseBadge`) are not in the generated Prisma client type and require `(req.server.prisma as any).modelName`.

3. **`req.memberId`** — `fastify.authenticateUser` sets `request.memberId: string`. Never use `request.member.id`.

4. **Fire-and-forget** — XP/streak side effects use `void asyncFn().catch(() => {})` pattern so a failure never blocks the primary response.

5. **Access vs Enrollment** — `CourseAccess` is the authorisation gate (checked on enroll and video play). `CourseEnrollment` tracks progress. Admin `grantCourseAccessHandler` upserts both so the course appears in the member's list.

6. **Quiz trigger** — `quizTriggeredForRef` (useRef) prevents the quiz modal from firing more than once per episode in the learning page.

7. **Certificate** — The course certificate endpoint (`GET /api/user/courses/:courseId/certificate`) requires ALL visible episodes to have `completed = true` in `CourseEpisodeProgress`. Returns 403 with a clear message if not yet eligible.

8. **Upsell/CrossSell resolution** — `getUserCourseHandler` fetches the `String[]` Postgres arrays, then batch-fetches the referenced published courses and returns lightweight objects (`id, title, slug, thumbnailUrl, level, totalLessons`). Only published courses are resolved.

---

## Section 5 — Video Security & DRM

### 5.1 Bunny Stream DRM (Episode-Level)

DRM is toggled per episode, not per course. Two episode fields control it:

| Field | Type | Purpose |
|---|---|---|
| `drmEnabled` | `Boolean` | Whether DRM is active for this episode |
| `bunnyDrmToken` | `String?` | Signed token from Bunny Stream DRM API |

**How Bunny DRM works:**
- Generate a signed URL token via the Bunny Stream DRM API using `BUNNY_STREAM_API_KEY` + `BUNNY_STREAM_LIBRARY_ID`
- Token is stored in `bunnyDrmToken` per episode by admin
- When serving the Bunny iframe embed URL, append `?token=<bunnyDrmToken>` to the iframe `src`
- Bunny validates the token server-side; playback fails without a valid token

**Admin UI** (Episodes tab, episode form):
- `drmEnabled` toggle — shows/hides the token field
- `bunnyDrmToken` text input — paste the token from Bunny dashboard
- Episode list row shows a `Lock` icon badge when `drmEnabled = true`

**User web** (learning page):
- The `normalizeBunnyUrl` utility (`tbt-user-web/lib/utils/format.ts`) converts `player.mediadelivery.net/play/{lib}/{id}` → `iframe.mediadelivery.net/embed/{lib}/{id}` and appends `?fullscreen=false`
- `withResumeTime` appends `&t={seconds}` for resume-from-position
- When `drmEnabled`, the backend appends `&token={bunnyDrmToken}` before returning `videoUrl` to the client

### 5.2 Video Watermark

**File:** `tbt-user-web/components/features/video/VideoWatermark.tsx`

Wraps every video player (both native `<VideoPlayer>` and Bunny iframe embeds). Renders two invisible anti-screen-capture layers plus a floating text watermark.

**Behaviour:**
- Watermark shows member email + truncated member ID + current timestamp
- Cycles through 9 pre-defined position zones (corners, mid-edges, center)
- Timing: visible for **8 seconds**, fade duration **1.4s**, hidden gap **4 seconds**
- Tiled semi-transparent layer always present (4×4 grid, 3% opacity) for screenshot deterrence
- Pointer-event blocker layer on top prevents right-click → save on the video
- Custom fullscreen button replaces Bunny's native fullscreen so watermark layers follow into fullscreen

**Usage in learning page:**
```tsx
<VideoWatermark
  className="w-full aspect-video rounded-xl overflow-hidden relative bg-black"
  containerId="course-video-root"
  showFullscreenButton={isBunnyEmbed(selectedLesson.videoUrl)}
>
  {/* iframe or VideoPlayer inside */}
</VideoWatermark>
```

**Props:**
| Prop | Type | Description |
|---|---|---|
| `containerId` | `string?` | ID applied to wrapper div (used by fullscreen API) |
| `showFullscreenButton` | `boolean` | Show custom FS button (Bunny iframe only) |

### 5.3 Security Event Logging

Backend logs suspicious watching behaviour into `SecurityLog` (read-only — no automatic blocking). Logged in `markLessonCompleteHandler` and in the episode progress heartbeat path.

| Event Type | Trigger | Metadata logged |
|---|---|---|
| `EXCESSIVE_SKIPPING` | Playhead jumped forward > (delta + 300s) without matching actual watch time | `episodeId`, `courseId`, `fromSecs`, `toSecs`, `reportedDelta` |
| `RAPID_EPISODE_SWITCHING` | Multiple episode changes within a short window | `episodeIds`, `timeWindowSeconds` |
| `ABNORMAL_PROGRESS_SPEED` | `actualWatchedSecs` accumulating faster than wall-clock allows | `episodeId`, `reportedSecs`, `elapsedMs` |
| `MULTIPLE_DEVICES` | Same member active on > N devices within 1 hour | `deviceCount`, `devices[]`, `ipAddress` |

**Admin visibility:** `/api/security-logs` endpoint (read-only). Hooks: `useSecurityLogs(params)` and `useSecurityLogStats()` in `useTbt.ts`.

**Effect on certificate:** `getCertificateEligibilityHandler` checks `securityLog` for ANY log against the member — returns `securityStatus: 'flagged'` in eligibility response. Flagged members can still get a cert (no hard block), but admins see the flag.

### 5.4 Episode Progress Integrity Rules

Applied in `markLessonCompleteHandler`:

- **Safe delta cap:** Max 30s per heartbeat call (`safeDelta = Math.min(deltaSeconds ?? 0, 30)`) — prevents inflated watch time from client manipulation
- **Completion threshold:** `actualWatchedSecs >= durationSeconds * 0.85` (or 90s minimum for short clips) — must be met before `isCompleted` is accepted
- **Already completed:** Once `completed = true` it is never reverted
- **`actualWatchedSecs`** uses `{ increment: safeDelta }` Prisma update — safe against concurrent requests
- **`lastWatchedSecs`** = raw playhead position (for resume) — not capped

---

## Section 6 — Payment Gateway (Razorpay)

### 6.1 Current State (Manual Payments Only)

As of the current implementation, all course payments are recorded **manually** by admin via the Access tab → Grant form. The `CoursePayment.method` field accepts `razorpay` as a value but no automated Razorpay integration exists yet.

### 6.2 Razorpay Integration (Planned)

When implemented, the flow will be:

**Step 1 — Create Order (backend)**
```
POST /api/user/courses/:courseId/payment/create-order
Auth: authenticateUser (JWT cookie)
Body: { amount, currency? }
Returns: { orderId, amount, currency, keyId }
```

Creates a Razorpay order via `razorpay.orders.create({ amount: amountInPaise, currency, receipt })`. The `orderId` is returned to the frontend to initialise the Razorpay checkout SDK.

**Step 2 — Frontend Checkout**

User web opens the Razorpay payment modal using the Razorpay JS SDK:
```typescript
const rzp = new (window as any).Razorpay({
  key: keyId,
  order_id: orderId,
  amount,
  currency,
  handler: async (response) => {
    await verifyPayment(response.razorpay_payment_id, response.razorpay_signature);
  },
});
rzp.open();
```

**Step 3 — Verify & Grant (backend)**
```
POST /api/user/courses/:courseId/payment/verify
Body: { paymentId, signature, orderId }
```

- Verify HMAC-SHA256 signature: `HMAC(orderId + "|" + paymentId, RAZORPAY_KEY_SECRET)`
- On success: create `CoursePayment` record + upsert `CourseAccess` (same logic as `grantCourseAccessHandler`)
- Return updated course with `hasAccess: true`

**Step 4 — Webhook (Razorpay → backend)**
```
POST /api/webhooks/razorpay
Header: x-razorpay-signature (HMAC-SHA256 of payload with RAZORPAY_WEBHOOK_SECRET)
```

Handles `payment.captured` event as a fallback in case the user closes the browser before Step 3 completes:
- Verify webhook signature
- Extract `courseId` from `payment.notes` (set at order creation)
- Grant access if not already granted

**Env vars required:**
```
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

### 6.3 User Web — Purchase Flow

**Program detail page CTA change when Razorpay is enabled:**
- `hasAccess = false` and `price > 0` → "Buy Now — ₹{price}" button (triggers Razorpay checkout)
- `hasAccess = false` and `price = 0` → "Enroll Free" (direct enroll, no payment)
- After successful payment → `hasAccess` becomes `true` → CTA switches to "Enroll Now"

**Script tag** (in `tbt-user-web/app/layout.tsx` or per-page):
```html
<Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
```

---

## Section 7 — Notification Automation

### 7.1 Trigger Points

Notifications should fire at these course lifecycle events:

| Event | Recipient | Channel | Template |
|---|---|---|---|
| Access granted (manual or payment) | Member | WhatsApp + Push | "You now have access to {course}" |
| Member enrolls in a course | Member | Push | "Welcome to {course}! Start your first lesson." |
| Episode completed | Member | Push (optional) | "{episode} done! Keep the streak going." |
| Quiz passed | Member | Push | "You scored {score}% on the {episode} quiz! +{xp} XP" |
| Course 100% complete | Member | WhatsApp + Push | "Congratulations! You completed {course}. Download your certificate." |
| Badge awarded | Member | Push | "You earned the '{badge}' badge!" |
| Access expiring in 3 days | Member | WhatsApp | "Your access to {course} expires in 3 days." |

### 7.2 Implementation Pattern

Notifications use the existing `app-notifications` module. Fire them fire-and-forget from the relevant handler:

**In-app notification (existing pattern):**
```typescript
void (request.server.prisma as any).appNotification.create({
  data: {
    memberId: request.memberId,
    title: 'Course Completed!',
    body: `You completed "${course.title}". Your certificate is ready.`,
    type: 'course_complete',
    metadata: { courseId },
  },
}).catch(() => {});
```

**Push notification (Firebase):**
Use the existing `sendPushNotification` helper from the `app-notifications` module, passing `memberId` + title/body.

**WhatsApp (Zacx BSP):**
Use the existing WhatsApp send utility (`POST /v1/message/send` via Zacx, `body: [message]`). Only for high-value events (access granted, completion).

### 7.3 Access Expiry Job (BullMQ)

A scheduled job checks for `CourseAccess` records where `expiresAt` is within the next 3 days and sends a WhatsApp reminder.

```typescript
// In backend/src/jobs/ — runs daily at 08:00
const expiringAccess = await prisma.courseAccess.findMany({
  where: {
    isActive: true,
    accessType: 'duration',
    expiresAt: {
      gte: new Date(),
      lte: addDays(new Date(), 3),
    },
  },
  include: {
    member: { select: { phone: true, firstName: true } },
    course: { select: { title: true } },
  },
});
// Send WhatsApp to each member
```

---

## Section 8 — Certificate PDF Generation

### 8.1 Current State

`GET /api/user/courses/:courseId/certificate` returns **JSON metadata** (not a PDF):
```json
{
  "certificateId": "ABCD1234EFGH5678",
  "memberName": "First Last",
  "courseTitle": "Course Name",
  "completedAt": "2026-06-24T10:00:00.000Z",
  "issuedAt": "2026-06-24T10:00:00.000Z"
}
```

### 8.2 PDF Certificate (Planned)

Based on the existing workshop PDF certificate pattern in `backend/src/modules/workshops/controller.ts`.

**Generation function:**
```typescript
async function buildCourseCertificatePdf(
  memberName: string,
  courseTitle: string,
  completedAt: string,
  certId: string,
): Promise<Buffer> {
  const { default: PDFDocument } = await import('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;

    // Dark background
    doc.rect(0, 0, W, doc.page.height).fill('#0d0d0d');
    // Red border
    doc.rect(24, 24, W - 48, doc.page.height - 48).lineWidth(2).stroke('#dc2626');
    // Accent rule lines
    doc.moveTo(60, 80).lineTo(W - 60, 80).lineWidth(0.5).stroke('#444');
    doc.moveTo(60, doc.page.height - 80).lineTo(W - 60, doc.page.height - 80).lineWidth(0.5).stroke('#444');

    // Header
    doc.fillColor('#dc2626').fontSize(10).font('Helvetica-Bold').text('TAMIL BUSINESS TRIBE', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(32).font('Helvetica-Bold').text('CERTIFICATE OF COMPLETION', { align: 'center' });

    // Divider
    doc.fillColor('#333').rect(W / 2 - 40, 180, 80, 1).fill();

    // Body
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('This certifies that', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text(memberName, { align: 'center' });
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('has successfully completed', { align: 'center' });
    doc.fillColor('#dc2626').fontSize(18).font('Helvetica-Bold').text(courseTitle, { align: 'center' });

    // Details
    const details = `Completed: ${new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}   ·   Certificate ID: ${certId}`;
    doc.fillColor('#a0a0a0').fontSize(10).font('Helvetica').text(details, { align: 'center' });

    doc.end();
  });
}
```

**Endpoint update:**
```typescript
// Stream PDF directly to browser
const pdfBuffer = await buildCourseCertificatePdf(memberName, courseTitle, completedAt, certId);
reply.header('Content-Type', 'application/pdf');
reply.header('Content-Disposition', `attachment; filename="certificate-${certId}.pdf"`);
return reply.send(pdfBuffer);
```

**Optional R2 upload** (for persistent URL):
```typescript
const key = `certificates/courses/${courseId}/${memberId}.pdf`;
await s3.send(new PutObjectCommand({
  Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
  Key: key,
  Body: pdfBuffer,
  ContentType: 'application/pdf',
}));
const publicUrl = `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
```

### 8.3 Certificate Verification (Public)

A public page at `/verify/course/:certId` (no auth required) that calls:
```
GET /api/pub/certificates/course/:certId
```

Backend decodes the cert ID (`base64url` of `memberId:courseId`) and returns member name + course title + completion date for display.

---

## Section 9 — Admin Reporting

### 9.1 Payments Dashboard

**Page:** Accessible via `/api/courses/payments` hook `useListCoursePayments(params)`.

**Filters:** `courseId`, `status` (completed / pending / refunded), `page`, `limit`.

**Response per row:**
```json
{
  "id": "uuid",
  "amount": 4999,
  "currency": "INR",
  "method": "razorpay",
  "status": "completed",
  "reference": "txn_id",
  "paidAt": "ISO date",
  "notes": "...",
  "member": { "id", "firstName", "lastName", "email" },
  "course": { "id", "title" }
}
```

**Recommended admin UI additions:**
- "Payments" tab or sub-page under `/courses`
- Total revenue stat at top
- Filterable table: member, course, amount, method, date
- Export to CSV button

### 9.2 Per-Course Analytics

**Endpoint:** `GET /api/courses/:id/analytics`
**Hook:** `useCourseAnalyticsAdmin(courseId)` — used in Analytics tab of CourseDetailPanel.

**Response:**
```json
{
  "totalEnrollments": 42,
  "completedEnrollments": 18,
  "completionRate": 43,
  "totalXpAwarded": 1260,
  "totalRevenue": 149950,
  "episodes": [
    { "id": "uuid", "title": "Episode 1", "order": 0, "quizAttempts": 35 }
  ]
}
```

### 9.3 Leaderboard (Admin View)

**Endpoint:** `GET /api/courses/:id/leaderboard?limit=20`
**Hook:** Not yet in `useTbt.ts` — can add `useCoursLeaderboardAdmin(courseId)` pointing to this endpoint.

Returns top members by total XP for a course. Useful for identifying top performers.

### 9.4 At-Risk Detection (Existing)

`useAtRiskMembers()` hook (already in `useTbt.ts`) hits `/api/analytics/at-risk`. Cross-reference course enrollments with low `healthScore` members to find enrolled-but-not-progressing members who may need follow-up.
