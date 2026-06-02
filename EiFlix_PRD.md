# EiFlix — Product Requirements Document (PRD Spec Kit)

> Derived from screen recording analysis of eiflix.com  
> Platform: Video-on-Demand + Live Workshop LMS  
> Brand: "EiFlix — a Product of Antano & Harini (Evolution Scientists)"

---
replace the the word EiFlix with TBT
## 1. Product Overview

EiFlix is a gated, subscription-based learning platform that combines on-demand video content with live cohort-based workshops. It serves students enrolled in Antano & Harini's (A&H) personal excellence and business development programs.

**Core value proposition:** Structured learning journeys that blend self-paced video courses, live calls with facilitators, Q&A community, assignments, and tier-locked premium content.

**User type:** Single authenticated user role (member/learner). No admin-facing UI visible in recording.

---

## 2. User Persona

| Attribute | Detail |
|---|---|
| Role | Enrolled learner / program participant |
| Profile data | Name, email, phone, DOB |
| Access | Subscription with start/end dates |
| Tier | Tier 1–10+ (unlocks progressively based on program milestones) |
| Badge | Program badge (e.g., "BIG") shown on profile |
| Auth | Email + password login |

---

## 3. Information Architecture

### 3.1 Top-Level Navigation (Navbar)
```
EiFlix [logo]    Home    Workshop    Products    Resources    [Bell] [Message] [Avatar]
```

- **EiFlix logo** — links to `/eiflix` (Home)
- **Home** → `/eiflix`
- **Workshop** → `/workshops`
- **Products** → `/Products`
- **Resources** → `/Resources`
- **Bell icon** — notifications (unread count badge)
- **Message/chat icon** — messaging (unread count badge)
- **Avatar (circular)** — links to `/profile`

Active nav item is visually emphasized (bold + underline or highlight).

### 3.2 Route Map

| Route | Screen |
|---|---|
| `/` or `/loading` | Splash / loading animation |
| `/login` | Authentication screen |
| `/eiflix` | Home — hero carousel + content rows |
| `/profile` | User profile + subscription + tier access |
| `/workshops` | Workshop listing (active + completed) |
| `/workshop/[id]` | Workshop detail — challenges, Q&A, assignment |
| `/watch/[id]` | Full-screen video player (standalone) |
| `/Products` | A&H product catalog |
| `/Resources` | Resource/PDF library |

---

## 4. Screen Specifications

### 4.1 Splash Screen (`/loading`)
- Full-screen dark background
- "EiFlix" logo animation (fade/slide in)
- Redirects to `/login` or `/eiflix` after animation completes

---

### 4.2 Home Page (`/eiflix`)

#### Hero Carousel
- Full-width cinematic banner occupying ~50vh
- 3 slides, auto-rotating with manual navigation dots
- Each slide has a background video (muted by default, toggle mute button visible on active slide)
- Slide content overlay (bottom-left):
  - Series/workshop title
  - Short descriptor text
  - Primary CTA button — text varies by state:
    - `CONTINUE` (if previously started)
    - `Watch Now` (VOD content)
    - `Know More` (redirects to product/info page)

**Observed slides:**
| Slide | Content | CTA |
|---|---|---|
| 1 | CTD Workshop | CONTINUE |
| 2 | Mini uP Series | Watch Now |
| 3 | uP! for Prodigies | Know More |

#### Content Sections (horizontal scroll rows)
Each section is a labeled row with horizontally scrollable content cards.

**Observed sections (in order):**
1. Conversational Programming
2. Pre CPM
3. NLP Patterns
4. Mini uP Series
5. B!G Accelerator
6. Evolution Stories
7. Time Compression Documentaries
8. A&H Podcast
9. Reframe With Antano
10. EIS Installations Core *(tier-locked — shows UNLOCK badge)*
11. Business Intelligence Installation *(tier-locked — shows UNLOCK badge)*

**Content Card (default):**
- Thumbnail image (16:9)
- Title overlay at bottom
- UNLOCK badge (dark overlay + lock icon + "UNLOCK" text) for locked tiers

**Content Card (on hover):**
- Expanded modal/popover appears
- Contains:
  - Course/series title (bold)
  - Play button (primary, filled)
  - Category tag (pill chip)
  - Episode list (numbered) with series-specific thumbnails
  - Toggle: thumbnail view / list view

#### Footer
```
EiFlix — a Product of Antano & Harini — All Right Reserved
```

---

### 4.3 Profile Page (`/profile`)

#### Header
- Circular avatar with gradient ring
- Full name (large)
- Email address
- Program badge (e.g., "BIG" in styled chip)

#### Sections

**Personal Details**
- First Name
- Email
- Phone number
- Date of Birth
- Edit functionality implied (fields may be inline-editable)

**Subscription**
- Start Date
- End Date

**Tier Access** (read-only display)
Each tier shown as a row:
- Tier number + label
- Status: UNLOCKED (green) / LOCKED (gray with padlock)
- Locked tiers show unlock condition text (e.g., prerequisite action required)

**Observed tier states:**
| Tier | State |
|---|---|
| Tier 8 | UNLOCKED |
| Tier 9 | LOCKED |
| Tier 10 | LOCKED |

**Sign Out**
- Red/danger-styled button at bottom

---

### 4.4 Workshops Page (`/workshops`)

Two sections displayed vertically:

#### "Workshops" (Active/Enrolled)
- Grid of workshop cards (2–4 per row)
- Card: thumbnail image, workshop title below, "Enrolled" green badge (top-right of thumbnail)

#### "Completed Workshops"
- Same card grid layout
- Badge: green checkmark icon (top-right)
- "Online" green chip label on card thumbnail (for online-delivered workshops)

Clicking any card navigates to `/workshop/[id]`.

---

### 4.5 Workshop Detail Page (`/workshop/[id]`)

**Layout:** Two-column split
- **Left / Main area** (~75% width): dynamic content zone
- **Right sidebar** (~25% width, fixed height, scrollable internally): structured workshop flow

#### Page Header
- Back arrow (← returns to `/workshops`)
- Workshop title (e.g., "CTD Workshop – Pivot to Pivot (May 2026)")

#### Main Area States

**State 1: Live Call Countdown**
Shown when the currently active item in the flow is an upcoming live call:
- "LIVE CALL" heading (centered, white)
- Call subtitle (e.g., "Mid Review with EIS")
- Countdown timer: `DD DAYS  HH HOURS  MM MINS  SS SECS` (large digits, monospace)
- Date label below timer (e.g., "JUNE 2, 2026") in teal/small caps
- Message in teal: *"Stay tuned — the link will unlock before the session begins"*
- Background: pure black

**State 2: Video Player**
Shown when an episode video is selected:
- Embedded video player (full width of main area, ~56.25% aspect ratio)
- Controls bar:
  - Play/Pause button
  - 10s rewind / 10s forward overlay buttons
  - Seek bar (progress fill)
  - Current time / Total duration label (e.g., `00:18 / 29:20`)
  - `Auto` quality selector button
  - `1x` playback speed selector
  - Volume icon
  - Fullscreen button
- Video title below player (bold)
- Video description text below title

**State 3: Assignment Submission View**
Shown when user clicks an assignment in the Assignment tab:
- Back arrow (← Back, returns to assignment list)
- Green checkmark circle icon (indicates submitted)
- Assignment title (amber/yellow text)
- "Your Answer:" label
- Answer card (dark bordered box) showing user's submitted response as a numbered list

#### Right Sidebar — 3 Tabs

---

##### Tab 1: Challenges

**Learning Progress Widget** (collapsible, shown at top when expanded):
- "Learning Progress XX%" header with chevron toggle
- 3 star icons representing milestone markers (filled/unfilled)
- Horizontal progress bar (blue fill)
- "N of M Completed" count below bar

**Workshop Flow** (label + sequential item list):

Item types in order:

**Pre-Requisite card**
- Label: "Pre-Requisite:" in teal
- Description: "This is your first step!"
- Green circle check icon (when completed)
- Chevron expand/collapse

**LIVE CALL card (past / missed)**
- "LIVE CALL:" label in pink/magenta
- Video camera icon (colored)
- Title (e.g., "Missed it? View Call 👇 shows the recording.")
- Green checkmark badge if recording viewed
- Subtext: "Kindly complete the necessary prerequisites before the live call starts."

**Challenge card** (expandable)
- Challenge number + title in teal (e.g., "Challenge 01: Deals – Inspire Purpose")
- Circular spinner/progress icon
- Progress bar with % (e.g., 67%)
- Description paragraph (visible when expanded)
- Episode list (numbered, scrollable):
  - Number
  - Episode title
  - Content type label (Video / Assignment / Offer)
  - Duration (e.g., `Video · 10:35`)
  - Status icon:
    - Pink checkmark circle = completed
    - Padlock icon = locked (requires completing prior content or tier upgrade)
    - Nothing = available but not started

**LIVE CALL card (upcoming)**
- "LIVE CALL:" label + call name + datetime
- Description of facilitator and call purpose
- When clicked → main area shows countdown view

**Observed Workshop Flow structure (CTD Workshop – Pivot to Pivot):**
```
Pre-Requisite: This is your first step!
LIVE CALL: Missed it? [recording available] ✓
Challenge 01: Deals – Inspire Purpose (67%)
  01. Incremental Greatness: Compounding Micro-Shifts...  Video 10:35 ✓
  02. The Foresight Formula: Seeing Before It Happens    Video 14:47 ✓
  03. Blind Spots & Skill Gaps: Closing Both Together    Video ✓
  ...
  09. Reflect & Record – ...                             Assignment 🔒
  10. Celebrate with the Offer                           Offer 🔒
Challenge 02: The Mastery of Deal Craft: ... (0%)
  01. Win-Win Architecture: ...                          Video 🔒
  ...
LIVE CALL: Mid Review with EIS (June 2, 2026) [UPCOMING — shows countdown]
Challenge 03: Co-Create the Close: Partnership Beyond Persuasion (0%)
Challenge 04: The Reset 'Swish': Anchor Certainty, Creativity, and Flow (0%)
LIVE CALL: Celebration Call with EIS (09th June '26 | 8:00PM)
```

---

##### Tab 2: Q & A

**Ask section:**
- Heading: "Do you have any questions?" (teal highlight on "questions")
- Subtext: "Got something on your mind? Post your question and let's explore it together!"
- Text area placeholder: "Type your Question here ?"
- "Ask Now" button (teal/cyan background)

**Community questions list:**
- Heading: "Others Asked questions" (teal highlight on "questions")
- Each post:
  - User avatar (circular)
  - Username (bold) + time ago (e.g., "3h", "2d")
  - Question text
  - "Reply" link (teal)
- Scrollable list (infinite scroll implied)

---

##### Tab 3: Assignment

**List view (default):**
- Grouped by Challenge:
  - Challenge label header (e.g., "Challenge 01: Deals")
  - Assignment card(s):
    - Document icon
    - Assignment title
    - "QUESTION" type label
    - Highlighted border (teal/cyan) indicating selected or available state

**Submission view (on card click):**
- Main area renders the submitted answer (see Main Area State 3 above)

---

### 4.6 Full-Screen Video Player (`/watch/[id]`)

- Full-viewport black background
- Header bar: back arrow + episode title
- Video centered, full width
- LOADING spinner overlay during buffering
- Standard controls (play/pause, seek, volume, fullscreen)

---

### 4.7 Products Page (`/Products`)

- Full-page gradient background: teal → purple (diagonal)
- Heading: "Journey with A&H" (large, white)
- Product cards in a row:

| Product | CTAs |
|---|---|
| uP! for Prodigies | "Apply Now" (primary) + "Enquire Now!" (secondary) |
| uP! Accelerate | "Apply Now" + "Enquire Now!" |

Each card:
- Product name (bold)
- Short description
- CTA buttons (stacked or side-by-side)

---

### 4.8 Resources Page (`/Resources`)

- Page heading: "Resources"
- Search bar (full-width input, placeholder: search resources)
- Metadata row: resource count (e.g., "9 resources") + list/grid view toggle icons

**Resource card (list view):**
- PDF/document icon (colored, type-specific)
- Title
- Author / source name
- Date
- File count badge (if collection)
- On hover: Eye icon (preview) + Download icon appear on right

**Grid view:** Larger thumbnail tiles with same metadata below

---

## 5. Content Model (Data Schema)

```
User
  id, name, email, phone, dob, avatarUrl
  subscriptionStart, subscriptionEnd
  tier (int), badgeLabel (e.g., "BIG")

Workshop
  id, title, slug, thumbnailUrl
  status: active | completed
  description

Challenge
  id, workshopId, order (int), title, description

Episode
  id, challengeId, order (int), title
  type: video | assignment | offer
  videoUrl, durationSeconds
  isLocked (bool, resolved from tier/progress)

LiveCall
  id, workshopId, order (int), title, scheduledAt
  type: pre-requisite | mid-review | celebration | other
  facilitatorName, facilitatorTitle, description
  liveUrl (null until unlocked)

Progress
  userId, episodeId, completedAt
  (aggregated per challenge as %)

QAPost
  id, workshopId, userId, questionText, createdAt
  replies: [{ userId, text, createdAt }]

Assignment
  id, challengeId, title, questionText, order

AssignmentSubmission
  id, assignmentId, userId, answerText, submittedAt

Resource
  id, title, author, date, fileUrl, type (pdf | doc | etc), fileCount

ContentSection (home page rows)
  id, title, order, requiredTier

ContentItem (cards within a section)
  id, sectionId, title, thumbnailUrl, videoUrl, requiredTier
  type: series | standalone | podcast
  episodes: [{ title, videoUrl, durationSeconds, order }]

Product
  id, title, description, applyUrl, enquireUrl, thumbnailUrl

Notification
  id, userId, message, readAt, createdAt
```

---

## 6. Access Control System

### 6.1 Tier-Based Content Locking
- Content items and entire sections carry a `requiredTier` value
- User's current tier (from subscription/profile) gates access
- Locked content shows padlock icon; no playback allowed
- Home feed shows "UNLOCK" badge overlaid on locked section cards

### 6.2 Sequential Episode Unlocking (within Workshops)
- Episodes within a challenge unlock linearly
- Must complete episode N before episode N+1 becomes available
- Live Call links are time-gated: URL injects into the card only when `scheduledAt - buffer < now`

### 6.3 Subscription Gating
- Subscription `endDate` gates overall platform access
- Expired subscription → redirect to renewal/products page (implied)

---

## 7. Key User Workflows

### 7.1 Continue Watching (Home → Video)
1. Land on `/eiflix`
2. Hero carousel shows "CONTINUE" on in-progress content
3. Click CTA → navigate to `/watch/[episodeId]` or `/workshop/[id]` with correct challenge expanded
4. Full-screen player loads, resumes from last position (resume point stored server-side)

### 7.2 Workshop Flow Progression
1. Navigate to `/workshops` → click enrolled workshop card
2. `/workshop/[id]` loads with Challenges tab active
3. Pre-Requisite section expanded by default
4. User watches videos sequentially (clicking each episode in sidebar list)
5. Main area loads embedded player for each video
6. Assignment items: click → Assignment tab auto-selects → submit text answer
7. Progress bar updates per challenge as episodes complete
8. Overall "Learning Progress" widget updates with total count and % star milestones
9. When live call is next: main area shows countdown; sidebar shows call card with date/facilitator
10. After live call datetime passes: recording link appears ("View Call 👇")

### 7.3 Posting a Q&A Question
1. Workshop detail → click "Q & A" tab
2. Type question in text area
3. Click "Ask Now"
4. Question appears in "Others Asked" feed for all enrolled users

### 7.4 Submitting an Assignment
1. Workshop detail → click "Assignment" tab
2. Find assignment under correct challenge heading
3. Click assignment card → main area shows question
4. Enter text answer
5. Submit → green checkmark shown + answer card with "Your Answer:" displayed

### 7.5 Downloading a Resource
1. Navigate to `/Resources`
2. Search or browse list
3. Hover card → click download icon → file downloads
4. Alternatively: click eye icon → preview in browser

---

## 8. UI Design System

### Colors
| Token | Value | Usage |
|---|---|---|
| Background | `#000000` | Page backgrounds |
| Surface | `#0f0f0f` – `#1a1a1a` | Cards, sidebar |
| Primary text | `#ffffff` | Headings, main content |
| Secondary text | `#a0a0a0` | Metadata, timestamps |
| Accent (teal) | `#00c4cc` approx | Links, labels, CTAs, progress fills |
| Alert (magenta) | `#ff3d8b` approx | LIVE CALL label, progress bars |
| Success (green) | `#22c55e` approx | Completed, enrolled badges |
| Locked (gray) | `#4a4a4a` | Locked items, padlock icons |
| Gradient | teal→purple | Products page background |

### Typography
- Font: Inter or similar system sans-serif
- Headings: bold, white
- Labels/chips: uppercase, small, letter-spaced
- Countdown digits: monospace, extra-large

### Component Patterns
- **Cards:** Rounded corners (~8–12px), dark surface, subtle border or no border
- **Badges:** Pill/chip shape, colored background, uppercase text (Enrolled, Online, UNLOCK)
- **Progress bars:** Full-width within container, teal or magenta fill, rounded ends
- **Tabs:** Underline-style active indicator (teal underline), no filled background
- **Buttons:** 
  - Primary: teal/cyan fill, white text, rounded
  - Secondary: outlined border, white text
  - Danger: red or outlined red (Sign Out)
- **Avatar:** Circular image with gradient ring (on profile hero); simple circular on Q&A posts
- **Lock icon:** Standard padlock, gray, right-aligned on locked episode rows

### Layout
- Max content width: ~1280px, centered
- Navbar: fixed top, full-width, dark background with slight opacity/blur
- Workshop detail: fixed sidebar 280px right, scrollable independently; left area fills remaining space
- All pages: 100vh dark background, no light mode

---

## 9. Notification System

- Bell icon in navbar shows unread count badge
- Notification types implied: new live call announcements, assignment feedback, new resource uploads
- No notification panel detail was recorded — full spec requires further analysis

---

## 10. Messaging System

- Message icon (chat bubble) in navbar shows unread count badge
- No messaging panel was recorded in detail — likely direct message or announcement channel
- Could be Crisp, Intercom, or custom implementation

---

## 11. Technical Considerations for Clone Implementation

### Recommended Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript |
| Styling | Tailwind CSS |
| State | TanStack Query (server) + Zustand (client) |
| Auth | Clerk (email/password + OAuth) |
| Video | Bunny Stream or Mux (video hosting + HLS streaming) |
| Database | PostgreSQL via Prisma ORM |
| File Storage | Cloudflare R2 (PDFs, resources) |
| Live Calls | Agora.io or Zoom SDK for live sessions |
| Real-time | Socket.io or Pusher (countdown sync, Q&A live updates) |
| Notifications | Firebase Cloud Messaging |
| Search | Algolia or Postgres full-text search |
| Deployment | Vercel (frontend) + Railway (backend) |

### Key Technical Challenges
1. **Countdown timer sync:** Live call countdown must be server-derived (prevent client clock skew); use SSE or polling against scheduled datetime
2. **Progress tracking:** Episode completion events fire POST to backend; aggregate per challenge and overall
3. **Sequential locking:** Episode availability resolves server-side based on `Progress` records — never trust client-only state
4. **Video resume:** Store `lastWatchedSeconds` per user+episode; player initializes with `currentTime = lastWatchedSeconds`
5. **Tier gate rendering:** Home page sections with `requiredTier > user.tier` render UNLOCK overlay — resolved at fetch time, not render time
6. **Q&A real-time feed:** New posts should appear without page reload — WebSocket or polling at 15s interval

---

## 12. Admin Requirements (Implied, Not Shown in Recording)

The following admin capabilities are required to power the learner-facing features:

- Create/edit workshops with challenge structure and episode sequence
- Upload videos (integrate with Bunny Stream / Mux)
- Schedule live calls with datetime, facilitator, and description
- Create assignments per challenge
- Manage content sections and items on home page
- Set tier requirements per content section / item
- Upload and categorize resources
- Manage users: tier assignment, subscription dates, batch enrollment
- View Q&A posts and reply
- Track progress analytics per user per workshop

---

*End of PRD Spec Kit — EiFlix Clone*  
*Analyzed from 61 frames extracted from clone.mp4 at 5-second intervals*
