# TBT Self-Onboarding & Admin Approval — Speckit

Move onboarding from "admin fills in the user's profile" to "user self-onboards, admin gives final approval" — across **backend + admin panel + user-web + Flutter app**, reusing the existing (and already half-built) status/verification architecture.

Status: **specification — not yet implemented.**
Audit date: 2026-08-18. Written against branch `feature/app`, commit `ae2b0e4`.

Follow section-by-section. §3–§5 are foundation (schema + API contract); §8–§10 are per-client and can be built in parallel once §5 is frozen.

---

## 0. Key Decisions Made While Writing This Spec

These are judgment calls, not settled requirements — flagged up front so they can be challenged before implementation starts rather than discovered mid-build.

| # | Decision | Why |
|---|---|---|
| D1 | Add **one** new `VerificationStatus` enum value: `changes_requested` | The enum already has `awaiting_kyc \| under_review \| verified \| rejected` — a 4-state KYC workflow, unused today. Only "changes requested" is missing to cover the requested Pending/Approved/Rejected/Changes-Required admin view. Uses the exact idempotent `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pattern already used twice in `prisma.ts` for `MemberStatus`/`CoursePaymentMethod`. |
| D2 | Wizard lives at `tbt-user-web/app/(platform)/onboarding/` (post-login), with a **new exemption** added to `SubscriptionGate`'s `PendingInterceptor` | Reuses the existing authenticated shell/nav instead of duplicating it outside `(platform)`. Requires one targeted change: `PendingInterceptor` currently blocks every route with no exemption list (unlike `FreeInterceptor`, which already has `EXEMPT_PATHS`) — see §7.1. |
| D3 | Self-onboarding writes go through a **new whitelist schema**, not `updateMemberSchema` | `updateMemberSchema` includes `status`, `verificationStatus`, `accountManagerId`, `batchId`, `password`, `membershipPlan`, `currentTier` — none of which a member may ever set on themselves. A new `onboardingUpdateSchema` (§5.2) enumerates only the safe subset. This is the load-bearing security boundary for this whole feature. |
| D4 | Documents go through the **existing, dormant `KycDocument` table** — not a new table | Zero backend code reads/writes it today (`grep -ri kycdocument backend/src` → no matches), but its shape (`documentType, documentUrl, status, verifiedBy, verifiedAt`) is already exactly right, and a private `'kyc-documents'` R2 bucket is already wired into the presigned-upload handler (`upload/controller.ts:136`) — clearly anticipated for this. |
| D5 | Admin-authored step content is **one genuinely new small table**, `onboarding_content` | Checked `ContentSection`/`ContentItem`, `AppResource`, `BatchDay` — none has a clean "ordered step: title + text + video + audio" shape. This is the one piece of new schema surface that isn't just extending something that already exists. |
| D6 | `notes` on `Member` stays admin-only; a **separate** `onboarding_review_note` column is added | `notes` reads as an internal admin remark field in the existing create/edit form. Reusing it for the admin's "here's what to fix" message to the user would conflate two different audiences for the same field. |
| D7 | Per-document admin verification (`KycDocument.status` → `verified`/`rejected` individually) is **P2, not required for the core loop** | The 10-step flow only requires a holistic approve/reject/request-changes at the *application* level. Per-document status is a nice-to-have the dormant table already supports cheaply — included in §5.6 as optional, not blocking. |
| D8 | Mobile scope: **build it in this pass**, not deferred | The task instructions are explicit that mobile must support the flow. Scope is kept lean (§10) by reusing every existing mobile pattern found in the audit — no new packages, no new architecture. |

**Needs verification at implementation time, not assumed here:** the admin members-page audit found a `kycDocumentUrl` file upload in the create/edit form (`admin-panel/app/members/page.tsx:~1393`, `pathPrefix: "members/kyc"`) that doesn't correspond to any field in the ~30-field list the backend audit extracted from `schema.prisma`. Before touching that form, grep `schema.prisma` for `kycDocumentUrl` directly — if it's a real column, decide whether to deprecate it in favor of `KycDocument` rows (recommended, one document type becomes many) or keep both. This document assumes it will be superseded by `KycDocument`.

---

## 1. Integration Point Inventory

Everything below was verified in the repo during the audit (four parallel research passes: backend, admin panel, user-web, mobile). These are the exact seams this feature attaches to.

### 1.1 Status / state fields already on `Member` (`backend/prisma/schema.prisma`)

| Field | Type | Current default | Current usage |
|---|---|---|---|
| `status` | `MemberStatus` (`active\|inactive\|paused\|suspended\|pending`) | `active` | Gates login (`inactive/suspended/paused` blocked) and platform access (`pending` blocked by `SubscriptionGate`) |
| `verificationStatus` | `VerificationStatus` (`awaiting_kyc\|under_review\|verified\|rejected`) | `awaiting_kyc` | **Set on creation, never read or transitioned anywhere.** This is the field this feature activates. |
| `onboardingCompleted` | `Boolean` | `false` | **Never read or written anywhere.** Flips to `true` on final admin approval under this spec. |
| `createdBy` | `String? (Admin FK)` | `null` | Self-signups leave this `null` — already the correct signal for "user, not admin, created this." |

### 1.2 Self-signup (existing, being extended not replaced)

- `POST /api/user-auth/signup` → `signup()`, `backend/src/modules/user-auth/controller.ts:518-582`. Accepts `firstName, lastName?, phone, email, password, businessName?, city?, state?`. Creates `Member` with `status: 'pending'`, `membershipPlan: 'free'` (560-561); `verificationStatus`/`onboardingCompleted` untouched (schema defaults apply — already correct for this spec). Emits `admin:member_pending` via `io.to('admin')` (567-572) and `createAdminNotification(...)` (573-578).
- `login()` (~97+) already allows `status: 'pending'` through (only blocks `inactive/suspended/paused`, 117-119) — no change needed.
- `me()`, `GET /api/user-auth/me` (497-515) — currently returns `id, memberId, firstName, lastName, email, phone, profilePhotoUrl, avatarGradient, status` only. **Must be extended** to also return `verificationStatus, onboardingCompleted, onboardingReviewNote` (§5.1) — the wizard and `SubscriptionGate` both need these to render the right state.

### 1.3 Admin approval (existing, being extended not replaced)

- `POST /api/members/:id/approve` → `approveMemberHandler`, `backend/src/modules/members/controller.ts:1401-1493`. Guards `status !== 'pending'` → 400 (1411-1413). Merges arbitrary body fields onto the row (this is literally the "admin does the onboarding" mechanism today) alongside `status: 'active'` (1415-1423). Optionally creates a Clerk account (1430-1449) and a paid `Subscription` row (1454-1466). On success: invalidates `me:{id}` cache, emits `admin:member_approved` to the admin room, emits socket `notification` to `user:{id}` **and** persists a `Notification` row (1471-1486, type `system`) — **this exact pattern is the one to reuse for reject/request-changes** (§9, §J).
- **No reject or request-changes endpoint exists anywhere.** New surface, §5.5.
- `createMemberHandler` (`controller.ts:313+`) / `createMemberSchema` (`members/schema.ts:3-49`) is the authoritative list of every field an admin currently enters by hand — this is the exact field set self-onboarding needs to move to the user (§5.2 whitelist).

### 1.4 Upload / media infrastructure (existing, fully reused)

- `getPresignedUrlHandler` (`modules/upload/controller.ts:108-181`) — arbitrary `bucket`/`pathPrefix`, already treats `'kyc-documents'` as private (line 136: `isPublic = targetBucket !== 'kyc-documents'`). **Reused as-is** for document uploads, called with a server-fixed bucket (§5.3 — never trust a client-supplied bucket name for this endpoint).
- `uploadImageHandler` (17-95) — direct-buffer upload, converts known image MIME types to WebP via `sharp`, passes through anything else untouched (audio/video/PDF unaffected).
- Video: Bunny Stream via `createBunnyVideoHandler` (207-275), TUS resumable upload → `embedUrl`/HLS — the existing project pattern for "video technology," reused for onboarding instructional video (§4).
- Audio: no dedicated infra exists anywhere in the project. A plain uploaded file URL + native `<audio>` (web) / `just_audio` (mobile) is the right level of complexity — do not build audio infra.

### 1.5 Notification infrastructure (existing, fully reused)

- **Member-facing**: the `Notification` model + socket `notification` emit to `user:{id}` room, exactly as `approveMemberHandler` already does it. This is the single pattern for submitted/changes-requested/approved/rejected (§J) — not the separate `AppNotification` broadcast system, which is a different concern (admin→many-members broadcasts).
- **Admin-facing**: `admin:member_pending` socket event, consumed globally in `admin-panel/components/Providers.tsx:82-86` (toast + `['members']` query invalidation + notification-bell bump). Currently fired at **signup** time — this spec moves it to **submit** time (§5.4), since there's nothing for an admin to review until the wizard is actually submitted.

### 1.6 UI patterns confirmed reusable as-is

| Pattern | Where | Reuse for |
|---|---|---|
| Inline `window.confirm(...)` before destructive actions | 13+ admin pages, e.g. `batches/page.tsx:243` | Reject / request-changes / approve buttons (§8.2) — no shared dialog component exists in this repo; don't introduce one for this feature alone |
| Per-page inline status badge (`{label,color,bg,Icon}` record) | `security-logs/page.tsx`, prior `batch-reports/page.tsx` | Onboarding status badges (§8.2) |
| Local `useState<Step>` union-type step tracking, conditional block rendering | `tbt-user-web/components/auth/LoginScreen.tsx:12,34` | The onboarding wizard's step machine (§9.1) — no stepper/wizard library exists in this repo |
| Presigned-URL-then-PUT, `/api/user/me/avatar-presign` → PUT → `PATCH /api/user/me/avatar` | `tbt-user-web/lib/api/services/user.service.ts:19-23` | Shape to mirror for the new `/api/onboarding/documents/*` endpoints (§5.3) |
| `lib/hooks/use*.ts` (TanStack Query) → `lib/api/services/*.service.ts` (typed `apiClient` calls) | `useUser.ts` + `user.service.ts` | New `useOnboarding.ts` + `onboarding.service.ts` (§9.2) |
| Riverpod function providers + `*_service.dart` repository, `@Riverpod(keepAlive:true)` Notifier for socket-driven state | `tbt_app/lib/features/batch_program/providers/batch_provider.dart:13-46` | New `onboarding_provider.dart` (§10.2) |
| `better_player_plus` via `TbtVideoPlayerConfig` factory | `tbt_app/lib/shared/video/tbt_video_player_config.dart` | Onboarding video step on mobile (§10.3) |
| `just_audio`, no shared wrapper | `tbt_app/lib/features/podcasts/data/podcast_player_controller.dart` | Onboarding audio step on mobile — use directly, don't build a wrapper |
| `file_picker` → presigned URL → R2 PUT | `tbt_app/lib/features/batch_program/presentation/batch_day_screen.dart:83-117` | Onboarding document upload on mobile (§10.4) |
| `notification_router.dart` type→route switch, mirrored on the TS side | `tbt_app/lib/core/utils/notification_router.dart:10-15` | New `onboarding_approved`/`onboarding_rejected`/`onboarding_changes_requested` cases, added on **both** sides (§12) |

---

## 2. Scope and Phasing

**In scope, one pass:**
- Backend: schema extension, new `onboarding` module, extended `members` approve + new reject/request-changes.
- Admin panel: new onboarding review UI + content-management UI.
- user-web: new onboarding wizard (text/audio/video, profile fields, documents, review, submit).
- Mobile: same wizard, native equivalents.
- Notifications, both directions, reusing existing infra exactly.

**Explicitly out of scope for this pass** (call out if any of these turn out to be required):
- Per-document individual verification UI (D7) — table supports it, UI is optional.
- Editing `email`/`phone` during onboarding — these are the account identifiers verified at signup; changing them is a distinct, higher-risk flow (would need re-verification) and isn't part of "self-onboard the business profile."
- A generic reusable `ConfirmDialog`/`Stepper` component library — matching existing per-page convention instead (§1.6).
- Multi-language content — `onboarding_content` stores one `textBody` per step; i18n is not present anywhere else in this codebase either.

---

## 3. Data Model

### 3.1 Enum change

```sql
-- Sequential, before any table ALTERs — matches the existing pattern for
-- MemberStatus/CoursePaymentMethod in plugins/prisma.ts's pre-Promise.all block.
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'changes_requested';
```

`schema.prisma`:
```prisma
enum VerificationStatus {
  awaiting_kyc
  under_review
  verified
  rejected
  changes_requested
}
```

### 3.2 New nullable columns on `Member`

Idempotent `ALTER TABLE`, added to the existing `Promise.all([...])` block in `backend/src/plugins/prisma.ts` (same convention as `batches.snapshot_days` etc.), **and** added to `schema.prisma` for typed Prisma access (matching how the prior `WhatsappMessage` extension was done):

```sql
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS onboarding_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS onboarding_review_note TEXT
```

```prisma
model Member {
  // ...existing fields unchanged...
  onboardingSubmittedAt DateTime? @map("onboarding_submitted_at") @db.Timestamptz(6)
  onboardingReviewedAt  DateTime? @map("onboarding_reviewed_at") @db.Timestamptz(6)
  onboardingReviewedBy  String?   @map("onboarding_reviewed_by") @db.Uuid
  onboardingReviewNote  String?   @map("onboarding_review_note")
}
```

No FK relation on `onboardingReviewedBy` — plain id string, matching the existing precedent of `KycDocument.verifiedBy` (also a bare string, not a relation).

### 3.3 New table: `onboarding_content` (D5)

```sql
CREATE TABLE IF NOT EXISTS onboarding_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  text_body TEXT,
  video_url TEXT,
  audio_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

```prisma
model OnboardingContent {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  stepKey   String   @map("step_key") @db.VarChar(50)
  title     String
  textBody  String?  @map("text_body")
  videoUrl  String?  @map("video_url")
  audioUrl  String?  @map("audio_url")
  sortOrder Int      @default(0) @map("sort_order")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@map("onboarding_content")
}
```

`stepKey` is a free-text slug (`"welcome"`, `"introduction"`, `"guided_instructions"`, etc.) rather than an enum — content authors (admins) may want to add/reorder/rename steps without a schema change; `sortOrder` + `isActive` give full control from the admin UI.

### 3.4 `KycDocument` (existing, activated, unchanged)

```prisma
model KycDocument {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId     String    @map("member_id") @db.Uuid
  documentType String    @map("document_type")
  documentUrl  String    @map("document_url")
  status       String    @default("pending")
  verifiedBy   String?   @map("verified_by")
  verifiedAt   DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  member       Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

No changes. `documentType` stays free-text (e.g. `"gst_certificate"`, `"business_proof"`, `"id_proof"`) — exact required document types are a product decision, not a schema one; see §11 required-fields note.

---

## 4. Media Storage

| Content | Path |
|---|---|
| Onboarding instructional video | Bunny Stream, same as workshops/courses — admin uploads via the existing `createBunnyVideoHandler` flow when authoring an `onboarding_content` row; `videoUrl` stores the resulting HLS/embed URL |
| Onboarding instructional audio | R2 presigned upload (existing `getPresignedUrlHandler`, `bucket: "onboarding-content"`, public) when authoring an `onboarding_content` row; `audioUrl` stores the resulting public URL |
| User-submitted KYC documents | R2 presigned upload, **server-fixed** `bucket: "kyc-documents"` (already private per `upload/controller.ts:136`), `pathPrefix: "members/{memberId}"` — client never chooses the bucket for this flow (§5.3) |
| User profile photo during onboarding | Existing `profilePhotoUrl` field + existing avatar-presign pattern (`/api/user/me/avatar-presign`) — **not a new upload path**, the wizard's profile step just reuses it |

No new storage provider. No change to `upload/controller.ts`'s image-to-WebP conversion — irrelevant to documents/audio/video, which already pass through untouched.

---

## 5. Backend API

New module: `backend/src/modules/onboarding/` (`routes.ts` + `controller.ts` + `schema.ts`), registered in `server.ts` at `/api/onboarding`, `preHandler: fastify.authenticateUser` (JWT cookie — same as `user-batch`) for every member-facing route in this section. Admin routes (§5.5) live in the existing `members` module, `preHandler: fastify.authenticate` (Clerk), same as everything else there.

### 5.1 `GET /api/user-auth/me` — extend (existing endpoint)

Add to the existing `select`: `verificationStatus, onboardingCompleted, onboardingSubmittedAt, onboardingReviewedAt, onboardingReviewNote`. No breaking change — additive fields only, matching this repo's stated policy of never removing/renaming fields in member-facing responses (mobile compatibility).

### 5.2 `onboardingUpdateSchema` (D3 — the security boundary)

```typescript
// backend/src/modules/onboarding/schema.ts
export const onboardingUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(), // match existing Gender enum values
  profilePhotoUrl: z.string().url().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  businessEstablishedOn: z.string().optional(),
  productServiceType: z.string().optional(),
  instagramLink: z.string().optional(),
  annualTurnover: z.string().optional(),
  goalAfter90Days: z.string().optional(),
  preferredSessionMode: z.enum(['online', 'offline', 'hybrid']).optional(), // verify actual enum values at implementation
  gstNumber: z.string().optional(),
  marketingChannels: z.array(z.string()).optional(),
  marketingChannelName: z.string().optional(),
  hasMarketingTeam: z.boolean().optional(),
  marketingTeamDetails: z.string().optional(),
  hasVideoEditing: z.boolean().optional(),
  videoEditingDetails: z.string().optional(),
  domainHostingDetails: z.string().optional(),
  businessAddress: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  subIndustry: z.string().optional(),
  businessStage: z.string().optional(), // verify actual BusinessStage enum values at implementation
  currentChallenges: z.array(z.string()).optional(),
}).strict(); // reject unknown keys outright — do not silently drop, fail loudly on a client bug
```

**Never included, by design**: `status`, `verificationStatus`, `onboardingCompleted`, `membershipPlan`, `accountManagerId`, `batchId`, `subscriptionEndsAt`, `password`, `currentTier`, `createdBy`, `email`, `phone`, `memberId`, `notes` (D6), `healthScore`, `churnRisk`, `totalPoints`. If a new Member column is ever added, it is **excluded from self-onboarding by default** — this schema must be extended deliberately, never wildcarded.

### 5.3 Member-facing routes

```
GET  /api/onboarding
```
Returns current wizard state:
```jsonc
{
  "success": true,
  "data": {
    "status": "pending",
    "verificationStatus": "awaiting_kyc",
    "onboardingCompleted": false,
    "onboardingSubmittedAt": null,
    "onboardingReviewNote": null,
    "profile": { /* current values of every onboardingUpdateSchema field */ },
    "documents": [{ "id": "...", "documentType": "gst_certificate", "documentUrl": "...", "status": "pending" }]
  }
}
```

```
PATCH /api/onboarding
```
Body: `onboardingUpdateSchema.partial()`. **Guard**: 403 unless `verificationStatus` is `awaiting_kyc` or `changes_requested` (can't edit while `under_review` — already submitted — or `verified` — already approved). This is the "save progress" endpoint, called on every step's "Continue" and available for resume-later.

```
POST /api/onboarding/documents/presign
```
Body: `{ filename, contentType, documentType }`. Server sets `bucket: "kyc-documents"` and `pathPrefix: "members/${req.memberId}"` itself — **the client-supplied bucket/pathPrefix from the generic upload endpoint is never used here.** Returns `{ uploadUrl, publicUrl }`. Same guard as PATCH (can't upload while under review/verified).

```
POST /api/onboarding/documents
```
Body: `{ documentType, documentUrl }` (after the client has PUT to `uploadUrl`). Creates a `KycDocument` row, `status: 'pending'`. Returns the created row.

```
DELETE /api/onboarding/documents/:id
```
Must belong to `req.memberId` (404 otherwise — never leak existence of another member's document); 403 if the parent application is already `under_review`/`verified`.

```
POST /api/onboarding/submit
```
**Guard**: `verificationStatus` must be `awaiting_kyc` or `changes_requested`. Server-side validates a minimal required set — see §11 for the exact list (open decision, propose: `firstName`, `businessName`, `businessType`, `city`, `state`, plus at least one `KycDocument` row). On success: `verificationStatus → under_review`, `onboardingSubmittedAt → now()`. Fires the admin-notify side effect described in §5.4. Returns the new state.

```
GET /api/onboarding-content
```
`data: OnboardingContent[]` where `isActive`, ordered by `sortOrder`. Read-only for members.

### 5.4 Moving the admin-notify side effect (signup → submit)

`signup()` (`user-auth/controller.ts:567-578`) currently emits `admin:member_pending` + `createAdminNotification`. **Remove that from `signup()`**; move the identical call into `submit()` in the new onboarding controller. Rationale: under the old flow, signup *was* the complete application (nothing else to fill in), so notifying immediately was correct. Under the new flow, signup is just account creation — there's nothing to review until the wizard is submitted, and notifying admin at signup would mean a wall of "pending" applications that are actually still empty/in-progress.

### 5.5 Admin routes (extend `members` module, `preHandler: fastify.authenticate`)

`GET /api/members/:id` — extend existing `getMemberHandler`'s `select`/`include` to also return `kycDocuments: true` and the new `onboarding*` columns. No new endpoint — the existing member-detail fetch already has everything else.

`POST /api/members/:id/approve` — **extend existing handler**:
- Guard becomes `status === 'pending' && (createdBy !== null || verificationStatus === 'under_review')` (was: `status !== 'pending'` only). The `createdBy !== null` branch preserves the existing admin-direct-creation path exactly as it works today — an admin who creates a member by hand can still approve immediately without ever passing through `under_review`, since that member never went through self-onboarding at all. The `verificationStatus === 'under_review'` branch is the *new* self-onboarding path's guard — a self-signed-up member (`createdBy === null`) must have actually submitted the wizard before an admin can approve them.
- Additionally sets `verificationStatus: 'verified'`, `onboardingCompleted: true`, `onboardingReviewedAt: now()`, `onboardingReviewedBy: req.adminId`.
- Everything else (Clerk account creation, Subscription row, cache invalidation, `admin:member_approved` emit, member `Notification` + socket) **unchanged**.

`POST /api/members/:id/reject` — **new**:
```typescript
Body: { reason: string } // required, min length 1
Guard: verificationStatus === 'under_review'
Effect: verificationStatus → 'rejected', onboardingReviewedAt → now(), onboardingReviewedBy → req.adminId, onboardingReviewNote → reason
         status unchanged ('pending') — account stays inactive but distinctly marked
Side effects: same pattern as approve — member Notification (type 'system', title "Onboarding Update") + socket 'notification' to user:{id};
              admin:member_rejected emitted to admin room (new event, mirrors admin:member_approved)
```

`POST /api/members/:id/request-changes` — **new**:
```typescript
Body: { note: string } // required, min length 1
Guard: verificationStatus === 'under_review'
Effect: verificationStatus → 'changes_requested', onboardingReviewedAt → now(), onboardingReviewedBy → req.adminId, onboardingReviewNote → note
         status unchanged ('pending')
Side effects: member Notification + socket, admin:member_changes_requested emitted (new event)
```

Both new handlers follow `approveMemberHandler`'s exact structure (404 if missing, guard check → 400, then the update+notify block) — same file, same conventions, not a new pattern.

### 5.6 Optional / P2 (D7): per-document review

```
PUT /api/members/:id/kyc-documents/:docId
Body: { status: 'verified' | 'rejected' }
```
Sets `status`, `verifiedBy`, `verifiedAt` on the `KycDocument` row. Cheap to add (table already has every field) — include if time allows, not required for the core approve/reject/request-changes loop.

---

## 6. Approval State Machine

```
                    ┌─────────────┐
      signup ──────▶│ awaiting_kyc│◀────────────────┐
                    └──────┬──────┘                  │
                           │ PATCH (save progress)*   │ request-changes
                           │ ×N, any order             │ (admin)
                           ▼                           │
                    (still awaiting_kyc)          ┌────┴─────────────┐
                           │                       │ changes_requested│
                           │ POST /submit          └────┬─────────────┘
                           ▼                             │ PATCH + POST /submit
                    ┌──────────────┐                     │ (user corrects)
                    │ under_review │◀────────────────────┘
                    └──────┬───────┘
                    ┌──────┼───────┐
          approve   │      │       │  reject
         (admin)    ▼      │       ▼
                ┌────────┐ │  ┌──────────┐
                │verified│ │  │ rejected │  (terminal for this pass — see §11
                └────────┘ │  └──────────┘   for whether rejected should be
                           │                  resumable; default: no, admin
                           │ request-changes  can manually reopen via existing
                           ▼                  member-edit if needed)
                    ┌──────────────────┐
                    │ changes_requested│
                    └──────────────────┘
```

`*` PATCH is only accepted while `awaiting_kyc` or `changes_requested` — this is the sole enforcement point preventing a user from editing their submitted application out from under an admin mid-review, or after approval.

`Member.status` stays `pending` throughout every state above; it only becomes `active` on the `verified` transition. This means the *existing* `PendingInterceptor` gate (which checks `status`, not `verificationStatus`) continues to correctly block full platform access right up until approval — no change needed to the gate's trigger condition, only to its exemption list (§7.1) and its displayed message (§7.2).

---

## 7. Cross-Client Contract

Both user-web and mobile must agree on: which routes are reachable while `status === 'pending'`, and what message/state each `verificationStatus` value renders.

### 7.1 Gate exemption (D2)

**user-web** — `tbt-user-web/app/(platform)/SubscriptionGate.tsx`. `PendingInterceptor` currently has no exemption check at all (unlike `FreeInterceptor`, which already has `EXEMPT_PATHS = ["/Products", "/profile"]`, line 11). Add:
```typescript
const PENDING_EXEMPT_PATHS = ["/onboarding"];
// inside PendingInterceptor's render/trigger logic, mirror FreeInterceptor's isExempt check:
const isExempt = PENDING_EXEMPT_PATHS.some(p => pathname?.startsWith(p));
if (isExempt) return null; // or return children unblocked, matching FreeInterceptor's existing pattern exactly
```

**mobile** — `tbt_app/lib/shared/widgets/subscription_gate.dart:43-48`, `_PendingInterceptor`. Same shape of change: check current route against an equivalent exempt-path/route-name list before rendering the blocking screen. Exact mechanism (route name vs path prefix) depends on `app.dart`'s `go_router` setup — verify at implementation time.

### 7.2 Message by state (both clients)

| `verificationStatus` | What the gate/wizard shows |
|---|---|
| `awaiting_kyc`, not yet submitted | Redirect into `/onboarding` (or show a resume banner if `onboardingSubmittedAt` is null but some profile fields are already filled — "Continue your onboarding") |
| `under_review` | "Your onboarding has been submitted and is waiting for admin approval." (Step 7 requirement, verbatim) — no further action available, read-only |
| `changes_requested` | "Admin requested some changes: {onboardingReviewNote}" + button back into `/onboarding`, landing on the flagged step if determinable, else the Review step |
| `rejected` | "Your application was not approved: {onboardingReviewNote}" — no resubmit path in this pass (§11 open question) |
| `verified` | Not reachable — `status` is `active` by this point, `PendingInterceptor` doesn't fire at all |

### 7.3 What "resume where you left off" means

No separate progress-percentage field is introduced — completion is derived client-side from which `onboardingUpdateSchema` fields are non-null in the `GET /api/onboarding` response, plus `documents.length > 0`. This avoids a second source of truth for "how much is done" that could drift from the actual data.

---

## 8. Admin Panel

### 8.1 Hooks (new `admin-panel/lib/hooks/useOnboarding.ts`, following the `useTbt.ts`/`useMembers.ts` convention exactly)

```typescript
useListOnboardingApplications({ verificationStatus?, search?, page?, limit? })
  // GET /api/members?verificationStatus=... — reuses the EXISTING useListMembers query shape,
  // just a differently-named/filtered wrapper for this screen's own query key
useGetOnboardingDetail(memberId)        // GET /api/members/:id (extended, §5.5)
useApproveOnboarding()                  // POST /api/members/:id/approve (extended)
useRejectOnboarding()                   // POST /api/members/:id/reject
useRequestOnboardingChanges()           // POST /api/members/:id/request-changes
useListOnboardingContent()              // GET/admin variant of onboarding_content
useUpsertOnboardingContent()            // POST/PUT onboarding_content (admin CRUD)
```

### 8.2 Page: `admin-panel/app/onboarding/page.tsx`

Monolithic-page-with-tabs, matching this repo's stated convention for large feature pages (CLAUDE.md: "Large feature pages are monolithic by design ... follow that pattern rather than splitting"):

- **Tab "Applications"**: table (mirrors `security-logs/page.tsx`'s list pattern) — columns Member / Submitted At / Status badge (Pending=under_review / Approved=verified / Rejected / Changes Required) / actions. Filter chips for all 4 statuses + search box (member name/phone/email, delegating to the existing `useListMembers` search param). Row click → detail drawer/panel:
  - Profile summary (every `onboardingUpdateSchema` field, read-only)
  - Documents list with inline preview (image → thumbnail, PDF → link, matches `app-resources` page's existing file-link pattern for non-image types)
  - Onboarding content playback if relevant (rare — mainly for admin to sanity-check what the user was shown, not a required review step)
  - Admin note textarea (required before Reject/Request Changes can be submitted — this doubles as the "not a single accidental click" friction requested)
  - Three actions: **Approve** (only enabled when `verificationStatus === 'under_review'`; `window.confirm` guard, matching §1.6's existing convention), **Reject** (requires the note field to be non-empty, then `window.confirm`), **Request Changes** (same requirement)
- **Tab "Content"**: CRUD list for `onboarding_content` rows — title, step key, text body, video upload (existing Bunny flow, matching how `workshops`/`courses` admin pages already do it), audio upload (existing presigned-URL flow), sort order, active toggle.

### 8.3 Sidebar

`admin-panel/components/layout/Sidebar.tsx` — add `{ name: "Onboarding", href: "/onboarding", icon: UserCheck }` (or similar) to the top ungrouped section, near "Members" — it's a first-class review queue, not a "Communication" item.

The existing Members page's inline pending-badge/Approve-button (`app/members/page.tsx:1366-1414`) should be simplified to a link into `/onboarding?memberId=...` rather than duplicating the approve/reject logic in two places — single source of truth for the review action.

---

## 9. user-web Implementation

### 9.1 Wizard shell — `app/(platform)/onboarding/page.tsx`

Single page, local step state exactly matching `LoginScreen.tsx`'s pattern (§1.6):
```typescript
type Step = "welcome" | "education" | "profile" | "documents" | "guided_media" | "review" | "submitted";
const [step, setStep] = useState<Step>("welcome");
```
Each step is a conditionally-rendered block in the same component (not separate routes) — matches the one confirmed precedent in this codebase for multi-step flows. A slim progress bar (`step index / 7`) renders above every step per the Rapido/Zomato-inspired "strong progress indicator" requirement.

- **Welcome** (Step 1 of the product spec): static intro text (from `uiStrings`, since this page is inside `(platform)` — see the uiStrings nuance below) + estimated time + Continue.
- **Education** (Step 2): renders `onboarding_content` rows for `stepKey: "introduction"` — text always shown, video via `PlyrPlayer` if `videoUrl` present, audio via native `<audio controls>` if `audioUrl` present. Continue enabled immediately (no forced watch-to-completion — matches "explain, don't gate" framing from the requirements).
- **Profile** (Step 3): form driven by `onboardingUpdateSchema`'s field list, calling `PATCH /api/onboarding` on Continue. Reuse existing validation patterns from the admin create/edit form (`react-hook-form`) rather than inventing new client-side rules.
- **Documents** (Step 4): file input(s) per required `documentType` → `POST /api/onboarding/documents/presign` → client PUT → `POST /api/onboarding/documents`. List of already-uploaded docs with a remove button (`DELETE`).
- **Guided media** (Step 5): renders `onboarding_content` rows for `stepKey: "guided_instructions"` (or similar) — same text/video/audio rendering as Education.
- **Review** (Step 6): read-only summary of everything entered + document list + a completion checklist against the required-fields set (§11); Edit links jump back to the relevant step (not a full restart).
- **Submit** (Step 7): `POST /api/onboarding/submit` → on success, show the exact required copy: *"Your onboarding has been submitted successfully and is waiting for admin approval."* — then this page becomes read-only (re-fetches `GET /api/onboarding`, sees `under_review`, renders the pending message instead of the form).

### 9.2 API layer

`lib/api/services/onboarding.service.ts` + `lib/hooks/useOnboarding.ts`, following the `user.service.ts`/`useUser.ts` shape exactly (§1.6): `useOnboardingState()` (query), `useSaveOnboardingProgress()`, `usePresignOnboardingDocument()`, `useRegisterOnboardingDocument()`, `useDeleteOnboardingDocument()`, `useSubmitOnboarding()`, `useOnboardingContent()`.

### 9.3 uiStrings

Because this wizard lives inside `(platform)` (D2), every user-facing string must come from `uiStrings`/`config` per the existing, enforced convention — not hardcoded like the (exempt) `SignupScreen`. New keys needed under `settings/ui-strings` in the admin panel: welcome copy, step labels, button labels, the pending/rejected/changes-required messages from §7.2, validation messages. This is a real, non-trivial addition to the admin ui-strings settings page — budget for it, don't treat it as an afterthought.

---

## 10. Flutter Implementation

### 10.1 Structure

`tbt_app/lib/features/onboarding/{data,domain,providers,presentation}/`, mirroring `batch_program`'s layout exactly (§1.6). `data/onboarding_repository.dart` wraps the same six endpoints as the web service layer. `domain/onboarding_state.dart` — freezed model mirroring the `GET /api/onboarding` response shape.

### 10.2 Providers

`providers/onboarding_provider.dart` — function-based `@riverpod` providers delegating to the repository (matching `batch_provider.dart:13-28`), plus a `@Riverpod(keepAlive: true)` step-state notifier holding the current wizard step locally (mirrors `LoginScreen`'s local state, just Riverpod-shaped instead of React `useState` since that's this app's convention).

### 10.3 Presentation — one screen per step under `presentation/`

`welcome_screen.dart`, `education_screen.dart`, `profile_screen.dart`, `documents_screen.dart`, `guided_media_screen.dart`, `review_screen.dart`, `submitted_screen.dart`, navigated via `go_router` sub-routes under `/onboarding` (registered in `app.dart`, exempted from the pending-gate per §7.1). Video → `TbtVideoPlayerConfig` factory (§1.6), audio → `just_audio` directly (no wrapper needed, matching podcasts' level of abstraction).

### 10.4 Upload

`documents_screen.dart` reuses the exact `file_picker` → `uploadServiceProvider.getPresignedUrl(...)` → `uploadServiceProvider.uploadToR2(...)` chain already proven in `batch_day_screen.dart:83-117` — call the new `/api/onboarding/documents/presign` endpoint instead of the generic one, same client-side shape.

### 10.5 API constants

Add to `tbt_app/lib/core/constants/api.dart`: `kOnboardingGet`, `kOnboardingUpdate`, `kOnboardingDocumentsPresign`, `kOnboardingDocuments`, `kOnboardingSubmit`, `kOnboardingContent` — following the existing `k*` naming convention, never inline a path string in the repository (explicit existing rule).

---

## 11. Reliability, Edge Cases, Open Questions

Genuine open decisions — propose defaults, flag for confirmation before/during implementation:

1. **Exact required-fields-to-submit set.** Proposed default: `firstName`, `businessName`, `businessType`, `city`, `state`, plus ≥1 `KycDocument`. This is deliberately smaller than the full ~25-field admin form — "do not invent unnecessary fields" — but confirm against actual business requirements before hardcoding the validator.
2. **Is `rejected` resumable?** Default in this spec: no self-service resubmit from `rejected` (only `changes_requested` allows editing) — a genuine rejection is treated as more final than "please fix X." Admin retains the ability to manually reset `verificationStatus` via the existing member-edit form if they want to give someone another chance. Confirm this matches intent.
3. **`gender`, `preferredSessionMode`, `businessStage` enum values** — the backend audit didn't extract these enums' exact members; verify against `schema.prisma` before writing `onboardingUpdateSchema` so the Zod enum matches exactly.
4. **The `kycDocumentUrl` legacy field** (see §0 "needs verification") — resolve before touching `admin-panel/app/members/page.tsx`.
5. **Race condition**: nothing stops two browser tabs from both calling `PATCH` concurrently — last-write-wins, same as every other profile-edit flow in this codebase (no optimistic-locking anywhere precedent-wise); not a new risk class, not fixed specially here.
6. **Presigned document uploads that never get registered** (client uploads to R2, then closes the tab before `POST /api/onboarding/documents`) — orphaned R2 objects, no cleanup job. Same class of gap as every other presigned-upload flow in this codebase already; not introducing a new problem, not solving an old one in scope of this feature.

---

## 12. Realtime / Notification Events

New Socket.IO events, added to the existing rooms table (`user:{memberId}` and `'admin'`, exactly as already documented in the root `CLAUDE.md`):

| Event | Room | Emitted by | Consumed by |
|---|---|---|---|
| `admin:member_pending` | `admin` | `onboarding/submit` (moved from `signup`) | `admin-panel/components/Providers.tsx` (existing listener, unchanged) |
| `admin:member_rejected` | `admin` | `members/reject` | New — add alongside the existing `admin:member_approved` listener in `Providers.tsx` if multi-admin visibility is wanted; optional |
| `admin:member_changes_requested` | `admin` | `members/request-changes` | Same as above, optional |
| `notification` (existing generic event) | `user:{memberId}` | submit / reject / request-changes / approve | Existing member notification-bell consumer — no new client-side event name needed, reuses the `Notification` model exactly as approve already does |

Mobile: add `'onboarding_approved'`, `'onboarding_rejected'`, `'onboarding_changes_requested'` cases to **both** `tbt_app/lib/core/utils/notification_router.dart` and its documented TS mirror `admin-panel/lib/utils/notificationRouter.ts` (per the existing cross-file sync requirement noted in that file) — routing to `/onboarding` (changes-requested) or `/profile`/dashboard (approved/rejected).

---

## 13. Security / Authorization

- Every member-facing `/api/onboarding/*` route uses `fastify.authenticateUser` (JWT cookie) — identical middleware to every other member route, no new auth mechanism.
- **A member can never approve their own onboarding** — there is no member-reachable route that writes `verificationStatus → verified` or `status → active`; those only happen inside the Clerk-gated `members/approve` handler.
- The whitelist schema (D3, §5.2) is the sole mechanism preventing privilege escalation via the profile-edit endpoint — `.strict()` mode rejects unknown keys rather than silently dropping them, so a client bug (or probing attempt) fails loudly instead of quietly succeeding-minus-the-dangerous-fields.
- Document endpoints scope every read/write to `req.memberId` — a member can never view or delete another member's `KycDocument` rows (404, not 403, to avoid confirming existence).
- Admin routes (`reject`, `request-changes`, extended `approve`) stay behind `fastify.authenticate` (Clerk) exactly as `approve` already is — no change to the admin authorization boundary.

---

## 14. Testing

### Backend (vitest — new)
Following the exact precedent set by `batchReportLogic.ts` / `batchReportLogic.test.ts` from the prior feature (pure, DB-free logic separated from Prisma orchestration, added to the narrow `vitest.config.ts` include list):
- `onboardingLogic.ts` (new, pure): the required-fields validator (§11 item 1), the state-transition guard function (given current `verificationStatus` + requested transition, allowed or not), and the whitelist-strip function if implemented as a standalone pure function rather than inline Zod.
- `onboardingLogic.test.ts`: every state-machine edge in §6 (can't PATCH while under_review, can't submit while under_review/verified, can't approve unless under_review, request-changes/reject both require under_review, etc.), required-fields validator with missing/present combinations.

### Typecheck
`cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json`, `cd tbt-admin/backend && npx tsc --noEmit`.

### Mobile
`flutter analyze` (the project's stated "typecheck equivalent" — no CI for mobile, per CLAUDE.md), `dart run build_runner build --delete-conflicting-outputs` after adding any `@riverpod`/`@freezed` annotations (mandatory per existing convention).

### Manual trace (same limitation as the prior feature — no live DB/credentials available in this environment)
Full loop to verify by careful code reading + the unit tests above, not a live run: signup → wizard save/resume → submit → admin sees in `/onboarding` → approve path → `status` flips to `active`, `PendingInterceptor` stops firing, member notified. Separately: submit → reject path → member sees reason, cannot resubmit. Separately: submit → request-changes path → member can edit and resubmit → back to `under_review`.

### `npm run lint` / `flutter analyze` caveats
Repo-wide backend/admin-panel `eslint` was found broken pre-existing (missing config/parser) in the prior session — not something this feature fixes or is blocked by; rely on `tsc` as the correctness gate, consistent with how the previous feature was verified.

---

## 15. Acceptance Criteria Coverage

Mapping the task's required 10-step user journey to where each step is implemented:

| Step | Implemented by |
|---|---|
| 1. Welcome | §9.1 Welcome block, `onboarding_content` optional |
| 2. Introduction/Education (text/audio/video) | §9.1 Education block, §3.3 `onboarding_content` |
| 3. Personal/Profile info (existing schema only) | §5.2 whitelist, §9.1 Profile block |
| 4. Required documents (existing upload infra) | §5.3 document endpoints, §4, §9.1 Documents block |
| 5. Guided audio/video instructions | §9.1 Guided Media block, same `onboarding_content` mechanism as Step 2 |
| 6. Review before submission | §9.1 Review block |
| 7. Submit → `PENDING_ADMIN_APPROVAL`-equivalent | §5.3 `/submit`, §6 (`under_review`), exact required user-facing copy specified |
| 8. Admin review (pending/approved/rejected/changes-required, docs, media) | §8.2 |
| 9. Final admin approval → existing active/onboarded state | §5.5 extended `approve`, §6 |
| 10. User result (approved/rejected/changes-required with reason, resubmit path) | §7.2, §6 |

Security requirement ("user must never approve their own onboarding") — §13. Notification requirement (submitted/changes-requested/approved/rejected, existing system reused) — §5.4, §12. Admin confirmation-before-destructive-action requirement — §8.2 (note-required + `window.confirm`, matching existing repo convention rather than a new dialog component).

---

## 16. Rollout / Migration Notes

- Schema changes are 100% additive (new enum value, new nullable columns, one new table) — `prisma db push --accept-data-loss` in CI applies them safely, same as the prior feature; no data migration needed since every existing `Member` row already has `verificationStatus: 'awaiting_kyc'` (schema default) and no rows currently have anything else.
- **Existing admin-created members are unaffected** — `createMemberHandler`/`updateMemberSchema` are untouched, and the `approve` guard in §5.5 was written specifically to preserve the existing admin-direct-creation path (`createdBy !== null` branch) alongside the new self-onboarding path (`under_review` branch) — an admin-created member's `verificationStatus` defaults to `awaiting_kyc` same as a self-signup would, so without that `createdBy` branch the guard would have silently broken today's "admin creates and immediately approves" workflow. Worth a second pair of eyes on this specific guard during code review given how easy it was to get wrong the first time.
- No downtime required; this is purely additive until the frontend routes/pages are deployed, at which point the new `/onboarding` routes simply start existing.
