# TBT Mobile Parity Verification (Playwright-driven)

Live audit against `https://app.tamilbusinesstribe.com/` (member `7010834661`, plan `starter`), 2026-07-11.

Legend: ✅ verified in Flutter · ⚠ partial · ❌ missing · N/A doesn't apply on mobile.

---

## Nav / chrome

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Top-nav links (Home/Workshops/Courses/Task/Products/Resources/Notifications/Messages/Profile) | 9 top-nav items | Bottom-tab + drawer equivalent | ✅ |
| Dark-mode toggle button in nav | present | driven by siteConfig (no user toggle) | ❌ P1 — add a manual toggle |
| Notification bell badge (count 19) | present | bottom-nav badge only | ⚠ acceptable — mobile equivalent exists |
| Account menu | present | profile screen | ✅ |

## Login / OTP

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Phone + password step | ✅ | ✅ | ✅ |
| OTP verify step (echoes resolved phone) | ✅ | ✅ (Phase 1 fix) | ✅ |
| Forgot password / reset | ✅ | ✅ | ✅ |
| Error messaging | inline banner | SnackBar with backend msg (Phase 5 fix) | ⚠ P2 — polish differs |

## Dashboard (`/dashboard`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Welcome greeting w/ first name | ✅ | ✅ | ✅ |
| 4-card stats grid (Enrolled/Completed/Streak/Upcoming) | ✅ | ✅ (Phase 10) | ✅ |
| Recently Watched row | ✅ | ✅ | ✅ |
| Card click deep-links to specific lesson via `?lesson=` | ✅ | ⚠ routes to course detail, not player | ⚠ P1 |

## Home / Catalog (`/tbt`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Hero carousel with prev/next + dots | ✅ | ✅ | ✅ |
| Continue Watching row | ✅ | ✅ | ✅ |
| Recently Watched w/ All/In Progress/Completed pill filters | ✅ | ❌ pills missing | ❌ P1 |
| Featured Series row (workshops) | ✅ | ✅ | ✅ |
| Continue Learning row (courses) | ✅ | ✅ | ✅ |
| Tier-locked sections w/ "Upgrade to unlock" overlay per item | ✅ | ❌ SubscriptionGate exists but no per-item lock overlay | ❌ P1 |

## Workshops list (`/workshops`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Card grid | ✅ | ✅ | ✅ |
| Enrolled badge | ✅ | ✅ | ✅ |
| Delivery mode chip (Online/Offline/Hybrid) | ✅ | ✅ | ✅ |
| Search UI | not present | not present | ✅ |

## Workshop detail (`/workshop/:slug`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Back button + title + Learning Progress % | ✅ | ✅ | ✅ |
| Live-call card w/ countdown | ✅ | ✅ (Phase 9) | ✅ |
| Google Calendar link on live-call card | ✅ | ❌ | ❌ **P0** |
| Download .ics on live-call card | ✅ | ❌ | ❌ **P0** |
| RSVP toggle (Confirmed / Change) | ✅ | ✅ (Phase 9) | ✅ |
| Learning Progress bar (0/5 Completed etc.) | ✅ | ✅ | ✅ |
| Certificate Progress section (Videos% + Challenges% + remaining) | ✅ | ❌ has cert button but no progress view | ❌ **P0** |
| Tabs: Challenges / Q&A / Assignment | ✅ | ⚠ Flutter has 5 tabs (extra Overview + Flow) | ⚠ acceptable — extra info, not missing |
| Challenge types: WATCH / QUIZ / WRITTEN / MATCH / FLASHCARD | ✅ 5 types | ❌ **only QUIZ implemented** | ❌ **P0 blocker** — 4 types unusable |
| Live-call flow item at bottom | ✅ | ✅ | ✅ |

## Courses (`/courses`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Search bar | ✅ | ✅ | ✅ |
| Level filter chips (All/Beginner/Intermediate/Advanced) | ✅ | ✅ (Phase 10) | ✅ |

## Learning (`/learning`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Enrolled courses list | ✅ | ✅ | ✅ |
| Badges link | ✅ | ✅ | ✅ |
| Course detail w/ lessons + player + quiz + reflection + practice + XP | ✅ | ✅ (Phases 1+5) | ✅ |

## Batch program (`/batch-program`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Header w/ program name + Request Break button | ✅ | ✅ | ✅ |
| "Today Day N" card | ✅ | ✅ | ✅ |
| Stats block + calendar + break list | ✅ | ✅ | ✅ |
| Certificate download when 100% approved | ✅ | ✅ (Phase 3) | ✅ |

## Batch day detail (`/batch-program/:day`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Day navigator (◀ 41/90 ▶) | ✅ | ✅ | ✅ |
| Attendance section + Mark Present | ✅ | ✅ | ✅ |
| Day description text | ✅ | ⚠ freezed model doesn't carry `notes` — needs raw JSON read | ⚠ P1 |
| Checklist w/ checkboxes | ✅ | ✅ | ✅ |
| Journal textarea | ✅ | ✅ (Phase 6) | ✅ |
| Save Draft + Submit for Review | ✅ | ✅ | ✅ |
| Task proof-type variants (text / URL / file) | ✅ | ⚠ file only — freezed model blocks the other two | ⚠ P0 for text/url days |

## Notifications (`/notifications`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Grouped by date | ✅ | ✅ | ✅ |
| All / Unread filter tabs | ✅ | ✅ (Phase 8) | ✅ |
| Mark all read | ✅ | ✅ | ✅ |
| Dismiss + Clear read | ✅ | ✅ (Phase 3) | ✅ |

## Messages (`/messages`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Conversation list | ✅ | ✅ | ✅ |
| New conversation | ✅ | ✅ (Phase 3) | ✅ |
| Real-time messages (socket) | ✅ | ✅ (Phase 6 typing + auto-scroll) | ✅ |
| Archive | ✅ | ✅ swipe-left (Phase 6) | ✅ |
| Typing indicator | ✅ | ✅ (Phase 6) | ✅ |

## Profile (`/profile`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Avatar upload | ✅ | ✅ | ✅ |
| Name / email / plan badge | ✅ | ✅ | ✅ |
| **Stats strip** (Points, Streak, Health%) | ✅ 3 stats prominent | ❌ | ❌ **P0** |
| Personal Details section w/ Edit | ✅ | ✅ (Phase 7 sheet: firstName/lastName/phone/dob/city/state/businessName) | ✅ |
| **Subscription section** (plan + start/end + status) | ✅ | ❌ | ❌ **P0** |
| **Tier Access section** (locked/unlocked list) | ✅ 3 tiers | ❌ | ❌ **P0** |
| Notification Preferences (Push/Email/SMS) | ✅ | ✅ (Phase 3) | ✅ |
| Active Devices w/ revoke | ✅ | ✅ (Phase 3) | ✅ |
| Sign Out | ✅ | ✅ | ✅ |

## Products (`/Products`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Page title + description | ✅ | ✅ | ✅ |
| Product grid | ✅ 1-3 cols | ✅ 2-3 cols (Phase 10) | ✅ |
| Inquiry modal | ✅ | ✅ | ✅ |

## Resources (`/Resources`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Search bar | ✅ | ✅ (Phase 8) | ✅ |
| List / Grid view toggle | ✅ | ✅ (Phase 8) | ✅ |
| Download action | ✅ | ✅ | ✅ |

## History (`/history`)

| Feature | Web | Flutter | Status |
|---|---|---|---|
| Group by parent title | ✅ | ✅ (Phase 8) | ✅ |
| Filter tabs (All/In Progress/Completed) | ✅ | ✅ | ✅ |

---

## Summary — real P0/P1 gaps to close this session

Grouped by impact:

### P0 blockers (features literally missing / non-functional)
1. **Challenge types WATCH / WRITTEN / MATCHING / FLASHCARD** — Flutter workshop challenges only handle `quiz`. Non-quiz challenges are unusable.
2. **Google Calendar link + .ics download** on workshop live-call card.
3. **Certificate Progress section** on workshop detail (Videos% / Challenges% / remaining count).
4. **Profile stats strip** — Points / Streak / Health.
5. **Profile Subscription card** — plan + dates + status.
6. **Profile Tier Access section** — 3 tiers with locked/unlocked state.

### P1 (visible missing UI)
7. Dark-mode toggle in nav (or profile).
8. Home `/tbt` — Recently Watched All/In Progress/Completed pill filter.
9. Home `/tbt` — per-item tier-locked overlay ("Upgrade to unlock").
10. Dashboard "Continue Watching" — deep-link to specific lesson via `?lesson=`.
11. Batch day description text (needs raw JSON read).
12. Batch task proof-type variants (text / URL).

Implementation begins next.
