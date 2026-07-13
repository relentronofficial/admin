# TBT Mobile Parity Gap Audit

Comparison of `tbt_app` (Flutter) vs `tbt-user-web` (production: `https://app.tamilbusinesstribe.com/`).

Audit date: 2026-07-09. Accounts for work through Phase 5 + the recent OTP + error-mapper fixes.

Severity: **P0** = blocks a user flow · **P1** = feature missing · **P2** = polish / UX gap.
Effort: **S** = <2 h · **M** = half-day · **L** = day+.

---

## 1. Overall status

| Area | Screen coverage | Feature depth | Notes |
|------|-----------------|---------------|-------|
| Auth (login / OTP / signup / forgot) | ✅ | 90% | Just fixed OTP flow + error mapper. Missing polish only. |
| Dashboard | ✅ | 75% | Stats card count differs (3 vs 4); resume-to-player deep-link missing. |
| Learning / Courses / Course detail | ✅ | 95% | Cue quiz + reflection + practice arena + XP all wired in Phase 1. Level filter + pinned "Enrolled" row still missing on catalog. |
| Workshops / Workshop detail | ✅ | 90% | Episode player wired in Phase 5; certificate download wired in Phase 2. Search bar missing on list. |
| Player routes | ✅ | 100% | Both course + workshop episode players present. |
| TBT catalog (`/tbt`) | ✅ | 90% | Same core rendering. Suspense-style progressive load is web-only. |
| Batch program | ✅ | 60% | **P0 gaps**: no journal entry, no day notes/resource embed, no per-task deliverables/points/estimate, no text/URL proof types, no calendar 2-dot overlay, no streak indicator. |
| Events | ✅ | 80% | No search on list. No real-time attendee count. |
| Programs | ✅ | 30% | **P0**: no tabs, no curriculum lesson list, no leaderboard, no pricing/enrollment, no upsell/cross-sell. |
| Live sessions (`/live/:webinarId`) | ❌ | 0% | Standalone HLS webinar player screen does not exist. |
| Workshop live-call | ✅ | 80% | Phase 4 wired resources / Q&A / polls / feedback / cert. No pre-session countdown, no RSVP toggle, no add-to-calendar. |
| Notifications | ✅ | 90% | Dismiss + clear-read done. All/Unread filter tabs missing. |
| Messages | ✅ | 60% | **P0**: no socket integration = no real-time messages or typing indicator. No archive button on conversation tile. No backwards message pagination. |
| Profile | ✅ | 55% | **P0**: only name is editable; web edits firstName/lastName/phone/dob/city/state/businessName. No stats strip, no subscription card, no tiers. |
| Products | ✅ | 90% | Full 2 tabs (All / My Inquiries). Secondary CTA `launchUrl` not wired. |
| Resources | ✅ | 60% | **P0**: no search. No grid view. No pagination UI. |
| Search | ✅ | 85% | Result cards are icon-only (no thumbnail); web has full cards with images. |
| History | ✅ | 70% | Flat list vs web's grouped-by-content structure. |

Rough overall parity: **~75%**. Down from the earlier "~50%" estimate — Phases 1-5 closed the biggest holes. What remains is 4 real P0 clusters + a long tail of polish.

---

## 2. P0 blockers (fix before shipping to real users)

### 2.1 Messages — no socket integration
Chat is REST-only. Sent messages don't push to the other party until they refetch. `chat:typing`, `chat:conversation_closed`, `chat:conversation_reopened` events aren't listened to. Web has all three.

- **What's missing:** `getSocket().on('chat:message', ...)` in `conversation_screen.dart` + typing debounce + closed/reopened UI states.
- **Effort:** M

### 2.2 Batch program — journal, day notes, proof types
The web batch-day page has three things Flutter doesn't:
- Journal entry (large textarea, auto-save on debounce).
- Day notes / day description (may embed a YouTube or Vimeo iframe).
- Per-task proof types beyond file upload: `text` proof (textarea) and `url` proof (URL input).

Right now a Flutter member on a text-proof day cannot submit anything.

- **Effort:** M (journal + notes: S. proof-type variants: M.)

### 2.3 Programs detail — no curriculum, no leaderboard, no enrollment
Programs detail on Flutter shows just an icon, name, and description. Web has a full-featured detail page with tabs (Curriculum / Leaderboard), lesson list, XP leaderboard, upsell/cross-sell, and an enrollment CTA that opens the payment URL.

- **Effort:** L (this is essentially a new screen)

### 2.4 Profile — only name is editable
Web edits: firstName, lastName, phone, dob, city, state, businessName. Flutter edits: name.

- **Effort:** S (form expansion), M (if we add a dob date picker and validation)

### 2.5 Resources — no search
Web's `/Resources` has a live search + view toggle + pagination. Flutter has none. On a real member's account with dozens of resources, browsing without search is unusable.

- **Effort:** M (search input + query param + pagination UI)

---

## 3. P1 missing features

### Dashboard
- Stats grid: web shows 4 cards (Courses enrolled, Completed, Streak, Upcoming). Flutter shows 3 pills. **S**
- "Continue watching" cards route to detail screen; web deep-links to the player at the exact `?lesson=<id>` position. **S**

### Courses catalog
- Level filter tabs (All / Beginner / Intermediate / Advanced). **S**
- "Enrolled" section pinned above "Available". **S**

### Workshops list
- Search bar (web doesn't have one either — flag: this is actually *no gap* on web currently; skip unless user requests).

### Workshop live-call (pre-session)
- Countdown (days / hrs / mins / secs). **S**
- RSVP toggle (Confirmed / Declined / Change). **M**
- Add to Google Calendar + `.ics` download. **S**
- Recording indicator (badge inside room). **S**

### Live sessions
- Standalone HLS webinar player at `/live/:webinarId`. **M** — build a webinar screen that either plays HLS (using `video_player` or `better_player_plus`) or shows a countdown.

### Notifications
- All / Unread filter tabs. **S**
- Video-type notification rendering (currently skipped). **M**

### Messages
- Archive button per conversation tile (server methods exist; just UI). **S**
- Backwards message pagination on scroll-to-top. **S**
- Auto-grow message input. **S**
- "Reply to reopen" hint when conversation is closed. **S**

### Profile
- Stats strip (Points, Streak, Health). **S** — new endpoint may be needed; may already be in `useMe`.
- Subscription card (plan + start + end + status). **S**
- Tiers section (locked / unlocked list). **M** — new endpoint likely.

### Resources
- Grid view toggle. **S**
- Pagination UI. **S**

### History
- Group episodes by parent content title (course / workshop). **M**
- Per-group progress summary + "Continue" / "Rewatch" button. **S**

### Events
- Search input. **S**
- Real-time attendee count. **S**

### Batch program (beyond §2.2)
- Calendar 2-dot visualization (attendance dot + task-status dot). **S**
- 7-day streak indicator. **S**
- Category badges on day tiles. **S**
- "Mark Present" attendance inline on day tile (not just day detail). **S**

---

## 4. P2 polish

- Login: glassmorphic card + background slideshow + gradient accent (web). Flutter has a plain dark screen. **M**
- Login: focused input glow. **S**
- Login: inline error banner (Flutter shows SnackBar). **S**
- OTP: pre-fill OTP if backend returns it (for dev/staging). **S**
- Session check on app start: skip login screen if already authenticated. **S**
- Products: 3-column grid on tablet + secondary CTAs must actually launch external URLs (currently no-op). **S**
- Products: category badge as image overlay (currently below thumbnail). **S**
- Search results: show thumbnails + description in tiles (currently icon + title only). **M**
- Resources: dedicated download button (currently whole tile is tap-to-download). **S**
- Dashboard: welcome greeting uses `uiStrings.dashboardWelcome`. **S**

---

## 5. Suggested implementation plan

Grouped by cohesive theme so each phase can be built + tested independently. Rough time budgets.

### Phase 6 — Messages real-time + Batch program editor completion (~3-4 h)
1. Wire socket to `conversation_screen.dart` (`chat:message`, `chat:typing`, `chat:conversation_closed`, `chat:conversation_reopened`).
2. Add typing indicator widget.
3. Add archive button to `_ConversationTile` in messages screen.
4. Add journal entry textarea + day notes / resource embed to `batch_day_screen.dart` (+ auto-save).
5. Add per-task text-proof + URL-proof input variants.

### Phase 7 — Programs detail overhaul + Profile expansion (~4-5 h)
1. New `_ProgramCurriculumTab` and `_ProgramLeaderboardTab` widgets.
2. Add pricing + enrollment CTA + payment URL launch.
3. Add upsell / cross-sell rows.
4. Expand profile edit form (firstName, lastName, phone, dob picker, city, state, businessName).
5. Add profile stats strip + subscription card + tiers section.

### Phase 8 — Resources + Notifications + History polish (~2-3 h)
1. Resources: search input + grid toggle + pagination.
2. Notifications: All / Unread filter tabs.
3. History: group by parent content title + per-group progress + continue button.

### Phase 9 — Live sessions + workshop-live pre-session (~3-4 h)
1. Standalone webinar screen at `/live/:webinarId` (HLS `<video>` via `video_player`).
2. Pre-session countdown widget for workshop live-calls.
3. RSVP toggle wired to `upsertRsvp` (already in service).
4. Add-to-calendar (.ics generation + share).

### Phase 10 — Auth polish + Dashboard + small P1s (~2-3 h)
1. Dashboard 4-card stats grid.
2. Continue-watching deep-link to player.
3. Login glass card + background slideshow + focus glow + inline error banner.
4. OTP pre-fill + session check on app start.
5. Courses level filter + enrolled section.
6. Products 3-col tablet grid + secondary CTA `launchUrl`.

---

## 6. Explicit non-gaps (skipped intentionally)

- **Public certificate verification (`/verify/course/:certId`)** — this is a web-only public-facing page for someone to verify another member's cert. Not needed on mobile.
- **Marketing landing pages** — `(marketing)` route group is public promo pages. Mobile has splash + login instead.
- **Clerk `(auth)/` route group** — used by the web `/sign-in`, `/sign-up` fallbacks. Flutter has its own login and doesn't need Clerk.
- **`/eiflix` legacy redirect** — served only by web `next.config.ts`.

---

## 7. Next step

Read this document, then tell me which phase to start with (or reprioritize, or add/remove items). I recommend **Phase 6** first because it fixes two P0s (messages real-time, batch task proofs) that make the current app feel broken for anyone actually using it day-to-day.
