# Live Call Features — Implementation Spec Kit

> **Safety principle:** Every feature is additive only. No existing handler, schema field, route, or component is removed or renamed. New fields are always nullable with defaults. New routes use new path segments that don't conflict with existing ones.

---

## Implementation Groups (do in this order)

| Group | Features | Risk | Reason |
|-------|----------|------|--------|
| A | #4, #6, #8 | Lowest | Frontend/socket only — zero DB changes |
| B | #10, #15 | Low | DB fields already exist / reads existing data |
| C | #2, #3, #7, #11, #14 | Medium | New standalone models, no FK changes to LiveCall |
| D | #1, #12 | Medium | FK additions to LiveCall — test thoroughly |
| E | #9, #13 | Medium-High | LiveKit grants + PDF generation |
| F | #5, #16 | High | Breakout rooms (LiveKit API) + cron scheduling |

---

## GROUP A — Frontend/Socket Only (zero DB changes)

---

### Feature #4 — Timezone-Aware Scheduling + Add to Calendar

**What changes:**
- User-web workshop page: replace raw date display with local timezone
- Add "Add to Calendar" link (Google Calendar URL + ICS download)

**Files to touch:**
- `tbt-user-web/app/(platform)/workshop/[slug]/page.tsx` — `MainAreaCountdown` and `LiveCallChallengeView` components
- Nothing else

**Implementation detail:**

Replace the existing `dateLabel` computation:
```typescript
// BEFORE
const dateLabel = new Date(item.scheduledAt)
  .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  .toUpperCase();

// AFTER — auto-detects browser timezone
const dateLabel = new Date(item.scheduledAt)
  .toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  })
  .toUpperCase();
```

Google Calendar URL builder (pure function, no deps):
```typescript
function googleCalendarUrl(title: string, scheduledAt: string, durationMins = 60): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMins * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}`;
}
```

ICS download (client-side blob, no backend needed):
```typescript
function downloadIcs(title: string, scheduledAt: string, durationMins = 60) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMins * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "session.ics"; a.click();
  URL.revokeObjectURL(url);
}
```

**UI placement:** below the date label, two small ghost links — "📅 Google Calendar" and "⬇ Download .ics". Only shown when `status !== 'past'`.

**Admin panel:** No changes needed.

**Backend:** No changes.

---

### Feature #6 — Hand Raise Queue

**What changes:**
- Socket events only — fully ephemeral, no DB
- User-web: raise/lower hand button during live call
- Admin panel (`AdminLiveCall.tsx`): hand raise queue panel

**Socket events (new — add to existing socket handler):**

| Event | Direction | Payload |
|-------|-----------|---------|
| `live_call:hand_raised` | member → room | `{ liveCallId, memberId, memberName, identity }` |
| `live_call:hand_lowered` | member → room | `{ liveCallId, identity }` |
| `live_call:hand_cleared` | admin → room | `{ identity }` (admin clears after acknowledging) |

**Backend socket handler** (`backend/src/plugins/socket.ts` or wherever socket events are handled):
```typescript
socket.on('live_call:hand_raised', (data) => {
  io.to(`live:${data.liveCallId}`).emit('live_call:hand_raised', data);
});
socket.on('live_call:hand_lowered', (data) => {
  io.to(`live:${data.liveCallId}`).emit('live_call:hand_lowered', data);
});
socket.on('live_call:hand_cleared', (data) => {
  io.to(`live:${data.liveCallId}`).emit('live_call:hand_cleared', data);
});
```

**User-web** (`WorkshopLiveCall.tsx`):
- Add a "✋ Raise Hand" toggle button to the top bar (beside LIVE/REC badges)
- On click: emit `live_call:hand_raised` via socket; button changes to "✋ Lower Hand"
- On `live_call:hand_cleared` for own identity: reset button state

**Admin panel** (`AdminLiveCall.tsx`):
- Add "Hands" tab alongside Participants / Chat / Polls
- Listen for `live_call:hand_raised` and `live_call:hand_lowered` events
- Maintain a local array `raisedHands: { identity, memberName, raisedAt }[]` sorted by time
- Each entry shows member name + time raised + "Clear" button (emits `live_call:hand_cleared`)

**No DB, no migration, no new routes.**

---

### Feature #8 — Live Emoji Reactions

**What changes:**
- Socket events only — fully ephemeral, no DB
- User-web: emoji reaction picker during live call
- Component `EmojiReactionOverlay.tsx` already exists — extend it

**Socket event (new):**

| Event | Direction | Payload |
|-------|-----------|---------|
| `live_call:reaction` | member → room | `{ liveCallId, emoji, identity }` |

**Backend socket handler:**
```typescript
socket.on('live_call:reaction', (data) => {
  io.to(`live:${data.liveCallId}`).emit('live_call:reaction', data);
});
```

**User-web** (`WorkshopLiveCall.tsx`):
- The `EmojiReactionOverlay` component already exists. Wire it to emit `live_call:reaction` on click
- Listen for incoming `live_call:reaction` events → pass to overlay to animate

Supported emojis (fixed set, no user input): `["❤️", "👏", "😂", "🔥", "👍", "🎉"]`

Each reaction: appears at a random horizontal position, floats up over 2s, fades out. Max 20 concurrent animations (oldest removed if exceeded).

**Admin panel:** Reactions visible in AdminLiveCall too (same socket listener).

**No DB, no migration, no new routes.**

---

## GROUP B — Wire Existing Infrastructure

---

### Feature #10 — AI Summary & Transcript (Auto-fill existing fields)

**What changes:**
- `aiSummary` and `aiTranscript` already exist on `LiveCall` — just never populated
- Wire the `egress_ended` LiveKit webhook → call LLM → store

**Backend only** (`backend/src/modules/pub/controller.ts` — `livekitWebhookHandler`):

In the existing `egress_ended` block, after storing `recordingUrl`, add:
```typescript
// After recordingUrl is stored:
if (env.ANTHROPIC_API_KEY && liveCallId) {
  // Queue async job — do NOT await in webhook handler
  void generateLiveCallSummary(req.server.prisma, liveCallId);
}
```

New helper function (same file or `backend/src/lib/ai.ts`):
```typescript
async function generateLiveCallSummary(prisma: PrismaClient, liveCallId: string) {
  const lc = await prisma.liveCall.findUnique({
    where: { id: liveCallId },
    include: { attendance: true, polls: { include: { options: { include: { votes: true } } } } }
  });
  if (!lc) return;

  const attendanceCount = lc.attendance.length;
  const avgDuration = lc.attendance.reduce((a, r) => a + (r.durationSec ?? 0), 0) / (attendanceCount || 1);
  const pollSummary = lc.polls.map(p => {
    const winner = p.options.sort((a, b) => b.votes.length - a.votes.length)[0];
    return `Poll: "${p.question}" — top answer: "${winner?.optionText}" (${winner?.votes.length} votes)`;
  }).join('\n');

  const prompt = `Summarize this live session in 3-5 bullet points for members who missed it.
Title: ${lc.title}
Attendees: ${attendanceCount}, avg stay: ${Math.round(avgDuration / 60)} min
${pollSummary}
Transcript: [not yet available — summarize from metadata only]`;

  // Use Claude API (or whichever LLM is configured)
  const summary = await callLlm(prompt); // implement with @anthropic-ai/sdk
  await prisma.liveCall.update({ where: { id: liveCallId }, data: { aiSummary: summary } });
}
```

**New env var required:** `ANTHROPIC_API_KEY` (add to `env.ts` as optional string)

**Admin panel** (`workshops/[id]/page.tsx` — live calls tab):
- In the live call card, show `lc.aiSummary` as a collapsible section when present
- "Regenerate Summary" button → calls new endpoint `POST /api/workshops/live-calls/:lcid/summarize`

**New admin-only endpoint:**
```
POST /api/workshops/live-calls/:lcid/summarize
→ triggers generateLiveCallSummary() → returns { success: true }
```

**User-web** (`workshop/[slug]/page.tsx`):
- In the "past" state of live call cards, show `challenge.aiSummary` if present
- Collapsible "AI Summary" section with italic body text

**No schema migration needed.**

---

### Feature #15 — Live Call Analytics Dashboard

**What changes:**
- New admin endpoint that aggregates existing data
- New UI section in the live calls tab

**New backend endpoint:**
```
GET /api/workshops/live-calls/:lcid/analytics
→ admin-authenticated
```

Handler reads existing tables — no new schema:
```typescript
export async function getLiveCallAnalyticsHandler(req, reply) {
  const { lcid } = req.params as any;
  const [lc, attendance, polls] = await Promise.all([
    req.server.prisma.liveCall.findUnique({ where: { id: lcid } }),
    req.server.prisma.liveCallAttendance.findMany({ where: { liveCallId: lcid } }),
    req.server.prisma.liveCallPoll.findMany({
      where: { liveCallId: lcid },
      include: { options: { include: { votes: true } } }
    }),
  ]);

  const durations = attendance.map(a => a.durationSec ?? 0).filter(d => d > 0);
  const totalDuration = lc?.endedAt && lc?.startedAt
    ? Math.round((new Date(lc.endedAt).getTime() - new Date(lc.startedAt).getTime()) / 1000)
    : null;

  return reply.send({ success: true, data: {
    totalAttendees: attendance.length,
    avgStaySeconds: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    maxConcurrent: null, // future — requires time-series data
    sessionDurationSeconds: totalDuration,
    pollParticipation: polls.length
      ? Math.round(polls.reduce((sum, p) => sum + p.options.reduce((s, o) => s + o.votes.length, 0), 0) / polls.length)
      : 0,
    polls: polls.map(p => ({
      question: p.question,
      totalVotes: p.options.reduce((s, o) => s + o.votes.length, 0),
      options: p.options.map(o => ({ text: o.optionText, votes: o.votes.length }))
        .sort((a, b) => b.votes - a.votes),
    })),
  }, error: null });
}
```

**Admin panel** — new "Analytics" section inside the existing live call card (expandable):
- Total attendees
- Average stay duration (formatted as "X min Y sec")
- Session duration
- Poll participation count
- Per-poll vote breakdown bar chart (CSS-only, no chart library)

**No schema changes. No user-web changes.**

---

## GROUP C — New Standalone Models

---

### Feature #2 — Member RSVP / Attendance Confirmation

**New schema model:**
```prisma
model LiveCallRsvp {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId String    @map("live_call_id") @db.Uuid
  memberId   String    @map("member_id") @db.Uuid
  status     String    @default("confirmed")  // "confirmed" | "declined"
  confirmedAt DateTime @default(now()) @map("confirmed_at") @db.Timestamptz(6)
  liveCall   LiveCall  @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  member     Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([liveCallId, memberId])
  @@map("live_call_rsvps")
}
```
Add `rsvps LiveCallRsvp[]` relation to `LiveCall` model.
Add `liveCallRsvps LiveCallRsvp[]` relation to `Member` model.

**New user-web endpoints** (add to `user/routes.ts`):
```
POST /api/user/workshop/live-calls/:id/rsvp    body: { status: "confirmed" | "declined" }
GET  /api/user/workshop/live-calls/:id/rsvp    returns own RSVP status
```

**New admin endpoint** (add to `workshops/routes.ts`):
```
GET /api/workshops/live-calls/:lcid/rsvps      returns list with member names + count
```

**Backend handlers:**
- `upsertRsvpHandler` — upsert on `[liveCallId, memberId]` unique key
- `getRsvpStatusHandler` — find by liveCallId + memberId from token
- `listRsvpsHandler` — admin only, returns `{ confirmed: N, declined: N, members: [...] }`

**User-web** (`workshop/[slug]/page.tsx`):
- In the countdown card (before the call is unlocked), show "Will you attend?" with "✓ Yes, I'll be there" and "✗ Can't make it" buttons
- After RSVP, show "You're confirmed ✓" or "You declined" with option to change
- Shown only when `status === 'upcoming'` and `diff > 0`

**Admin panel** (`workshops/[id]/page.tsx` — live call card):
- Show RSVP count badge on each live call card: "12 confirmed · 3 declined"
- Clicking it opens a modal with the full member list

**Reminder integration:** `sendRemindersHandler` already exists — extend it to only send to members with `status === 'confirmed'` RSVP when RSVP data is available.

**Socket event on RSVP:** Emit `admin:live_rsvp` to admin room with `{ liveCallId, count }` so the badge updates live.

---

### Feature #3 — Pre-Session Resource Pack

**New schema model:**
```prisma
model LiveCallResource {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId String   @map("live_call_id") @db.Uuid
  title      String
  url        String
  type       String   @default("link")  // "link" | "pdf" | "video"
  order      Int      @default(0)
  liveCall   LiveCall @relation(fields: [liveCallId], references: [id], onDelete: Cascade)

  @@map("live_call_resources")
}
```
Add `resources LiveCallResource[]` relation to `LiveCall` model.

**New admin endpoints** (add to `workshops/routes.ts`):
```
GET    /api/workshops/live-calls/:lcid/resources
POST   /api/workshops/live-calls/:lcid/resources      body: { title, url, type }
PUT    /api/workshops/live-calls/:lcid/resources/:rid  body: { title?, url?, type?, order? }
DELETE /api/workshops/live-calls/:lcid/resources/:rid
PUT    /api/workshops/live-calls/:lcid/resources/reorder  body: { ids: string[] }
```

**New user-web endpoint** (add to `user/routes.ts`):
```
GET /api/user/workshop/live-calls/:id/resources
→ returns resources only if within unlock window OR call is past
```

**Admin panel** (`workshops/[id]/page.tsx` — inside live call form):
- New "Pre-Session Resources" section at the bottom of the live call form
- Add/edit/delete/reorder resource items (title + URL + type selector)
- Type icons: 📄 PDF, 🔗 Link, 🎬 Video
- Uses existing DnD reorder pattern from CLAUDE.md

**User-web** (`workshop/[slug]/page.tsx`):
- In the countdown card, below the stay-tuned message, show a "Prepare for this session" section
- List resources as clickable cards (icon + title + external link)
- Only shown when resources exist and `status !== 'past'`

---

### Feature #7 — Live Call Q&A Moderation Queue

**Note:** The existing `WorkshopQA` is workshop-wide. This is a separate, live-call-specific moderated Q&A.

**New schema model:**
```prisma
model LiveCallQuestion {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId  String    @map("live_call_id") @db.Uuid
  memberId    String    @map("member_id") @db.Uuid
  question    String
  isAnswered  Boolean   @default(false) @map("is_answered")
  answeredAt  DateTime? @map("answered_at") @db.Timestamptz(6)
  isHidden    Boolean   @default(false) @map("is_hidden")  // admin can hide spam
  submittedAt DateTime  @default(now()) @map("submitted_at") @db.Timestamptz(6)
  liveCall    LiveCall  @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  member      Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@map("live_call_questions")
}
```
Add `questions LiveCallQuestion[]` to `LiveCall`.
Add `liveCallQuestions LiveCallQuestion[]` to `Member`.

**New user-web endpoints:**
```
POST /api/user/workshop/live-calls/:id/questions    body: { question: string }
GET  /api/user/workshop/live-calls/:id/questions    returns non-hidden questions
```

**New admin endpoints:**
```
GET  /api/workshops/live-calls/:lcid/questions
PUT  /api/workshops/live-calls/:lcid/questions/:qid   body: { isAnswered?, isHidden? }
```

**Socket events:**
| Event | Direction | Payload |
|-------|-----------|---------|
| `live_call:question_new` | backend → room | `{ liveCallId, questionId, question, memberName }` |
| `live_call:question_answered` | backend → room | `{ questionId }` |

**User-web** (`WorkshopLiveCall.tsx`):
- New "Q&A" tab in the side panel (alongside Chat / Participants / Polls)
- Text input + Submit button to submit a question
- List of all non-hidden questions showing answered/pending state
- Members can see all questions but cannot answer

**Admin panel** (`AdminLiveCall.tsx`):
- New "Q&A" tab in the admin side panel
- Questions listed with: member name · question text · "Mark Answered" button · "Hide" button
- Unanswered questions highlighted; answered ones dimmed
- Real-time updates via `live_call:question_new` socket event

---

### Feature #11 — Session Replay Chapter Markers

**New schema model:**
```prisma
model RecordingChapter {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId      String   @map("live_call_id") @db.Uuid
  label           String
  timestampSeconds Int     @map("timestamp_seconds")
  order           Int      @default(0)
  liveCall        LiveCall @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("recording_chapters")
}
```
Add `chapters RecordingChapter[]` to `LiveCall`.

**New admin endpoints:**
```
GET    /api/workshops/live-calls/:lcid/chapters
POST   /api/workshops/live-calls/:lcid/chapters    body: { label, timestampSeconds }
DELETE /api/workshops/live-calls/:lcid/chapters/:chapterId
PUT    /api/workshops/live-calls/:lcid/chapters/reorder   body: { ids: string[] }
```

**Admin panel** (`workshops/[id]/page.tsx` — live call card, only when `recordingUrl` is set):
- "Add Chapter Marker" form: label text + timestamp input (MM:SS format)
- List of existing markers with delete button
- Existing DnD reorder pattern

**New user-web endpoint:**
```
GET /api/user/workshop/live-calls/:id/chapters
→ only returns chapters when liveCall.recordingUrl is set
```

**User-web** (`workshop/[slug]/page.tsx` — past state of live call card):
- When `recordingUrl` is present and chapters exist, render a chapter list
- Each chapter: timestamp label + title as a link with `?t=123` query param
- If the recording is embedded (iframe/video), seek to `t` on click
- If it's an external link (Bunny/Zoom recording), open with timestamp appended where supported

---

### Feature #14 — Post-Session Feedback & Rating

**New schema model:**
```prisma
model LiveCallFeedback {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId  String   @map("live_call_id") @db.Uuid
  memberId    String   @map("member_id") @db.Uuid
  rating      Int      // 1–5
  comment     String?
  submittedAt DateTime @default(now()) @map("submitted_at") @db.Timestamptz(6)
  liveCall    LiveCall @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  member      Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([liveCallId, memberId])
  @@map("live_call_feedback")
}
```
Add `feedback LiveCallFeedback[]` to `LiveCall`.
Add `liveCallFeedback LiveCallFeedback[]` to `Member`.

**New user-web endpoint:**
```
POST /api/user/workshop/live-calls/:id/feedback    body: { rating: 1-5, comment?: string }
GET  /api/user/workshop/live-calls/:id/feedback    returns own feedback (to avoid double-submit UI)
```

**New admin endpoint:**
```
GET /api/workshops/live-calls/:lcid/feedback
→ returns { avgRating, totalResponses, breakdown: {1:N, 2:N, ...}, comments: [...] }
```

**Socket trigger:** When admin clicks "End for Everyone" → backend emits `live_call:ended` with `{ liveCallId }` to enrolled members. User-web already handles `live:ended` — extend this to also trigger the feedback prompt.

**User-web** (`WorkshopLiveCall.tsx`):
- When the session ends (`live:ended` received or admin disconnects), instead of showing plain "Meeting ended by host", show a feedback overlay:
  - "How was the session?" heading
  - 5-star rating (tap to select)
  - Optional comment textarea (max 300 chars)
  - "Submit Feedback" button + "Skip" link
- Only shown once — after submit or skip, store in `localStorage` key `feedback_${liveCallId}` to prevent re-prompt
- Skip the prompt if feedback already exists (check `GET /feedback` on mount)

**Admin panel** (`workshops/[id]/page.tsx` — live call card):
- Show avg rating as stars (e.g. "★ 4.2 · 18 responses") on each past live call card
- Clicking opens a modal with the full breakdown + comment list

---

## GROUP D — FK Additions to LiveCall

> These add nullable FK columns to the existing `LiveCall` table. Safe as long as the new columns have no `@default` that would break existing rows. All new fields are `String?` (nullable).

---

### Feature #1 — Hard Prerequisite Gating (Challenge Must Be Completed)

**Schema change** (add to `LiveCall` model):
```prisma
prerequisiteChallengeId  String?  @map("prerequisite_challenge_id") @db.Uuid
prerequisiteChallenge    Challenge? @relation("LiveCallPrereq", fields: [prerequisiteChallengeId], references: [id], onDelete: SetNull)
```
Add to `Challenge` model:
```prisma
gatedLiveCalls  LiveCall[] @relation("LiveCallPrereq")
```

**Backend change** — `joinLiveCallHandler` in `user/controller.ts`:

After the existing passcode check, add:
```typescript
if (lc.prerequisiteChallengeId) {
  const progress = await prisma.challengeProgress.findFirst({
    where: { challengeId: lc.prerequisiteChallengeId, memberId: member.id, isCompleted: true }
  });
  if (!progress) {
    return reply.status(403).send({
      success: false,
      error: { message: "Complete the prerequisite challenge before joining this session." }
    });
  }
}
```

**Admin panel** (`workshops/[id]/page.tsx` — live call form):
- New dropdown in the form: "Hard Prerequisite (optional)" — lists all challenges in this workshop
- This replaces the existing `prerequisiteNote` free-text for cases where hard gating is desired
- Both fields co-exist: `prerequisiteNote` is still shown as display text; `prerequisiteChallengeId` enforces the gate in the backend

**User-web** (`workshop/[slug]/page.tsx`):
- When join fails with "Complete the prerequisite challenge" message, show `joinError` as already implemented
- No extra UI needed — the existing `joinError` display handles it

---

### Feature #12 — Post-Session Challenge Auto-Unlock

**Schema change** (add to `LiveCall` model):
```prisma
postSessionUnlockChallengeId  String?   @map("post_session_unlock_challenge_id") @db.Uuid
postSessionUnlockChallenge    Challenge? @relation("LiveCallUnlock", fields: [postSessionUnlockChallengeId], references: [id], onDelete: SetNull)
```
Add to `Challenge` model:
```prisma
unlockedByLiveCalls  LiveCall[] @relation("LiveCallUnlock")
```

**Backend change** — `endLiveCallHandler` in `workshops/controller.ts`:

After stamping `endedAt` and deleting the LiveKit room, add:
```typescript
if (liveCall.postSessionUnlockChallengeId) {
  // Find all enrolled members and create/update their ChallengeProgress
  const enrollments = await prisma.workshopEnrollment.findMany({
    where: { workshopId: liveCall.workshopId, status: 'active' }
  });
  await Promise.allSettled(enrollments.map(e =>
    prisma.challengeProgress.upsert({
      where: { challengeId_memberId: {
        challengeId: liveCall.postSessionUnlockChallengeId!,
        memberId: e.memberId
      }},
      create: {
        challengeId: liveCall.postSessionUnlockChallengeId!,
        memberId: e.memberId,
        status: 'not_started',
        isUnlocked: true
      },
      update: { isUnlocked: true }
    })
  ));
}
```

> ⚠️ Verify the exact shape of `ChallengeProgress` in your schema before implementing — adjust field names accordingly.

**Admin panel** (`workshops/[id]/page.tsx` — live call form):
- New dropdown: "Auto-unlock after session (optional)" — lists challenges in this workshop
- Helper text: "This challenge will be unlocked for all enrolled members when the session ends"

**User-web:** No changes — the unlocked challenge will appear in the flow naturally on the next flow fetch (existing `isUnlocked` logic handles it).

---

## GROUP E — LiveKit Grants + PDF

---

### Feature #9 — Co-Host / Presenter Role

**What changes:**
- New admin endpoint to generate a co-host token for a member
- In `AdminLiveCall.tsx`: promote-to-presenter button in the participants list
- No DB changes — fully runtime/token-based

**New admin endpoint:**
```
POST /api/workshops/live-calls/:lcid/co-host/:memberId
→ generates a LiveKit token with canPublish: true, canPublishData: true, roomAdmin: false
→ emits socket event to that member's user room with the new token
```

Handler:
```typescript
export async function promoteCoHostHandler(req, reply) {
  const { lcid, memberId } = req.params as any;
  const lc = await req.server.prisma.liveCall.findUnique({ where: { id: lcid } });
  if (!lc) return reply.status(404).send({ success: false });

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId } });
  const { AccessToken } = await import('livekit-server-sdk');
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: memberId,
    name: [member?.firstName, member?.lastName].filter(Boolean).join(' ') || memberId,
    ttl: '4h',
  });
  token.addGrant({
    roomJoin: true,
    room: `workshop-live-${lcid}`,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  const jwt = await token.toJwt();

  // Notify the member via socket with their new token
  req.server.io.to(`user:${memberId}`).emit('live_call:promoted_co_host', {
    liveCallId: lcid, token: jwt, wsUrl: env.LIVEKIT_WS_URL
  });

  return reply.send({ success: true, data: null, error: null });
}
```

**User-web** (`WorkshopLiveCall.tsx`):
- Listen for `live_call:promoted_co_host` socket event
- On receive: disconnect and reconnect with the new token (LiveKit supports token refresh)
- Show a brief "You've been promoted to presenter" toast

**Admin panel** (`AdminLiveCall.tsx` — participants panel):
- Add "Promote to Presenter" button next to each non-host participant
- Calls `POST /api/workshops/live-calls/:lcid/co-host/:memberId`
- Disable the button after clicking (can't un-promote in this version)

---

### Feature #13 — Attendance Certificate

**New schema model:**
```prisma
model LiveCallCertificate {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId       String   @map("live_call_id") @db.Uuid
  memberId         String   @map("member_id") @db.Uuid
  attendancePercent Int     @map("attendance_percent")
  certificateUrl   String   @map("certificate_url")
  issuedAt         DateTime @default(now()) @map("issued_at") @db.Timestamptz(6)
  liveCall         LiveCall @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  member           Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([liveCallId, memberId])
  @@map("live_call_certificates")
}
```
Add `certificates LiveCallCertificate[]` to `LiveCall` and `Member`.

**New admin endpoint:**
```
POST /api/workshops/live-calls/:lcid/certificates/generate
body: { minAttendancePercent: number }   // e.g. 70
→ generates certificates for all members who met the threshold
```

**PDF generation options (pick one):**
- `@react-pdf/renderer` — generates PDF from React components server-side
- `puppeteer` — render an HTML template to PDF (heavier, needs headless Chrome)
- Recommendation: `@react-pdf/renderer` — no browser dependency, works in Node.js

**Certificate content:** Member name, session title, date, attendance percentage, TBT logo, facilitator name.

**Storage:** Generate PDF → upload to R2 via existing `putObject` pattern → store `certificateUrl`.

**New user-web endpoint:**
```
GET /api/user/workshop/live-calls/:id/certificate
→ returns { certificateUrl } or 404
```

**User-web** (`workshop/[slug]/page.tsx` — past state):
- "Download Certificate" button shown when `certificateUrl` is returned
- Opens in new tab (PDF download)

**Admin panel** (`workshops/[id]/page.tsx` — live call card, past sessions only):
- "Generate Certificates" button with min-attendance input (default 70%)
- Shows count of certificates generated after completion

---

## GROUP F — Complex Features

---

### Feature #5 — Breakout Rooms

**New schema model:**
```prisma
model BreakoutRoom {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  liveCallId String   @map("live_call_id") @db.Uuid
  name       String
  roomName   String   @map("room_name")  // LiveKit room name: "breakout-{liveCallId}-{n}"
  isActive   Boolean  @default(true) @map("is_active")
  liveCall   LiveCall @relation(fields: [liveCallId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("breakout_rooms")
}
```

**New admin endpoints:**
```
POST   /api/workshops/live-calls/:lcid/breakout-rooms           body: { count: number, names?: string[] }
POST   /api/workshops/live-calls/:lcid/breakout-rooms/:brid/assign    body: { identity: string }
POST   /api/workshops/live-calls/:lcid/breakout-rooms/recall-all      → end all breakout rooms, recall everyone
DELETE /api/workshops/live-calls/:lcid/breakout-rooms/:brid
```

**Backend flow:**
1. `createBreakoutRoomsHandler` — creates N LiveKit rooms named `breakout-{lcid}-1`, etc. via `RoomServiceClient.createRoom()`
2. `assignToBreakoutHandler` — generates a new token for the participant for the breakout room → emits `live_call:breakout_assigned` socket event to `user:{memberId}` with new token + wsUrl
3. `recallAllHandler` — emits `live_call:breakout_recall` to all in the live call room → deletes breakout rooms via LiveKit API

**User-web** (`WorkshopLiveCall.tsx`):
- Listen for `live_call:breakout_assigned` → show "You've been moved to a breakout room" banner → reconnect with new token
- Listen for `live_call:breakout_recall` → reconnect with original main room token (store original token on mount)

**Admin panel** (`AdminLiveCall.tsx`):
- New "Breakout" tab in admin panel
- "Create Breakout Rooms" button with count selector (2–8)
- Per-room: list of assigned participants + drag-from-participants to assign
- "Recall All" button

> ⚠️ LiveKit breakout rooms are just separate rooms — participants need a new token for each room. Store the original main-room token for recall.

---

### Feature #16 — Recurring Live Call Templates

**New schema model:**
```prisma
model LiveCallTemplate {
  id                          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workshopId                  String   @map("workshop_id") @db.Uuid
  title                       String
  label                       String   @default("LIVE CALL:")
  labelColor                  String   @default("#ff3d8b") @map("label_color")
  recurrence                  String   // "weekly" | "biweekly" | "monthly"
  dayOfWeek                   Int      // 0=Sun … 6=Sat
  timeHour                    Int      @map("time_hour")    // 0–23 UTC
  timeMinute                  Int      @map("time_minute")  // 0–59
  durationMinutes             Int      @default(60) @map("duration_minutes")
  liveUrlUnlocksMinutesBefore Int      @default(30) @map("live_url_unlocks_minutes_before")
  facilitatorName             String?  @map("facilitator_name")
  stayTunedMessage            String   @default("Stay tuned — the link will unlock before the session begins") @map("stay_tuned_message")
  stayTunedColor              String   @default("#00c4cc") @map("stay_tuned_color")
  isActive                    Boolean  @default(true) @map("is_active")
  lastGeneratedAt             DateTime? @map("last_generated_at") @db.Timestamptz(6)
  weeksAhead                  Int      @default(4) @map("weeks_ahead")  // how far ahead to generate
  workshop                    Workshop @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  createdAt                   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("live_call_templates")
}
```
Add `liveCallTemplates LiveCallTemplate[]` to `Workshop`.

**New admin endpoints:**
```
GET    /api/workshops/:id/live-call-templates
POST   /api/workshops/:id/live-call-templates    body: { template fields }
PUT    /api/workshops/live-call-templates/:tid
DELETE /api/workshops/live-call-templates/:tid
POST   /api/workshops/live-call-templates/:tid/generate-now  → manually trigger generation
```

**Cron job** (using existing BullMQ + Upstash Redis):
- Job: `generateRecurringLiveCalls` — runs daily (00:00 UTC)
- For each active template: check `lastGeneratedAt` and `weeksAhead` → create `LiveCall` records for any missing future sessions
- Idempotent: check if a live call with matching `scheduledAt` + `workshopId` + `title` already exists before creating

**Admin panel** (`workshops/[id]/page.tsx` — inside Live Calls tab):
- New "Templates" sub-section above the live call list
- Add/edit/delete templates with: recurrence, day-of-week, time (with timezone selector), weeks-ahead count
- "Generate Now" button to preview what will be created

---

## Implementation Notes — Applies to All Features

### DB push workflow (project uses `prisma db push`, not migrations)
```bash
# After each schema change:
cd tbt-admin/backend
npx prisma db push
npm run prepare   # regenerates Prisma client
```

### New hooks pattern (admin panel)
Add to `admin-panel/lib/hooks/useTbt.ts` (bottom of file):
```typescript
export const useLiveCallRsvps = (lcid: string) =>
  useQuery({ queryKey: ['live-call-rsvps', lcid], queryFn: () => apiClient.get(`/api/workshops/live-calls/${lcid}/rsvps`).then(r => r.data) });

// ...one hook per new endpoint
```

### New hooks pattern (user-web)
Add to `tbt-user-web/lib/hooks/useConfig.ts` (bottom of file):
```typescript
export const useRsvpLiveCall = () =>
  useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) =>
    apiClient.post(`/api/user/workshop/live-calls/${id}/rsvp`, { status }).then(r => r.data)
  });
```

### Controller exports
Each new handler must be:
1. Exported from `controller.ts`
2. Imported in `routes.ts`
3. Registered on a route in `routes.ts`

### Socket rooms already available
- `live:{liveCallId}` — all members currently in the call
- `user:{memberId}` — direct to one member
- `admin` — all admin panel users

### Do NOT modify
- `WorkshopLiveCall.tsx` rendering logic for existing LiveKit session
- `AdminLiveCall.tsx` existing tab panels (only add new tabs alongside)
- `joinLiveCallHandler` other than the prerequisite gate addition
- `livekitWebhookHandler` other than the AI summary addition
- Any existing schema fields or their DB column names
- The `(auth)/`, `login/`, or `signup/` routes in user-web
