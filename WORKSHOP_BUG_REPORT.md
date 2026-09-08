# Workshop Bug Report

**Date:** 2026-08-21  
**Scope:** Static code audit — backend (`tbt-admin/backend`), admin panel (`tbt-admin/admin-panel`), user web (`tbt-user-web`)  
**Bugs found:** 6

---

## Summary Table

| ID | Severity | Area | File | Line | Issue |
|---|---|---|---|---|---|
| BUG-WS-001 | Medium | Admin UI | `admin-panel/app/workshops/[id]/page.tsx` | 2359 | Invalid `live_call` option in challenge type dropdown |
| BUG-WS-002 | High | Backend | `backend/src/modules/workshops/controller.ts` | 1462 | Q&A reply saves `adminId = null` (reads non-existent `req.admin`) |
| BUG-WS-003 | Medium | Backend | `backend/src/modules/workshops/controller.ts` | 571 | Live session start notification has incomplete `actionUrl` |
| BUG-WS-004 | High | Backend | `backend/src/modules/workshops/controller.ts` | 473 | Editing any live call field resets `endedAt` to null |
| BUG-WS-005 | High | User Web | `tbt-user-web/app/(player)/episode/[workshopSlug]/[episodeId]/page.tsx` | 54 | Standalone episode player ignores HLS — episodes with only `bunnyVideoId` show error |
| BUG-WS-006 | High | Backend | `backend/src/modules/workshops/controller.ts` | 1613 | Breakout recall emits to wrong socket room — members never receive it |

---

## BUG-WS-001 — Invalid Challenge Type Option in Admin UI

**Severity:** Medium  
**File:** `admin-panel/app/workshops/[id]/page.tsx:2359`

### Description
The challenge creation/edit form in the admin panel includes a `<option value="live_call">Live Call</option>` in the challenge type dropdown. `live_call` is a **flow item type**, not a valid challenge type. Valid challenge types are: `watch | quiz | matching | written | flashcard`.

### Root Cause

```tsx
// Line 2359 — inside the challenge form's type <select>
<option value="live_call">Live Call</option>
```

Additionally, line 1660 includes `live_call` in the `typeMeta` map used for rendering challenge badges:

```tsx
live_call: { label: "LIVE CALL", color: "#22c55e" }
```

If an admin selects "Live Call" and saves, the backend receives `type = "live_call"`, which is not in the valid enum. The challenge either fails schema validation silently or persists an invalid row.

### Test Case

1. Open the admin panel → navigate to any workshop → open the **Flow** tab
2. Click **Add Challenge** (or edit an existing challenge)
3. Open the **Type** dropdown
4. **Observe:** A "Live Call" option is present in the list
5. Select "Live Call" and save the challenge
6. **Expected:** "Live Call" should not appear in the challenge type dropdown; saving should be prevented or return a validation error
7. **Actual:** The option is selectable; submitting sends `type = "live_call"` to the backend

### Fix

Remove `<option value="live_call">Live Call</option>` from the challenge type `<select>` at line 2359. Also remove `live_call` from the `typeMeta` map at line 1660.

---

## BUG-WS-002 — Q&A Reply Always Saves `adminId = null`

**Severity:** High  
**File:** `backend/src/modules/workshops/controller.ts:1462`

### Description
The `replyQAHandler` reads `(req as any).admin` to get the admin ID. The Clerk plugin sets `request.user` (the Clerk user ID string like `user_xxx`) — it never sets `request.admin`. As a result, `adminId` is always `null` in every saved Q&A reply from an admin.

### Root Cause

```typescript
// clerk.ts — what the plugin actually sets:
request.user = verified.sub;   // e.g. "user_2abc..."
// request.admin is NEVER set

// controller.ts line 1462 — what the handler reads:
const adminId = (req as any).admin?.id ?? null;
// (req as any).admin is always undefined → adminId = null
```

The admin lookup should use `req.user` (the Clerk subject ID) to find the admin record in the DB.

### Test Case

1. Open the admin panel → navigate to any workshop → open the **Q&A** tab
2. Find any member question
3. Click **Reply** and submit a reply text
4. Open the database (Prisma Studio or direct SQL): `SELECT * FROM workshop_qa_replies ORDER BY created_at DESC LIMIT 5`
5. **Expected:** The reply row should have `admin_id` set to the replying admin's ID
6. **Actual:** `admin_id` is `NULL` on every reply; replies are permanently unattributed

### Fix

```typescript
// In replyQAHandler (controller.ts ~line 1458):
const admin = await req.server.prisma.admin.findFirst({
  where: { clerkId: req.user },
  select: { id: true },
});
const adminId = admin?.id ?? null;
```

---

## BUG-WS-003 — Live Session Start Notification Links to 404

**Severity:** Medium  
**File:** `backend/src/modules/workshops/controller.ts:571`

### Description
When a live call session is started, the system sends a notification to enrolled members. The notification's `actionUrl` is hardcoded as `'/workshop'` — an incomplete URL that routes users to a 404 page instead of the specific workshop.

### Root Cause

```typescript
// controller.ts line 571 — inside startLiveCallHandler:
actionUrl: '/workshop',   // BUG: missing workshop slug
```

The live call record has a `workshopId` FK, but the handler never joins the `workshop` relation to fetch the slug.

### Test Case

1. In the admin panel, navigate to any workshop → **Live Calls** tab
2. Click **Start Session** on any live call entry
3. On a member account enrolled in this workshop, check the **Notifications** page
4. Click the notification for the live session
5. **Expected:** Member is navigated to the specific workshop page (e.g., `/workshop/my-workshop-slug`)
6. **Actual:** Member is navigated to `/workshop` which either 404s or shows an empty state

### Fix

```typescript
// In startLiveCallHandler, after fetching liveCall, join workshop:
const workshop = await req.server.prisma.workshop.findUnique({
  where: { id: liveCall.workshopId },
  select: { slug: true },
});

// Then use:
actionUrl: `/workshop/${workshop?.slug ?? liveCall.workshopId}`,
```

---

## BUG-WS-004 — Editing Any Live Call Field Reactivates an Ended Session

**Severity:** High  
**File:** `backend/src/modules/workshops/controller.ts:473`

### Description
`updateLiveCallHandler` unconditionally applies `data.endedAt = null` to the Prisma update payload regardless of which field is being edited. This means that editing the title, description, or any other field on a live call that has already ended silently clears the `endedAt` timestamp, making the session appear active again.

### Root Cause

```typescript
// controller.ts line 473 — inside updateLiveCallHandler:
data.endedAt = null;   // applied unconditionally to every PATCH
```

There is no guard to only clear `endedAt` when the intent is to re-open a session.

### Test Case

1. In the admin panel, navigate to a workshop → **Live Calls** tab
2. Start then end a live call session (verify `endedAt` is set in DB)
3. Without restarting the session, edit the live call's **title** only and save
4. Check the live call record in the DB
5. **Expected:** `ended_at` should remain unchanged; only `title` should be updated
6. **Actual:** `ended_at` is reset to `NULL` — the session now appears active/ongoing to members

### Fix

Remove the unconditional `data.endedAt = null` line at 473. Only clear `endedAt` if the caller explicitly passes `endedAt: null` in the request body, or when a separate "re-open session" action is taken:

```typescript
// Only clear endedAt if explicitly requested:
if (body.endedAt === null) {
  data.endedAt = null;
}
```

---

## BUG-WS-005 — Standalone Episode Player Fails for HLS-Only Episodes

**Severity:** High  
**File:** `tbt-user-web/app/(player)/episode/[workshopSlug]/[episodeId]/page.tsx:54`

### Description
The full-screen standalone episode player (`/episode/:slug/:episodeId`) gates rendering on `!playback?.videoUrl`. Episodes uploaded via Bunny Stream (with a `bunnyVideoId`) return `hlsUrl` but `videoUrl = null`. The player shows an error/empty state instead of falling back to HLS playback.

### Root Cause

```typescript
// page.tsx line 54:
if (!playback?.videoUrl) {
  // shows error — never checks hlsUrl
  return <ErrorScreen />;
}

// line 69: only uses videoUrl:
const videoSrc = withResumeTime(normalizeBunnyUrl(playback.videoUrl), ...);

// line 94: always renders iframe — PlyrPlayer never used:
<iframe src={videoSrc} ... />
```

The backend's `getEpisodePlaybackHandler` returns both `videoUrl` (iframe embed URL) and `hlsUrl` (HLS playlist). The page ignores `hlsUrl` entirely. The equivalent in-workshop player (`workshop/[slug]/page.tsx`) correctly uses the two-tier HLS-first / iframe-fallback pattern.

### Test Case

1. In the admin panel, create or locate a workshop episode that was uploaded via Bunny Stream (has a `bunnyVideoId` but no explicit `videoUrl`/embed URL set)
2. As a member, navigate to the workshop and find the episode
3. Click to play the episode — then click the **full-screen player** link (`/episode/:slug/:episodeId`)
4. **Expected:** The HLS player (`PlyrPlayer`) loads and the episode plays via HLS
5. **Actual:** The page renders an error state because `playback.videoUrl` is `null`, despite `playback.hlsUrl` being a valid HLS URL

### Fix

Apply the same two-tier player pattern used in `workshop/[slug]/page.tsx`:

```typescript
// Replace the videoUrl-only guard with:
const hasHls = !!playback?.hlsUrl;
const hasIframe = !!playback?.videoUrl;

if (!hasHls && !hasIframe) {
  return <ErrorScreen />;
}

// Render PlyrPlayer when hlsUrl is available:
if (hasHls && !hlsFailed) {
  return <PlyrPlayer hlsUrl={playback.hlsUrl} onError={() => setHlsFailed(true)} ... />;
}

// Fall back to iframe:
const videoSrc = withResumeTime(normalizeBunnyUrl(playback.videoUrl!), ...);
return <iframe src={videoSrc} ... />;
```

---

## BUG-WS-006 — Breakout Room Recall Emits to Wrong Socket Room

**Severity:** High  
**File:** `backend/src/modules/workshops/controller.ts:1613`

### Description
`recallAllHandler` (triggered when an admin recalls all members from breakout rooms) emits `live_call:breakout_recall` to `live:${lcid}`. Workshop members are never in the `live:*` room — only webinar participants join that room via the explicit `join:live` socket event. The event silently drops for all workshop members.

### Root Cause

```typescript
// controller.ts line 1613:
req.server.io.to(`live:${lcid}`).emit('live_call:breakout_recall', { liveCallId: lcid });
```

Socket room membership (from `socket.ts`):
- Members auto-join `user:{memberId}` and `community` on connect
- `live:{id}` is joined only when a member explicitly emits `join:live` — this is the **webinar** flow only
- Workshop live calls have no equivalent room-join mechanism; members never emit `join:live` for workshop sessions

The client-side listener in `WorkshopLiveCall.tsx` listens on the personal socket (`getSocket()`) for `live_call:breakout_recall` — meaning it expects the event on the `user:{memberId}` room.

### Test Case

1. In the admin panel, navigate to a workshop → **Live Calls** tab → start a session
2. Have multiple members join the workshop live call
3. As admin, assign members to breakout rooms
4. Click **Recall All** to bring members back from breakout rooms
5. **Expected:** All members in breakout rooms receive the recall notification and are redirected back to the main room
6. **Actual:** No member receives any recall notification; the `live_call:breakout_recall` event is emitted to an empty room and dropped silently

### Fix

Fetch all enrolled members for this workshop and emit to each member's personal room:

```typescript
// In recallAllHandler, after fetching the liveCall:
const enrollments = await req.server.prisma.workshopEnrollment.findMany({
  where: { workshopId: liveCall.workshopId },
  select: { memberId: true },
});

for (const { memberId } of enrollments) {
  req.server.io
    .to(`user:${memberId}`)
    .emit('live_call:breakout_recall', { liveCallId: lcid });
}
```

Alternatively, create a persistent workshop live-call room (e.g., `workshop-live:${lcid}`) that members join when they open the live call UI, and emit to that room. This is the preferred approach if the workshop live call feature expands.

---

## Fix Priority

| Priority | Bug | Reason |
|---|---|---|
| P0 | BUG-WS-004 | Data corruption — silently reactivates ended sessions on any edit |
| P0 | BUG-WS-005 | Content inaccessible — HLS-only episodes always fail in standalone player |
| P1 | BUG-WS-002 | Data integrity — Q&A replies permanently lose admin attribution |
| P1 | BUG-WS-006 | Feature broken — breakout recall is a no-op; members never notified |
| P2 | BUG-WS-001 | Data integrity — invalid challenge type can be persisted from UI |
| P2 | BUG-WS-003 | UX — live session notification navigates to 404 |
