# MENTORSHIP_DASHBOARD_VISUAL_SPECKIT.md

**Component:** `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx`  
**Visual Reference:** `coursepage.png` (repo root — Figma export, canonical design target)  
**Rendered on:** `/courses`, `/batch-program/mentorship`, `/profile`  
**Audit date:** 2026-10-06  
**Commits in this sprint:** `749422ac`, `3e3dd1ec` (PR #53), `7912e206`, `851ac056`

---

## Root Cause

The original component (`9ef2dd7f`) was written before `coursepage.png` was finalised as the design target. Ten structural mismatches were discovered through static analysis of the original commit against the reference image, plus a second-pass live visual QA.

---

## Items

### MD-01 — Daily Usage tile wrong metric
- **Was:** `attendanceCount` (days attended this batch), e.g. `"42 /90 days"`
- **Reference:** Daily time invested in hours, e.g. `"3.15 hrs"`
- **Fix:** Changed to `stats.dailyTimeSpentHrs` with `suffix=" hrs"`, no `/total` denominator
- **Status:** ✅ Complete — `749422ac`

---

### MD-02 — Lifelines hardcoded default + artificial padding
- **Was:** `lifelinesTotal ?? 3` fallback; hearts padded to `Math.max(5, lifelinesTotal)` — always showed at least 5 hearts even when member had no batch data
- **Reference:** Show exact number of hearts the member has; hide the entire lifelines chip when none are allocated
- **Fix:** `totalHearts = lifelinesTotal ?? 0`; entire hearts section gated on `totalHearts > 0`
- **Status:** ✅ Complete — `749422ac`

---

### MD-03 — Streak badge missing "Streak" label word
- **Was:** `"🔥 7 Days"` — no "Streak" prefix
- **Reference:** `"🔥 Streak 7 Days"`
- **Fix:** Badge text changed to `Streak {streakDays} Days`
- **Status:** ✅ Complete — `749422ac`

---

### MD-04 — KPI Card 4 (Organic Growth) duplicated growth badge
- **Was:** `growth={leadsGrowthVal}` passed to `KpiCard` — rendered a `GrowthBadge` showing e.g. `+12.5%` below the sub-text, even though the main value IS `+12.5%`. Also `accentColor="#818cf8"` (purple) instead of green.
- **Reference:** Main value is the growth percentage, coloured green/red. No secondary badge. Green accent.
- **Fix:** Removed `growth` prop; added `valueColor` prop to `KpiCard`; set `accentColor="#22c55e"` and `valueColor` to green when positive, red when negative
- **Status:** ✅ Complete — `749422ac`

---

### MD-05 — Expert Support Calls totals excluded 2 of 6 call types
- **Was:** `allCallsUsed` summed only `techSupport`, `adSupport`, `groupCall`, `callCredits` — `salesSupport` and `contentSupport` (added in PR #53) were missing
- **Reference:** All 6 support types contribute to header chip totals
- **Fix:** Changed to iterate all 6: `[quota.salesSupport, quota.techSupport, quota.contentSupport, quota.adSupport, quota.callCredits, quota.groupCall]`; `SupportQuota` type extended with both new buckets in `lib/hooks/useUser.ts`; backend `computeSupportQuota` in `supportQuota.ts` updated in PR #53
- **Status:** ✅ Complete — `3e3dd1ec` (PR #53) + `7912e206`

---

### MD-06 — Expert Support Calls header chips wrong format
- **Was:** `"X MC Completed"` / `"Quota Y"` — wrong order, wrong label text
- **Reference:** `"{used}/{allocated} Completed"` / `"{remaining} Quota Remaining"`
- **Fix:** Updated both chips to the reference format
- **Status:** ✅ Complete — `7912e206`

---

### MD-07 — Section headings in small muted uppercase style
- **Was:** All three major section headings used `text-[11px] font-bold uppercase tracking-widest` with muted `color-text-subtle` colour
- **Reference:** `text-sm font-bold` in white `color-text-normal`
- **Affected sections:** Customer Journey, Expert Support Calls, Your Revenue Stats
- **Fix:** Changed all three `<h2>` elements to `className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}`
- **Status:** ✅ Complete — `7912e206`

---

### MD-08 — Leaderboard tile missing ordinal suffix
- **Was:** `"#45"` — no suffix
- **Reference:** `"#45th"`
- **Fix:** Added `ordinalSuffix(n)` helper (handles 11th/12th/13th edge cases via `n % 100` check); leaderboard tile value changed to `` `#${rank}${ordinalSuffix(rank)}` ``
- **Status:** ✅ Complete — `851ac056`

---

### MD-09 — Revenue Stats used wrong card component
- **Was:** Separate `RevenueCard` component with:
  - `text-xl` value (too small)
  - ROAS as a sub-text line instead of a top-right chip
  - Hardcoded `"Free Customers"` label on the conversion card
  - String-interpolation bug in badge colour (`${btoColor}26` evaluated as string literal)
  - Modal-based data entry (value entry was inside a popover)
- **Reference:** Inline cards with `text-3xl` value, `mainColor` per-card, top-right growth/ROAS badge slot, risk badge below value
- **Fix:** Replaced with inline `card()` helper: `text-3xl` value, `mainColor` param, `topRight` slot, `badge` slot for risk/ROAS labels, `meta1`/`meta2` for sub-text lines
- **Status:** ✅ Complete — `851ac056`

---

### MD-10 — KPI Card 3 (Expert Support) wrong accent colour
- **Was:** `accentColor="#34d399"` (mint green)
- **Reference:** Yellow accent on the support calls card
- **Fix:** Changed to `accentColor="#eab308"` (yellow); also updated KPI Card 3 sub-text to `"{allCallsAllocated} All-Time Calls"`
- **Status:** ✅ Complete — `851ac056`

---

## Second-Pass QA Fixes

### MD-11 — `btoRisk` threshold too strict
- **Was:** `btoRatio < 5 → "Low Risk"`, `< 20 → "Moderate"` — demo data (~10% BTO) showed "Moderate"
- **Reference:** Demo data at ~10% BTO should show "Low Risk"
- **Fix:** Raised thresholds to `< 15 → "Low Risk"`, `< 30 → "Moderate"`, `≥ 30 → "High Risk"`
- **Status:** ✅ Complete — `851ac056`

---

### MD-12 — KPI Card 2 sub-text stale format
- **Was:** `"0 MC Calls This Period"` (old chip format leaked into sub-text)
- **Reference:** `"{allCallsAllocated} All-Time Calls"`
- **Fix:** Updated sub-text to use the correct variable and label
- **Status:** ✅ Complete — `851ac056`

---

### MD-13 — `SupportCallTile` value too small
- **Was:** `text-lg` value size
- **Reference:** Larger value matching other tiles
- **Fix:** Changed to `text-xl font-black`; added colour-coded exhaustion state (`#ef4444` when `used >= total`)
- **Status:** ✅ Complete — `7912e206`

---

## Known Remaining Items

| ID | Issue | Priority |
|---|---|---|
| MD-14 | Journey tiles **Modules** and **Tasks** — reference shows sub-text below the value. Added `"X Left"` / `"All Done"` derived from existing stats fields | Low | ✅ Complete |
| MD-15 | Daily Usage value format — KPI card uses `"3.15 hrs"` (matches reference). Journey tile uses compact `"3.15h"` — appropriate for tile size. No change needed. | Low | ✅ Complete (no change required) |
| MD-16 | Social metrics section — not in `coursepage.png` reference; visual parity deferred until a Figma update covers it | Deferred |

---

## Key Invariants (do not break)

1. **`GrowthBadge` must never appear on KPI Card 4** — the main value IS the growth percentage. Pass no `growth` prop there.
2. **`ordinalSuffix` is required** wherever a leaderboard rank is displayed (handles 11th/12th/13th teens).
3. **`btoRatio` = `(adBudgetSpent / revenueGenerated) × 100`** — computed in `RevenueSummarySection`. Thresholds: `< 15` Low Risk, `15–30` Moderate, `≥ 30` High Risk.
4. **`SupportQuota` must include all 6 types** — `salesSupport`, `techSupport`, `contentSupport`, `adSupport`, `callCredits`, `groupCall`. Any new quota type added to the backend must also be added here.
5. **Section headings** — always `text-sm font-bold` + `color-text-normal` (white), never muted uppercase.
6. **`totalHearts`** — derive from `lifelinesTotal ?? 0`; never default to 3 or 5.
