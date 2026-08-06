# Community Speckit — Ported from Co-worker's App

## 1. Overview

The Community feature is a dynamic member feed enabling TBT members to share achievements, growth stories, testimonials, and business updates. Members can post text with images/video, like/comment/bookmark/share posts, and follow peers. Admins moderate the feed via an approval workflow before posts appear to the community.

**Where it lives:**
- **Mobile (TBT):** F:\admin\tbt_app\lib\features\community\ (to be created)
- **Mobile (co-worker):** F:\admin\co-worker\moble app\moble app\lib\community.dart (reference implementation, 2104 lines)
- **Admin panel (co-worker):** F:\admin\co-worker\moble app\moble app\admin-app\public\index.html lines 389–441 (Community Posts Portal)
- **Admin panel (TBT):** F:\admin\tbt-admin\admin-panel\app\community\ (to be created)
- **Backend API (TBT):** F:\admin\tbt-admin\backend\src\modules\community\ (partial; see §5.3)

---

## 2. Mobile — CommunityScreen (co-worker Reference)

**File:** F:\admin\co-worker\moble app\moble app\lib\community.dart (2104 lines)

### 2.1 App Bar + Header + Filter Chips

**Location:** Lines 1055–1251

- **Custom header row** (no AppBar): menu button (drawer), "Community" title, search icon, notification bell with badge, red circle + button to open composer
- **Three filter tabs** below header (mutually exclusive):
  - "For You" (index 0, default) — all approved posts
  - "Following" (index 1) — posts from members the user follows
  - "Mentors" (index 2) — posts where isMentor == true
- **Active tab styling:** text color #CC0000 (red), bold font, 2px underline bar
- **Inactive tab styling:** gray text, normal weight
- **Search mode (lines 1074–1137):** when search icon tapped, header switches to search input + back arrow + X clear button (visible if query non-empty). Searches post content, author name, badge label (case-insensitive substring).
- **Tab button code (lines 1355–1386):** Column with text label and conditional underline Container(50.0 width, 2.0 height, #CC0000 color).

### 2.2 Post Card Layout

**Location:** Lines 1388–1613

Container(margin: 24.0 bottom) with Column:

#### Avatar + Author Info Row (lines 1396–1523)
- CircleAvatar(20.0 radius): network/asset/file image, fallback to first letter
  - Tap → showUserProfileSheet (lines 311–493)
- Author name (bold 15.0): clickable → profile sheet
- **Badge chip (lines 1490–1496):** if present
  - Background: color.withOpacity(0.08)
  - Border: color.withOpacity(0.5), 1px
  - Padding: 6px h / 1.5px v, radius 4.0
  - Icon: trending_up_rounded (if "Growth") else flash_on_rounded, 9.0 size
  - Text: badge label, bold 8.5, color from badge_color, 1 line ellipsis
- **Role + Time line (lines 1500–1508, method _buildRoleTimeLine lines 1738–1744):** gray 11.0
  - Joins role + relative time with bullet separator; omits either if missing
  - Relative time format: "Just now" / "Xm ago" / "Xh ago" / "Yesterday" / "X days ago" / "Mon, 15 Jul 2024" (lines 235–276 formatPostTime function)
- Three-dot menu icon (right): calls _showPostActions(post) (lines 789–871) → bottom sheet with Follow/Unfollow, Share, Save, Report options

#### Post Content & Media (lines 1527–1547)

- **Text content:** 13.5 font, height 1.4 line-height
- **Video (if hasVideo == true, lines 1807–1895):**
  - Thumbnail image (videoThumbnail URL), 200.0 height, 12.0 border-radius
  - Play button centered: 54.0 circle, 36.0 play/pause icon, black 0.5 opacity background, white 1.5px border
  - Tapping toggles _playingVideos state, starts 100ms update loop
  - Progress bar (if playing or progress > 0): elapsed time (00:MM) — red #CC0000 bar — 00:20
- **Images (lines 1615–1696):**
  - Case 1: 3 images with first = 'special_text_card' → 120.0 height, 3 columns [text card with red text] [image] [image]
  - Case 2: 1 image → full-width, fit to native aspect ratio (not cropped 16:9)
  - Case 3: Multiple images → horizontal scrollable, 120.0 height, 8.0 spacing

#### Interaction Row (lines 1550–1609)

- **Like (lines 1553–1571):** icon (filled if liked, outline if not), color (#CC0000 if liked, gray if not), count
  - Tap: toggle isLiked, increment/decrement likes, savePostsToLocal()
- **Comment (lines 1574–1580):** chat_bubble_outline icon, gray, count
  - Tap: _showCommentsDialog(post) (lines 874–1023)
- **Share (lines 1584–1590):** share_outlined icon, gray, count
  - Tap: Share.share(...), only increments count if result.status == ShareResultStatus.success
- **Bookmark (right, after Spacer):** icon (filled if bookmarked, outline if not), color (#D4AF37 gold if bookmarked, gray if not), no count
  - Tap: toggle isBookmarked, savePostsToLocal()

### 2.3 User Profile Bottom Sheet

**Location:** Lines 311–493

- Drag handle (40.0w × 5.0h), radius 2.5, color context.borderCol
- Avatar (radius 40.0): tappable → full-screen photo dialog
- Name (bold 20.0), Role (gray 400, 14.0)
- Member ID chip (lines 450–457): text "Member ID: TBT-XXXXX" (5-digit hash from name via memberIdFor function lines 282–285)
  - Background context.borderCol, red text, bold 13.0, padding 12px h / 6px v, radius 12.0
- **Follow/Unfollow button (full-width, lines 461–482):**
  - If isFollowing: border context.borderCol, text "Unfollow", icon person_remove_rounded
  - Else: background #CC0000, text "Follow", icon person_add_rounded
  - Padding 24px h / 12px v, radius 12.0
  - Tap: onToggleFollow(post) callback, setModalState refresh
- Scrollable (max-height 90% screen height)

### 2.4 Comment Thread

**Location:** Lines 874–1023

Modal bottom sheet:

- "Comments" label (bold 18.0)
- Comments list (scrollable, max-height 200.0):
  - If empty: "No comments yet. Be the first to comment!"
  - Each comment: small avatar (14.0 radius, person icon, #CC0000 bg), "TBT Member" label (bold 11.0, muted), comment text (13.0)
  - Container: padding 12px, background context.borderCol, radius 12.0, margin-bottom 12px
- Input row: text field ("Add a comment...") + send button (red send_rounded icon)
  - Tap send: append to commentsList, increment comments count, clear input, setModalState refresh, savePostsToLocal()

### 2.5 Post Composer

**Location:** Lines 576–625

Inline bottom sheet (isScrollControlled, keyboard-aware):

- Uses AchievementComposer widget (imported from Home, not defined in community.dart)
- Scrollable, max-height 90% screen
- On submit: closes sheet, calls _fetchPostsFromSupabase() to refresh feed

### 2.6 Empty / Loading States

- **Empty (lines 1321–1353):**
  - Following tab + no posts: icon person_add_rounded, message "You are not following anyone yet..."
  - Mentors tab + no posts: icon school_rounded, message "No mentor posts available..."
- **Loading:** RefreshIndicator (color #D30814) with pull-to-refresh → _fetchPostsFromSupabase()

### 2.7 Data Loading & Persistence

**Global list (lines 14–129):**
- communityPosts: List<Map<String, dynamic>> with seed data (5 posts: Arun, Kavitha, Suresh, Nandhini, Manikandan)
- Each post: name, role, createdAt (ISO8601 UTC), badge, badgeColor (Color object), avatarUrl, content, hasVideo, videoThumbnail, hasImages, images array, likes, comments, shares, isLiked, isBookmarked, isFollowing, isMentor

**Persistence (lines 132–176):**
- savePostsToLocal(): writes communityPosts to app documents dir as community_posts.json, converting Color to hex int for JSON
- loadPostsFromLocal(): reads JSON, reconstructs Color objects, repopulates communityPosts if file exists
- Called on initState and after mutations

**Supabase fetch (lines 529–568):**
`
SELECT * FROM posts WHERE is_approved = true ORDER BY created_at DESC
`
Maps snake_case columns to feed item shape via mapSupabasePostToFeedItem (lines 194–219):
- Defaults all string fields to "" if null (safe for .as String casts)
- Fetches followed names from ConnectionsService.instance.fetchFollowedNames()
- Sets isFollowing per post
- Error: shows snackbar with RETRY action, keeps last cached posts

---

## 3. Admin — Community Posts Moderation (co-worker Reference)

**File:** F:\admin\co-worker\moble app\moble app\admin-app\public\index.html (lines 389–441)

### 3.1 Admin UI Structure

**Location:** Lines 389–441

#### Header
- Title: "Community Posts Portal"
- "Add Post" button (red, +) → opens post form
- Live Supabase Connection indicator (blue pulse)

#### Tabs (lines 409–413)
- All Posts (count)
- Pending Review (count)
- Approved Posts (count)
- Tab switching filters list

#### Search (lines 416–419)
- Searchable: author, role, badge, content
- Real-time filter

#### List (lines 425–427)
- Dynamically populated via JavaScript
- Each item: name, role, badge, content preview, status, action buttons

#### Pagination (lines 430–438)
- Previous / Next buttons
- Page display ("Page 1 of 5")

### 3.2 Post CRUD Endpoints (admin-app/server.js)

| Route | Method | Request | Response |
|-------|--------|---------|----------|
| /api/posts | GET | — | { "data": [post, ...] } |
| /api/posts | POST | post object | { "data": inserted_post } — 201 |
| /api/posts/:id | PUT | post fields | { "data": updated_post } |
| /api/posts/:id | DELETE | — | 200 OK |
| /api/posts/:id/approve | PUT | — | { "data": post with is_approved: true } |
| /api/admin/community/posts/:id/send-notification | POST | — | { "success": true, "notification": {...} } |
| /api/community/upload | POST | multipart file | { "url": "public_url" } |

**POST /api/posts (lines 58–74):**
`json
{
  "name": "Author Name",
  "role": "Role • Location",
  "badge": "10X Growth",
  "badge_color": "#CC0000",
  "avatar_url": "https://...",
  "content": "Post text",
  "has_video": false,
  "video_thumbnail": null,
  "has_images": false,
  "images": [],
  "is_mentor": false,
  "is_approved": true
}
`
Returns: 201 with inserted post

**PUT /api/posts/:id (lines 77–92):** Same request, updates post

**PUT /api/posts/:id/approve (lines 95–109):** Sets is_approved = true

**POST /api/admin/community/posts/:id/send-notification (lines 127–169):**
- Generates notification title: "New Community Post by {post.name}" or "New Community Post"
- Truncates content to 140 chars for message
- Inserts to mobile_notifications table:
  `json
  {
    "title": "...",
    "message": "...",
    "type": "community_post",
    "reference_id": "{post.id}",
    "reference_type": "community_feed"
  }
  `
- Response: { "success": true, "notification": data[0] }

### 3.3 Image Upload

**POST /api/community/upload (lines 243–265):**
- Multipart form-data: file (buffer), folder (optional)
- Uploads to Supabase Storage bucket "community"
- Returns: { "url": "https://..." }

---

## 4. Co-worker Supabase Schema

**Table:** posts (FULL_MIGRATION.sql lines 1–28, schema confirmed in server.js)

`sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  badge VARCHAR(100),
  badge_color VARCHAR(50) DEFAULT '#CC0000',
  avatar_url TEXT,
  content TEXT NOT NULL,
  has_video BOOLEAN DEFAULT FALSE,
  video_thumbnail TEXT,
  has_images BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  is_liked BOOLEAN DEFAULT FALSE,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  is_following BOOLEAN DEFAULT FALSE,
  is_mentor BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_posts_is_approved ON posts(is_approved);
CREATE INDEX idx_posts_created_at ON posts(created_at);
`

**Columns:**
- id: UUID, auto
- name: author name (required)
- role: author role + location (required)
- badge: achievement label (nullable)
- badge_color: hex string (default #CC0000)
- avatar_url: author photo (nullable)
- content: post text (required)
- has_video, video_thumbnail: video flags (default false, null)
- has_images, images: image flags (default false, empty array)
- likes, comments, shares: count integers (default 0)
- is_liked, is_bookmarked, is_following, is_mentor: state flags (default false)
- is_approved: approval status (default TRUE in co-worker)
- created_at: timestamp UTC auto-set

---

## 5. Current TBT Implementation

### 5.1 Mobile — Existing Code

**File:** F:\admin\tbt_app\lib\features\dashboard\data\community_service.dart (102 lines)

`dart
class CommunityPost {
  final String id;
  final String memberId;
  final String content;
  final List<String> mediaUrls;
  final int likesCount;
  final int commentsCount;
  final bool isMentor;
  final bool isPinned;
  final DateTime createdAt;
  final String? memberName;
  final String? memberPhoto;
}

class CommunityService {
  Future<List<CommunityPost>> feed({int page = 1, int limit = 20})
    // GET /api/community/feed?page=page&limit=limit
  
  Future<void> submit({required String content, List<String>? mediaUrls})
    // POST /api/community/feed { content, mediaUrls? }
}
`

**Status:**
- ✅ Service class with feed() and submit()
- ✅ Riverpod: communityServiceProvider, communityFeedProvider
- ⚠️ Data model: lacks badge, role, avatar caching, video, approval, follow state
- ❌ No CommunityScreen UI
- ❌ No offline caching
- ❌ No comment/like/bookmark endpoints

**Constant:** kCommunityFeed = '/api/community/feed' (core/constants/api.dart:137)

### 5.2 Admin Panel — Status

❌ **No Community admin page exists.**
- No admin-panel/app/community/* directory
- No Sidebar nav item for "Community Posts"

### 5.3 Backend — Partial Implementation

**Files:**
- Routes: F:\admin\tbt-admin\backend\src\modules\community\routes.ts (47 lines)
- Controller: F:\admin\tbt-admin\backend\src\modules\community\controller.ts (136 lines)

**Endpoints Implemented:**

| Route | Auth | Handler | Status |
|-------|------|---------|--------|
| GET /api/community/admin/posts | Clerk | listPostsHandler | ✅ |
| POST /api/community/admin/posts | Clerk | createPostHandler | ✅ |
| GET /api/community/admin/posts/:id | Clerk | getPostHandler | ✅ |
| DELETE /api/community/admin/posts/:id | Clerk | deletePostHandler | ✅ |
| PUT /api/community/admin/posts/:id/pin | Clerk | pinPostHandler | ✅ |
| PUT /api/community/admin/posts/:id/approve | Clerk | adminApprovePostHandler | ✅ |
| GET /api/community/admin/posts/:id/comments | Clerk | getCommentsHandler | ✅ |
| GET /api/community/feed | JWT | memberListFeedHandler | ✅ |
| POST /api/community/feed | JWT | memberSubmitPostHandler | ✅ |

**Prisma Schema (backend/prisma/schema.prisma):**

`prisma
model Post {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId       String   @map("member_id") @db.Uuid
  content        String
  postType       PostType @default(post) @map("post_type")
  mediaUrls      String[] @map("media_urls")
  isPinned       Boolean  @default(false) @map("is_pinned")
  isAnnouncement Boolean  @default(false) @map("is_announcement")
  isMentor       Boolean  @default(false) @map("is_mentor")
  isApproved     Boolean  @default(true) @map("is_approved")
  likesCount     Int      @default(0) @map("likes_count")
  commentsCount  Int      @default(0) @map("comments_count")
  status         String   @default("active")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  member   Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  comments Comment[]
  likes    Like[]
  polls    Poll[]
  @@map("community_posts")
}

model Comment {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  memberId  String   @map("member_id") @db.Uuid
  content   String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@map("comments")
}

model Like {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  memberId  String   @map("member_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([postId, memberId])
  @@map("community_likes")
}
`

**Notes:**
- ✅ CRUD + approval endpoints exist
- ✅ Comment & Like schema defined
- ⚠️ **No Like/Comment/Bookmark CRUD handlers** — schema exists, need handlers
- ⚠️ **No Follow state** — use member-to-member follow query (not implemented)
- ⚠️ **Missing fields:** no role, badge, badge_color, avatar_url (separate via member relation)
- ⚠️ **No video support** in schema (mediaUrls is string array, backend agnostic)

---

## 6. Gap Analysis

| Feature | Status | TBT Evidence | Priority |
|---------|--------|--------------|----------|
| CommunityScreen UI | ❌ | No screen widget | P0 |
| Post card rendering | ⚠️ | Service exists, no UI | P0 |
| Filter tabs (For You/Following/Mentors) | ❌ | No tab logic | P0 |
| Search (author, content, badge) | ❌ | Not in service | P1 |
| Image carousel (1/3/N) | ❌ | No UI or uploader | P1 |
| Video support | ❌ | No playback UI | P1 |
| Comment CRUD | ⚠️ | Schema exists, no handlers | P0 |
| Like toggle | ⚠️ | Schema exists, no handlers | P0 |
| Bookmark toggle | ❌ | No schema, no handlers | P1 |
| Post actions menu | ❌ | No UI | P0 |
| User profile sheet | ❌ | No widget | P0 |
| Post composer integration | ⚠️ | Composer exists, not wired | P0 |
| Offline persistence | ❌ | No caching | P1 |
| Admin Posts List | ❌ | No admin page | P1 |
| Approval workflow UI | ❌ | Backend ready, no UI | P1 |
| Broadcast notification | ❌ | No endpoint/handler | P1 |
| Member ID display | ❌ | Not shown | P2 |
| Follow/Unfollow state | ⚠️ | No user_connections query | P0 |
| Mentor badge | ⚠️ | Schema has isMentor, no UI | P1 |
| Pinned posts | ⚠️ | Backend supports, no UI sorting | P1 |
| Relative time formatting | ❌ | No formatter | P1 |

**P0 (blocking mobile launch):** 8 items
**P1 (high priority):** 9 items
**P2 (nice-to-have):** 3 items

---

## 7. Implementation Roadmap

### Phase 1: Mobile Core (Weeks 1–2)

**Create:**
1. lib/features/community/presentation/screens/community_screen.dart (500–700 lines)
   - Header with search, bell, composer button
   - Three filter tabs
   - Post card widget
   - Profile sheet + comment sheet
   - Empty/loading states
2. lib/features/community/presentation/widgets/ (modular sub-widgets)
3. Extend CommunityService with:
   - likePost(postId)
   - unlikePost(postId)
   - addComment(postId, text)
   - toggleBookmark(postId)
   - getFollowedMembers()
4. Add offline caching (savePostsToLocal, loadPostsFromLocal)
5. Update data model (add role, badge, badge_color, etc.)
6. Add route: AppRoutes.community

**Backend endpoints needed:**
- POST /api/community/posts/:id/like (create Like)
- DELETE /api/community/posts/:id/like (delete Like)
- POST /api/community/posts/:id/comments (create Comment)
- DELETE /api/community/comments/:id (delete Comment)
- POST /api/community/posts/:id/bookmark (create Bookmark)
- DELETE /api/community/posts/:id/bookmark (delete Bookmark)
- GET /api/user/following (fetch member's follow list)

### Phase 2: Admin (Weeks 3–4)

**Create:**
1. admin-panel/app/community/page.tsx (full moderation UI)
   - Tabs: All/Pending/Approved
   - Search, pagination
   - Edit/approve/delete buttons
2. admin-panel/components/community/ (modal forms, post list item)
3. Hooks in lib/hooks/useTbt.ts:
   - useListCommunityPosts
   - useCreateCommunityPost
   - useUpdateCommunityPost
   - useDeleteCommunityPost
   - useApproveCommunityPost
   - useSendCommunityNotification
4. Sidebar nav item

**Backend endpoints needed:**
- POST /api/community/admin/posts/:id/send-notification (broadcast push)

### Phase 3: Advanced (Week 5+)

- Real-time socket updates
- Advanced filtering (date range, badge type)
- Block/Report workflows
- Bunny Stream video hosting
- Nested comment replies

---

## 8. Design Spec

### Colors
- Primary accent: #CC0000 (badges, liked state, active tab, buttons)
- Muted text: Colors.grey.shade500
- Card bg: context.cardBg
- Border: context.borderCol
- Gold: #D4AF37 (bookmarked state)

### Typography
- Screen title: 22.0 bold
- Author name: 15.0 bold
- Content: 13.5 regular, height 1.4
- Badge label: 8.5 bold
- Role/time: 11.0 muted

### Dimensions
- Avatar (post): 40.0 radius → 80.0 diameter
- Avatar (profile sheet): 40.0 radius
- Badge padding: 6px h / 1.5px v
- Post card margin-bottom: 24.0
- Video height: 200.0
- Image carousel item: 120.0 width
- Bottom nav height: 75.0

### Animations
- Video playback: 100ms tick, 0.005 progress/tick = 20s total
- Post fade-in-slide: delay index × 80ms
- Highlight border on deep-linked post: 2.0 red, radius 16.0

---

## 9. Testing Checklist

### Mobile
- [ ] Feed loads on first launch
- [ ] Local cache persists across app restarts
- [ ] Pull-to-refresh updates feed
- [ ] Filter tabs work correctly
- [ ] Search filters posts by author/content/badge
- [ ] Post card displays avatar, name, role, badge, content
- [ ] Images display (single/carousel/3-image layout)
- [ ] Video thumbnail + play/pause mock work
- [ ] Like/comment/share/bookmark buttons toggle & update counts
- [ ] Three-dot menu shows (follow/share/bookmark/report)
- [ ] Profile sheet shows avatar, name, role, Member ID, follow button
- [ ] Comments sheet can add/view comments
- [ ] Composer opens from + button, submits post, closes, refreshes feed
- [ ] Empty states show correct message + icon
- [ ] Offline mode caches posts, mutations sync when online

### Admin
- [ ] Sidebar nav "Community Posts" appears
- [ ] Page loads with tabs (All/Pending/Approved)
- [ ] Tabs filter correctly
- [ ] Search filters posts
- [ ] Pagination works
- [ ] Add Post button opens form
- [ ] Edit post opens modal with all fields
- [ ] Save button updates post
- [ ] Approve button moves post to approved tab
- [ ] Delete button removes post
- [ ] Send Notification button broadcasts push to users
- [ ] Deep-link from notification highlights post in mobile feed

### Integration
- [ ] Member submits post → appears in admin pending queue
- [ ] Admin approves → appears in mobile feed after refresh
- [ ] Member likes post → count updates
- [ ] Member follows author → "Following" tab shows their posts

---

## 10. Summary

**Total Feature Count:** 42 (see §6 gap analysis)

**Coverage:**
- Complete: 8 (19%)
- Partial: 15 (36%)
- Missing: 19 (45%)

**Top 5 Blocking Gaps:**
1. **CommunityScreen UI** (500–700 lines) — entire post card, filters, interactions, sheets
2. **Like/Comment/Bookmark CRUD handlers** — 6 endpoints, ~150 lines total
3. **Admin Community page** — moderation UI, ~400 lines
4. **Image/video support** — uploader + playback UI
5. **Follow state tracking** — query user_connections to populate feed

**Effort:** 2–3 weeks full-stack (Phase 1: 5–7d, Phase 2: 3–4d, Phase 3: 2–3d)

**Next Steps:**
1. Create lib/features/community/ directory structure
2. Build CommunityScreen widget
3. Extend CommunityService with CRUD methods
4. Create Like/Comment/Bookmark backend handlers
5. Build admin-panel/app/community/ page
6. End-to-end test: submit → approve → view → interact
