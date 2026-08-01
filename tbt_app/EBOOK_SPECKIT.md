# Ebook Feature Speckit

Full gap-fix plan for the ebook feature (mobile + backend + admin). Findings from the 2026-08-01 audit. Data plumbing is already dynamic — this speckit adds the **features and admin controls** that are missing.

Follow section-by-section; every item is independently shippable. Data-model additions come first because most member/admin features depend on them.

---

## 1. Current State Summary

**What already works** (do not touch):
- Books / categories / banners fully backend-fed via `/api/ebooks/**`.
- Admin has full CRUD at `admin-panel/app/ebooks/page.tsx` with hooks in `useEbooks.ts`.
- Bookmarks + reading progress round-trip via JWT-scoped endpoints.
- Prisma models: `Ebook`, `EbookCategory`, `EbookBanner`, `EbookBookmark`, `EbookProgress`.

**What's missing** (this speckit):
- Member-facing: search-by-author, ratings/reviews, highlights, streaks, share, series, author pages, offline library, trending, recommendations.
- Admin-facing: per-book analytics, batch access control, CSV import, bookmark viewer, pinning, scheduled-publish enforcement, bulk edit, extended metadata.
- Data models: `EbookReview`, `EbookHighlight`, `EbookReadingStreak`, `EbookAuthor`, `EbookSeries`, `EbookPublisher`.

---

## 2. Data Model Additions (Foundation)

**File**: `tbt-admin/backend/prisma/schema.prisma`
**Plus**: idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `plugins/prisma.ts` per the project convention.

### 2.1 New columns on existing `Ebook`
```
isbn                String?     @map("isbn")
language            String?     @default("en")
previewPages        Int?        @default(0)     @map("preview_pages")
previewPdfUrl       String?     @map("preview_pdf_url")
batchIds            Json?       @map("batch_ids")             // null = all, [] = none, [id] = restricted
pinnedAt            DateTime?   @map("pinned_at")   @db.Timestamptz(6)
pinnedUntil         DateTime?   @map("pinned_until") @db.Timestamptz(6)
seriesId            String?     @map("series_id")   @db.Uuid
seriesNumber        Int?        @map("series_number")
authorId            String?     @map("author_id")   @db.Uuid   // FK to EbookAuthor (nullable; keeps `author` string for legacy)
publisherId         String?     @map("publisher_id") @db.Uuid
ttsUrl              String?     @map("tts_url")
viewCount           Int         @default(0)         @map("view_count")
```

### 2.2 New models
```
model EbookAuthor {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  slug      String   @unique
  bio       String?
  photoUrl  String?  @map("photo_url")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  books     Ebook[]
  @@map("ebook_authors")
}

model EbookSeries {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String
  slug        String   @unique
  description String?
  coverUrl    String?  @map("cover_url")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  books       Ebook[]
  @@map("ebook_series")
}

model EbookPublisher {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  slug      String   @unique
  logoUrl   String?  @map("logo_url")
  country   String?
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  books     Ebook[]
  @@map("ebook_publishers")
}

model EbookReview {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId   String   @map("member_id") @db.Uuid
  bookId     String   @map("book_id")   @db.Uuid
  rating     Int                              // 1-5
  reviewText String?  @map("review_text")
  status     String   @default("pending")     // pending | approved | rejected
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  member     Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  book       Ebook    @relation(fields: [bookId],   references: [id], onDelete: Cascade)
  @@unique([memberId, bookId])
  @@index([bookId, status])
  @@map("ebook_reviews")
}

model EbookHighlight {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId       String   @map("member_id") @db.Uuid
  bookId         String   @map("book_id")   @db.Uuid
  pageNumber     Int      @map("page_number")
  selectedText   String   @map("selected_text")
  highlightColor String?  @default("yellow") @map("highlight_color")
  notes          String?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  member         Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  book           Ebook    @relation(fields: [bookId],   references: [id], onDelete: Cascade)
  @@index([memberId, bookId])
  @@map("ebook_highlights")
}

model EbookReadingStreak {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId       String    @unique @map("member_id") @db.Uuid
  currentStreak  Int       @default(0) @map("current_streak")
  longestStreak  Int       @default(0) @map("longest_streak")
  lastReadAt     DateTime? @map("last_read_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  member         Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@map("ebook_reading_streaks")
}
```

**Migration approach**: `npx prisma db push` in CI covers new models; add idempotent `ALTER TABLE` for the new columns on `ebooks` in `plugins/prisma.ts` startup (matches the workshops `batchIds` pattern).

**Acceptance**: `npx prisma generate` succeeds; startup runs without error against the prod DB.

---

## 3. P0 — Highest impact, ship first

### P0-1 — Author search + scheduled-publish enforcement
**Two 1-line wins bundled together.**

**Files**:
- `backend/src/modules/ebooks/controller.ts` — the `library` handler.

**Changes**:
1. Extend the search `where` clause from `{ title: contains }` to `{ OR: [{ title: contains }, { author: contains }] }`.
2. Add `publishDate: { lte: new Date() }` to the member-facing list query so future-dated books are hidden until their publish date.

**Acceptance**:
- Searching for an author name returns matching books.
- Creating a book with `publishDate` set 24 h in the future doesn't appear in the mobile library, but appears exactly at that time (no cron needed — filter is query-time).

**Effort**: 15 min. **Risk**: low.

---

### P0-2 — Batch access control on Ebook
**Match the pattern already in `Workshop.batchIds` (`schema.prisma:*`) and `AppResource.visibility`.**

**Files**:
- `schema.prisma` — the `Ebook.batchIds Json?` column added in §2.1.
- `plugins/prisma.ts` startup — `ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS batch_ids JSONB`.
- `backend/src/modules/ebooks/controller.ts` — list + detail handlers.
- `admin-panel/app/ebooks/page.tsx` — BookForm multi-select.

**Changes**:
- **List endpoint**: return every active book, but compute `locked: boolean` per book based on the calling member's `batchId`. Never filter the list — match how workshops render locked overlays.
- **Detail endpoint**: return 403 if `batchIds` is a non-empty array and the caller's `batchId` isn't in it.
- **Admin form**: multi-select dropdown listing batches (reuse the `useListBatches` hook from workshops).

**Acceptance**:
- Setting `batchIds: [batchA]` on a book: members in `batchA` can open it; members in `batchB` see it locked; members with no batch see it locked; leaving `batchIds: null` = available to all.
- Admin UI persists the array as JSON in Postgres.

**Effort**: 45 min. **Risk**: low (proven pattern).

---

### P0-3 — Per-book analytics endpoint + admin tab
**Admin can't see whether books are actually being read.**

**Files**:
- `backend/src/modules/ebooks/controller.ts` — new `adminBookAnalyticsHandler`.
- `backend/src/modules/ebooks/routes.ts` — `GET /admin/books/:id/analytics`.
- `admin-panel/lib/hooks/useEbooks.ts` — `useEbookAnalytics(bookId)`.
- `admin-panel/app/ebooks/page.tsx` — new "Analytics" tab inside the book detail modal.

**Response shape**:
```ts
{
  totalOpens: number,          // count of EbookProgress rows for this book
  completedCount: number,      // where completed = true
  completionRate: number,      // completedCount / totalOpens
  avgPageReached: number,      // AVG(currentPage) across progress rows
  totalBookmarks: number,      // count of EbookBookmark rows
  activeReaders30d: number,    // members with progress updated in last 30 days
  viewCount: number,           // Ebook.viewCount (P1-6 populates this)
}
```

**Acceptance**:
- Admin opens any book → "Analytics" tab shows 6 numbers.
- Numbers change when a member updates progress.

**Effort**: 60 min. **Risk**: low.

---

### P0-4 — Ratings + reviews
**Social proof + admin moderation.**

**Files**:
- New model `EbookReview` (§2.2).
- Backend:
  - `POST /api/ebooks/books/:id/reviews` (member submit, upsert)
  - `GET /api/ebooks/books/:id/reviews?status=approved` (public list on detail page)
  - `GET /api/ebooks/admin/reviews?status=pending` (moderation queue)
  - `PUT /api/ebooks/admin/reviews/:id/status` (approve/reject)
- Admin UI: new "Reviews" tab with pending queue + approve/reject.
- Mobile UI:
  - `ebook_detail_screen.dart`: 5-star rating widget, average rating display, "Write a review" bottom sheet.
  - Reviews list section on detail screen.
- Include `averageRating`, `reviewCount` computed on the `getBook` detail response.

**Acceptance**:
- Member submits a rating → appears in pending queue.
- Admin approves → appears on detail screen and average rating recalculates.
- One review per (member, book) — upserting overwrites.

**Effort**: 4 h. **Risk**: medium (net-new UI on both sides).

---

### P0-5 — Reading streak
**Engagement/gamification, ties into the existing points ledger.**

**Files**:
- New model `EbookReadingStreak` (§2.2).
- Backend:
  - Every call to `POST /api/ebooks/progress` upserts the streak row for the member. Rule: if `lastReadAt` was yesterday → increment; if today → no-op; else reset to 1.
  - New endpoint `GET /api/ebooks/streak` returning `{ currentStreak, longestStreak, lastReadAt }`.
- Mobile: badge on `ebooks_screen.dart` header showing current streak (matches the workshop streak pattern).

**Acceptance**:
- Reading a book today, then again tomorrow, then again the day after → streak reads 3.
- Skipping a day → streak resets to 1 on next read.
- Endpoint returns 0 when no history exists.

**Effort**: 90 min. **Risk**: low.

---

## 4. P1 — Worth building next

### P1-1 — Bulk CSV import
Admin uploads `.csv` with `title, author, category, totalPages, pdfUrl, coverUrl` and rows are created in one shot.

**Files**:
- `POST /api/ebooks/admin/books/bulk-import` (multipart/form-data)
- Admin UI: file input + preview modal ("N books will be created / M errors") before commit.
- Rejects rows with duplicate `slug` (auto-generated from title).

**Effort**: 90 min.

### P1-2 — "Who bookmarked this" viewer
`GET /api/ebooks/admin/books/:id/bookmarks` returning `{ member: {id, name, avatarUrl}, pageNumber, createdAt }[]`.
Admin UI: new sub-view under the book detail modal.

**Effort**: 30 min.

### P1-3 — Pin at position / pin-until
Admin sets `pinnedAt` and optional `pinnedUntil`. Library sort order becomes:
`ORDER BY (pinned_at IS NULL) ASC, pinned_at DESC, sort_order ASC` (with `pinnedUntil > now()` filter).

**Effort**: 45 min.

### P1-4 — Series / multi-part books
New `EbookSeries` model + `seriesId` / `seriesNumber` on Ebook. Admin CRUD for series.
Detail screen: "Part 2 of 5 in _Series Name_" and next-in-series recommendation.

**Effort**: 3 h.

### P1-5 — Author profile page
New `EbookAuthor` model. Existing `Ebook.author` string field stays for legacy rows; admin can optionally link to an `EbookAuthor` row.
Mobile: tapping the author name on the detail screen opens `/ebook-author/:slug`.

**Effort**: 3 h.

### P1-6 — Trending / recently added rows on ebooks home
- Add `viewCount Int @default(0)` to `Ebook` (added in §2.1).
- Increment on each `GET /api/ebooks/books/:id` call from a member.
- New `GET /api/ebooks/trending?limit=10` sorted by view count in the last 30 days.
- Mobile: new row above "Library" section.

**Effort**: 60 min.

### P1-7 — Share button on detail screen
Add `share_plus` share intent: "Check out _[title]_ by _[author]_ on Tamil Business Tribe: https://app.tamilbusinesstribe.com/ebook/:slug".
Requires a public web route (Next.js page) that renders a preview + deep-links to the app.

**Effort**: 45 min (Flutter side) + 30 min (Next.js page).

### P1-8 — Highlights + notes
New model `EbookHighlight`. Reader UI: tap-and-hold → yellow highlight; long-press existing highlight → edit/delete + optional note.
Endpoints: full CRUD scoped to member.
Bonus: "My highlights" screen aggregating across all books.

**Effort**: 8 h. Highest UX lift but heaviest lift too.

### P1-9 — Extended metadata (ISBN, language, publisher)
Fields added in §2.1. Admin form inputs. `EbookPublisher` CRUD (§2.2).
No mobile UI change required (fields render on detail screen only if present).

**Effort**: 90 min.

---

## 5. P2 — Nice to have

- **Preview pages** (`previewPages` + `previewPdfUrl` in §2.1) — free sample chapter before paywall.
- **Offline library** — cache downloaded PDFs locally with a "Downloaded" badge and a purge control.
- **Recommendations engine** — interim: books from same category sorted by rating. Full: collaborative filtering (out of scope).
- **Text-to-speech** — `ttsUrl` field is added in §2.1; player integration is the actual work.
- **Bulk edit toolbar** — checkbox multi-select in admin books table + `PUT /admin/books/bulk-update`.
- **Reading stats dashboard** — admin sees org-wide reading hours, most-completed book, per-batch reading leaderboard.

---

## 6. Out of Scope

- Payments / paid ebooks (no monetization signal in the current app).
- DRM (the current PDFs are hosted via presigned R2/Bunny URLs; DRM would require Bunny DRM SDK + client-side player rewrite).
- Multi-tenancy / white-label libraries.
- Rewriting `ebooks_screen.dart` for pagination — infinite scroll works fine at the current library size.

---

## 7. Verification Plan

Per fix, execute in this order:

1. **Backend**: `npx tsc --noEmit -p backend/tsconfig.json` clean. Then hit the new endpoint via `curl` or the admin panel — response shape matches spec.
2. **Admin**: open the new admin control, save a value, refresh — value persists in Postgres.
3. **Mobile**: `flutter run`, navigate to the affected ebook screen, take the action the spec describes — result is what the spec's acceptance criteria describe.
4. **Regression**: existing bookmark/progress flow still works; existing admin CRUD for books/categories/banners still saves.

For P0-2 (batch access): create two test members in different batches, restrict a book, log in as each and confirm the locked overlay + 403 behavior.

For P0-3 (analytics): open one book from a member account, refresh admin analytics tab, watch `totalOpens` tick up.

For P0-5 (streak): manually manipulate `EbookReadingStreak.last_read_at` to yesterday, call the progress endpoint, check the streak jumped by 1.

---

## 8. Fix Order & Rough Sizing

Foundation must land before any P0/P1 items that depend on new models.

| # | Fix | Effort | Depends on |
|---|-----|--------|------------|
| §2 | Data model additions (schema + startup ALTER TABLE) | 60 min | — |
| P0-1 | Author search + scheduled-publish filter | 15 min | — |
| P0-2 | Batch access control | 45 min | §2 (batchIds column) |
| P0-3 | Per-book analytics + admin tab | 60 min | — |
| P0-4 | Ratings + reviews | 4 h | §2 (EbookReview) |
| P0-5 | Reading streak | 90 min | §2 (EbookReadingStreak) |
| P1-1 | Bulk CSV import | 90 min | — |
| P1-2 | "Who bookmarked" viewer | 30 min | — |
| P1-3 | Pin at position / pin-until | 45 min | §2 (pinnedAt/pinnedUntil) |
| P1-4 | Series | 3 h | §2 (EbookSeries) |
| P1-5 | Author profile pages | 3 h | §2 (EbookAuthor) |
| P1-6 | Trending / view count | 60 min | §2 (viewCount) |
| P1-7 | Share button | 75 min | (small Next.js page) |
| P1-8 | Highlights + notes | 8 h | §2 (EbookHighlight) |
| P1-9 | ISBN / language / publisher metadata | 90 min | §2 (EbookPublisher, new columns) |

**P0 total**: ~8 h (mostly P0-4 ratings). **P1 total**: ~18 h. **Foundation adds 1 h.**

**Recommended split**:
- **Sprint 1 (1 day)**: §2 + P0-1 + P0-2 + P0-3 + P0-5 + P1-6. All infra + engagement. ~5 h.
- **Sprint 2 (1 day)**: P0-4 + P1-1 + P1-2 + P1-9. Social proof + admin QoL. ~7 h.
- **Sprint 3 (2 days)**: P1-4 + P1-5 + P1-8. Structural content features. ~14 h.
- **Backlog**: P1-3, P1-7, P2 items.
