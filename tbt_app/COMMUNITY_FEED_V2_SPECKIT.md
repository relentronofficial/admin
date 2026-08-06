# Community Feed v2 Speckit — Social-Media-Grade Overhaul

> Baseline: `COMMUNITY_SPECKIT.md` (v1 shipped, ~19% → ~40% coverage).
> Reference apps: LinkedIn feed · X/Threads · Instagram feed · Facebook groups.
> Target: `F:/admin/tbt_app/lib/features/community/` and companion backend + admin.
>
> **Generated**: 2026-07-21 · **Total items**: 30 · **Total effort**: ~5–7 dev days
> · **Backend items**: 7 · **Mobile items**: 22 · **Admin items**: 1

---

## Legend
- **UX** = Critical UX gap (kills "social media feel")
- **Feature** = Functional feature gap
- **Polish** = Nitpick / visual refinement
- **P** = Priority: **P0** must-ship for v2 · **P1** high value · **P2** nice-to-have

---

## 1. Inline composer at top of feed  · UX · P0

**Behavior**: A compact composer card sits above the feed list — same pattern as LinkedIn's "Start a post" or Instagram's create sheet. Tap anywhere on the collapsed pill to expand it (or route to full home composer for MVP).

**Design**:
- Collapsed height 60 px, radius 16, `bgSurface`, border `borderCard @ 0.4`
- Row: `me.avatarUrl` 40×40 · text `"Share a win, insight, or milestone…"` (14 px `textMuted`) · image icon 20 (blue #2F80ED) · video icon 20 (green #27AE60)
- Onboard-style shadow: `black @ 0.05`, blur 12, y 2
- On tap → `push(AchievementComposer())` as a full modal, or expand inline

**Backend**: No new endpoint (reuses `POST /api/community/feed`)
**Effort**: 2 h · **Files**: `lib/features/community/presentation/community_screen.dart` + new `_InlineComposerCard` widget

---

## 2. Real avatar photos + colored initial fallback  · UX · P0

**Behavior**: Wherever no `avatarUrl`, generate a deterministic pastel gradient background from the member id (hash → HSL) with the initial letter in white. LinkedIn/GitHub-style avatar rings for mentors.

**Design**:
- Fallback: `Container(gradient: LinearGradient(_hslFromId(memberId)))` — hue from `memberId.hashCode`, saturation 60%, lightness 55%
- Mentor avatars get 2 px gold `#D4AF37` ring with 4 px `bgSurface` gap (photo-frame effect)
- Extract to `lib/shared/widgets/member_avatar.dart` (reusable across features)

**Effort**: 1.5 h · **Files**: new `member_avatar.dart`, replace all `_Avatar` usages in community + comment sheet + drawer

---

## 3. Filter tabs (For You / Following / Mentors / My Posts)  · UX · P0

**Behavior**: Segmented tab bar under the app bar. `For You` = all approved · `Following` = posts by members I follow (requires user_connections) · `Mentors` = `isMentor=true` only · `My Posts` = `memberId=me` (any status, including pending — with "Pending approval" pill).

**Design**:
- Sticky TabBar under the AppBar, height 44, `bgSurface` bg, red indicator (3 px), inactive text `textSecondary`, active text `accent`
- Labels 12 px w800 uppercase letter-spacing 0.5
- Optional counts on Mentors + My Posts

**Backend**: Extend `GET /api/community/feed?filter=all|following|mentors|mine` — filter accordingly. `following` returns `[]` until user_connections is wired.

**Effort**: 3 h (backend 1 h + mobile 2 h) · **Files**: `controller.ts` + `community_screen.dart`

---

## 4. Post card visual hierarchy overhaul  · UX · P0

**Behavior**: Redesign the card so it reads top-down like a Threads/LinkedIn post — dense meta row, generous content, clear action band.

**Design deltas** (from v1 → v2):

| Prop | v1 | v2 |
|---|---|---|
| Card padding | 14 | 16 |
| Card radius | 14 | 16 |
| Card shadow | none | `black @ 0.05` blur 12 y 2 |
| Header row | 40 avatar + 8 gap + name/time stacked | 44 avatar + 12 gap + `name · relative_time` inline (time right-aligned muted small) |
| Mentor badge | left of name | right of name, gold gradient pill |
| Content font | 14 / line 1.45 | 15.5 / line 1.55 / textPrimary |
| Media block margin | mt 12 | mt 14 |
| Action band | inline row with divider above | separate band (padding V 8), `bgInput @ 0.4` background, icons 22, counts 13 w700 |
| Overflow ⋮ | none | 20 px, top-right corner |

**Effort**: 2 h · **Files**: `community_screen.dart` (`CommunityPostCard`)

---

## 5. Like button tap animation  · UX · P0

**Behavior**: On tap, heart scale-bounces `1.0 → 1.4 → 1.0` over 300 ms `elasticOut` and color transitions muted → red. Add a subtle red ring pulse behind it (like Twitter/X).

**Design**:
- Wrap icon in `AnimatedScale + AnimatedContainer` inside a `GestureDetector`
- Optional: emit a `CustomPaint` particle burst (3 small red hearts drift up + fade over 600 ms) on first-time like — LinkedIn does this
- Haptic feedback: `HapticFeedback.lightImpact()` on tap

**Effort**: 1.5 h · **Files**: `community_screen.dart` — extract `_LikeButton` widget

---

## 6. Engagement summary line  · UX · P1

**Behavior**: Above the action band, render "Liked by **Priya** and **86 others** · **2 comments**". Tap "Priya" → opens profile sheet. Tap "86 others" → opens a bottom sheet listing all likers.

**Design**:
- 12 px `textSecondary`, bold names inline
- Only render when `likesCount > 0`
- Hidden if `likesCount === 0 && commentsCount === 0`

**Backend**: New endpoint `GET /api/community/posts/:id/likers?limit=1` — returns `{ likers: [{firstName, lastName}], othersCount }`. Also add `GET /api/community/posts/:id/likers/full?page=` for the bottom sheet.

**Effort**: 3 h (backend 1 + mobile 2) · **Files**: `controller.ts`, `routes.ts`, `community_service.dart`, `community_screen.dart`

---

## 7. Refined relative time  · Polish · P0

**Behavior**: Correct format across timescales, muted small caps.

**Rules**:
- `<60 s` → `just now`
- `<60 min` → `${n}m`
- `<24 h` → `${n}h`
- `<7 d` → `${n}d`
- `<52 w` → `${n}w`
- else → `MMM d` (e.g., `Jul 20`)
- If `year != current` append year

**Design**: 11 px `textMuted` w600, right-aligned in header row. Preceded by `·` separator between name and time.

**Effort**: 30 min · **Files**: helper `_relativeTime` in `community_screen.dart` — extract to `lib/shared/utils/time_ago.dart`

---

## 8. Overflow ⋮ menu on each post  · UX · P0

**Behavior**: Tap ⋮ (top-right of card) → `showModalBottomSheet` with actions.

**Actions** (by author-vs-viewer):
- **Not author**: Save (bookmark) · Copy link · Report · Hide from feed · Follow @author
- **Author**: Save · Copy link · Edit (v3) · **Delete post** · View insights (mentor-only)
- **Mentor viewing non-mentor**: adds "Approve/Un-approve" shortcut (in-app moderation for mentors)

**Design**:
- Sheet padding V 12, drag handle
- Each action: `ListTile` icon 20 + label 15 · destructive (Delete/Report) in red
- Confirmation dialog for Delete

**Backend**: `DELETE /api/community/posts/:id` (member self-delete — currently admin-only, extend controller to allow if `req.memberId === post.memberId`). Report → new `POST /api/community/posts/:id/report {reason}` writes to a new `post_reports` table.

**Effort**: 4 h (backend 1.5 + mobile 2.5)

---

## 9. Long-content collapse ("… see more")  · Polish · P0

**Behavior**: Cap post content at 3 lines by default. If overflow, show "…more" inline red link. Tapping expands to full text (no navigation).

**Design**:
- Use `LayoutBuilder + TextPainter` to detect overflow at the given width
- Toggle `_expanded` bool per card
- Animate expansion with `AnimatedCrossFade` (200 ms)

**Effort**: 1.5 h · **Files**: `_ExpandableContent` widget in `community_screen.dart`

---

## 10. Full-screen image viewer  · UX · P0

**Behavior**: Tap any post image → opens full-screen with pinch-to-zoom + swipe-to-dismiss + horizontal swipe across multi-image posts + share icon in top-right.

**Design**:
- New route `/community/image?url=&index=&total=` OR modal via `showGeneralDialog` with hero-transition
- Use `photo_view: ^0.15.0` package (add to pubspec) or `InteractiveViewer` (built-in)
- Black background, dismiss on drag down > 100 px

**Effort**: 2.5 h · **Files**: new `lib/features/community/presentation/image_viewer.dart`

**Dependency**: add `photo_view: ^0.15.0` OR use `InteractiveViewer`

---

## 11. Comment preview inline  · UX · P1

**Behavior**: Below the action band, show 1 top comment ("Comment by Priya: Massive congrats!…") + "View all N comments" link. Tap opens `CommentSheet`.

**Design**:
- Padding H 16 V 6, `textSecondary` "View all N comments" 12 px
- Bold comment author, regular comment text (1 line ellipsis)
- Only render when `commentsCount >= 1`

**Backend**: Extend feed handler to include `topComment: {content, member: {...}} | null` on each post. Query per-post is N+1 — use a single `groupBy` with `orderBy: createdAt asc, take: 1 per post` or a raw SQL DISTINCT ON.

**Effort**: 2.5 h · **Files**: `controller.ts` + `community_screen.dart`

---

## 12. Skeleton loading (shimmer)  · Polish · P0

**Behavior**: Replace the red `CircularProgressIndicator` with 3 shimmer skeleton cards that match the post-card layout.

**Design**:
- Use existing `shimmer: ^3.0.0` package (already in pubspec)
- Skeleton = card with gray boxes for avatar (44×44 circle), name (100×12 bar), time (60×10 bar), content (2 × full-width bars), image (16:10 rect), action row (3 × 40 bars)
- Base color `bgInput`, highlight color `bgInput @ 1.4x lightness`

**Effort**: 1 h · **Files**: new `_FeedSkeleton` widget

---

## 13. Pull-to-refresh with "new posts" pill  · UX · P1

**Behavior**: On refresh, if new posts arrive, show a floating pill "↑ 10 new posts" at the top of the scroll view for 3 s. Tap → scrolls to top. If no new posts → subtle "You're all caught up" toast.

**Design**:
- Pill: `bgSurface` bg, radius 20, padding H 14 V 8, red `↑` icon + text 12 w700
- Positioned top-center under the AppBar with slide-down animation (300 ms `easeOutBack`)

**Backend**: Track `since=<lastFetchedAt>` param on `GET /feed`; return `newSince: N` in meta.

**Effort**: 2 h · **Files**: `controller.ts` + `community_screen.dart`

---

## 14. Empty state with CTA button  · UX · P0

**Behavior**: Replace plain text with a full-height empty state: icon + heading + subheading + **primary red button "Share your first win"** that opens the composer.

**Design**:
- Icon `Icons.groups_rounded` 80 px `textMuted @ 0.5`
- Heading "No posts yet" 18 w800 `textPrimary`
- Subheading "Be the first to share a win with the tribe." 13 `textSecondary`
- Button 48 tall, full-width max 260, red bg, "Share your first win"

**Effort**: 45 min · **Files**: `_EmptyState` widget in `community_screen.dart`

---

## 15. FAB composer button  · UX · P1

**Behavior**: Floating action button bottom-right (56 px, red gradient, `+` icon) that opens the composer. Standard mobile pattern — always reachable while scrolling long feeds.

**Design**:
- `FloatingActionButton.extended` with icon `edit_note` + label "Post"
- Red bg with `#B30710` end gradient, shadow blur 16 y 6 alpha 0.35
- Hide on scroll-down, show on scroll-up (Twitter pattern) via `NotificationListener<ScrollNotification>`

**Effort**: 1.5 h · **Files**: `community_screen.dart`

---

## 16. Bookmark / Save posts  · Feature · P1

**Behavior**: Bookmark icon in overflow menu (or as a 4th action-row icon). Toggles saved state. Saved posts accessible via `/community/saved` route.

**Backend**: New `Bookmark` model (similar to `Like`) OR reuse `Like` with a `type: 'bookmark'` discriminator. Prefer new model:
```prisma
model PostBookmark {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId String @map("member_id") @db.Uuid
  postId String @map("post_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@unique([memberId, postId])
  @@map("community_post_bookmarks")
}
```

Endpoints:
- `POST /api/community/posts/:id/bookmark` — toggle
- `GET /api/community/bookmarks` — my saved posts

Extend feed handler to include `isBookmarkedByMe: bool` per post.

**Effort**: 4 h · **Files**: `schema.prisma` (add model) + `plugins/prisma.ts` (add startup SQL) + `controller.ts` + `community_service.dart` + `community_screen.dart` + new `SavedPostsScreen`

---

## 17. Share  · Feature · P1

**Behavior**: Tap Share → native share sheet with:
- Post URL (`https://app.tamilbusinesstribe.com/community/posts/:id`)
- Post content preview
- If images, first image URL

**Backend**: Public-facing deep link route `/community/posts/:id` (needs to work when unauthenticated → redirect to login and post-login continue).

**Effort**: 1 h (`share_plus` already in pubspec) · **Files**: `community_screen.dart` `_ActionButton(Share)` handler

---

## 18. Reply to comments (threaded)  · Feature · P2

**Behavior**: Each comment has "Reply" text link. Tap → composer input pre-fills `@user`. Nested comments render indented 32 px with a lighter connector line on the left.

**Backend**: Schema already supports `parentCommentId`. Update `POST /api/community/posts/:id/comments` to accept optional `parentCommentId`. Update `GET .../comments` to return a nested tree OR flat with `parentCommentId` and let the client render.

**Design**:
- Nested comments cap at 2 levels deep (Threads-style) — deeper replies flatten to level 2
- Show "5 replies" collapsible thread with expand chevron

**Effort**: 5 h (mobile 3.5 + backend 1.5) · **Files**: `controller.ts` + `community_service.dart` + `CommentSheet`

---

## 19. Like comments (heart on each comment)  · Feature · P2

**Behavior**: Small heart icon at the right of each comment row. Tap toggles like on that comment, with the same optimistic + animation pattern as post likes.

**Backend**: `Like` model already has `commentId String?` — extend controller with:
- `POST /api/community/comments/:id/like` — toggle
- Extend `GET .../comments` to include `likesCount + isLikedByMe` per comment

**Effort**: 2 h · **Files**: `controller.ts` + `community_service.dart` + `CommentSheet`

---

## 20. Author profile sheet  · UX · P1

**Behavior**: Tap avatar OR name in a post → opens a bottom sheet with:
- Cover image (or gradient fallback)
- Avatar + name + role
- Stats: Posts count · Followers · Following
- Bio (if available)
- "Follow" primary button + "Message" secondary
- Recent posts row (3 thumbnails)

**Backend**: New `GET /api/community/members/:id/profile` — returns joined data (member row + post count + follow counts + top-3 recent post covers).

**Design**:
- `DraggableScrollableSheet` initial 0.6, max 0.95
- Standard profile card layout — matches Instagram's profile sheet

**Effort**: 5 h (backend 2 + mobile 3) · **Files**: `controller.ts` + new `MemberProfileSheet` widget

---

## 21. Follow / unfollow member  · Feature · P1

**Behavior**: Follow button on profile sheet + overflow menu action. Adds row to `user_connections` table.

**Backend**: Check if `user_connections` table exists (from co-worker admin — likely need to create). Endpoints:
- `POST /api/community/members/:id/follow` — toggle
- `GET /api/community/members/me/following` — list I follow
- `GET /api/community/members/:id/followers` — their followers

**Schema (new)**:
```prisma
model MemberConnection {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  followerId String @map("follower_id") @db.Uuid
  followingId String @map("following_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  follower Member @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  following Member @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)
  @@unique([followerId, followingId])
  @@map("member_connections")
}
```

Enables the "Following" filter tab (#3).

**Effort**: 5 h (backend 3 + mobile 2)

---

## 22. Media upload on composer  · Feature · P0

**Behavior**: The composer currently accepts `XFile` but doesn't upload — posts submitted with images lose them. Fix: use existing R2 presigned URL flow.

**Backend**: Use existing `/api/upload/presigned-url` endpoint (bucket `community-posts`).

**Mobile flow**:
1. User picks image → local `XFile`
2. On submit, first `POST /upload/presigned-url` with contentType
3. `PUT` file bytes to `uploadUrl`
4. Pass `publicUrl` in `POST /community/feed`'s `mediaUrls`

**Effort**: 3 h · **Files**: `achievement_composer.dart` (add upload step before `submit`), possibly add helper `community_upload_service.dart`

---

## 23. Video posts  · Feature · P2

**Behavior**: Composer picks video → uploads to Bunny Stream (or R2 for MVP) → post displays thumbnail with play overlay → tap opens full-screen video player.

**Backend**: Reuse `POST /api/upload/bunny-video-create` (already exists). Post model schema already supports `hasVideo` + `videoThumbnail`.

**Design**:
- Thumbnail with dark overlay + `Icons.play_circle_fill` 60 px red centered
- Duration badge bottom-right (e.g., "0:47")
- Tap → `VideoPlayerScreen` (reuse from workshops)

**Effort**: 6 h (backend 2 + mobile 4)

---

## 24. Delete own post (from mobile)  · Feature · P0

**Behavior**: In overflow menu, "Delete" action for own posts. Confirms then calls `DELETE /api/community/posts/:id` (member-side).

**Backend**: Extend the existing admin-only `DELETE` to also allow author self-delete. Split into `memberDeleteOwnPostHandler` OR add auth check inside existing handler.

**Effort**: 1 h · Already covered by #8

---

## 25. Report post  · Feature · P2

**Behavior**: In overflow menu, "Report" opens sheet with reason radios (Spam · Harassment · Inappropriate · Misinformation · Other). Submit creates a report row + notifies admins via socket.

**Backend**: New table + endpoints:
```prisma
model PostReport {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  postId String @map("post_id") @db.Uuid
  reporterId String @map("reporter_id") @db.Uuid
  reason String @db.VarChar(50)
  detail String?
  status String @default("pending") @db.VarChar(20) // pending | resolved | dismissed
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  reporter Member @relation(fields: [reporterId], references: [id], onDelete: Cascade)
  @@map("community_post_reports")
}
```

- `POST /api/community/posts/:id/report {reason, detail}` (member)
- `GET /api/community/admin/reports?status=pending` (admin)
- `PUT /api/community/admin/reports/:id {status}` (admin resolve)

Admin panel gets a `Reports` tab on `/community` page.

**Effort**: 6 h (backend 3 + mobile 1 + admin 2)

---

## 26. @mentions in comments  · Feature · P2

**Behavior**: Typing `@` in comment box triggers member auto-suggest (search bottom sheet or inline dropdown). Selected member is stored as `@{memberId:firstName}` marker in the plain text. On render, the text is parsed and rendered as clickable spans that open profile sheet.

**Backend**:
- `GET /api/community/members/search?q=raj&limit=10` (member) — returns matching members
- Optional: notify mentioned members via `POST /notifications` (already exists)

**Design**:
- Use `flutter_mentions: ^2.0.1` package OR hand-roll with `TextEditingController` listener

**Effort**: 5 h (backend 2 + mobile 3)

---

## 27. Hashtag / URL auto-detection  · Feature · P2

**Behavior**: `#growth` → red clickable link → tap opens filtered feed by hashtag. URLs (`http://...`) render as clickable and open in `url_launcher`.

**Backend**: `GET /api/community/hashtag/:tag/feed?page=` — searches posts where content matches `#tag` word boundary.

**Design**:
- Use `flutter_linkify: ^6.0.0` package OR RegExp split into `TextSpan[]`
- Hashtag color `accent`, weight w700
- URL color `#2F80ED`, underline decoration

**Effort**: 3 h (backend 1 + mobile 2)

---

## 28. Infinite scroll pagination  · Feature · P0

**Behavior**: Feed loads 20 posts. When user scrolls near bottom, fetch next page. Loading indicator at bottom while fetching. "You've reached the end" text at true end.

**Backend**: Already supports `?page=` — no change.

**Mobile**:
- Use `ScrollController` with `.addListener` to detect near-bottom
- Manage list of pages in a `StateNotifier` (replace `FutureProvider` with `AsyncNotifier`)
- Guard against duplicate fetches with `_fetching` bool

**Effort**: 3 h · **Files**: refactor `communityFeedProvider` + `CommunityScreen`

---

## 29. Optimistic new-post insertion  · UX · P0

**Behavior**: When the composer submits, instantly insert the post at the top of the feed with a "Pending admin approval" gold pill. If backend errors, roll back with red toast.

**Design**:
- Author sees the post immediately (no "waiting for admin" confusion)
- Post shows the gold "Pending" pill + slightly dimmed opacity (0.85)
- On admin approval, the pill disappears (already handled via feed refresh)

**State**: The feed provider needs to accept optimistic inserts. Refactor to `AsyncNotifier` that exposes `insertPending(post)` and `commitOrRollback(post)`.

**Effort**: 3 h · **Files**: refactor `communityFeedProvider` + `achievement_composer.dart` + `_PendingPill` widget

---

## 30. Real-time updates via Socket.IO  · Feature · P1

**Behavior**: When another member posts / likes / comments, the feed updates live without pull-to-refresh. New posts appear at top with a subtle "1 new post ↑" pill.

**Backend**:
- Emit `community:post_created` in `memberSubmitPostHandler` (only after admin approves)
- Emit `community:post_liked` `{postId, likesCount}` in `memberToggleLikeHandler`
- Emit `community:comment_added` `{postId, commentsCount}` in `memberAddCommentHandler`
- Broadcast to `'community'` room

**Mobile**:
- Existing `getSocket()` singleton
- Subscribe in `CommunityScreen.initState`, unsubscribe in `dispose`
- On event: `ref.read(communityFeedProvider.notifier).applyDelta(event)`

**Effort**: 4 h (backend 2 + mobile 2)

---

## Rollout plan

### Batch A — "Feels like a social feed" (P0 UX + polish, ~1.5 days)
Ship 1, 2, 4, 5, 7, 8, 9, 12, 14. Instantly transforms the vibe. No backend changes required for most.

### Batch B — "Full functionality" (P0 features, ~2 days)
Ship 3, 10, 22, 28, 29. Adds filter tabs, image viewer, media upload, pagination, optimistic posts. Small backend touches.

### Batch C — "Engagement drivers" (P1, ~2 days)
Ship 6, 11, 13, 15, 16, 20, 21, 30. Add engagement summary, comment preview, new-posts pill, FAB, bookmarks, profile sheet, follow, real-time.

### Batch D — "Advanced" (P2, ~2 days)
Ship 17, 18, 19, 23, 25, 26, 27. Share, threaded/liked comments, videos, reports, mentions, hashtags.

---

## Dependencies to add

| Package | Version | For |
|---|---|---|
| `photo_view` | `^0.15.0` | #10 image viewer (or use built-in `InteractiveViewer`) |
| `flutter_linkify` | `^6.0.0` | #27 URL detection (optional) |
| `flutter_mentions` | `^2.0.1` | #26 @mentions (optional) |

Already installed: `shimmer`, `share_plus`, `just_audio`, `cached_network_image`, `socket_io_client`, `image_picker`, `file_picker`.

---

## New backend endpoints summary

| Method | Path | For item |
|---|---|---|
| GET | `/api/community/posts/:id/likers` | #6 |
| GET | `/api/community/posts/:id/likers/full` | #6 |
| POST | `/api/community/posts/:id/bookmark` | #16 |
| GET | `/api/community/bookmarks` | #16 |
| POST | `/api/community/posts/:id/report` | #25 |
| GET | `/api/community/admin/reports` | #25 |
| PUT | `/api/community/admin/reports/:id` | #25 |
| POST | `/api/community/comments/:id/like` | #19 |
| POST | `/api/community/members/:id/follow` | #21 |
| GET | `/api/community/members/me/following` | #21 |
| GET | `/api/community/members/:id/followers` | #21 |
| GET | `/api/community/members/:id/profile` | #20 |
| GET | `/api/community/members/search?q=` | #26 |
| GET | `/api/community/hashtag/:tag/feed` | #27 |

**Extend existing**:
- `GET /api/community/feed` — add `?filter=` (#3), `?since=` (#13), include `topComment` (#11), `isBookmarkedByMe` (#16)
- `GET /api/community/posts/:id/comments` — include `likesCount + isLikedByMe` per comment (#19), nested via `parentCommentId` (#18)
- `POST /api/community/posts/:id/comments` — accept `parentCommentId` (#18)
- `DELETE /api/community/posts/:id` — allow author self-delete (#24)

---

## New tables (Prisma)

- `community_post_bookmarks` (#16)
- `community_post_reports` (#25)
- `member_connections` (#21)

All three go into the idempotent `plugins/prisma.ts` startup SQL block per project convention.

---

## Summary

**30 items** across **UX (15) · Feature (13) · Polish (2)** — total effort **~5–7 dev days** for the full set.

**Fastest wins** (< 1 day each in Batch A): #1 inline composer, #2 avatar fallback, #4 card redesign, #5 like animation, #7 timestamps, #9 see-more, #12 skeleton, #14 empty state CTA.

**Highest-impact backend work**: #6 engagement summary (adds topComment + likers batch queries) and #11 comment preview — both require careful N+1 avoidance.

**Highest-risk feature**: #23 videos (needs Bunny Stream integration in mobile — new territory) and #26 mentions (typeahead UX is complex).

Recommended path: **ship Batch A immediately** (biggest visual jump), then Batch B in the following session, then Batches C and D as time permits.
