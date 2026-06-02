# EiFlix User Web — Dynamic PRD Spec Kit

> Every piece of content, configuration, label, color, and structure is served from the admin API.  
> Zero hardcoded strings, images, routes, or copy on the frontend.

---

## 1. Core Principle: Everything Is Dynamic

The frontend is a **renderer**. It receives structured data from the backend API and renders it. The frontend never contains:
- Hardcoded section titles, slide content, or CTA labels
- Hardcoded nav item names or URLs
- Hardcoded tier labels, unlock condition text, or badge names
- Hardcoded facilitator names or call descriptions
- Hardcoded product names or resource titles
- Hardcoded footer text, brand name, or logo path
- Any copy or color values outside of what the API provides

---

## 2. Bootstrap: Site Configuration API

**First API call on app load (before any page renders):**

```
GET /api/config/site
```

Response drives the entire shell:

```json
{
  "siteName": "EiFlix",
  "logoUrl": "https://cdn.../logo.svg",
  "faviconUrl": "https://cdn.../favicon.ico",
  "footerText": "EiFlix — a Product of Antano & Harini — All Right Reserved",
  "theme": {
    "accentColor": "#00c4cc",
    "alertColor": "#ff3d8b",
    "successColor": "#22c55e",
    "bgPrimary": "#000000",
    "bgSurface": "#111111"
  },
  "splashLogoUrl": "https://cdn.../splash-logo.svg",
  "splashDurationMs": 2000
}
```

The app applies theme CSS variables from this response. No fallback defaults in code.

---

## 3. Navigation

**API:**
```
GET /api/config/nav
```

Response:
```json
{
  "items": [
    { "id": "uuid", "label": "Home", "href": "/eiflix", "order": 1, "isVisible": true },
    { "id": "uuid", "label": "Workshop", "href": "/workshops", "order": 2, "isVisible": true },
    { "id": "uuid", "label": "Products", "href": "/Products", "order": 3, "isVisible": true },
    { "id": "uuid", "label": "Resources", "href": "/Resources", "order": 4, "isVisible": true }
  ],
  "rightIcons": {
    "notifications": true,
    "messages": true,
    "profile": true
  }
}
```

Frontend renders nav items in `order` sequence. Items with `isVisible: false` are hidden.  
The active item is determined by matching `href` to the current URL — no hardcoding which item is "active".

---

## 4. Home Page (`/eiflix`)

### 4.1 Hero Carousel

**API:**
```
GET /api/home/hero
```

Response:
```json
{
  "slides": [
    {
      "id": "uuid",
      "order": 1,
      "title": "CTD Workshop",
      "description": "Crafting Your Trajectory",
      "bgVideoUrl": "https://cdn.../ctd-bg.mp4",
      "bgImageUrl": "https://cdn.../ctd-thumb.jpg",
      "bgMuteDefault": true,
      "ctaLabel": "CONTINUE",
      "ctaUrl": "/workshop/DhM8bpP7mKneQDFzecB0",
      "ctaType": "internal",
      "badgeText": null,
      "isActive": true
    }
  ],
  "autoPlayIntervalMs": 5000
}
```

Frontend logic:
- `ctaType: "internal"` → use Next.js `<Link>`
- `ctaType: "external"` → open in new tab
- `ctaLabel` is never hardcoded — always from API
- Mute toggle state stored in component; default from `bgMuteDefault`
- If `bgVideoUrl` is null → show `bgImageUrl` as static background

### 4.2 Content Sections

**API:**
```
GET /api/home/sections?memberTier={tier}
```

Response:
```json
{
  "sections": [
    {
      "id": "uuid",
      "title": "Conversational Programming",
      "slug": "conversational-programming",
      "order": 1,
      "isVisible": true,
      "requiredTier": 1,
      "isLocked": false,
      "lockLabel": null,
      "items": [
        {
          "id": "uuid",
          "title": "Series Title",
          "thumbnailUrl": "https://cdn.../thumb.jpg",
          "requiredTier": 1,
          "isLocked": false,
          "lockBadgeText": null,
          "contentType": "series",
          "episodeCount": 12,
          "episodes": [
            {
              "id": "uuid",
              "order": 1,
              "title": "Episode Title",
              "thumbnailUrl": "https://cdn.../ep1.jpg",
              "durationSeconds": 1245
            }
          ],
          "categoryTag": "NLP",
          "playUrl": "/watch/episode-id"
        }
      ]
    }
  ]
}
```

Frontend:
- Renders sections in `order` sequence
- If `isLocked: true` → renders card with overlay and `lockBadgeText` (e.g., "UNLOCK")
- Section title comes from `title` field only
- Hover modal content (episode list, category tag, play button label) all from API

### 4.3 Footer

**API:** Same as `GET /api/config/site` — `footerText` field.

Footer renders: `{config.footerText}` — nothing else.

---

## 5. Profile Page (`/profile`)

**API:**
```
GET /api/members/me
```

Response:
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+91 9876543210",
  "dob": "1990-01-15",
  "avatarUrl": "https://cdn.../avatar.jpg",
  "avatarGradient": "linear-gradient(135deg, #00c4cc, #a855f7)",
  "badges": [
    { "id": "uuid", "label": "BIG", "color": "#a855f7", "bgColor": "#2d1b4e" }
  ],
  "subscription": {
    "startDate": "2025-01-01",
    "endDate": "2026-12-31",
    "status": "active"
  },
  "tiers": [
    { "tierNumber": 8, "label": "Tier 8", "status": "unlocked", "unlockConditionText": null },
    { "tierNumber": 9, "label": "Tier 9", "status": "locked", "unlockConditionText": "Complete the B!G Accelerator program" },
    { "tierNumber": 10, "label": "Tier 10", "status": "locked", "unlockConditionText": "Complete uP! Accelerate" }
  ],
  "sections": [
    { "id": "personal", "label": "Personal Details", "fields": ["firstName", "lastName", "email", "phone", "dob"] },
    { "id": "subscription", "label": "Subscription", "fields": ["startDate", "endDate"] },
    { "id": "tiers", "label": "Tier Access" }
  ],
  "signOutLabel": "Sign Out"
}
```

Frontend:
- Section labels, field labels, button labels — all from API
- Tier unlock condition text — from API, never hardcoded
- Badge label, color, background — from API
- Avatar gradient — from API

**Update profile:**
```
PATCH /api/members/me
Body: { firstName, lastName, phone, dob }
```

---

## 6. Workshops Page (`/workshops`)

**API:**
```
GET /api/workshops/my
```

Response:
```json
{
  "sections": [
    {
      "id": "active",
      "label": "Workshops",
      "items": [
        {
          "id": "uuid",
          "title": "CTD Workshop – Pivot to Pivot (May 2026)",
          "thumbnailUrl": "https://cdn.../thumb.jpg",
          "slug": "DhM8bpP7mKneQDFzecB0",
          "enrollmentStatus": "active",
          "enrolledBadge": { "label": "Enrolled", "color": "#22c55e" },
          "deliveryMode": "online",
          "deliveryModeLabel": "Online"
        }
      ]
    },
    {
      "id": "completed",
      "label": "Completed Workshops",
      "items": [
        {
          "id": "uuid",
          "title": "Conversational Programming Live Workshop May 2026",
          "thumbnailUrl": "https://cdn.../cp-thumb.jpg",
          "slug": "cp-may-2026",
          "enrollmentStatus": "completed",
          "completedBadgeIconType": "checkmark",
          "deliveryMode": "online",
          "deliveryModeLabel": "Online"
        }
      ]
    }
  ]
}
```

Frontend:
- Section labels ("Workshops", "Completed Workshops") — from API `sections[].label`
- Badge labels, colors — from API
- No hardcoded status strings anywhere

---

## 7. Workshop Detail Page (`/workshop/[slug]`)

### 7.1 Page Bootstrap

**API:**
```
GET /api/workshops/:slug/detail
```

Response:
```json
{
  "id": "uuid",
  "title": "CTD Workshop – Pivot to Pivot (May 2026)",
  "backLabel": "Back",
  "backUrl": "/workshops",
  "sidebar": {
    "tabs": [
      { "id": "challenges", "label": "Challenges", "order": 1 },
      { "id": "qa", "label": "Q & A", "order": 2 },
      { "id": "assignment", "label": "Assignment", "order": 3 }
    ]
  },
  "learningProgress": {
    "label": "Learning Progress",
    "percentage": 23,
    "completedCount": 8,
    "totalCount": 35,
    "milestoneCount": 3
  },
  "workshopFlowLabel": "Workshop Flow",
  "defaultMainAreaType": "countdown"
}
```

### 7.2 Workshop Flow (Challenges Tab Content)

**API:**
```
GET /api/workshops/:slug/flow
```

Response:
```json
{
  "flowItems": [
    {
      "id": "uuid",
      "order": 1,
      "type": "pre_requisite",
      "label": "Pre-Requisite:",
      "description": "This is your first step!",
      "isCompleted": true,
      "isExpanded": false
    },
    {
      "id": "uuid",
      "order": 2,
      "type": "live_call",
      "label": "LIVE CALL:",
      "labelColor": "#ff3d8b",
      "title": "Kick-Off Call with EIS",
      "scheduledAt": "2026-05-01T14:00:00Z",
      "status": "past",
      "recordingAvailable": true,
      "recordingLabel": "Missed it? View Call 👇 shows the recording.",
      "prerequisiteNote": "Kindly complete the necessary prerequisites before the live call starts.",
      "isCompleted": true,
      "facilitatorName": "Disha Varma",
      "facilitatorTitle": "Excellence Installation Specialist",
      "facilitatorDescription": "Mentored by Antano & Harini with over a decade of experience in Excellence Installation Technology."
    },
    {
      "id": "uuid",
      "order": 3,
      "type": "challenge",
      "challengeNumber": 1,
      "numberLabel": "Challenge 01:",
      "numberColor": "#00c4cc",
      "title": "Deals – Inspire Purpose",
      "description": "A deal is never just a transaction. It is a moment infused with vision, possibility, and purpose...",
      "progressPercent": 67,
      "isExpanded": true,
      "episodes": [
        {
          "id": "uuid",
          "order": 1,
          "title": "Incremental Greatness: Compounding Micro-Shifts into Exponential Outcomes",
          "type": "video",
          "typeLabel": "Video",
          "durationSeconds": 635,
          "durationLabel": "10:35",
          "isCompleted": true,
          "isLocked": false,
          "lockIconType": "padlock",
          "completedIconType": "checkmark"
        },
        {
          "id": "uuid",
          "order": 9,
          "title": "Reflect & Record – The Connection Between Favors and Deals",
          "type": "assignment",
          "typeLabel": "Assignment",
          "durationSeconds": null,
          "durationLabel": null,
          "isCompleted": false,
          "isLocked": true
        },
        {
          "id": "uuid",
          "order": 10,
          "title": "Celebrate with the Offer",
          "type": "offer",
          "typeLabel": "Offer",
          "durationSeconds": null,
          "durationLabel": null,
          "isCompleted": false,
          "isLocked": true
        }
      ]
    },
    {
      "id": "uuid",
      "order": 7,
      "type": "live_call",
      "label": "LIVE CALL:",
      "labelColor": "#ff3d8b",
      "title": "Mid Review with EIS",
      "scheduledAt": "2026-06-02T14:00:00Z",
      "status": "upcoming",
      "liveUrl": null,
      "liveUrlUnlocksMinutesBefore": 30,
      "facilitatorName": "Disha Varma",
      "facilitatorTitle": "Excellence Installation Specialist",
      "facilitatorDescription": "Mentored by Antano & Harini with over a decade of experience in Excellence Installation Technology.",
      "countdownConfig": {
        "stayTunedMessage": "Stay tuned — the link will unlock before the session begins",
        "stayTunedColor": "#00c4cc"
      }
    }
  ]
}
```

Frontend:
- All labels (Pre-Requisite:, LIVE CALL:, Challenge 01:) come from API
- Label colors come from API (`labelColor`, `numberColor`)
- "Stay tuned..." message — from API `stayTunedMessage`
- Countdown computed client-side from `scheduledAt`; display format (DAYS/HOURS/MINS/SECS) — API can specify unit labels
- Episode type labels ("Video", "Assignment", "Offer") — from API `typeLabel`

### 7.3 Main Area — Video Player

**API: Get video playback info**
```
GET /api/episodes/:episodeId/playback
```

Response:
```json
{
  "id": "uuid",
  "title": "Unlimited Time: Breaking the Myth of Limited Access",
  "description": "Antano dismantles the myth of 'limited time' by showing how access expands...",
  "videoUrl": "https://stream.bunnycdn.com/...",
  "videoType": "hls",
  "durationSeconds": 1760,
  "resumeAtSeconds": 18,
  "qualityOptions": ["auto", "720p", "480p", "360p"],
  "defaultQuality": "auto",
  "defaultSpeed": "1x",
  "speedOptions": ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"],
  "playerLabels": {
    "autoLabel": "Auto",
    "fullscreenLabel": "Fullscreen"
  }
}
```

On progress:
```
POST /api/episodes/:episodeId/progress
Body: { watchedSeconds: 312, isCompleted: false }
```

On completion:
```
POST /api/episodes/:episodeId/progress
Body: { watchedSeconds: 1760, isCompleted: true }
```

### 7.4 Main Area — Live Call Countdown

All text, colors, datetime from the flow item API response. Countdown computed from `scheduledAt`.  
Unit labels (DAYS, HOURS, MINS, SECS) configurable via:
```
GET /api/config/site → countdownUnitLabels: { days: "DAYS", hours: "HOURS", mins: "MINS", secs: "SECS" }
```

### 7.5 Q&A Tab

**Fetch questions:**
```
GET /api/workshops/:slug/qa?page=1&limit=20
```

Response:
```json
{
  "heading": "Do you have any questions ?",
  "promptText": "Got something on your mind? Post your question and let's explore it together!",
  "inputPlaceholder": "Type your Question here ?",
  "submitLabel": "Ask Now",
  "communityHeading": "Others Asked questions",
  "communityHeadingHighlight": "questions",
  "posts": [
    {
      "id": "uuid",
      "author": { "name": "Rajiv Roda", "avatarUrl": "https://cdn.../avatar.jpg" },
      "timeAgo": "3h",
      "questionText": "In the must have Deal I have – 'Stop over thinking and Take actions' I don't know how should I work on this deal?",
      "replyLabel": "Reply",
      "replies": []
    }
  ],
  "pagination": { "total": 48, "page": 1, "limit": 20 }
}
```

**Post question:**
```
POST /api/workshops/:slug/qa
Body: { questionText: "..." }
```

**Post reply:**
```
POST /api/qa/:postId/reply
Body: { replyText: "..." }
```

Frontend: All UI labels (heading, prompt, placeholder, button, community heading) from API response. No hardcoded copy.

### 7.6 Assignment Tab

**Fetch assignments:**
```
GET /api/workshops/:slug/assignments
```

Response:
```json
{
  "groups": [
    {
      "challengeLabel": "Challenge 01",
      "challengeTitle": "Deals",
      "assignments": [
        {
          "id": "uuid",
          "title": "'That Must Have Deal' List",
          "typeLabel": "QUESTION",
          "iconType": "document",
          "submission": {
            "isSubmitted": true,
            "submittedAt": "2026-05-30T10:00:00Z",
            "answerText": "1. Mentoring my team\n2. Leadership quality of me\n3. Better system in Sales\n4. Adjustments with Bhuvana\n5. Capabilities for my kids",
            "completedIcon": "checkmark_green",
            "yourAnswerLabel": "Your Answer:",
            "backLabel": "Back"
          }
        }
      ]
    }
  ]
}
```

**Submit assignment:**
```
POST /api/assignments/:assignmentId/submit
Body: { answerText: "..." }
```

---

## 8. Full-Screen Video Player (`/watch/[episodeId]`)

**API:** Same as `GET /api/episodes/:episodeId/playback`

All labels on the player (quality selector, speed options, back label) — from API response.  
No hardcoded player strings in UI code.

---

## 9. Products Page (`/Products`)

**API:**
```
GET /api/products
```

Response:
```json
{
  "pageTitle": "Journey with A&H",
  "pageBg": "linear-gradient(135deg, #00c4cc 0%, #a855f7 100%)",
  "products": [
    {
      "id": "uuid",
      "order": 1,
      "title": "uP! for Prodigies",
      "description": "A transformational program for young minds...",
      "thumbnailUrl": "https://cdn.../up-prodigies.jpg",
      "isVisible": true,
      "ctas": [
        { "label": "Apply Now", "url": "https://...", "type": "primary", "openInNewTab": true },
        { "label": "Enquire Now!", "url": "https://...", "type": "secondary", "openInNewTab": false }
      ]
    }
  ]
}
```

Frontend: `pageTitle`, `pageBg`, product titles, descriptions, CTA labels — all from API.

---

## 10. Resources Page (`/Resources`)

**API:**
```
GET /api/resources?search={query}&view=list&page=1&limit=20
```

Response:
```json
{
  "pageTitle": "Resources",
  "searchPlaceholder": "Search resources...",
  "totalCount": 9,
  "totalLabel": "resources",
  "viewOptions": ["list", "grid"],
  "resources": [
    {
      "id": "uuid",
      "title": "Excellence Workbook Vol 1",
      "author": "Antano & Harini",
      "date": "2026-01-15",
      "fileUrl": "https://r2.../workbook-v1.pdf",
      "previewUrl": "https://r2.../workbook-v1-preview.pdf",
      "fileType": "pdf",
      "fileTypeIconUrl": "https://cdn.../pdf-icon.svg",
      "fileCount": 1,
      "order": 1,
      "isVisible": true,
      "hoverActions": [
        { "type": "preview", "iconType": "eye", "label": "Preview" },
        { "type": "download", "iconType": "download", "label": "Download" }
      ]
    }
  ],
  "pagination": { "total": 9, "page": 1, "limit": 20 }
}
```

Frontend: All labels (`pageTitle`, `searchPlaceholder`, hover action labels) from API.

---

## 11. Notifications

**API:**
```
GET /api/notifications?page=1&limit=30
POST /api/notifications/:id/read
POST /api/notifications/read-all
```

Response includes: notification list with title, message, type, createdAt, isRead.  
No notification type labels or icons hardcoded in frontend.

---

## 12. Authentication

**Login page (`/login`)**  
Clerk-powered. All UI labels (heading, email placeholder, password placeholder, submit button label) driven by:
```
GET /api/config/auth
```

Response:
```json
{
  "loginHeading": "Welcome Back",
  "loginSubheading": "Sign in to continue your journey",
  "emailLabel": "Email",
  "emailPlaceholder": "Enter your email",
  "passwordLabel": "Password",
  "passwordPlaceholder": "Enter your password",
  "submitLabel": "Sign In",
  "logoUrl": "https://cdn.../logo.svg"
}
```

---

## 13. Error & Empty States

All empty state messages, error messages, and loading labels come from:
```
GET /api/config/ui-strings
```

Response:
```json
{
  "loading": "Loading...",
  "noWorkshops": "No workshops enrolled yet.",
  "noResources": "No resources found.",
  "qaLoadingLabel": "Loading questions...",
  "errorGeneric": "Something went wrong. Please try again.",
  "lockedContentMessage": "Upgrade your tier to unlock this content."
}
```

---

## 14. API Summary for User Web

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/config/site` | Site config, theme, branding |
| GET | `/api/config/nav` | Navigation items |
| GET | `/api/config/auth` | Login UI labels |
| GET | `/api/config/ui-strings` | All UI text/labels |
| GET | `/api/home/hero` | Hero carousel slides |
| GET | `/api/home/sections` | Home content section rows |
| GET | `/api/members/me` | Logged-in user profile |
| PATCH | `/api/members/me` | Update profile |
| GET | `/api/workshops/my` | My enrolled/completed workshops |
| GET | `/api/workshops/:slug/detail` | Workshop page bootstrap |
| GET | `/api/workshops/:slug/flow` | Challenge/live-call flow items |
| GET | `/api/workshops/:slug/qa` | Q&A posts |
| POST | `/api/workshops/:slug/qa` | Post a question |
| POST | `/api/qa/:postId/reply` | Post a reply |
| GET | `/api/workshops/:slug/assignments` | Assignment list + submissions |
| POST | `/api/assignments/:id/submit` | Submit assignment answer |
| GET | `/api/episodes/:id/playback` | Video playback info |
| POST | `/api/episodes/:id/progress` | Track watch progress |
| GET | `/api/products` | Products page data |
| GET | `/api/resources` | Resource library |
| GET | `/api/notifications` | Notification feed |
| POST | `/api/notifications/:id/read` | Mark notification read |
