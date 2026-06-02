# EiFlix Admin — PRD + Database Schema

> Admin panel extensions for the TBT Admin Platform (`tbt-admin/`) that power all dynamic content served to the EiFlix user web.  
> Every field the user web displays is managed through these admin interfaces.

---

## 1. Admin Module Overview

| Module | Purpose |
|---|---|
| Site Config | Branding, theme colors, logo, footer, UI strings |
| Navigation | Manage navbar items and their order |
| Hero Carousel | Slides, CTAs, background videos/images |
| Content Sections | Home page row sections and their content items |
| Courses & Episodes | VOD content library |
| Workshops | Workshop creation, flow builder |
| Challenges | Challenges within workshops |
| Episodes (Workshop) | Video/assignment/offer items within challenges |
| Live Calls | Schedule and manage live sessions |
| Assignments | Assignment questions per challenge |
| Q&A Moderation | View, reply, delete Q&A posts |
| Resources | Upload and manage PDF/document library |
| Products | Manage product cards and CTAs |
| Tiers | Configure tier labels and unlock conditions |
| Badges | Member badge definitions |
| Notifications | Send broadcast or targeted notifications |
| Member Progress | View progress per member per workshop |
| Enrollment | Enroll/unenroll members in workshops |

---

## 2. Complete Database Schema (Prisma)

Add these models to `backend/prisma/schema.prisma` alongside the existing `Admin`, `Member`, `Batch` models.

```prisma
// ─── SITE CONFIGURATION ───────────────────────────────────────────────

model SiteConfig {
  id           String   @id @default(cuid())
  siteName     String
  logoUrl      String?
  faviconUrl   String?
  footerText   String
  splashLogoUrl String?
  splashDurationMs Int  @default(2000)

  // Theme
  accentColor  String   @default("#00c4cc")
  alertColor   String   @default("#ff3d8b")
  successColor String   @default("#22c55e")
  bgPrimary    String   @default("#000000")
  bgSurface    String   @default("#111111")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("site_configs")
}

model UiStrings {
  id                   String   @id @default(cuid())
  loading              String   @default("Loading...")
  noWorkshops          String   @default("No workshops enrolled yet.")
  noResources          String   @default("No resources found.")
  qaLoadingLabel       String   @default("Loading questions...")
  errorGeneric         String   @default("Something went wrong. Please try again.")
  lockedContentMessage String   @default("Upgrade your tier to unlock this content.")

  // Countdown unit labels
  countdownDays        String   @default("DAYS")
  countdownHours       String   @default("HOURS")
  countdownMins        String   @default("MINS")
  countdownSecs        String   @default("SECS")

  // Auth page labels
  loginHeading         String   @default("Welcome Back")
  loginSubheading      String   @default("Sign in to continue your journey")
  emailLabel           String   @default("Email")
  emailPlaceholder     String   @default("Enter your email")
  passwordLabel        String   @default("Password")
  passwordPlaceholder  String   @default("Enter your password")
  submitLabel          String   @default("Sign In")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("ui_strings")
}

// ─── NAVIGATION ───────────────────────────────────────────────────────

model NavItem {
  id        String   @id @default(cuid())
  label     String
  href      String
  order     Int
  isVisible Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("nav_items")
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────────

model HeroSlide {
  id              String   @id @default(cuid())
  order           Int
  title           String
  description     String?
  bgVideoUrl      String?
  bgImageUrl      String?
  bgMuteDefault   Boolean  @default(true)
  ctaLabel        String
  ctaUrl          String
  ctaType         String   @default("internal") // internal | external
  badgeText       String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("hero_slides")
}

// ─── HOME CONTENT SECTIONS ────────────────────────────────────────────

model ContentSection {
  id           String          @id @default(cuid())
  title        String
  slug         String          @unique
  order        Int
  isVisible    Boolean         @default(true)
  requiredTier Int             @default(1)
  lockBadgeText String?        // e.g. "UNLOCK"
  items        ContentItem[]
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@map("content_sections")
}

model ContentItem {
  id           String         @id @default(cuid())
  sectionId    String
  section      ContentSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  title        String
  thumbnailUrl String?
  requiredTier Int            @default(1)
  lockBadgeText String?
  contentType  String         @default("series") // series | standalone | podcast
  categoryTag  String?
  playUrl      String?
  order        Int
  isVisible    Boolean        @default(true)

  // If this item links to a Course
  courseId     String?
  course       Course?        @relation(fields: [courseId], references: [id])

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@map("content_items")
}

// ─── COURSES (VOD library) ────────────────────────────────────────────

model Course {
  id           String        @id @default(cuid())
  title        String
  slug         String        @unique
  description  String?
  thumbnailUrl String?
  requiredTier Int           @default(1)
  isActive     Boolean       @default(true)
  order        Int           @default(0)
  episodes     CourseEpisode[]
  contentItems ContentItem[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@map("courses")
}

model CourseEpisode {
  id              String   @id @default(cuid())
  courseId        String
  course          Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title           String
  thumbnailUrl    String?
  videoUrl        String
  durationSeconds Int      @default(0)
  order           Int
  isVisible       Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("course_episodes")
}

// ─── TIERS ────────────────────────────────────────────────────────────

model Tier {
  id                  String   @id @default(cuid())
  tierNumber          Int      @unique
  label               String   // e.g. "Tier 8"
  description         String?
  unlockConditionText String?  // shown on profile for locked tiers
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@map("tiers")
}

// ─── BADGES ───────────────────────────────────────────────────────────

model Badge {
  id              String         @id @default(cuid())
  label           String         // e.g. "BIG"
  color           String         @default("#ffffff")
  bgColor         String         @default("#a855f7")
  isActive        Boolean        @default(true)
  memberBadges    MemberBadge[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@map("badges")
}

model MemberBadge {
  id        String   @id @default(cuid())
  memberId  String
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  badgeId   String
  badge     Badge    @relation(fields: [badgeId], references: [id])
  awardedAt DateTime @default(now())

  @@unique([memberId, badgeId])
  @@map("member_badges")
}

// ─── WORKSHOPS ────────────────────────────────────────────────────────

model Workshop {
  id           String               @id @default(cuid())
  title        String
  slug         String               @unique
  description  String?
  thumbnailUrl String?
  isActive     Boolean              @default(true)
  deliveryMode String               @default("online") // online | offline | hybrid
  requiredTier Int                  @default(1)
  batchId      String?
  batch        Batch?               @relation(fields: [batchId], references: [id])

  // Sidebar tab config
  tabChallengesLabel  String        @default("Challenges")
  tabQaLabel          String        @default("Q & A")
  tabAssignmentLabel  String        @default("Assignment")

  // Progress widget config
  progressWidgetLabel String        @default("Learning Progress")
  progressMilestoneCount Int        @default(3)
  workshopFlowLabel   String        @default("Workshop Flow")

  // Back navigation
  backLabel    String               @default("Back")
  backUrl      String               @default("/workshops")

  enrollments  WorkshopEnrollment[]
  challenges   Challenge[]
  liveCalls    LiveCall[]
  flowItems    WorkshopFlowItem[]
  qaposts      QAPost[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@map("workshops")
}

model WorkshopEnrollment {
  id           String    @id @default(cuid())
  workshopId   String
  workshop     Workshop  @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  memberId     String
  member       Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  status       String    @default("active") // active | completed | cancelled
  enrolledAt   DateTime  @default(now())
  completedAt  DateTime?

  @@unique([workshopId, memberId])
  @@map("workshop_enrollments")
}

// ─── WORKSHOP FLOW ────────────────────────────────────────────────────

// Ordered list of items in the workshop sidebar flow
// Each item points to either a Challenge or a LiveCall
model WorkshopFlowItem {
  id           String    @id @default(cuid())
  workshopId   String
  workshop     Workshop  @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  order        Int
  type         String    // pre_requisite | challenge | live_call
  challengeId  String?
  challenge    Challenge? @relation(fields: [challengeId], references: [id])
  liveCallId   String?
  liveCall     LiveCall? @relation(fields: [liveCallId], references: [id])

  // For pre_requisite type
  label        String?   // "Pre-Requisite:"
  description  String?   // "This is your first step!"
  isCompleted  Boolean   @default(false)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@map("workshop_flow_items")
}

// ─── CHALLENGES ───────────────────────────────────────────────────────

model Challenge {
  id              String              @id @default(cuid())
  workshopId      String
  workshop        Workshop            @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  order           Int
  challengeNumber Int                 // display number (1, 2, 3...)
  numberLabel     String              // e.g. "Challenge 01:"
  numberColor     String              @default("#00c4cc")
  title           String
  description     String?
  episodes        WorkshopEpisode[]
  assignments     Assignment[]
  flowItems       WorkshopFlowItem[]
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@map("challenges")
}

// ─── WORKSHOP EPISODES ────────────────────────────────────────────────

model WorkshopEpisode {
  id              String    @id @default(cuid())
  challengeId     String
  challenge       Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  order           Int
  title           String
  type            String    // video | assignment | offer
  typeLabel       String    // "Video" | "Assignment" | "Offer" (configurable)
  videoUrl        String?
  durationSeconds Int?
  durationLabel   String?   // precomputed "10:35"
  lockIconType    String    @default("padlock")
  completedIconType String  @default("checkmark")
  progress        MemberEpisodeProgress[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@map("workshop_episodes")
}

model MemberEpisodeProgress {
  id              String           @id @default(cuid())
  memberId        String
  member          Member           @relation(fields: [memberId], references: [id], onDelete: Cascade)
  episodeId       String
  episode         WorkshopEpisode  @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  isCompleted     Boolean          @default(false)
  completedAt     DateTime?
  lastWatchedSecs Int              @default(0)
  updatedAt       DateTime         @updatedAt

  @@unique([memberId, episodeId])
  @@map("member_episode_progress")
}

// ─── LIVE CALLS ───────────────────────────────────────────────────────

model LiveCall {
  id                        String             @id @default(cuid())
  workshopId                String
  workshop                  Workshop           @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  order                     Int
  type                      String             // pre_requisite | mid_review | celebration | custom
  label                     String             @default("LIVE CALL:")
  labelColor                String             @default("#ff3d8b")
  title                     String
  scheduledAt               DateTime
  liveUrl                   String?            // null until unlocked
  liveUrlUnlocksMinutesBefore Int              @default(30)
  recordingUrl              String?
  recordingLabel            String?            // "Missed it? View Call 👇 shows the recording."
  prerequisiteNote          String?
  facilitatorName           String?
  facilitatorTitle          String?
  facilitatorDescription    String?
  stayTunedMessage          String             @default("Stay tuned — the link will unlock before the session begins")
  stayTunedColor            String             @default("#00c4cc")
  flowItems                 WorkshopFlowItem[]
  createdAt                 DateTime           @default(now())
  updatedAt                 DateTime           @updatedAt

  @@map("live_calls")
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────

model Assignment {
  id            String                 @id @default(cuid())
  challengeId   String
  challenge     Challenge              @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  order         Int
  title         String
  questionText  String
  typeLabel     String                 @default("QUESTION")
  iconType      String                 @default("document")
  submissions   AssignmentSubmission[]
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  @@map("assignments")
}

model AssignmentSubmission {
  id           String     @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  memberId     String
  member       Member     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  answerText   String
  submittedAt  DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Labels configurable via admin (can override global UI strings per assignment)
  completedIconType String @default("checkmark_green")
  yourAnswerLabel   String @default("Your Answer:")
  backLabel         String @default("Back")

  @@unique([assignmentId, memberId])
  @@map("assignment_submissions")
}

// ─── Q&A ──────────────────────────────────────────────────────────────

model QAPost {
  id           String    @id @default(cuid())
  workshopId   String
  workshop     Workshop  @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  memberId     String
  member       Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  questionText String
  replies      QAReply[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@map("qa_posts")
}

model QAReply {
  id         String   @id @default(cuid())
  postId     String
  post       QAPost   @relation(fields: [postId], references: [id], onDelete: Cascade)
  memberId   String?
  member     Member?  @relation(fields: [memberId], references: [id])
  adminId    String?
  admin      Admin?   @relation(fields: [adminId], references: [id])
  replyText  String
  createdAt  DateTime @default(now())

  @@map("qa_replies")
}

// ─── RESOURCES ────────────────────────────────────────────────────────

model Resource {
  id            String   @id @default(cuid())
  title         String
  author        String?
  date          DateTime?
  fileUrl       String
  previewUrl    String?
  fileType      String   @default("pdf") // pdf | doc | xlsx | video | other
  fileTypeIconUrl String?
  fileCount     Int      @default(1)
  order         Int      @default(0)
  isVisible     Boolean  @default(true)

  // Hover action labels
  previewLabel  String   @default("Preview")
  downloadLabel String   @default("Download")

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("resources")
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────

model Product {
  id           String       @id @default(cuid())
  title        String
  description  String?
  thumbnailUrl String?
  order        Int          @default(0)
  isVisible    Boolean      @default(true)
  ctas         ProductCta[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@map("products")
}

model ProductCta {
  id           String   @id @default(cuid())
  productId    String
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  label        String
  url          String
  type         String   @default("primary") // primary | secondary
  openInNewTab Boolean  @default(true)
  order        Int      @default(0)

  @@map("product_ctas")
}

// ─── PRODUCTS PAGE CONFIG ─────────────────────────────────────────────

model ProductsPageConfig {
  id        String   @id @default(cuid())
  pageTitle String   @default("Journey with A&H")
  pageBg    String   @default("linear-gradient(135deg, #00c4cc 0%, #a855f7 100%)")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("products_page_config")
}

// ─── RESOURCES PAGE CONFIG ────────────────────────────────────────────

model ResourcesPageConfig {
  id                String   @id @default(cuid())
  pageTitle         String   @default("Resources")
  searchPlaceholder String   @default("Search resources...")
  totalLabel        String   @default("resources")
  defaultView       String   @default("list") // list | grid
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("resources_page_config")
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────

model Notification {
  id         String               @id @default(cuid())
  title      String
  message    String
  type       String               @default("info") // info | success | warning | alert
  recipients NotificationRecipient[]
  createdAt  DateTime             @default(now())

  @@map("notifications")
}

model NotificationRecipient {
  id             String       @id @default(cuid())
  notificationId String
  notification   Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  memberId       String?      // null = broadcast to all
  member         Member?      @relation(fields: [memberId], references: [id])
  readAt         DateTime?
  createdAt      DateTime     @default(now())

  @@map("notification_recipients")
}
```

---

## 3. Admin Panel Module Specs

### 3.1 Site Config (`/settings/site`)

**Fields:**
- Site Name (text)
- Logo (file upload → R2)
- Favicon (file upload → R2)
- Splash Logo (file upload → R2)
- Splash Duration (number, ms)
- Footer Text (text)
- Theme:
  - Accent Color (color picker)
  - Alert Color (color picker)
  - Success Color (color picker)
  - BG Primary (color picker)
  - BG Surface (color picker)
- Live preview panel showing how theme renders

**API:**
```
GET    /api/admin/config/site
PUT    /api/admin/config/site
```

---

### 3.2 UI Strings (`/settings/ui-strings`)

Single form with all configurable labels:
- Loading message
- Empty state messages (no workshops, no resources, etc.)
- Countdown unit labels (DAYS / HOURS / MINS / SECS)
- Login page labels
- Locked content message

**API:**
```
GET    /api/admin/config/ui-strings
PUT    /api/admin/config/ui-strings
```

---

### 3.3 Navigation Manager (`/settings/navigation`)

Drag-and-drop sortable list:
- Each row: Label (text), URL/href (text), Visible toggle
- Add / Remove items
- Save order

**API:**
```
GET    /api/admin/config/nav
POST   /api/admin/config/nav
PUT    /api/admin/config/nav/:id
DELETE /api/admin/config/nav/:id
PUT    /api/admin/config/nav/reorder  { ids: [...] }
```

---

### 3.4 Hero Carousel (`/hero-carousel`)

List view of slides with drag-to-reorder:

Per slide form:
- Order (auto from drag)
- Title (text)
- Description (textarea)
- Background Video (file upload, .mp4 → R2/CDN)
- Background Image (file upload, fallback if no video)
- Mute by Default (toggle)
- CTA Label (text)
- CTA URL (text)
- CTA Type (select: Internal / External)
- Badge Text (text, optional)
- Active (toggle)

**API:**
```
GET    /api/admin/hero-slides
POST   /api/admin/hero-slides
PUT    /api/admin/hero-slides/:id
DELETE /api/admin/hero-slides/:id
PUT    /api/admin/hero-slides/reorder  { ids: [...] }
```

---

### 3.5 Content Sections (`/content-sections`)

Two-level management:

**Section level:**
- Title (text)
- Slug (auto-generated, editable)
- Order (drag-to-reorder)
- Required Tier (number)
- Lock Badge Text (text, e.g., "UNLOCK")
- Visible toggle

**Item level (within each section):**
- Title (text)
- Thumbnail (file upload)
- Required Tier (number)
- Lock Badge Text (text)
- Content Type (select: Series / Standalone / Podcast)
- Category Tag (text)
- Play URL (text) or link to Course
- Order (drag-to-reorder)
- Visible toggle
- Episodes (if not linked to Course): add/edit episode list inline

**API:**
```
GET    /api/admin/content-sections
POST   /api/admin/content-sections
PUT    /api/admin/content-sections/:id
DELETE /api/admin/content-sections/:id
PUT    /api/admin/content-sections/reorder

GET    /api/admin/content-sections/:id/items
POST   /api/admin/content-sections/:id/items
PUT    /api/admin/content-items/:id
DELETE /api/admin/content-items/:id
PUT    /api/admin/content-sections/:id/items/reorder
```

---

### 3.6 Courses (`/courses`)

List of VOD courses with CRUD:

Per course:
- Title, Slug, Description
- Thumbnail (file upload)
- Required Tier
- Active toggle
- Order

Episode management (within course):
- Title
- Thumbnail (optional)
- Video (file upload → Bunny Stream)
- Duration (auto-detected or manual)
- Order (drag-to-reorder)
- Visible toggle

**API:**
```
GET    /api/admin/courses
POST   /api/admin/courses
PUT    /api/admin/courses/:id
DELETE /api/admin/courses/:id

GET    /api/admin/courses/:id/episodes
POST   /api/admin/courses/:id/episodes
PUT    /api/admin/course-episodes/:id
DELETE /api/admin/course-episodes/:id
PUT    /api/admin/courses/:id/episodes/reorder
```

---

### 3.7 Workshops (`/workshops`)

#### Workshop List
Table: Title | Batch | Delivery Mode | Tier | Active | Enrollments | Actions

#### Create/Edit Workshop
**Basic Info tab:**
- Title, Slug
- Description (rich text)
- Thumbnail (file upload)
- Delivery Mode (select: Online / Offline / Hybrid)
- Required Tier
- Link to Batch (dropdown from existing batches)
- Active toggle

**Labels tab** (all user-facing text configurable):
- Challenges Tab Label
- Q&A Tab Label
- Assignment Tab Label
- Progress Widget Label
- Workshop Flow Label
- Back Label + Back URL
- Progress Milestone Count

**Enrollment tab:**
- Table of enrolled members with status (active / completed)
- Bulk enroll (select members from dropdown, choose batch)
- Mark individual member as completed

**API:**
```
GET    /api/admin/workshops
POST   /api/admin/workshops
PUT    /api/admin/workshops/:id
DELETE /api/admin/workshops/:id

GET    /api/admin/workshops/:id/enrollments
POST   /api/admin/workshops/:id/enroll   { memberIds: [...] }
PUT    /api/admin/workshops/:id/enrollments/:enrollmentId  { status }
DELETE /api/admin/workshops/:id/enrollments/:enrollmentId
```

---

### 3.8 Workshop Flow Builder (`/workshops/:id/flow`)

**Visual drag-and-drop flow builder** showing all items in order:

Each item is a card in the list. Item types:
- **Pre-Requisite** card: label, description, editable
- **Challenge** card: select from existing challenges or create new inline
- **Live Call** card: select from existing live calls or create new inline

Actions:
- Drag to reorder
- Click to edit
- Delete
- Add item (dropdown: Pre-Requisite / Challenge / Live Call)

**API:**
```
GET    /api/admin/workshops/:id/flow
POST   /api/admin/workshops/:id/flow     { type, challengeId|liveCallId|label|description, order }
PUT    /api/admin/workshops/:id/flow/:itemId
DELETE /api/admin/workshops/:id/flow/:itemId
PUT    /api/admin/workshops/:id/flow/reorder  { ids: [...] }
```

---

### 3.9 Challenges (`/workshops/:id/challenges`)

Per challenge form:
- Challenge Number (int, auto-incremented, editable)
- Number Label (text, e.g., "Challenge 01:" — auto-generated but editable)
- Number Color (color picker, default teal)
- Title
- Description (rich text)
- Order (set via flow builder drag)

**Episode list within challenge:**
Each episode row:
- Order (drag-to-reorder)
- Title (text)
- Type (select: Video / Assignment / Offer)
- Type Label (text — fully editable; e.g., "Video", "Assignment", "Offer")
- Video URL (shown if type=video; upload to Bunny or paste URL)
- Duration (auto-detected or manual, displayed as computed label)
- Lock Icon Type (select: padlock / none)
- Completed Icon Type (select: checkmark / none)

**API:**
```
GET    /api/admin/workshops/:id/challenges
POST   /api/admin/workshops/:id/challenges
PUT    /api/admin/challenges/:id
DELETE /api/admin/challenges/:id

GET    /api/admin/challenges/:id/episodes
POST   /api/admin/challenges/:id/episodes
PUT    /api/admin/workshop-episodes/:id
DELETE /api/admin/workshop-episodes/:id
PUT    /api/admin/challenges/:id/episodes/reorder
```

---

### 3.10 Live Calls (`/workshops/:id/live-calls`)

Per live call form:
- Type (select: Pre-Requisite / Mid Review / Celebration / Custom)
- Label (text, default "LIVE CALL:") + Label Color (color picker)
- Title
- Scheduled Date & Time (datetime picker)
- Live URL (text, initially empty — filled before session)
- Live URL Unlocks N Minutes Before (number)
- Recording URL (text, filled after session)
- Recording Label (text, e.g., "Missed it? View Call 👇 shows the recording.")
- Prerequisite Note (text)
- Facilitator Name
- Facilitator Title
- Facilitator Description
- Stay Tuned Message (text) + color (color picker)

**API:**
```
GET    /api/admin/workshops/:id/live-calls
POST   /api/admin/workshops/:id/live-calls
PUT    /api/admin/live-calls/:id
DELETE /api/admin/live-calls/:id
```

---

### 3.11 Assignments (`/workshops/:id/assignments`)

**List view grouped by challenge.**

Per assignment form:
- Challenge (select)
- Title
- Question Text (rich text)
- Type Label (text, default "QUESTION")
- Icon Type (select: document / clipboard)
- Order

Assignment submissions sub-page:
- Table: Member | Submitted At | Answer (expand) | Actions
- Admin can view all submissions; no grading system required initially

**API:**
```
GET    /api/admin/workshops/:id/assignments
POST   /api/admin/workshops/:id/assignments
PUT    /api/admin/assignments/:id
DELETE /api/admin/assignments/:id

GET    /api/admin/assignments/:id/submissions
```

---

### 3.12 Q&A Moderation (`/workshops/:id/qa`)

- Paginated list of questions: Member name | Question | Time | Replies count
- Expand to see replies inline
- Admin can post a reply (attributed to admin name or "EiFlix Team")
- Delete question or reply
- No approval workflow — all questions visible immediately

**API:**
```
GET    /api/admin/workshops/:id/qa?page&limit&search
POST   /api/admin/qa/:postId/reply  { replyText }
DELETE /api/admin/qa/:postId
DELETE /api/admin/qa/replies/:replyId
```

---

### 3.13 Tiers (`/settings/tiers`)

List of tiers with CRUD:

Per tier:
- Tier Number (int, unique)
- Label (text, e.g., "Tier 8")
- Description (textarea, optional)
- Unlock Condition Text (text — shown on user profile for locked tiers)
- Active toggle

Assign tier to member: done via Member detail page (existing members module).

**API:**
```
GET    /api/admin/tiers
POST   /api/admin/tiers
PUT    /api/admin/tiers/:id
DELETE /api/admin/tiers/:id
```

---

### 3.14 Badges (`/settings/badges`)

Per badge:
- Label (text, e.g., "BIG")
- Text Color (color picker)
- Background Color (color picker)
- Active toggle

Assign badge to member: done via Member detail page (add MemberBadge relation).

**API:**
```
GET    /api/admin/badges
POST   /api/admin/badges
PUT    /api/admin/badges/:id
DELETE /api/admin/badges/:id

POST   /api/admin/members/:id/badges  { badgeId }
DELETE /api/admin/members/:id/badges/:badgeId
```

---

### 3.15 Resources (`/resources`)

List with CRUD + file upload:

Per resource:
- Title
- Author
- Date (date picker)
- File (upload to R2 → stores `fileUrl`)
- Preview File (upload to R2, optional, lighter version for in-browser preview)
- File Type (auto-detected from upload extension, selectable: pdf / doc / xlsx / other)
- File Type Icon (auto from type, or custom upload)
- File Count (int)
- Order (drag-to-reorder)
- Visible toggle
- Preview Label (text)
- Download Label (text)

**API:**
```
GET    /api/admin/resources
POST   /api/admin/resources
PUT    /api/admin/resources/:id
DELETE /api/admin/resources/:id
PUT    /api/admin/resources/reorder
```

---

### 3.16 Products (`/products`)

Per product:
- Title
- Description (rich text)
- Thumbnail (file upload)
- Order (drag-to-reorder)
- Visible toggle
- CTAs (add multiple):
  - Label
  - URL
  - Type (primary / secondary)
  - Open in New Tab toggle
  - Order

Products Page Config (separate form within module):
- Page Title
- Page Background (CSS gradient or color picker)

**API:**
```
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
PUT    /api/admin/products/reorder

GET    /api/admin/config/products-page
PUT    /api/admin/config/products-page
```

---

### 3.17 Notifications (`/notifications`)

**Compose notification form:**
- Title
- Message (textarea)
- Type (select: Info / Success / Warning / Alert)
- Recipients:
  - All Members (broadcast)
  - Specific Members (multi-select from members list)
  - By Workshop Enrollment (select workshop → sends to all enrolled)
  - By Batch (select batch)
- Send button

**Sent notifications list:**
- Table: Title | Type | Sent At | Recipients Count | Read Count

**API:**
```
GET    /api/admin/notifications
POST   /api/admin/notifications  { title, message, type, recipientType, recipientIds? }
DELETE /api/admin/notifications/:id
GET    /api/admin/notifications/:id/stats  { totalRecipients, readCount }
```

---

### 3.18 Member Progress (`/members/:id/progress`)

Within the existing member detail page, add a Progress tab:

**Content:**
- For each enrolled workshop:
  - Workshop title + enrollment status
  - Overall progress %
  - Challenge breakdown table: Challenge title | Episodes completed | Total episodes | %
  - Assignment submissions list
  - Last active date

**API:**
```
GET /api/admin/members/:id/progress
Response:
{
  workshops: [
    {
      workshopId, workshopTitle, status,
      overallPercent, completedCount, totalCount,
      challenges: [{ title, completedCount, totalCount, percent }],
      assignments: [{ title, isSubmitted, submittedAt }],
      lastActiveAt
    }
  ]
}
```

---

## 4. Admin Sidebar Navigation Updates

Add these items to the existing `Sidebar.tsx` menu:

```
Dashboard
Admins
Members
─── CONTENT ──────────────
  Hero Carousel
  Content Sections
  Courses
  Workshops
  Resources
  Products
─── COMMUNICATION ─────────
  Notifications
  Q&A Moderation  (sub-nav under each workshop)
─── SETTINGS ──────────────
  Site Config
  Navigation
  UI Strings
  Tiers
  Badges
Support
```

---

## 5. Data Flow Summary

```
Admin creates Workshop
  └─ Admin builds flow (Pre-Requisite → Challenge 01 → Live Call → Challenge 02 ...)
       └─ Each Challenge has Episodes (Video / Assignment / Offer)
       └─ Each Live Call has schedule, facilitator, labels
Admin enrolls Members into Workshop
  └─ WorkshopEnrollment created (status: active)
Admin sets Member tier on Member detail page
  └─ Controls which ContentSections are locked on home page

Member logs into EiFlix
  └─ App bootstraps: GET /api/config/site (theme, branding)
  └─ GET /api/config/nav (navbar items)
  └─ Home: GET /api/home/hero + GET /api/home/sections?memberTier=8
  └─ Workshop: GET /api/workshops/my → /workshop/:slug/detail → /workshop/:slug/flow
  └─ Watches episode → POST /api/episodes/:id/progress (tracks completion)
  └─ Completion updates WorkshopFlowItem / MemberEpisodeProgress
  └─ Challenge progress computed: completedEpisodes / totalEpisodes per challenge
  └─ Overall progress computed: completedEpisodes / totalEpisodes across workshop
```

---

## 6. Backend Module Structure (Fastify)

New modules to add under `backend/src/modules/`:

```
eiflix/
  config/         routes.ts + controller.ts (site, nav, ui-strings, auth-labels)
  hero/           routes.ts + controller.ts
  content/        routes.ts + controller.ts (sections + items)
  courses/        routes.ts + controller.ts
  workshops/      routes.ts + controller.ts (user-facing)
  episodes/       routes.ts + controller.ts (playback + progress)
  qa/             routes.ts + controller.ts
  assignments/    routes.ts + controller.ts
  resources/      routes.ts + controller.ts
  products/       routes.ts + controller.ts
  notifications/  routes.ts + controller.ts (user-facing read)

admin/
  config/         routes.ts + controller.ts (all config CRUD)
  hero/           routes.ts + controller.ts
  content/        routes.ts + controller.ts
  courses/        routes.ts + controller.ts
  workshops/      routes.ts + controller.ts (admin CRUD + flow builder)
  challenges/     routes.ts + controller.ts
  live-calls/     routes.ts + controller.ts
  assignments/    routes.ts + controller.ts
  qa/             routes.ts + controller.ts (moderation)
  resources/      routes.ts + controller.ts
  products/       routes.ts + controller.ts
  tiers/          routes.ts + controller.ts
  badges/         routes.ts + controller.ts
  notifications/  routes.ts + controller.ts (send + stats)
  progress/       routes.ts + controller.ts
```

All admin routes use existing `fastify.authenticate` preHandler (Admin table check).  
All user-facing routes use a new `fastify.authenticateUser` preHandler (Member table check via `clerkId`).

Route prefixes:
- Admin: `/api/admin/*`
- User web: `/api/*` (existing convention)
