# ADMIN_REVENUE_MANAGEMENT_SPECKIT.md
## Admin Revenue Management — Member Mentorship Dashboard

**Status:** Implemented  
**Date:** 2026-10-08  
**Scope:** Additive — no changes to existing member-facing routes or components.

---

## Problem

"Your Revenue Stats" and "Weekly Revenue & Order Trajectory" on the member-facing Mentorship Dashboard
(`/batch-program/mentorship`) are member self-reported only. Admins cannot view or update a member's
revenue data from the admin panel, making centralized coaching and data correction impossible.

---

## Goal

Add a **Revenue tab** to the `MemberProgressModal` in the admin Members page. The tab allows admins
to view and edit any member's weekly revenue report. The member-facing dashboard reflects this data
immediately (shared write path — either member or admin can update the same `member_revenue_reports` row).

---

## Spec Items

### ARM-01 — Backend routes (members module)

Three new Clerk-protected routes in `members/routes.ts` + `members/controller.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/members/:id/mentorship/revenue` | Current or specific ISO week's row (query params `?week=N&year=N`) |
| `GET` | `/api/members/:id/mentorship/revenue/history` | Last 8 weeks, descending |
| `PUT` | `/api/members/:id/mentorship/revenue` | Upsert a week (body may include `weekNumber` + `year`) |

Response shape matches the existing user-facing endpoint (`getMentorshipRevenueHandler`).  
No DB changes — writes go to the same `member_revenue_reports` table.

---

### ARM-02 — Admin panel hooks (useTbt.ts)

Three new hooks appended to `useTbt.ts`:

| Hook | Key pattern | Stale time |
|------|-------------|------------|
| `useAdminMemberRevenue(memberId, weekNumber, year)` | `['members', id, 'revenue', wk, yr]` | 60 s |
| `useAdminMemberRevenueHistory(memberId)` | `['members', id, 'revenue-history']` | 300 s |
| `useAdminUpsertMemberRevenue(memberId)` | mutation; invalidates both above | — |

---

### ARM-03 — Revenue tab in MemberProgressModal (members/page.tsx)

Add `"revenue"` to the `activeTab` union. Add tab button "Revenue". Tab renders:

**A. Week Selector** — "Week N, YYYY" with `<` / `>` arrows. Default: current ISO week (IST).
Forward arrow disabled past current week. Uses `getIsoWeekOffset(offsetWeeks)` helper.

**B. Revenue Stats Cards (2×2 grid)**:
1. Revenue Generated — `₹N` + growth % + AOV sub-line + platform badge
2. Number of Orders — count + growth % + BTO ratio with risk badge
3. Ad Budget Spent — `₹N` + ROAS badge + CAC
4. Organic Inbound Leads — count + growth % + conversion rate

Cards use admin dark theme (`bg-[#1a1a1a]`, `border-[#2a2a2a]`, `text-[#f0f0f0]`).

**C. Weekly Revenue & Order Trajectory SVG chart** — Daily revenue (red solid) + order velocity
(yellow dashed). Only rendered when there is at least one non-null daily data point.

**D. Edit Form** (toggle "Edit Stats" / "Close Editor") — all 13 numeric fields + 7 daily revenue
inputs + 7 daily orders inputs (Mon–Sun). Save button enabled only when `isDirty`.

**E. History Strip** — read-only rows for past 6 weeks showing revenue total and order count.

---

## Files Changed

| File | Change |
|------|--------|
| `tbt-admin/backend/src/modules/members/controller.ts` | + `isoWeekAdminHelper`, `mapAdminRevenueRow`, 3 handler exports |
| `tbt-admin/backend/src/modules/members/routes.ts` | + 3 route registrations + import |
| `tbt-admin/admin-panel/lib/hooks/useTbt.ts` | + `AdminMemberRevenue` type + 3 hooks |
| `tbt-admin/admin-panel/app/members/page.tsx` | + Revenue tab, helpers, chart component, dashboard component |

**No changes to:**
- `tbt-user-web/` (member dashboard stays untouched)
- `user/controller.ts` or `user/routes.ts`
- `prisma.ts` (no new tables or columns)
