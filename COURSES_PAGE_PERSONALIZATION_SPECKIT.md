# COURSES_PAGE_PERSONALIZATION_SPECKIT.md

**Feature:** Personalized Courses Page — Program-Driven Module Access + Dynamic Module Identity
**Status:** Phase 1 backend done; Phase 2 not started
**Date:** 2026-10-09

---

## Background & Problem

The current `/courses` page shows all course modules to everyone with uniform behavior. It attempts personalization using `me.businessType` as a `moduleTitle` filter — but `businessType` stores free-form strings like "Retail" or "Manufacturing", which never match the course module values of `'Product'`, `'Service'`, or `'Coach'`. This means the "personalization" silently does nothing.

Additionally, there is no distinction between:
- A new member who has never enrolled in anything (should see everything locked with a CTA)
- A batch program member (should see their program's specific course modules)
- A member with direct course access via purchase (should see their purchased courses)

The user's broader vision: when a member is enrolled in a single module (e.g. Product), the page should **not look like a generic course catalog**. It should transform into a dedicated, branded page for that module — its own hero, its own identity. The page adopts the module's name, banner, and description. Admin controls this dynamically, including per-member visibility overrides beyond the program default.

---

## Implementation Status

| Item | Status |
|---|---|
| CP-01 Backend: `programs.allowed_modules` ALTER TABLE | ✅ DONE |
| CP-02 Backend: admin program CRUD with `allowedModules` | ✅ DONE |
| CP-03 Backend: expose `programAllowedModules` in `GET /api/user-batch` | ✅ DONE |
| CP-04 Backend: `listUserCoursesHandler` returns `personalizationState` + `allowedModules` + `programName` in meta | ✅ DONE |
| CP-05 Admin: program editor multi-checkbox for Course Modules | ✅ DONE |
| CP-06 Admin hooks: `useCreateProgram`/`useUpdateProgram` include `allowedModules` | ✅ DONE |
| CP-07 User-web: `useCourseModuleTabs` hook exists | ✅ DONE |
| CP-08 User-web: three-state page layout | ❌ NOT DONE |
| CP-09 User-web: lock overlay copy variants | ❌ NOT DONE |
| CP-10 User-web: remove broken `businessType` track selector | ❌ NOT DONE |
| CP-11 Backend: `members.allowed_modules` column (per-member override) | ❌ NOT DONE |
| CP-12 Backend: `module_config` raw SQL table (per-module branding) | ❌ NOT DONE |
| CP-13 Backend: `listUserCoursesHandler` reads member override + module config | ❌ NOT DONE |
| CP-14 Admin: member edit modal — Course Module Access section | ❌ NOT DONE |
| CP-15 Admin: Module Config page (banners, taglines, per-module display) | ❌ NOT DONE |
| CP-16 User-web: dedicated single-module page mode | ❌ NOT DONE |
| CP-17 User-web: dynamic string labels (no hardcoded text) | ❌ NOT DONE |

---

## Page States (revised)

| Member State | Source | Page Mode |
|---|---|---|
| **New** — no batch, no course access | `personalizationState: 'new'` | Generic catalog, all locked, CTA → /programs |
| **Single-module program/override** — exactly 1 allowed module | `allowedModules.length === 1` | **Dedicated module page** — hero banner, module name as heading, no module tabs |
| **Multi-module program** — 2+ allowed modules | `allowedModules.length > 1` | Tabbed experience, only allowed modules shown |
| **Direct access** — no batch but has `CourseAccess` rows | `personalizationState: 'direct'` | Full catalog, per-`CourseAccess` lock state |

The decision of which page mode to render lives entirely in the frontend — the backend just returns `personalizationState`, `allowedModules`, and `moduleConfigs`.

---

## Data Model Additions (Phase 2)

### `members.allowed_modules` — per-member module override

```sql
-- In backend/src/plugins/prisma.ts startup block (idempotent):
ALTER TABLE members ADD COLUMN IF NOT EXISTS allowed_modules JSONB DEFAULT NULL;
```

- `null` (default) → use the member's program's `allowedModules` (or all modules if no program)
- `[]` (empty array) → member sees all modules (explicit "no restriction" override)
- `["Product"]`, `["Service", "Coach"]`, etc. → member sees only these modules, regardless of program

**Override priority:** `members.allowed_modules` (if not null) → `programs.allowed_modules` → all modules

---

### `module_config` — admin-configurable per-module branding

```sql
-- In backend/src/plugins/prisma.ts startup block (idempotent):
CREATE TABLE IF NOT EXISTS module_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name VARCHAR(50) NOT NULL UNIQUE,  -- 'Product' | 'Service' | 'Coach'
  display_name VARCHAR(100),                -- e.g. "Product Mastery"
  tagline VARCHAR(255),                     -- e.g. "Build products that sell themselves"
  description TEXT,                         -- paragraph shown in the module hero
  banner_url TEXT,                          -- R2-hosted hero image URL
  icon_url TEXT,                            -- small icon for tab chips
  accent_color VARCHAR(20),                 -- optional hex override e.g. "#d97706"
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Seed the 3 default rows (idempotent):
INSERT INTO module_config (module_name, display_name, sort_order)
VALUES ('Product', 'Product Mastery', 1),
       ('Service', 'Service Excellence', 2),
       ('Coach', 'Business Coach', 3)
ON CONFLICT (module_name) DO NOTHING;
```

---

## Phase 1 Items (CP-08 to CP-10) — User Web

### CP-08 — User Web: Refactor `/courses` page — three-state layout

**File:** `tbt-user-web/app/(platform)/courses/page.tsx`

#### Remove
- `memberTrack` / `me.businessType` logic (lines 398–408)
- The "Active track badge + clear" JSX block (lines 462–493)
- `updateProfile.mutate({ businessType: null })` call
- `useUpdateProfile` import (only used for businessType clear)
- `moduleTitle: memberTrack ?? undefined` from `useCourses` call

#### Derive personalization state

```typescript
const { data: catalogData, isLoading: catalogLoading } = useCourses({
  search: search || undefined,
  level: level !== "all" ? level : undefined,
  sort,
  category: category !== "all" ? category : undefined,
  limit: 100,
});

const personalizationState: 'program' | 'direct' | 'new' =
  (catalogData as any)?.meta?.personalizationState ?? 'new';
const allowedModules: string[] = (catalogData as any)?.meta?.allowedModules ?? [];
const programName: string | null = (catalogData as any)?.meta?.programName ?? null;

// Derived display mode
const isSingleModule = allowedModules.length === 1;
const isMultiModule  = allowedModules.length > 1;
```

#### Three-state rendering

**State: `new`** — all locked, CTA to /programs
```tsx
{personalizationState === 'new' && (
  <NewMemberCoursesView courses={catalogCourses} enrolledMap={enrolledMap} />
)}
```

**State: `program` or `direct` with single module** — dedicated module page
```tsx
{(personalizationState === 'program' || personalizationState === 'direct') && isSingleModule && (
  <SingleModuleView
    courses={catalogCourses}
    enrolledMap={enrolledMap}
    module={allowedModules[0]}
    programName={programName}
  />
)}
```

**State: `program` with multiple modules** — tabbed program view
```tsx
{personalizationState === 'program' && isMultiModule && (
  <ProgramCoursesView
    courses={catalogCourses}
    enrolledMap={enrolledMap}
    allowedModules={allowedModules}
    programName={programName}
  />
)}
```

**State: `direct`** (no single-module shortcut) — full catalog
```tsx
{personalizationState === 'direct' && !isSingleModule && (
  <DirectCoursesView courses={catalogCourses} enrolledMap={enrolledMap} />
)}
```

---

#### `NewMemberCoursesView` component

- Header: `uiStrings.coursesNewMemberHeading ?? "Course Modules"` + subtitle `uiStrings.coursesNewMemberSubtitle ?? "Enroll in a TBT program to unlock these modules"`
- Module tabs (Product / Service / Coach / All) — visible, but tap reveals "join a program" toast
- All courses rendered with `forceLockedNewMember=true` → always show lock overlay
- Lock overlay: `uiStrings.coursesLockJoinProgram ?? "Join a program to unlock"`
- Prominent CTA banner at top: `uiStrings.coursesNewMemberCtaLabel ?? "Explore Programs →"` → `/programs`
- Search bar hidden (no point filtering locked content)

---

#### `ProgramCoursesView` component

- Header: `uiStrings.coursesProgramHeadingPrefix ?? "Your"` + `programName ?? "Program"` + `" Modules"`
- Program chip next to header: program name pill
- Module tabs: only render tabs for modules in `allowedModules` plus "All"
- Courses: only show `course.module` in `allowedModules`, filtered client-side
- "Other Modules" collapsed accordion at the bottom:
  - Title: `uiStrings.coursesOtherModulesLabel ?? "Other Modules (not in your program)"`
  - Courses outside `allowedModules` rendered with `lockedOutsideProgram=true`
  - Lock overlay: `uiStrings.coursesLockNotInProgram ?? "Not included in your program"`
  - Toggle: `useState(false)` for `showOtherModules`

---

#### `DirectCoursesView` component

- Existing behavior: all module tabs, courses with `course.hasAccess` unlocked, others locked
- This is the existing catalog UI minus the businessType hack
- Search and filters remain visible

---

### CP-09 — User Web: Update lock overlay copy

The `ModuleCard` component needs a `lockReason` prop:

```typescript
type LockReason = 'join_program' | 'not_in_program' | 'purchase' | 'request_access';
```

Pass `lockReason` into `ModuleCard`. Compute it at the call site:

```typescript
const lockReason: LockReason =
  forceLockedNewMember   ? 'join_program'   :
  lockedOutsideProgram   ? 'not_in_program' :
  course.price > 0       ? 'purchase'       :
                           'request_access';
```

In the lock overlay, read from `uiStrings`:

| `lockReason` | Copy key | Fallback |
|---|---|---|
| `join_program` | `uiStrings.coursesLockJoinProgram` | "Join a program to access this module" |
| `not_in_program` | `uiStrings.coursesLockNotInProgram` | "Not included in your program" |
| `purchase` | `uiStrings.coursesLockPurchase` | "Purchase to unlock" |
| `request_access` | `uiStrings.coursesLockRequestAccess` | "Request access to unlock" |

---

### CP-10 — User Web: Remove broken `businessType` track selector

Remove from `page.tsx`:
- Line 398: `const memberTrack = (me as any)?.businessType as string | null | undefined;`
- Lines 402–409: `moduleTitle: memberTrack ?? undefined` in `useCourses` call
- Lines 462–493: "Active track badge + clear" JSX block
- `useUpdateProfile` import if not used elsewhere on this page
- `updateProfile.mutate({ businessType: null })` call

---

## Phase 2 Items — Dynamic Module Identity & Per-User Control

### CP-11 — Backend: `members.allowed_modules` column

**File:** `tbt-admin/backend/src/plugins/prisma.ts`

Add to the startup ALTER TABLE block:
```typescript
await prisma.$executeRawUnsafe(
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS allowed_modules JSONB DEFAULT NULL`
);
```

---

### CP-12 — Backend: `module_config` table + seed

**File:** `tbt-admin/backend/src/plugins/prisma.ts`

Add the CREATE TABLE + INSERT seed SQL from the Data Model section above. Split into separate `$executeRawUnsafe` calls (one per statement — see pitfall #32).

---

### CP-13 — Backend: Update `listUserCoursesHandler` — member override + module config

**File:** `tbt-admin/backend/src/modules/user/controller.ts`

**Change 1 — Read `members.allowed_modules` first:**

Extend the existing personalization context fetch to check member-level override before program:

```typescript
// After finding memberRow.batchId...
const memberModuleRow = await request.server.prisma.$queryRawUnsafe<any[]>(
  `SELECT allowed_modules FROM members WHERE id = $1::uuid`,
  request.memberId
).catch(() => []);
const memberModuleOverride = memberModuleRow[0]?.allowed_modules;

// If member has an explicit override (not null), use it regardless of program
if (memberModuleOverride !== null && memberModuleOverride !== undefined) {
  const parsed = Array.isArray(memberModuleOverride)
    ? memberModuleOverride
    : JSON.parse(memberModuleOverride);
  allowedModules = parsed;
  personalizationState = parsed.length > 0 ? 'program' : 'direct';
  sourceType = 'member_override';
} else if (memberRow?.batchId) {
  // existing program logic...
  sourceType = 'program';
} else {
  // direct / new logic...
  sourceType = 'none';
}
```

**Change 2 — Fetch `module_config` rows and include in response:**

```typescript
const moduleConfigs = await request.server.prisma.$queryRawUnsafe<any[]>(
  `SELECT module_name, display_name, tagline, description, banner_url, icon_url, accent_color
   FROM module_config ORDER BY sort_order`
).catch(() => []);
```

Add to the response meta:
```typescript
return ok(reply, data, {
  total,
  page: Number(page),
  limit: Number(limit),
  personalizationState,
  allowedModules,
  programName,
  sourceType,          // 'member_override' | 'program' | 'none'
  moduleConfigs,       // array of { moduleName, displayName, tagline, description, bannerUrl, iconUrl, accentColor }
});
```

Cache key stays `courses:personalization:${memberId}` — include `moduleConfigs` in the cached payload (60s TTL is fine since admin changes are infrequent).

---

### CP-14 — Admin: Member edit modal — Course Module Access section

**File:** `tbt-admin/admin-panel/app/members/page.tsx`

In the member edit/detail modal, add a **"Course Module Access"** section after the Program/Batch section:

```tsx
{/* Course Module Access */}
<div>
  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#606060' }}>
    Course Module Access
  </label>

  {/* Show what the program provides */}
  {member.batchProgramAllowedModules?.length > 0 && (
    <p style={{ fontSize: 12, color: '#606060', marginTop: 4, marginBottom: 8 }}>
      Program default: {member.batchProgramAllowedModules.join(', ')}
    </p>
  )}

  {/* Override toggle */}
  <div className="flex items-center gap-2 mb-3">
    <input
      type="checkbox"
      id="override-modules"
      checked={form.overrideModules ?? false}
      onChange={e => setField('overrideModules', e.target.checked)}
      style={{ accentColor: '#dc2626' }}
    />
    <label htmlFor="override-modules" style={{ fontSize: 13, color: '#a0a0a0', cursor: 'pointer' }}>
      Override program modules for this member
    </label>
  </div>

  {/* Module checkboxes — only shown when override is on */}
  {form.overrideModules && (
    <div className="flex gap-3">
      {['Product', 'Service', 'Coach'].map(mod => (
        <label key={mod} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={(form.allowedModules ?? []).includes(mod)}
            onChange={e => {
              const next = e.target.checked
                ? [...(form.allowedModules ?? []), mod]
                : (form.allowedModules ?? []).filter((m: string) => m !== mod);
              setField('allowedModules', next);
            }}
            style={{ accentColor: '#dc2626' }}
          />
          <span style={{ fontSize: 13, color: '#f0f0f0' }}>{mod}</span>
        </label>
      ))}
      <p style={{ fontSize: 11, color: '#606060', marginTop: 4 }}>
        Leave all unchecked to grant all modules.
      </p>
    </div>
  )}
</div>
```

**Backend write** — in `PATCH /api/members/:id` (or the member update endpoint), handle the new field:

```typescript
// After Prisma update, persist allowed_modules override via raw SQL
if (body.overrideModules === true) {
  const modules = Array.isArray(body.allowedModules) ? body.allowedModules : [];
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE members SET allowed_modules = $1::jsonb WHERE id = $2::uuid`,
    JSON.stringify(modules),
    params.id
  );
} else if (body.overrideModules === false) {
  // Clearing the override — restore program default
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE members SET allowed_modules = NULL WHERE id = $2::uuid`,
    params.id
  );
}
// Invalidate the personalization cache
void invalidateCache(req.server.redis ?? null, `courses:personalization:${params.id}`);
```

**Admin hook** — extend `useUpdateMember` mutation type to include `overrideModules?: boolean; allowedModules?: string[]`.

**Member list display** — in the member row, show a small chip "Module Override" (amber) when `allowed_modules` is not null.

---

### CP-15 — Admin: Module Config page (branding per module)

**File:** New page at `tbt-admin/admin-panel/app/settings/modules/page.tsx`

Add to the Settings sidebar section. Page shows a table with one row per module (Product / Service / Coach). Clicking a row opens an edit panel:

**Fields per module:**
- Display Name (text input) — shown as page heading in single-module mode
- Tagline (text input, max 80 chars)
- Description (textarea, max 300 chars) — shown in single-module hero
- Banner Image (R2 upload via `useGetPresignedUrl`, bucket `"site-assets"`, prefix `"module-banners"`)
- Icon Image (R2 upload, small icon for tab chips)
- Accent Color (color picker, optional — overrides `--color-accent` on the module page)
- Sort Order (number)

**Backend:**

Admin routes at `/api/config/modules` (add to the existing `config` module under Clerk auth):
```
GET  /api/config/modules         # list all module_config rows
PUT  /api/config/modules/:name   # upsert by module_name ('Product'|'Service'|'Coach')
```

The `PUT` handler does a simple `INSERT ... ON CONFLICT (module_name) DO UPDATE SET ...` raw SQL.

**Admin hooks** in `useTbt.ts`:
```typescript
export const useModuleConfigs = () => useQuery({ queryKey: ['module-configs'], queryFn: ... });
export const useUpdateModuleConfig = () => useMutation({ mutationFn: (body) => ... });
```

---

### CP-16 — User Web: Dedicated single-module page mode (`SingleModuleView`)

**File:** `tbt-user-web/app/(platform)/courses/page.tsx` — new `SingleModuleView` component

This is the centerpiece of Phase 2. When `allowedModules.length === 1`, the entire courses page transforms to look like a dedicated program page for that module.

```typescript
interface SingleModuleViewProps {
  courses: any[];
  enrolledMap: Map<string, any>;
  module: string;         // 'Product' | 'Service' | 'Coach'
  programName: string | null;
  moduleConfig: any;      // from meta.moduleConfigs — may be null/undefined
}
```

#### Layout structure

```
┌─────────────────────────────────────────────────────┐
│  MODULE HERO BANNER (full-width, ~280px tall)        │
│  ┌───────────────────────────────────────────────┐  │
│  │ banner image (bg) or gradient fallback        │  │
│  │                                               │  │
│  │ ✦ {programName chip}                          │  │
│  │ {moduleConfig.displayName ?? module}          │  │  ← large heading (overlay-text)
│  │ {moduleConfig.tagline}                        │  │  ← subtitle (overlay-meta)
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  PROGRESS SUMMARY BAR                               │
│  X of Y modules completed · Z% complete             │
├─────────────────────────────────────────────────────┤
│  SEARCH + FILTERS (level / sort)                    │
├─────────────────────────────────────────────────────┤
│  COURSE GRID (all courses in this module)           │
│  ModuleCard × N                                     │
└─────────────────────────────────────────────────────┘
```

#### Module hero banner

```tsx
function ModuleHero({ moduleConfig, module, programName }: {...}) {
  const hasBanner = !!moduleConfig?.bannerUrl;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: 240,
        borderRadius: 16,
        background: hasBanner ? undefined : moduleGradient(module),
      }}
    >
      {hasBanner && (
        <img
          src={moduleConfig.bannerUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* dark gradient over image */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />

      {/* Content */}
      <div className="absolute bottom-0 left-0 p-6">
        {programName && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
            {programName}
          </div>
        )}
        <h1 className="overlay-text" style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          {moduleConfig?.displayName ?? module}
        </h1>
        {moduleConfig?.tagline && (
          <p className="overlay-meta" style={{ margin: 0, fontSize: 14 }}>
            {moduleConfig.tagline}
          </p>
        )}
      </div>
    </div>
  );
}

// Fallback gradient per module (used when no bannerUrl is set)
function moduleGradient(mod: string) {
  if (mod === 'Product') return 'radial-gradient(ellipse at 30% 40%, #1a3a5c 0%, #0a1e30 60%, #050d18 100%)';
  if (mod === 'Service') return 'radial-gradient(ellipse at 30% 40%, #1a3c1a 0%, #0d2010 60%, #051005 100%)';
  if (mod === 'Coach')   return 'radial-gradient(ellipse at 30% 40%, #3c2a10 0%, #201508 60%, #100a02 100%)';
  return 'radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 100%)';
}
```

#### Progress summary bar

```tsx
function ModuleProgressBar({ courses, enrolledMap }: {...}) {
  const total = courses.length;
  const completed = courses.filter(c => enrolledMap.get(c.id)?.completedAt != null).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // read from uiStrings with fallback
  const label = uiStrings?.coursesProgressLabel
    ?? `{completed} of {total} modules completed · {pct}% complete`;

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6,
        fontSize: 12, color: '#a0a0a8' }}>
        <span>{label.replace('{completed}', String(completed)).replace('{total}', String(total)).replace('{pct}', String(pct))}</span>
        <Link href="/learning/badges" style={{ fontSize: 12, color: '#92929b', textDecoration: 'underline' }}>
          {uiStrings?.myBadgesLabel ?? 'My Badges'}
        </Link>
      </div>
      <div style={{ height: 4, background: '#2a2a2e', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-accent)',
          borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}
```

#### No module selector tabs in single-module mode

Since there is only one module, there are no tabs. Search and level/sort filters are visible. The "Section heading" says the module's `displayName`:

```tsx
<h2 style={{ fontSize: 18, fontWeight: 500, color: '#f5f5f7', marginBottom: 16 }}>
  {uiStrings?.coursesAllCoursesLabel ?? 'All Courses'}
</h2>
```

#### Accent color injection (when `moduleConfig.accentColor` is set)

If `moduleConfig.accentColor` exists, inject it as a CSS override scoped to this page section:

```tsx
{moduleConfig?.accentColor && (
  <style>{`:root { --color-accent: ${moduleConfig.accentColor}; }`}</style>
)}
```

This overrides the site-wide accent only for the single-module page. Reset on unmount via `useEffect` cleanup:
```typescript
useEffect(() => {
  if (!moduleConfig?.accentColor) return;
  const root = document.documentElement;
  const prev = root.style.getPropertyValue('--color-accent');
  root.style.setProperty('--color-accent', moduleConfig.accentColor);
  return () => { if (prev) root.style.setProperty('--color-accent', prev); else root.style.removeProperty('--color-accent'); };
}, [moduleConfig?.accentColor]);
```

---

### CP-17 — User Web: Dynamic string labels (zero hardcoded text)

**File:** `tbt-user-web/app/(platform)/courses/page.tsx` and related sub-components

Every user-visible label on the courses page must come from `uiStrings` (from `SiteConfigProvider`). Read `uiStrings` at the top of the page component:

```typescript
const { uiStrings } = useSiteConfig();
```

Required `uiStrings` keys (with fallbacks):

| Key | Fallback |
|---|---|
| `coursesPageTitle` | "Modules" |
| `coursesModuleCountLabel` | "{n} modules" |
| `coursesBadgesLinkLabel` | "My Badges" |
| `coursesNewMemberHeading` | "Course Modules" |
| `coursesNewMemberSubtitle` | "Enroll in a TBT program to unlock these modules" |
| `coursesNewMemberCtaLabel` | "Explore Programs →" |
| `coursesProgramHeadingPrefix` | "Your" |
| `coursesProgramModulesLabel` | "Modules" |
| `coursesOtherModulesLabel` | "Other Modules (not in your program)" |
| `coursesLockJoinProgram` | "Join a program to unlock" |
| `coursesLockNotInProgram` | "Not included in your program" |
| `coursesLockPurchase` | "Purchase to unlock" |
| `coursesLockRequestAccess` | "Request access to unlock" |
| `coursesSearchPlaceholder` | "Search modules..." |
| `coursesNoResultsLabel` | "No modules found" |
| `coursesClearFiltersLabel` | "Clear filters" |
| `coursesLoadMoreLabel` | "Load more ({n} more)" |
| `coursesAllCoursesLabel` | "All Courses" |
| `coursesProgressLabel` | "{completed} of {total} modules completed · {pct}% complete" |
| `coursesSavedVideosLabel` | "Saved Videos" |
| `coursesSavedVideosViewAllLabel` | "View All" |

The footer contact details (`helpdesk@tamilbusinesstribe.com`, phone) should also move to `config.supportEmail` and `config.supportPhone` from `SiteConfig` rather than being hardcoded in `PageFooter`.

---

## Complete Decision Tree (revised)

```
Member loads /courses
       │
       ├── catalogData?.meta loaded?
       │         No → show skeleton
       │
       ├── personalizationState === 'new'
       │         → <NewMemberCoursesView>
       │           All modules visible, all locked
       │           CTA banner → /programs
       │
       ├── allowedModules.length === 1
       │         → <SingleModuleView module={allowedModules[0]}>
       │           Module hero banner (image or gradient)
       │           displayName from moduleConfig
       │           Progress bar
       │           Search + filters
       │           Full course grid for that module
       │           (NO module tabs)
       │
       ├── personalizationState === 'program' && allowedModules.length > 1
       │         → <ProgramCoursesView>
       │           Tabs = allowedModules chips only
       │           Courses filtered to allowed modules
       │           "Other Modules" collapsed at bottom
       │
       └── personalizationState === 'direct'
                 → <DirectCoursesView>
                   All module tabs
                   Courses with CourseAccess → unlocked
                   Others → locked (purchase/request copy)
```

---

## Implementation Order

Phase 1 (frontend-only, backend already done):
```
CP-10  Remove businessType hack (2 lines removed — do this first)
CP-09  Lock overlay copy variants (ModuleCard prop)
CP-08  Three-state page layout (NewMemberCoursesView + ProgramCoursesView + DirectCoursesView)
```

Phase 2 (backend then admin then user-web):
```
CP-12  Backend: module_config table + seed rows
CP-11  Backend: members.allowed_modules column
CP-13  Backend: listUserCoursesHandler — member override + moduleConfigs in meta
CP-15  Admin: Module Config settings page + routes
CP-14  Admin: Member edit modal — Course Module Access section
CP-16  User-web: SingleModuleView (dedicated module page mode)
CP-17  User-web: Replace all hardcoded strings with uiStrings
```

---

## What to Leave Alone

| Item | Reason |
|---|---|
| `CourseAccess` records | Still the source of truth for actual course access; `allowedModules` only affects catalog UX |
| Course player / lesson lock logic | Unchanged — `hasAccess` in course detail handler is unchanged |
| `useMyEnrollments` hook | Unchanged — still shows enrollment progress |
| Module tabs in admin panel course list | No change |
| `courses.module` values (Product/Service/Coach) | No change |
| `useCourseModuleTabs` hook | Now used only for `ProgramCoursesView` tab rendering |

---

## Out of Scope

- Auto-granting `CourseAccess` when a member is assigned to a batch (separate feature)
- Per-course unlock progression within a program (e.g., unlock Module 2 only after completing Module 1)
- Multiple concurrent program enrollments for the same member
- Custom module names beyond Product/Service/Coach (would require schema extension)
- Module-specific sub-routes (e.g., `/courses/product`) — the page stays at `/courses`, layout transforms in-place
