# PENDING_TASKS.md

Detailed implementation guide for the remaining PRD sections.
PRD source: `F:\admin\TBT_Admin_PRD.md`
Last updated: 2026-06-02

---

## How to Continue

1. Read `CLAUDE.md` for patterns, constants, and conventions
2. Read `PROJECT_STATUS.md` for what is done
3. Read `ARCHITECTURE.md` for file locations and hook names
4. Pick the next task below and implement it

All implementations follow the same pattern:
- Backend: add/update `backend/src/modules/<name>/routes.ts` + `controller.ts`
- Frontend hooks: add to `admin-panel/lib/hooks/useTbt.ts`
- Frontend page: edit `admin-panel/app/<route>/page.tsx`
- TypeScript check after: `cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | grep <filename>`

---

## NEXT IMMEDIATE TASK: 3.15 Resources (`/app-resources`)

### What exists
- `admin-panel/app/app-resources/page.tsx` — basic CRUD with title, description, fileUrl (text input), order, isVisible
- Backend routes at `/api/app-resources` — full CRUD + reorder already implemented
- Hooks: `useListAppResources`, `useCreateAppResource`, `useUpdateAppResource`, `useDeleteAppResource`, `useReorderAppResources`

### What is missing (PRD 3.15)
The current page uses a raw text input for `fileUrl`. Need to add:

1. **File upload** for main file (PDF/doc/xlsx/video/other → R2)
   - `bucket: "resources"`, `pathPrefix: "files"`
   - Auto-detect `fileType` from file extension
2. **Preview file upload** (optional lighter version for in-browser preview)
   - `bucket: "resources"`, `pathPrefix: "previews"`
3. **File Type Icon** upload (optional custom icon image)
   - `bucket: "resources"`, `pathPrefix: "icons"`
4. **Author** text field
5. **Date** date picker
6. **File Count** number input
7. **Preview Label** + **Download Label** text fields
8. **DnD reorder** — the `useReorderAppResources` hook exists but the grip icon is cosmetic
9. **List rows** should show file type badge, author, file count

### Implementation Steps

```typescript
// Form state (EMPTY_FORM):
{
  title: "",
  author: "",
  date: "",           // ISO date string
  fileUrl: "",        // from R2 upload
  previewUrl: "",     // from R2 upload (optional)
  fileType: "pdf",    // auto-detect from extension
  fileTypeIconUrl: "", // from R2 upload (optional)
  fileCount: 1,
  isVisible: true,
  previewLabel: "Preview",
  downloadLabel: "Download",
}

// File type auto-detection:
const detectFileType = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx"].includes(ext)) return "xlsx";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  return "other";
};
```

Upload component: reuse the `UploadBtn` pattern from hero-carousel (shows filename after upload, X to clear, file input hidden).

DnD: use the exact pattern from `settings/navigation/page.tsx` — `localItems`, `isDirty`, dragIndex ref, dragOver state, `handleSaveOrder`.

---

## Task 3.16: Products (`/products`)

### What exists
- `admin-panel/app/products/page.tsx` — basic CRUD (title, description, isVisible, order)
- Backend at `/api/products` — full CRUD + reorder exists
- Hooks: `useListProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useReorderProducts`

### What is missing (PRD 3.16)
1. **Thumbnail upload** — `bucket: "products"`, `pathPrefix: "thumbnails"`
2. **CTA management** — each product has multiple CTAs (label, url, type, openInNewTab, order)
   - CTA CRUD likely needs backend routes — check if they exist in `backend/src/modules/products/routes.ts`
   - If missing, add: POST `/api/products/:id/ctas`, PUT `/api/products/ctas/:ctaId`, DELETE `/api/products/ctas/:ctaId`
3. **Products Page Config** section at top of page
   - `useGetProductsPageConfig` + `useUpdateProductsPageConfig` hooks already exist
   - Add form: pageTitle (text) + pageBg (text, CSS gradient value)
4. **DnD reorder** — grip icon exists but not wired
5. **List rows** should show thumbnail

### Implementation Pattern for CTA inline editor
Within the create/edit modal for a product, add an inline CTA list:
```typescript
const [ctas, setCtas] = useState<any[]>([]);
// Add CTA button → push to local ctas array
// Each CTA row: label input, url input, type toggle (primary/secondary), openInNewTab checkbox, delete button
// On form save, include ctas in payload: { ...productFields, ctas }
```
Check if the backend `createProduct` controller already handles `ctas` array in the request body. If not, handle as separate API calls after the product is created/updated.

---

## Task 3.17: Notifications (`/app-notifications`)

### What exists
- `admin-panel/app/app-notifications/page.tsx` — basic send form (title, message, type) + sent list
- Backend at `/api/app-notifications` — full implementation
- Hooks: `useListAppNotifications`, `useSendAppNotification`, `useDeleteAppNotification`, `useGetNotificationStats`

### What is missing (PRD 3.17)
1. **Recipient targeting** — current form likely sends to "all members" only. Need:
   - **Broadcast** (all members) — current behavior
   - **Specific members** — multi-select member IDs (use search + chip UI)
   - **By Workshop** — select workshop → backend sends to all enrolled
   - **By Batch** — select batch → backend sends to all in batch
   - Use `useListBatches` (exists) for batch dropdown
   - Use `useListWorkshops` (exists) for workshop dropdown
   - For specific members: search input + `useListMembers` or similar
2. **Stats column** in sent notifications list
   - Use `useGetNotificationStats(notifId)` to show `totalRecipients` / `readCount`
   - Fetch per-row on expand or all at once

### Implementation Note
Check `backend/src/modules/app-notifications/controller.ts` to see what `recipientType` values it handles. The send payload should be:
```typescript
{
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "alert",
  recipientType: "all" | "members" | "workshop" | "batch",
  recipientIds?: string[],  // memberIds if recipientType=members
  workshopId?: string,      // if recipientType=workshop
  batchId?: string,         // if recipientType=batch
}
```

---

## Task 3.18: Member Progress (`/members/:id`)

### What exists
- `admin-panel/app/members/page.tsx` — member list
- No member detail page exists yet (`/members/[id]/page.tsx` does not exist)
- Hook: `useMemberProgress(memberId)` — already exists in `useTbt.ts`
- Backend route: `GET /api/workshops/:id/progress/:memberId` exists (via `getMemberProgressHandler`)

### What needs to be built
1. **Create** `admin-panel/app/members/[id]/page.tsx`
2. **Tab structure:** Info | Progress (add more tabs as needed)
3. **Info tab:** display member details (name, email, tier, enrolled workshops, badges)
   - Member badges: use `useListMemberBadges(memberId)`, `useAssignBadge(memberId)`, `useRemoveBadge(memberId)`
   - All badge definitions: use `useListAllBadges()`
4. **Progress tab:** for each enrolled workshop:
   - Workshop title + enrollment status chip
   - Overall progress % (progress bar)
   - Challenge breakdown table: Challenge title | Episodes Completed | Total | %
   - Assignment submissions list
   - Last active date

### Member detail page skeleton
```typescript
// File: admin-panel/app/members/[id]/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useGetMember } from "@/lib/hooks/useAdmin";
import { useMemberProgress } from "@/lib/hooks/useTbt";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: memberData } = useGetMember(id);
  const { data: progressData } = useMemberProgress(id);
  const member = memberData?.data;
  const progress = progressData?.data;
  // ...
}
```

Check if `useGetMember` exists in `useAdmin.ts` — if not, add:
```typescript
export const useGetMember = (id: string) =>
  useQuery({ queryKey: ['member', id], queryFn: async () => { const res: any = await apiClient.get(`/api/members/${id}`); return res; }, enabled: !!id });
```

Also check if `GET /api/members/:id` route exists in `backend/src/modules/members/routes.ts`.

---

## Additional Improvements (not in PRD, but noticed)

### Sidebar — Add Missing Links
The current `Sidebar.tsx` is missing some TBT links. These routes exist but aren't in the sidebar:
- Currently has: Hero Carousel, Sections, Courses, Workshops, Products, Resources, Notifications, Site Config, Navigation, UI Strings, Tiers, Badges

### Members Page — "View Details" Link
The members list page should link to `/members/:id` once the detail page exists. Currently the row likely has no such link.

---

## Checklist Before Each Implementation Session

Before starting any task:

1. Verify TypeScript is clean: `cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | head -20`
2. Check if backend route already exists (read `backend/src/modules/<name>/routes.ts`)
3. Check if hooks already exist (grep `useTbt.ts`)
4. Read the current page file to understand what already exists
5. Read PRD section in `F:\admin\TBT_Admin_PRD.md` for exact field requirements

After implementing:
1. Run TypeScript check on modified files
2. Update `PROJECT_STATUS.md` to mark section complete

---

## Common Pitfalls to Avoid

1. **Don't add `recorded` to delivery modes** — PRD says online/offline/hybrid only
2. **Content types** are `["series", "standalone", "podcast"]` — not video/doc/image/link
3. **CTA types** for hero carousel are `["internal", "external"]` — not primary/secondary/ghost
4. **Slug** auto-generates only in **create** mode — never auto-overwrite slug in edit mode
5. **Save Order button** should only appear when `isDirty=true` — not always visible
6. **Reorder endpoint** always expects `PUT <prefix>/reorder { ids: string[] }` — confirm endpoint exists in backend before adding hook
7. **File upload** always goes to R2 via presigned URL — never POST file to backend directly
8. **Duration auto-detect** only works client-side via `URL.createObjectURL` — not on server
9. **`useGetPresignedUrl`** is from `@/lib/hooks/useAdmin` — not from `useTbt`
10. **`apiClient` response interceptor** unwraps `response.data` — so hooks receive the full `{ success, data, meta, error }` object, not nested under `.data` again
