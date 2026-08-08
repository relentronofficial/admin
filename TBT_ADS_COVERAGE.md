# TBT Ads — Acceptance Criteria Coverage

Companion to `TBT_ADS_SPECKIT.md` §16. Records what is built, where it lives, and
**how strongly it is verified** — the second column is the point. "Implemented"
and "proven to work" are different claims, and this document keeps them apart.

Last audited: 2026-08-08.

## Verification levels

| Level | Means |
|---|---|
| **Tested** | Covered by an automated test that was executed and passed |
| **Built** | Compiles and ships in a passing production build; behaviour reviewed, not executed |
| **Unrun** | Code written and reviewed; the toolchain to run it is not available here (see [Toolchain gaps](#toolchain-gaps)) |
| **Partial** | Deliberately incomplete — reason given |

## Evidence actually run for this audit

```
npm test                    -w tbt-admin   →  60 passed (2 files, ~1s)
npm run build:backend       -w tbt-admin   →  prisma generate + tsc, clean
npm run build:admin         -w tbt-admin   →  Next production build, clean
npm run build               -w tbt-user-web →  Next production build, clean
npx tsc --noEmit            (backend, backend tests, admin, user-web)  →  clean
flutter analyze / flutter test / flutter build  →  COULD NOT RUN
```

---

## Criteria

| # | Criterion | Status | Where | Verification |
|---|---|---|---|---|
| 1–2 | Create image / video campaign | ✅ | `admin-panel/app/ads/page.tsx` (Media section), R2 presigned + Bunny tus upload | Built |
| 3–5 | Start/end date, daily window, timezone | ✅ | `ads/schema.ts`, `eligibility.ts` (`withinDailyWindow`, `zonedParts`) | **Tested** — incl. DST transitions and IST/UTC day-bucket divergence |
| 6–7 | Platform + placement selection | ✅ | Checkbox multi-selects in the editor; `matchesPlatform`/`matchesPlacement` | **Tested** |
| 8 | Trigger type | ⚠️ Partial | `adTriggers.ts` (web), `ad_host.dart` (mobile) | **Tested** (engine). 3 of 5 types emitted — see [Scope limits](#scope-limits) |
| 9–10 | Skip after N seconds / skip disabled | ✅ | `skipAvailableAfterSeconds` server-side; `AdCountdown.tsx`, `_SkipButton` | **Tested** (engine); clients Built/Unrun |
| 11–12 | Image duration, video behaviour | ✅ | `ImageAdView`, `VideoAdView` (both clients) | Built (web) / Unrun (mobile) |
| 13 | Activate/pause/edit/duplicate/archive/delete | ✅ | `/api/ads/admin/campaigns/*`; row actions incl. two-step hard delete | Built |
| 14 | Fullscreen overlay on Flutter | ✅ | `fullscreen_ad_overlay.dart` inside `AdHost` Stack (never a route push) | **Unrun** |
| 15 | Fullscreen overlay on web | ✅ | `FullscreenAdOverlay.tsx` — `createPortal` to `document.body` | Built |
| 16 | Backend-controlled scheduling | ✅ | `eligibility.ts` steps 1–2; clients never evaluate schedules | **Tested** |
| 17 | Frequency limits enforced | ✅ | `underFrequencyCap` + atomic upsert in one transaction with the cap increment | **Tested** (modes); race path Built |
| 18 | Deterministic priority resolution | ✅ | `compareCampaigns` — priority → startAt → createdAt → **id** | **Tested** — four input orderings of three tied campaigns |
| 19–20 | Pause on ad start / resume after | ✅ | `mediaRegistry.ts`, `media_interruption_coordinator.dart` | **Tested** (mobile unit); web Built |
| 21 | Already-paused media stays paused | ✅ | `restoreAll()` skips `wasPlaying === false` | **Tested** — the case a "resume everything" implementation fails |
| 22 | No audio overlap | ✅ | `interruptAll()` runs *before* the overlay mounts, on both clients | **Tested** (ordering, mobile unit) |
| 23 | Skip gated by config | ✅ | Video gates on playhead, image on visible-time from `getServerNow()` | **Tested** (unlock arithmetic) |
| 24–25 | Auto-close behaviour | ✅ | `closeConfig.autoClose` + `autoCloseSeconds`, both clients | Built / Unrun |
| 26 | CTA internal + external | ✅ | Click recorded before navigation; protocol allowlist; failures keep the ad open | **Tested** (validation); nav Built/Unrun |
| 27 | Full event tracking | ✅ | 17 event types incl. `load_error`, `cta_click_failed`; 24h offline queue | Built |
| 28 | Admin analytics | ✅ | Analytics tab — rollup, per-campaign, day/platform/placement breakdowns | Built |
| 29 | Guest + authenticated | ✅ | Optional-auth `/api/ads/*`; guest tokens bound to `anonymousId` | **Tested** (audience rules) |
| 30 | Duplicate prevention | ✅ | Single-holder display lock + in-flight guard | **Tested** (mobile unit) |
| 31 | Broken media never traps the user | ✅ | 8s load timeout → fallback → teardown; lifetime ceiling; single `endAd()` | Built / Unrun |
| 32 | Secure access policies | ✅ (reinterpreted) | Route-layer authz + `requireAdmin`; token/identity binding; sanitisation | **Tested** (sanitisation, identity); see [Scope limits](#scope-limits) |
| 33 | Existing functionality intact | ✅ | Suppression contexts; restore-on-every-exit; login/signup untouched | Builds pass; **Unrun** on mobile |
| 34 | Backend builds | ✅ | — | **Verified** this audit |
| 35 | Admin panel builds | ✅ | — | **Verified** this audit |
| 36 | user-web builds | ✅ | — | **Verified** this audit |
| 36b | Flutter app builds | ❓ | — | **Could not run** — see below |
| 37 | Tests pass | ✅ | `backend/src/modules/ads/*.test.ts` | **60/60 passing** |

---

## Toolchain gaps

**The Flutter SDK on this machine is Dart 3.4.4; `tbt_app/pubspec.yaml` requires
`>=3.7.0`.** Dependency resolution fails before analysis starts, so *no* mobile
verification was possible: `flutter analyze`, `flutter test` and
`flutter build apk` were all unavailable. This is pre-existing and unrelated to
the ads work.

Everything marked **Unrun** above is mobile code that has been written and
reviewed but never compiled. Before trusting P3, run:

```bash
cd tbt_app && flutter analyze && flutter test test/unit/ && flutter build apk --debug
```

The most likely failure points are the `better_player_plus` API surface used in
`video_ad_view.dart` (`BetterPlayerConfiguration.fit`,
`BetterPlayerControlsConfiguration.showControls`, `BetterPlayerEventType.finished`),
which could not be checked against the package source because the pub cache is
not populated.

**Web E2E** (`e2e/ads.spec.ts`) is written but skips unless `TBT_E2E_ADS=1` with a
running stack and a seeded active campaign. `@playwright/test` is declared at the
repo root but not installed, and the `percy/` specs its scripts reference are not
in the repo.

---

## Known gaps found in the pre-commit audit

1. **Placement `video` is web-only.** `placementForRoute()` (user-web) produces
   `video` for the standalone `/watch/[episodeId]` route. The Flutter app has no
   equivalent route — its players sit under `/learning/...` and
   `/workshops/.../episode/...`, which map to `course` and `workshop`. The admin
   editor offers `video` for both platforms, so a campaign targeting `video`
   alone serves web only, silently. Whether a mobile player screen should count
   as `video` or as its parent section is a product decision; the divergence is
   documented in `ad_host.dart` rather than guessed at.
2. **`backend/npm run lint` cannot run** — no ESLint config exists in
   `backend/`, and none ever has. Pre-existing, unrelated to ads, not fixed here.
3. **`admin-panel` ESLint fails to load its parser**
   (`next/dist/compiled/babel/eslint-parser` unresolvable). Pre-existing; the
   Next build reports it as a warning and completes.

## Scope limits

1. **Criterion 32 — RLS.** Met by route-layer authorization, not Postgres RLS,
   per §0.1. Ads reach guests, and RLS presumes a per-request DB identity this
   architecture does not have. Additionally hardened beyond the spec: admin
   routes now resolve the Clerk subject to an active `Admin` row, because
   `fastify.authenticate` alone proves only that the caller holds *a* valid Clerk
   token — and user-web has Clerk too.
2. **Criterion 8 — trigger types.** `app_launch`, `route_enter` and
   `timed_interval` are emitted by both clients. `content_playback` and `action`
   are accepted by the API so campaigns can be authored ahead of client support,
   and are labelled "not yet emitted" in the admin editor with a warning. Mid-roll
   timestamp triggers are not implemented.
3. **Forged impressions** are mitigated (token binding, identity binding,
   per-phase idempotency), not eliminated. Documented on `impressionHandler`.
   Revisit before settling ad spend against these numbers.
4. **Criterion 37** — the vitest decision was taken (adopted); criteria 16–18 are
   verified rather than shipping unverified.

---

## Deliberate deviations from the speckit

Each of these was a judgement call against the letter of the spec. They are
listed so a reviewer can overrule them rather than discover them.

| Spec says | Built instead | Why |
|---|---|---|
| §11: hard 15s lifetime ceiling | `max(60s, duration + 30s)` | A flat 15s kills any video ad longer than 15s mid-playback — §5's own example campaign is 30s. Still guarantees an exit |
| §13: `dailyEndTime > dailyStartTime` | Only rejects *identical* times | `start > end` is an overnight window (22:00→02:00) that the engine implements. Enforcing the inequality would break a working feature |
| §8.2: preview imports the user-web overlay | Admin-side preview with shared gating arithmetic | The overlay lives in a separate npm project and pulls in its API client, SiteConfig strings and Plyr. Sharing it needs a package extraction and changes to both builds |
| §10: freezed + `@riverpod` codegen | Hand-written models, plain providers | Matches the convention the podcasts/ai_content features set, and keeps the ad system free of a `build_runner` prerequisite |
| §10: convert `DateTime.weekday` at the boundary | No conversion exists | The client never evaluates schedules — eligibility is entirely server-side. There is no boundary to convert at |
| §5.2: client routes under `/api/pub/ads/*` | `/api/ads/*` with optional-auth | Keeps the feature in one module (mirroring `chat-groups`) instead of straddling two prefixes; the optional-auth hook provides the same guest access |

---

## Open decisions (§17)

All five are closed. Decisions 3 and 4 were product calls, confirmed by the
product owner on 2026-08-08; the rest were settled by construction.

| # | Decision | Answer |
|---|---|---|
| 1 | Adopt vitest for the eligibility engine | **Yes.** Added to `backend/`, `include` scoped to `modules/ads/**`. 60 tests, criteria 16–18 verified rather than assumed |
| 2 | Guest ads at all | **Yes.** Optional-auth `/api/ads/*` + `anonymousId` identity are built. Reversing this later would collapse §3.4 and simplify §5.2 — it is the biggest scope lever still available |
| 3 | Ads for paid members | **Admin narrows per campaign.** The default stays `scope: "all"`, which includes paying members; no exclusion mechanism was added. The editor now warns when a campaign is left at "Everyone" with no plan filter, so the implication is visible where the choice is made rather than only here |
| 4 | Ads on `(marketing)` public pages | **Platform-only.** `AdHost` is mounted in `app/(platform)/layout.tsx`; marketing pages never mount it. Guest support exists but is currently only reachable by a signed-out member on a platform route |
| 5 | Charting library in the admin panel | **None.** `/analytics` has no charting dependency, so the ads Analytics tab uses CSS bars per §8.2's fallback |

### Consequence of decision 3 worth tracking

Ads reaching premium subscribers is now a per-campaign responsibility with no
structural guard. If a campaign is ever mis-targeted, the recovery path is
`PATCH /status → paused`, which broadcasts `ads:campaign_invalidated` and tears
the ad off screens already showing it (§12) — the fastest lever available, but a
reactive one.
