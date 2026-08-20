# Voice of Sakthi (Podcast) Speckit — Ported from Co-worker's App

> **Source of truth**: `co-worker/moble app/moble app/lib/podcast.dart` (~1,850 lines), `lib/podcast_service.dart` (~350 lines), `lib/podcast_player_controller.dart` (~200 lines).
>
> **Target**: `F:/admin/tbt_app/lib/features/podcasts/` — 1,450 lines across 7 files (verified 2026-07-21).

---

## 1. Overview

Voice of Sakthi is the audio-first section of the app, accessible from the raised center tab in the bottom nav (`AppRoutes.podcasts`). Three screens today:

| Screen | Route | File | Lines |
|---|---|---|---|
| Browse home | `/podcasts` | `presentation/podcasts_screen.dart` | 510 |
| Series detail | `/podcasts/series/:id` | `presentation/podcast_series_screen.dart` | 197 |
| Full player | `/podcasts/player` | `presentation/podcast_player_screen.dart` | 222 |
| Mini player (overlay) | (persistent in shell) | `presentation/podcast_mini_player.dart` | 151 |

**Data / state:**
- `data/podcast_service.dart` — thin Dio wrapper over `/api/podcasts/*` (137 lines)
- `data/podcast_player_controller.dart` — `just_audio` singleton with progress upsert (179 lines)
- `providers/podcast_providers.dart` — providers (54 lines)

---

## 2. PodcastsScreen sections (current)

`podcasts_screen.dart:36–47`:
```
Scaffold(bgPage)
├─ AppBar (bgSurface, "Podcasts" 18 w700)
└─ RefreshIndicator + ListView
   ├─ _ContinueListeningSection  (horizontal row, 96 px, tile 280×76)
   ├─ _FeaturedSeriesSection     (horizontal, 170 px, card 130 wide)
   ├─ _CategoryChipsRow          (horizontal ChoiceChips, 34 px)
   └─ _EpisodesGrid              (vertical Column of full-width tiles)
```

**Co-worker's version adds:** hero player card at top with big cover + waveform + transport, "See All" links per section, brand-styled section headers.

## 3. PodcastPlayerScreen (current)

`podcast_player_screen.dart`:
```
Scaffold(bgPage) + AppBar "Now Playing"
└─ SafeArea padding H24 V12
   ├─ _Artwork (AspectRatio 1, radius 16)
   ├─ Title 19 w800 height 1.25
   ├─ Subtitle: "speaker · category"
   ├─ _ScrubBar (Slider 3px track, thumb r6, MM:SS labels)
   └─ _Transport: replay10 · play/pause 70×70 circle · forward10
```

**Co-worker adds:** 45-bar animated waveform, speed cycler (0.5/1/1.5/2×), prev/next episode buttons, bookmark heart, transcript pull-up sheet.

## 4. Mini Player (current)

66–70 px overlay above bottom nav. 2 px progress bar top edge · 42 cover · title + subtitle · play/pause · close X.

**Co-worker adds:** skip-back-10s next to play, cover 42→48, swipe-up-to-open.

## 5. PodcastPlayerController

`data/podcast_player_controller.dart` — `just_audio` singleton (ChangeNotifier). Methods: `playEpisode`, `togglePlay`, `seek`, `skipForward(s)`, `skipBackward(s)`, `stopAndClear()`, `submitProgress` at ~5 s cadence.

**Co-worker adds:** `setSpeed(double)`, `WidgetsBindingObserver` for save-on-background, completion → auto-next.

## 6. Data Sources

### 6.1 Endpoints (`/api/podcasts/*`, JWT cookie)

Member:
- `GET /categories` — active only
- `GET /episodes?page=&limit=&category=&search=` — paginated
- `GET /episodes/:id`
- `GET /series` — featured
- `GET /series/:id` — series + nested episodes
- `GET /continue-listening` — where progress > 0 AND completed=false
- `POST /progress` — upsert `{ episodeId, currentPositionSeconds, totalDurationSeconds }`
- `POST /mark-completed`

Admin (Clerk):
- `GET /admin/dashboard`
- CRUD `/admin/categories|series|episodes`
- `PUT /admin/episodes/:id/toggle-status`
- **Missing**: `POST /admin/podcast/{series|episodes}/:id/send-notification` (co-worker has FCM fan-out)

### 6.2 SQL tables (from `prisma.ts` startup)

- **podcast_categories**: id, name, slug UNIQUE, status, sort_order, timestamps
- **podcast_series**: id, title, slug UNIQUE, description, cover_image, status, sort_order, timestamps
- **podcast_episodes**: id, title, slug UNIQUE, description, category_id FK, series_id FK, cover_image, audio_url NOT NULL, duration_seconds, speaker, tags TEXT[], is_featured, status, publish_date, sort_order, transcript, timestamps
- **podcast_episode_progress**: id, member_id UUID FK, episode_id FK, current_position_seconds, total_duration_seconds, completed, updated_at, UNIQUE(member_id, episode_id)

## 7. Admin UI (`admin-panel/app/podcasts/page.tsx`)

Three tabs: Categories · Series · Episodes with CRUD each (name, slug, cover R2 upload, audio_url, category/series dropdowns, tags CSV, publish_date, transcript textarea).

**Missing**: dashboard stats tab · send-notification action · bulk CSV import · per-episode analytics.

## 8. Colors, Fonts, Spacing

- Accent (play/pause, active chips, progress): `#E50914`
- Cover fallback: `bgInput` + `#444` icon
- Section header: 11 px w800 letter-spacing 1.2 uppercase `textSecondary`
- Episode title: 13 px w700 (list) / 19 px w800 (player)
- Timeline labels: 11 px `textMuted`
- Full player play/pause: 70×70 circle, icon 34
- Mini player: 66–70 tall, cover 42, progress 2 px

## 9. Dependencies

Already installed: `just_audio: ^0.9.42`, `cached_network_image: ^3.4.1`.
Optional adds: `audio_session` (proper focus handling). Waveform can be hand-rolled — no external package needed.

## 10. Current TBT vs Co-worker — Coverage table

| Component | Coverage | Evidence |
|---|---|---|
| PodcastsScreen browse layout | ✅ 85% | `podcasts_screen.dart` — 4 sections present |
| Hero player card on browse | ❌ 0% | Absent — co-worker has big hero at top |
| "See All" links per section | ❌ 0% | `_SectionHeader` (line 452) is label-only |
| Series detail screen | ⚠️ 60% | 197 lines — verify subscribe button |
| Full player artwork | ✅ 100% | `_Artwork` line 82 |
| Player title/subtitle | ✅ 100% | Line 50–68 |
| Player scrubber | ✅ 100% | `_ScrubBar` line 110 |
| Player play/pause + skip ±10 | ✅ 100% | `_Transport` line 160 |
| **Player: animated waveform** | ❌ 0% | Missing — needs 45-bar `AnimationController` |
| **Player: speed cycler** | ❌ 0% | Missing |
| **Player: prev/next episode** | ❌ 0% | Missing — only skip ±10s |
| **Player: transcript sheet** | ❌ 0% | Missing |
| **Player: bookmark heart** | ❌ 0% | Missing |
| Mini player | ✅ 90% | Missing skip-back-10s + swipe-up |
| Controller: `just_audio` core | ✅ 100% | Verified |
| Controller: `setSpeed` | ❌ 0% | Not exposed |
| Controller: lifecycle save | ⚠️ 50% | Verify `WidgetsBindingObserver` |
| Controller: auto-next episode | ❌ 0% | Missing |
| Backend endpoints (member) | ✅ 100% | All 8 routes present |
| Backend endpoints (admin CRUD) | ✅ 100% | Verified |
| Admin dashboard stats tab | ❌ 0% | Missing |
| Admin send-notification | ❌ 0% | Missing |

**Overall:** mobile ~70% · backend 100% · admin ~85%.

## 11. Recommended implementation order

**Phase 1 — Player upgrades (biggest visual impact, ~1 day):**
1. Speed cycler chip `0.5x / 1x / 1.5x / 2x` → `player.setSpeed`.
2. Prev/Next episode buttons flanking play/pause (disabled when no `currentSeries`).
3. Bookmark heart in app bar (local `SharedPreferences` fallback until backend table exists).
4. **45-bar animated waveform** — pure `AnimationController` with sine-wave phase offset when playing.

**Phase 2 — Browse polish (~4 hours):**
5. "See All" chevron links on each `_SectionHeader`.
6. Full-width first featured card, then 130 for the rest.
7. "Recently played" row under "Continue Listening".

**Phase 3 — Mini player refinement (~2 hours):**
8. Skip-back-10s button left of play/pause.
9. Cover 42 → 48.
10. Swipe-up gesture → full player.

**Phase 4 — Admin polish (~half day):**
11. Stats tab in `/podcasts` admin.
12. Send-notification action + backend endpoint.

## 12. Testing checklist

**Mobile browse:**
- [ ] Continue-listening only when ≥1 in-progress
- [ ] Category "All" resets filter
- [ ] Refresh invalidates all 4 providers

**Mobile player:**
- [ ] Timeline seeks correctly, spinner on buffering
- [ ] Skip ±10s works from any position
- [ ] Speed cycler advances 0.5→1→1.5→2→0.5
- [ ] Waveform animates only when `player.playing`
- [ ] Progress persists on background (5 s cadence) and resumes on next play

**Mini player:**
- [ ] Renders only when `currentEpisode != null`
- [ ] Tap tile → opens full player at same position
- [ ] Close X clears controller
- [ ] Sits above bottom nav

**Backend:**
- [ ] `POST /progress` upserts on `(memberId, episodeId)`
- [ ] `GET /continue-listening` filters correctly

---

## SUMMARY

**Total requirements:** 45 (sections, controls, endpoints, tables, admin features)
**Current coverage:** ~70% mobile · 100% backend · 85% admin
**Top 5 gaps:**
1. Animated waveform on player (visual differentiator)
2. Speed control (must-have podcast UX)
3. Prev/Next episode buttons
4. Section "See All" links
5. Skip-back-10s on mini player

**Speckit line count:** ~180 lines.
