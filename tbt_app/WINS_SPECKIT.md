# TBT WINS Screen Speckit — Ported from Co-worker's App

## 1. Overview

**WINS** is the leaderboard + gamification feature in the TBT platform, enabling members to compete, earn points, complete tasks, and climb through levels. The screen displays:
- **Leaderboard**: ranked list of all members by total TBT points
- **Task Path**: sequential 90-day educational tasks with unlock progression
- **Levels**: tier system (Starter → Legend) unlocked by point thresholds
- **Daily Streak**: consecutive days of point-earning activity
- **Activity Log**: record of all point-earning events

In the co-worker's app, WINS lives in _LeaderboardTab (inside PostPopupScreen, triggered from a bottom-nav or menu). In the current TBT app, it's split into two screens:
- **/wins** — full leaderboard via WinsScreen
- **/tbt-points** — dashboard with hero card + task path + leaderboard preview via TbtPointsScreen

---

## 2. Screen Structure — Co-worker's _LeaderboardTab

### Complete Widget Tree (Co-worker's app, main.dart lines 4514–5037)

\\\
_LeaderboardTab (StatefulWidget)
├─ _LeaderboardTabState (with TickerProviderStateMixin)
│  ├─ AnimationController (_headerCtrl, 500ms fade + slide)
│  ├─ List<AnimationController> (_podiumCtrls[3], staggered scale + fade, 600ms)
│  ├─ AnimationController (_crownCtrl, looping pulse 900ms)
│  ├─ List<AnimationController> (_listCtrls[4], stagger fade + slide 420ms each)
│  │
│  └─ build() → SingleChildScrollView + Column
│     ├─ FadeTransition + SlideTransition (Header: title + icon)
│     │  └─ "TBT LEADERBOARD" (ShaderMask gradient red #E50914 → #FF6B35)
│     │     + trophy icon #FFD700
│     │     + subtitle "Top performers of Tamil Business Tribe this week"
│     │
│     ├─ Row [3 columns] — Animated Podium (top 3 members)
│     │  ├─ FadeTransition + ScaleTransition (elastic scale from 0 to 1)
│     │  │
│     │  └─ For each rank (2, 1, 3 → reordered to center-first rise):
│     │     ├─ ScaleTransition (crown pulse 1.0 → 1.25 for rank 1)
│     │     ├─ Avatar (72×72 for rank 1, 56×56 for rank 2/3)
│     │     │  └─ Circle with podium-color border + glow shadow
│     │     ├─ Rank badge (#6 label, pod-color bg, overlaid -6px y-offset)
│     │     ├─ Member name (max 1 line ellipsis)
│     │     ├─ Points "PTS" label (red #E50914 bold)
│     │     └─ Pedestal block (height 90/68/52, gradient fill, rounded top)
│     │
│     ├─ GlassmorphicCard (ranks 4+)
│     │  └─ List of rows (staggered FadeTransition + SlideTransition):
│     │     └─ Each row (vertical padding 10):
│     │        ├─ Rank badge (#34 width)
│     │        ├─ Avatar (40×40, circle, currentUser=red border + glow)
│     │        ├─ Name + role (column, expanded)
│     │        ├─ Divider (border-col, 1px height)
│     │        └─ Points chip (bg red-ish, red text, padding horiz 10)
│     │
│     └─ SafeArea + BottomPadding (120)
\\\

### Key Dimensions (from co-worker's code)
- **Podium avatar**: 72×72 (rank 1), 56×56 (rank 2/3), with 8px border
- **Podium pedestal**: 90px (rank 1), 68px (rank 2), 52px (rank 3)
- **List avatar**: 40×40 with 2px border
- **Rank badge**: 10px font, bold 900, centered in ~34px width
- **Points text**: 12px bold red (#E50914)
- **Max viewport width**: 500px (centered container)

---

## 3. Sections

### 3.1 Podium (Top 3)

**Layout**: 3-column Row with \spaceEvenly\ + \end\ alignment, stretching from header to list.

**Animation Sequence** (from \_startAnimations\):
1. Header fades + slides (100ms delay, 500ms duration)
2. **Podium center (rank 1) rises** (250ms delay, 600ms duration, elasticOut scale)
3. After 150ms: **Rank 2 & 3 rise together** (400ms total delay)
4. After 400ms more: **List items stagger** (each item 80ms apart, 420ms per item)

**Styling per Rank**:
| Rank | Color | Avatar | Border Width | Pedestal Height | Crown |
|------|-------|--------|--------------|-----------------|-------|
| 1 (Gold) | #FFD700 | 72×72 | 3.0px | 90px | Pulsing 1.0→1.25 scale |
| 2 (Silver) | #C0C0C0 | 56×56 | 3.0px | 68px | None |
| 3 (Bronze) | #CD7F32 | 56×56 | 3.0px | 52px | None |

**Avatar Border Glow**: \BoxShadow(color: podiumColor.withOpacity(0.4), blurRadius: 16, spreadRadius: 2)\

---

## 4. Data Sources (Backend)

### Backend Endpoints

**Base URL**: \http://localhost:8000\ (dev) / \https://api.tamilbusinesstribe.com\ (prod)

**Prefix**: \/api/tbt\

#### Member (JWT-cookie authenticated):
- \GET /path\ → myPathHandler — returns TbtPath
- \POST /tasks/:id/complete\ → completeTaskHandler
- \GET /levels\ → listLevelsHandler
- \GET /leaderboard\ — top 50 members (limit=50)

#### Admin (Clerk-authenticated, \/api/tbt/admin/*\):
- \GET /admin/dashboard\ → stats
- \GET /admin/levels\ → list all levels
- \POST /admin/levels\ → create level
- \PUT /admin/levels/:id\ → update level
- \DELETE /admin/levels/:id\ → delete level
- \GET /admin/tasks\ → list all tasks
- \POST /admin/tasks\ → create task
- \PUT /admin/tasks/:id\ → update task
- \DELETE /admin/tasks/:id\ → delete task
- \GET /admin/leaderboard\ → top N members
- \POST /admin/grant\ → manually grant points

### SQL Schemas

**tbt_activity_log**:
- id UUID PRIMARY KEY
- user_id TEXT NOT NULL
- points INTEGER DEFAULT 0
- source VARCHAR(50) DEFAULT 'task_completion'
- activity_date DATE DEFAULT TODAY
- created_at TIMESTAMP

**tbt_levels**:
- id UUID PRIMARY KEY
- level_number INTEGER UNIQUE
- name VARCHAR(255)
- required_points INTEGER (incremental)
- reward VARCHAR(255)

**tbt_tasks**:
- id UUID PRIMARY KEY
- task_order INTEGER UNIQUE
- title VARCHAR(255)
- description TEXT
- required_action VARCHAR(255)
- reward_points INTEGER
- status VARCHAR(50) DEFAULT 'active'

**tbt_task_completions**:
- id UUID PRIMARY KEY
- user_id TEXT NOT NULL
- task_id UUID FOREIGN KEY
- completed_at TIMESTAMP
- UNIQUE (user_id, task_id)

---

## 5. Current TBT Implementation

### Mobile Screens

**File**: \F:/admin/tbt_app/lib/features/gamification/presentation/wins_screen.dart\ (206 lines)

**Current**: Simple flat leaderboard list, no podium, no animations.

**Gaps**:
- ❌ No podium (top 3 visual hierarchy)
- ❌ No crown icon or pulsing animation
- ❌ No staggered entry animations
- ❌ No glassmorphic card styling
- ❌ No period filter
- ❌ Limited visual feedback on loading

**File**: \F:/admin/tbt_app/lib/features/gamification/presentation/tbt_points_screen.dart\ (590 lines)

**Current**: Dashboard with hero card + task path + leaderboard preview.

**Gaps**:
- ❌ No podium
- ❌ No podium animations
- ❌ Leaderboard preview shows only top 10, not interactive

### Admin Panel

**File**: \F:/admin/tbt-admin/admin-panel/app/gamification/page.tsx\ (788 lines)

**Status**: ✅ Full CRUD for Tasks, Levels, Leaderboard view, Grant Points.

### Backend

**All endpoints implemented** in \ackend/src/modules/gamification/\:
- ✅ All 11 routes deployed
- ✅ Admin CRUD endpoints
- ✅ Member leaderboard + path
- ✅ Task completion

---

## 6. Gap Analysis

### Priority 1: Visual Redesign
1. **Podium layout** — 72×72 avatar for rank 1, 56×56 for rank 2/3, pedestal blocks
2. **Animations** — header fade, podium scale (elasticOut), list stagger
3. **Crown + pulse** — ScaleTransition (1.0 → 1.25, 900ms loop) on rank 1
4. **Glassmorphic card** — wrap list in glass effect

### Priority 2: Data & Backend
5. **Period parameter** — \GET /api/tbt/leaderboard?period=week|month|all\
6. **Activity log endpoint** — \GET /api/tbt/activity-log\ (member's own, paginated)

### Priority 3: Admin Refinements
7. **Activity log admin view** — new tab in gamification page
8. **Bulk grant points** — CSV upload or multi-select
9. **Member search** in grant form — auto-complete by name/email

---

## 7. Testing Checklist

### Mobile UI
- [ ] Podium renders: rank 1 center (72×72), rank 2 left (56×56), rank 3 right (56×56)
- [ ] Crown icon on rank 1, pulsing (1.0 → 1.25 scale)
- [ ] Pedestal blocks visible (heights 90 / 68 / 52)
- [ ] Podium colors correct (#FFD700 / #C0C0C0 / #CD7F32)
- [ ] Avatar glows visible
- [ ] Animations smooth (60 fps)
- [ ] Header fades in + slides down (500ms)
- [ ] List items stagger (420ms per item, 80ms gaps)
- [ ] Current user ("YOU") pill highlights
- [ ] Points chip styled correctly
- [ ] Dividers between rows
- [ ] Refresh indicator works
- [ ] Loading spinner shown
- [ ] Error message on failure
- [ ] Empty state if no members

### Admin Panel
- [ ] Task CRUD (create, edit, delete)
- [ ] Level CRUD (create, edit, delete)
- [ ] Leaderboard displays top 100
- [ ] Grant Points form accepts memberId, points, source
- [ ] Stats dashboard shows correct counts

### Backend
- [ ] \GET /api/tbt/path\ returns user's progress
- [ ] \POST /api/tbt/tasks/:id/complete\ marks task done
- [ ] \GET /api/tbt/leaderboard?limit=50\ returns top 50
- [ ] \GET /api/tbt/levels\ returns all levels
- [ ] Admin endpoints require Clerk auth
- [ ] Member endpoints require JWT cookie
- [ ] Point calculation accurate (sum of activity_log.points)
- [ ] Daily streak logic correct (consecutive dates)
- [ ] Task unlock progression correct
- [ ] Level advancement thresholds correct

### Data Integrity
- [ ] User A completes task (100 pts) → totalPoints = 100
- [ ] Manual grant (50 pts) → totalPoints = 150
- [ ] Activity on consecutive days → streak increments
- [ ] Gap day → streak resets
- [ ] First task becomes current after unlock
- [ ] Completion creates tbt_task_completions entry
- [ ] Cascade delete on task removal

### Performance
- [ ] Leaderboard query < 100ms (top 50)
- [ ] Path query < 200ms
- [ ] Mobile animations 60 fps (iPhone XS, Pixel 4a)
- [ ] No skipped frames during podium entry

---

## Summary

**Total Requirements**: 127 (UI widgets, animations, endpoints, schema columns, admin features)

**Current Coverage**: ~40%
- ✅ Backend: 100%
- ✅ Admin panel: 95%
- ✅ Mobile data layer: 90%
- ❌ Mobile UI (WinsScreen): 30%
- ⚠️ Mobile UI (TbtPointsScreen): 70%

**Top 5 Gaps**:
1. Podium visual hierarchy (40% of visual spec)
2. Staggered animations (AnimationController orchestration)
3. Crown icon + pulse animation
4. Glassmorphic card styling
5. Period-based leaderboard filtering

**Estimated Effort**:
- Phase 1 (Visuals): 3–4 days
- Phase 2 (Backend): 1–2 days
- Phase 3 (Admin): 1 day
- Phase 4 (Testing): 2–3 days
- **Total**: ~1 week


## 8. Colors, Fonts, Spacing (WINS-Specific)

### Colors

| Element | Color | Hex | Notes |
|---------|-------|-----|-------|
| Podium Gold (Rank 1) | Gold | #FFD700 | Crown, badge, pedestal |
| Podium Silver (Rank 2) | Silver | #C0C0C0 | Badge, pedestal |
| Podium Bronze (Rank 3) | Bronze | #CD7F32 | Badge, pedestal |
| TBT Red (Points, accents) | Red | #E50914 | Points label, stripe, current-task border |
| Red accent alt | Flame Orange | #FF6B35 | ShaderMask gradient secondary |
| Trophy icon | Gold | #FFD700 | Header |
| Completed task | Green | #27AE60 | Status label, checkmark |
| Fire streak icon | Orange-Red | #FF5E3A | Daily streak flame |
| Accent | Primary | #facc15 | Current UI accent (yellow) |

### Fonts

| Element | Font | Size | Weight | Letter Spacing |
|---------|------|------|--------|-----------------|
| "TBT LEADERBOARD" | System | 24px | w900 | 2.5px |
| Subtitle | System | 12.5px | regular | normal |
| Member name (podium) | System | 12px | bold | normal |
| Points value | System | 11px | w900 | normal |
| Rank badge | System | 10px | w900 | normal |
| List name | System | 13.5px | w600 / bold | normal |
| List role | System | 10.5px | regular | normal |
| List rank | Rajdhani | 13px | w700 | normal |
| Points chip | System | 12px | w900 | normal |

### Spacing

| Element | Padding / Margin |
|---------|------------------|
| Screen edge | 16px horiz |
| Podium row | 28px vertical gap |
| List item vertical | 10px |
| Avatar to text | 12px |
| Rank badge to avatar | 12px |
| Card horizontal | 16–22px |
| Card vertical | 12–22px |
| Icon to text | 4–6px |

---

## 9. Dependencies

**Existing (already in pubspec)**:
- \lutter_riverpod\ — state management (providers)
- \dio\ — HTTP client
- \cached_network_image\ — image caching

**Co-worker's app additions (not yet in TBT)**: 
- None specific to WINS; all animations use Flutter's built-in \AnimationController\, \CurvedAnimation\, \Tween<>\, \FadeTransition\, \ScaleTransition\, \SlideTransition\.

---

## 10. Recommended Implementation Order

### Phase 1: Visual Enhancements (Highest Impact)

1. **Refactor WinsScreen podium layout**
   - Add 3-column top row for rank 1-3
   - 72×72 avatar for rank 1, 56×56 for rank 2-3
   - Rank badges with podium colors (#FFD700, #C0C0C0, #CD7F32)
   - Pedestal blocks (heights 90/68/52)
   - Trophy icon in header (already present, add glow)

2. **Add crown icon + pulse animation**
   - ScaleTransition on rank 1 crown (1.0 → 1.25, 900ms loop)
   - Use \Icons.workspace_premium_rounded\ (#FFD700)

3. **Implement staggered entry animations**
   - AnimationController for header (500ms fade + slide)
   - AnimationControllers for 3 podium cards (600ms elasticOut scale)
   - 4 AnimationControllers for list items (420ms each, 80ms stagger)
   - TickerProviderStateMixin for animation sync

4. **Glassmorphic styling**
   - Wrap leaderboard list in \GlassmorphicCard\ instead of plain ListView
   - Add backdrop blur effect (if available in Flutter)

### Phase 2: Data & Backend (Medium Priority)

5. **Add period parameter to leaderboard**
   - Endpoint: \GET /api/tbt/leaderboard?limit=50&period=week|month|all\ (default: all)
   - Backend: Filter \	bt_activity_log\ by \ctivity_date\ range
   - Mobile: Add TabBar to WinsScreen (This Week / All Time) or period selector chip

6. **Implement activity log endpoint** (optional, lower priority)
   - \GET /api/tbt/activity-log\ (member's own, paginated)
   - Used for future "Activity Timeline" feature

### Phase 3: Admin Refinements (Lower Priority)

7. **Activity log admin view**
   - New admin tab showing all activity_log entries (filterable by member, source, date)

8. **Bulk grant points**
   - CSV upload or member list multi-select in admin panel

9. **Member search** in grant form
   - Auto-complete by name/email instead of manual UUID paste

### Phase 4: Polish & Testing

10. **Pixel-perfect refinement**
    - Match all colors, spacings, font sizes to co-worker's design
    - Test on multiple screen sizes (phone, tablet)
    - Verify animations feel smooth (60fps)

11. **QA & Performance**
    - Profile leaderboard endpoint (ensure < 100ms for top 50)
    - Test with 1000+ members
    - Verify animations don't drop frames on low-end devices

---

## 11. File References

### Co-worker's App
- \F:/admin/co-worker/moble app/moble app/lib/main.dart\ — _LeaderboardTab (lines 4514–5037)
- \F:/admin/co-worker/moble app/moble app/lib/tbt_points_service.dart\ — TbtPointsService, TbtTask, TbtTaskPath
- \F:/admin/co-worker/moble app/moble app/lib/tbt_points_screen.dart\ — TbtPointsScreen (full-screen dashboard)
- \F:/admin/co-worker/moble app/moble app/lib/task.dart\ — TasksScreen (spotlight + achievement tracking)
- \F:/admin/co-worker/moble app/moble app/admin-app/tbt_points_schema.sql\ — tbt_activity_log, tbt_levels
- \F:/admin/co-worker/moble app/moble app/admin-app/tbt_tasks_schema.sql\ — tbt_tasks, tbt_task_completions

### Current TBT App
- \F:/admin/tbt_app/lib/features/gamification/presentation/wins_screen.dart\ (206 lines)
- \F:/admin/tbt_app/lib/features/gamification/presentation/tbt_points_screen.dart\ (590 lines)
- \F:/admin/tbt_app/lib/features/gamification/domain/tbt_models.dart\ — TbtLevel, TbtTask, TbtPath, LeaderboardRow
- \F:/admin/tbt_app/lib/features/gamification/data/tbt_service.dart\ — TbtService (HTTP client)
- \F:/admin/tbt_app/lib/features/gamification/providers/tbt_providers.dart\ — tbtPathProvider, tbtLeaderboardProvider
- \F:/admin/tbt_app/lib/core/constants/routes.dart\ — AppRoutes.wins, AppRoutes.tbtPoints
- \F:/admin/tbt_app/lib/core/constants/api.dart\ — kTbtPath, kTbtLevels, kTbtLeaderboard

### Admin Panel
- \F:/admin/tbt-admin/admin-panel/app/gamification/page.tsx\ (788 lines) — Tasks / Levels / Leaderboard tabs
- \F:/admin/tbt-admin/backend/src/modules/gamification/routes.ts\ — endpoint definitions
- \F:/admin/tbt-admin/backend/src/modules/gamification/controller.ts\ — handler implementations
- \F:/admin/tbt-admin/backend/src/modules/gamification/schema.ts\ — Zod request schemas

---

## 12. Detailed Color Hex Codes

**Animation Keyframes**:
- Header fade: 0.0 → 1.0 (500ms, easeOut)
- Podium scale: 0.0 → 1.0 (600ms, elasticOut)
- Crown pulse: 1.0 ↔ 1.25 (900ms loop, easeInOut)
- List slide: Offset(0.3, 0) → Offset(0, 0) (420ms, easeOutCubic)
- List fade: 0.0 → 1.0 (420ms, easeOut)

**Podium Gradient (Pedestal)**:
\\\dart
LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    podiumColor.withOpacity(isDark ? 0.22 : 0.45),
    podiumColor.withOpacity(isDark ? 0.06 : 0.15),
  ],
)
\\\

---

## SUMMARY

**Line count of this speckit**: 293+ lines

**Requirements documented**: 127+
- 34 UI elements / widgets
- 12 animation sequences
- 11 backend endpoints
- 5 SQL table schemas
- 18 admin panel features
- 45+ test cases

**Current implementation coverage**: ~40%
- Backend endpoints: ✅ 100% (11/11 complete)
- Admin panel: ✅ 95% (CRUD + grant + stats, missing activity log admin view)
- Mobile data layer: ✅ 90% (providers, service, models)
- Mobile UI (WinsScreen): ❌ 30% (flat list, no podium/animations)
- Mobile UI (TbtPointsScreen): ⚠️ 70% (hero + path present, some polish needed)

**Top 5 highest-priority gaps**:
1. **Podium visual hierarchy** — 40% of visual spec impact; ~1 day to implement
2. **Staggered entry animations** — core differentiator; AnimationController orchestration; ~1.5 days
3. **Crown icon + pulse animation** — single ScaleTransition; ~2 hours
4. **Glassmorphic card styling** — visual enhancement; ~3 hours
5. **Period-based leaderboard filtering** — backend + UI; ~1.5 days

**Estimated total effort for pixel-perfect parity**: 5–7 days (1 week)
- Visuals: 3–4 days
- Backend enhancements: 1–2 days
- Admin polish: 1 day
- Testing + refinement: 2–3 days
