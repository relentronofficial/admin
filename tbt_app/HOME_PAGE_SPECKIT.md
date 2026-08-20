# TBT Home Page Speckit — Pixel-perfect Port of Co-worker's App

> **Source of truth**: `co-worker/moble app/moble app/lib/main.dart`, class
> `PostPopupScreen` / `_PostPopupScreenState` (lines 2521–4508) plus supporting
> widgets (`AchievementComposer` line 1363, `AppLogo` line 200, `TbtAppDrawer`
> line 689, `AnimatedGlassCard` line 5310, `BlinkingShareButton` line 5166,
> `FadeInSlideTransition` line 5232, `NotificationBadge` singleton).
>
> **Target**: `F:/admin/tbt_app/` (Flutter + Riverpod + go_router). This spec
> is what a developer must reproduce so the home page is visually and
> functionally identical to the co-worker's app.

---

## 0. Non‑negotiable Constants

| Token | Value | Where |
|---|---|---|
| Brand red (CTA/active) | `#E50914` | buttons, active tab, milestone chip, indicator active dot |
| Deep red (avatar ring, notif dot) | `#D30814` | header profile ring, notification badge bg |
| Legacy red (poster button) | `#CC0000` | mentor card CTA button, loading spinner |
| Coral (ritual highlight) | `#FF3B30` | ritual title, question highlight word, ritual glow ring |
| Warm coral (yes button end) | `#FF5E3A` | Yes button gradient end |
| Flame gradient | `#FF416C → #FF4B2B` | streak flame ShaderMask (bottomCenter → topCenter) |
| Menu card bg (idle) | `#0B0B0D` | AnimatedGlassCard bg |
| Menu card bg (pressed) | `#1A0709` | AnimatedGlassCard press bg |
| Menu card border | `#B22222` (crimson) | AnimatedGlassCard border |
| Neutral secondary text | `#8E8E93` | ritual subtitle, "Not Yet" text, expand chevron |
| Dark inactive | `#48484A` | carousel inactive dot, avatar fallback bg |
| Success green | `Colors.green` | ritual completed pill/icon |
| Snackbar success | `#27AE60` | success snackbar bg |
| Snackbar error | `#D30814` | error snackbar bg |
| Drawer bg (dark) | `#0A0A0C @ 0.93` | drawer glassmorphic layer |
| Nav bar bg (dark) | `#151515 @ 0.85` | bottom nav backdrop |
| Header height | **70 px** | fixed |
| Bottom nav height | **75 px** | glass bar (Voice of Sakthi raised -24 px above) |
| Content max width | **500 px** | centered `ConstrainedBox` |
| Scroll body padding | left 16, right 16, top 8, bottom **120** | bottom pads for nav |
| Card corner radius | 16–24 px | menu card 16, composer 20, mentor poster 24 |
| Font family | Default (no custom font wired) | `context.textColor` from ThemeContext |

Backdrop blur values: drawer `sigmaX/Y = 22`, bottom nav `sigmaX/Y = 15`.

---

## 1. Overview

`PostPopupScreen` is the root of the authenticated app. It hosts two internal
tabs via `_currentTabIndex`:

- **Tab 0 — HOME feed** (default): greeting → composer → mentor carousel → dots → morning ritual → 6‑tile menu grid.
- **Tab 1 — WINS leaderboard**: `_LeaderboardTab()` (separate widget).

Tab switching is purely local state (no route change). Tabs 3 (Courses) and 4
(Profile) do **not** switch tabs — they push a new route, then reset to tab 0
when popped. Tab 2 (Voice of Sakthi) also pushes `PodcastScreen`.

Scaffold config: `extendBody: true`, `drawer: TbtAppDrawer()`,
`bottomNavigationBar: _buildBottomNavigationBar()`.

Background: `context.themeGradients` linear (topLeft → bottomRight).

---

## 2. Widget Tree (Home tab)

```
Scaffold(extendBody: true)
├─ drawer: TbtAppDrawer
├─ body: Container(gradient: themeGradients)
│  └─ Column
│     ├─ SafeArea (bottom: false)
│     │  └─ Container(maxWidth 500)
│     │     └─ SizedBox(height 70)
│     │        └─ Padding(H 16)
│     │           └─ Row
│     │              ├─ Hamburger (_buildCustomMenuIcon → openDrawer)
│     │              ├─ Expanded → AppLogo.appBar() (centered)
│     │              └─ Row(min)
│     │                 ├─ Streak (32×32 circle, flame + "12")
│     │                 ├─ SizedBox 16
│     │                 ├─ Bell (Icons.notifications_outlined + red badge)
│     │                 ├─ SizedBox 16
│     │                 └─ Profile Avatar (24×24 red ring)
│     └─ Expanded
│        └─ SingleChildScrollView (controller: _scrollController,
│                                    padding LTRB 16,8,16,120)
│           └─ Center → ConstrainedBox(maxWidth 500)
│              └─ Column(start, min)
│                 ├─ Text 'Hi, [Name]'  (22 px, bold, textColor)
│                 ├─ SizedBox 20
│                 ├─ AchievementComposer
│                 ├─ SizedBox 24
│                 ├─ Container(key: _mentorCardKey, child: _buildMentorPosterCard)
│                 ├─ SizedBox 16
│                 ├─ _buildCarouselIndicator (dot row)
│                 ├─ if (_showMorningRitual) SizedBox 24 + _buildMorningRitualCard
│                 ├─ SizedBox 24
│                 └─ _buildMenuGrid (2×3 tiles)
└─ bottomNavigationBar: NativeGlassNavigationBar (fallback custom)
```

---

## 3. Fixed Header (70 px, maxWidth 500, H‑padding 16)

### 3.1 Hamburger — `_buildCustomMenuIcon`
Three stacked, left‑aligned lines. Each `Container(height: 2, radius: 1)`.
- Line 1: width **22**, color `context.textColor`
- SizedBox 5
- Line 2: width **16**
- SizedBox 5
- Line 3: width **11**

Wrapped in `Builder` + `GestureDetector(behavior: opaque)` → `Scaffold.of(context).openDrawer()`.

### 3.2 Centered Wordmark — `AppLogo.appBar()`
Container `120 × 36`, `alignment: center`. `Image.asset` picks:
- Dark theme → `assets/images/TBT C Pvt Final logo-04.png`
- Light theme → `assets/images/TBT C Pvt Final logo-light.png`
- `errorBuilder`: `Text('TBT', color #E50914, size height*0.45 ≈ 16.2, w900, letterSpacing 1)`

Rebuilt from `ValueListenableBuilder<ThemeMode>(appThemeNotifier)`.

### 3.3 Streak Widget — `_buildStreakWidget`
- `Container 32×32` circle, bg `scaffoldBg @ 0.3`, border `borderCol` 1 px
- `Stack(alignment: center)`
  - `ShaderMask` (linear `#FF416C → #FF4B2B`, bottomCenter → topCenter) around `Icon(Icons.whatshot_rounded, white, size 18)`
  - `Positioned(bottom: 2)` → `Text('12', white, 9 px, w900, shadow(black, blur 3, offset 0,1))`
- Value **"12" is hardcoded** in the co-worker's app. Port TODO: read from `MemberXP` or `TbtActivityLog`.

Right spacing after: 16.

### 3.4 Notification Bell — `_buildNotificationWidget`
`AnimatedBuilder(animation: NotificationBadge.instance)` returns `Stack(clipBehavior: none)`:
- `Icon(Icons.notifications_outlined, textColor, size 22)`
- If `count > 0`, `Positioned(right: -2, top: -2)` → red‑dot bubble:
  - `padding: EdgeInsets.all(2)`, `constraints: minWidth 14, minHeight 14`
  - `BoxDecoration(color: #D30814, shape: circle)`
  - `Text(count > 9 ? '9+' : '$count', white, 8 px, bold, centered)`

Tap → push `NotificationsScreen()`, `.then((_) => NotificationBadge.instance.refresh())`.

`NotificationBadge` is a global `ChangeNotifier` singleton (`.instance`) with `unreadCount:int` and `.ensureLoaded()` / `.refresh()`.

### 3.5 Profile Avatar — `_buildProfileAvatar`
- `padding: 1.5 all`, `BoxDecoration(shape: circle, border: 1.5 #D30814)`
- `ClipRRect(radius 12)` around a `24×24` image:
  - If `ProfileScreen.profileImagePath != null` → `Image.file(...)`
  - Else `Image.network('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face')`
  - `errorBuilder`: `Container(24×24, bg #48484A, Icon(Icons.person, white70, size 14))`

Tap → `Navigator.push(MaterialPageRoute(builder: (_) => ProfileScreen()))`.

---

## 4. Content sections (top→bottom)

### 4.1 Greeting

```dart
Text('Hi, Thrisha',
  style: TextStyle(color: context.textColor, fontSize: 22, fontWeight: FontWeight.bold));
```

Port TODO: use `member.firstName` (first token of `me.name`).

### 4.2 AchievementComposer — full spec (main.dart:1363–2530)

State variables:
```
TextEditingController _textController
FocusNode _focusNode
bool _showEmojiPicker
XFile? _pickedImage
XFile? _pickedVideo
PlatformFile? _pickedAudio
String _visibility = 'Public'      // or 'Friends'
String? _selectedMilestone         // "First Post" | "Level Up" | ...
bool _showPostCard = true
bool _isPostCardExpanded = true
```

**Root**: `Column(start, min)` containing (only when `_showPostCard`) a **glass card**:
- `padding EdgeInsets.all(20)`
- Decoration: `color: context.cardBg @ 0.65`, `radius 20`,
  `border: 1 px #E50914 @ 0.25`, `boxShadow (black @ 0.2 dark / 0.05 light, blur 10, y 4)`

Header row:
- Title: `_isPostCardExpanded ? 'What did you achieve today? 🚀' : 'What did you achieve today?'` (18 px, bold, textColor, letterSpacing -0.5)
- Chevron button `36×36`, `borderCol` circle, `Icons.keyboard_arrow_up_rounded` or `_down_rounded`, `subTextColor`, size 24
- On tap → toggle `_isPostCardExpanded`

If expanded also render subtitle:
```
'Share your progress, inspire others, celebrate wins!'
(13.5 px, w400, color #8E8E93)
```

Then when expanded:

**Row 1 — avatar + input + emoji button**
- Avatar `40×40` (same source rules as header avatar) inside `ClipRRect(radius 20)`
- SizedBox 12
- Expanded `TextField`:
  - controller `_textController`, focusNode `_focusNode`, `maxLines: null`
  - style: 15 px, textColor
  - collapsed decoration, hint `'Share your wins, big or small...'`, hintColor `#7C7C80`
- SizedBox 8
- `IconButton(Icons.emoji_emotions_outlined, color #8E8E93)` toggles `_showEmojiPicker` — when opening, calls `_focusNode.unfocus()`; when closing, `_focusNode.requestFocus()`.

**Row 2 (conditional) — milestone chip**
When `_selectedMilestone != null`, indent 52 px, render pill:
- `padding H 10 V 5`, bg `#E50914 @ 0.08`, radius 20, border `#E50914 @ 0.25`
- `Icon(Icons.rocket_launch_rounded, #E50914, 13)` + 5 gap + `Text('${milestone.toUpperCase()} Growth Milestone', 11 px, w700, #E50914, ellipsis)`

**Emoji picker** (when `_showEmojiPicker == true`): 7‑column `GridView` of 60 emojis (see below), 40 px cell height, no scroll (fits fixed height around 240–280 px). Each cell is `InkWell → _insertEmoji(emoji)`.

Emoji list (index order matters for grid layout):
```
😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇
🙂 😉 😌 😍 🥰 😘 😋 😛 😜 😎
🤩 🥳 😏 🤔 🤨 😐 😑 🙄 😬 😴
👍 👎 👌 ✌️ 🤞 🤟 👋 👏 🙏 🙌
❤️ 💖 🔥 🚀 🎉 🌟 ✨ 💯 🎈 💼
📈 💡 🏆 🎯 🤝 📣 🔔 🌍 🇮🇳 💻
```
`_insertEmoji(emoji)` replaces the current selection (or appends if none) and moves the cursor to `selection.start + emoji.length`.

**Attachments preview**: when `_pickedImage`/`_pickedVideo`/`_pickedAudio` is non‑null, render a `200 px` preview strip below the input:
- Image: `Image.file(...)` `BoxFit.cover` with a **close pill** (`Positioned top 8, right 8`, black @ 0.6, radius 12, `Icons.close`, white, 16)
- Video: same pill + centered play icon overlay
- Audio: filename tile with `Icons.audiotrack` bg `#9B51E0 @ 0.15`, filename text
- Selecting a media clears the other two (mutually exclusive).

**Milestone selector**: horizontally scrollable chip row (only when expanded). Options:
`['First Post', 'Level Up', 'Task Complete', 'Book Finished', 'Course Complete']`
- Selected chip bg `#E50914 @ 0.15`, border `#E50914`, text `#E50914 700`
- Unselected chip bg `context.bgInput`, border `borderCol`, text `subTextColor 500`

**Bottom action bar** (Row):
- Left cluster (media buttons, using `_buildMediaItem` for icon + label):
  - 🖼 `Icons.image_outlined`, color `#2F80ED` (blue), label `'Photo'` → `_pickImage()`
  - `_buildDivider()` (16 px vertical line, `borderCol`)
  - 🎥 `Icons.videocam_outlined`, `#27AE60` (green), `'Video'` → `_pickVideo()`
  - divider
  - 🎧 `Icons.mic_none_outlined` (or `audiotrack`), `#9B51E0` (purple), `'Audio'` → `_pickAudio()`
- Spacer
- Visibility button → opens `_showVisibilitySelector()` (bottom sheet with `Public` and `Friends` options, list tiles)
- Post button (see below)

**Post button**:
- On tap runs the submit block (main.dart:2380–2470). If both text and media are empty → snackbar `'Say something first!'` (error color). Else:
  1. If `_pickedImage != null`, upload to Supabase Storage `community` bucket, path `posts/{ts}_{filename}` → obtain `uploadedImageUrl`
  2. Insert into local `communityPosts` list at index 0 (see full shape in main.dart:2380)
  3. Insert into Supabase `posts` table with `is_approved: false`, `status: 'active'`, `is_mentor: false`, badge_color `#CC0000` etc.
  4. Truncate `communityPosts` to 10 max, `savePostsToLocal()`
  5. Clear form fields; collapse card (`_isPostCardExpanded = false`)
  6. Snackbar `'Successfully posted to Community! 🎉'` bg `#27AE60`
  7. `widget.onPosted?.call()`
- Visual: `InkWell(radius 24)` wrapping `Container` padding `H 12 V 10`, bg `#E50914`, radius 24, shadow (`#E50914 @ 0.3` blur 10 y 4).
  Content: `Icon(Icons.send_rounded, white, 14)` + `SizedBox 6` + `Text('Post to Community', white, 14, bold)` — wrapped in `Flexible → FittedBox(scaleDown)`.

### 4.3 Mentor Poster Card — `_buildMentorPosterCard` (main.dart:3861–4097)

Container: `width: infinity`, `radius: 24`, `border: 1.5 borderCol`,
inner `ClipRRect(radius 22.5)`, `AspectRatio 1.6`.

**Loading state** (`_isLoadingCarousel == true`):
```
Container(w: infinity, h: 200, radius 24, cardBg,
  Center(CircularProgressIndicator(#CC0000)))
```

**Slides source**:
```dart
final slides = _carouselItems.isNotEmpty
    ? _carouselItems
    : [
        {
          'media_type': 'image',
          'media_url': 'assets/images/whatsapp_image.jpeg',
          'is_asset': true,
          'title': 'Tamil Business Tribe',
          'subtitle': 'Tamil Business Tribe - Guide. Inspire. Empower.',
        },
        {
          'media_type': 'image',
          'media_url': 'assets/images/tbt_2.jpeg',
          'is_asset': true,
          'title': 'TBT Quote of the Day',
          'subtitle': '"To get something you never had, you have to do something you never did."\n\n- Tamil Business Tribe Mentor Quote',
        }
      ];
```

**PageView.builder** (infinite scroll — initialPage 1000; `itemBuilder` mods by slides.length):
- On `pageChanged`: `_currentCarouselPage = index % slides.length`
- For each slide, build media widget:
  - `is_asset == true` → `Image.asset(mediaUrl, cover, errorBuilder → Container(cardBg))`
  - `media_type == 'video'` → `CarouselVideoPlayer(videoUrl, thumbnailUrl)` (with auto‑swap fallback: if `mediaUrl` looks like image and `thumbnailUrl` looks like video, they were reversed and are swapped)
  - default → `Image.network(mediaUrl, cover, errorBuilder → Container(#0F0F11, Icon(broken_image, white24, 40)))`
- Stack overlays:
  - Dark bottom gradient: `black @ 0.15 top → black @ 0.85 bottom`
  - Bottom‑left text (padding 16, mainAxis end):
    - Title: 16 px, bold, white, 1 line, ellipsis
    - Subtitle: 12 px, italic, white @ 0.9, 2 lines, ellipsis
    - Description (if any): 10 px, white @ 0.7, 1 line
    - Button (if `button_text`): `ElevatedButton` bg `#CC0000`, radius 6, 28 px height, H‑padding 12, text `button_text` white 11 px bold → `_launchUrlHelper(button_link)`
- Top‑right overlay: `Positioned(top 16, right 16, child: BlinkingShareButton(onTap: _shareCarouselQuote or _shareAssetImage))`

**BlinkingShareButton** (main.dart:5166):
- Continuous 1500 ms opacity loop (approx `0.5 ↔ 1.0`).
- Circle button with `Icons.ios_share` (or `share_rounded`), white on `black @ 0.4` bg, size ~28.

**Timer**: `_carouselTimer` `Timer.periodic(4 s)` calls `_carouselPageController.nextPage(dur 350 ms, easeIn)`.

**Backup poll**: `_backupPollTimer` `Timer.periodic(4 s)` re‑runs `_fetchCarouselItems()` + `_fetchDynamicHabits()`.

### 4.4 Carousel dots — `_buildCarouselIndicator`

Row centered, one `AnimatedContainer(dur 300 ms)` per slide:
- Selected: width **18**, height **4**, color `#E50914`, radius 2
- Others: width **6**, height 4, color `#48484A`, radius 2
- H‑margin per dot: 4

If `_carouselItems.isEmpty` the dots reflect the 2 hardcoded fallback slides.

### 4.5 Morning Ritual card — `_buildMorningRitualCard` (main.dart:3252–3679)

Rendered only when `_showMorningRitual == true`. Preceded by `SizedBox 24`.

Container:
- radius 16, border 1 `borderCol`, bg `context.cardBg` (implicit via theme), shadow (black @ 0.2 dark / 0.05 light, blur 10, y 4)
- padding 16 all

**Header Row**
1. Left ritual tag pill (Expanded):
   - Icon pill 32×32? padding 6, bg `pillColor` (light red), radius 8, border 1 `#FF3B30 @ 0.4`, `Icon(Icons.edit_document, #FF3B30, 16)`
   - SizedBox 10
   - `Text('MORNING RITUAL', color #FF3B30, 12 px, bold, ls 0.5)` — ellipsis
2. Step pill:
   - If in progress: padding H 12 V 4, radius 12, bg pillColor, border `#FF3B30 @ 0.2`, `Text('{step+1} / {total}', #FF3B30, 12, bold)`
   - Else: `border green @ 0.4`, `Text('Completed', green, 12, bold)`
3. SizedBox 12
4. Chevron toggle button: circle 6 px padding, bg pillColor, `Icons.keyboard_arrow_up/down_rounded` `#8E8E93` size 16 → toggles `_isMorningRitualExpanded`.

**Progress lines** (Row of Expanded 4 px bars):
- Bar `height 4`, radius 2, `H margin 4` (except first)
- Active bars (index ≤ current step OR completed): color `#E50914` with glow `boxShadow(#E50914 @ 0.4, blur 8, spread 1)`
- Inactive: `#2C2C2E` dark / `#E5E5EA` light

**Expanded body** (only if `_isMorningRitualExpanded`):
- SizedBox 24
- If still in progress (`_currentRitualStep < habits.length`):
  - `SizedBox(height 200)` containing `PageView.builder(controller: _ritualPageController, itemCount: habits.length)` — swipe advances step
  - Each page = centered Column:
    - Glow circle 60×60: bg pillColor, border 1.5 `#FF3B30`, shadow `#FF3B30 @ 0.3` blur 12 spread 2 → `Icon(_getDynamicIcon(fa-icon-name), #FF3B30, 26)`
    - SizedBox 18
    - `RichText(center)` — 22 px bold textColor, height 1.25 — spans from `_getDynamicQuestionSpans(index, #FF3B30)` which splits `rawQuestion` on `highlightWord`, coloring the match `#FF3B30`
    - SizedBox 8
    - Subtitle `Text(habit.subtitle, center, #8E8E93 14 w400)`
  - SizedBox 24
  - **Footer buttons** Row:
    - **Not Yet** (Expanded, InkWell radius 16):
      - Container padding V 14, radius 16, bg pillColor, border 1 `borderCol`
      - Row: `Icon(Icons.close_rounded, #8E8E93, 18)` + SizedBox 8 + `Text(buttonsConfig.notYetLabel ?? 'Not Yet', #8E8E93, 15, bold)`
      - Tap → `_handleRitualAnswer(false)`
    - SizedBox 16
    - **Yes** (Expanded):
      - Container padding V 14, radius 16, gradient `#FF3B30 → #FF5E3A`, shadow `#FF3B30 @ 0.3` blur 10 y 4
      - Row: `Icon(Icons.check_rounded, white, 18)` + 8 + `Text(buttonsConfig.yesLabel ?? 'Yes', white, 15, bold)`
      - Tap → `_handleRitualAnswer(true)`
- Else (completed):
  - SizedBox 20
  - Circle 60×60, bg `green @ 0.1`, border 1.5 green, shadow green @ 0.2 blur 12 spread 2 → `Icon(Icons.check_circle_rounded, green, 32)`
  - SizedBox 18
  - `Text('Morning Ritual Completed!', 22, bold, textColor)`
  - SizedBox 8
  - `Text('Success! You checked off ${yesCount} of ${total} morning habits.', center, #8E8E93 14)`
  - SizedBox 10

**Handlers**
- `_handleRitualAnswer(bool answer)`: sets `_ritualAnswers[step] = answer`, increments `_currentRitualStep`, animates `_ritualPageController.nextPage(dur 300, easeInOut)`
- Dismiss (cross icon in some builds): sets `_showMorningRitual = false`

### 4.6 Menu Grid — `_buildMenuGrid` (main.dart:4138–4253)

Six `_HomeMenuItem`s in this exact order:

| # | title | icon | color | onTap destination |
|---|-------|------|-------|-------------------|
| 1 | Community | `Icons.groups_rounded` | `#E50914` | `CommunityScreen` (then if returned int == 4 push `ProfileScreen`) |
| 2 | Courses | `Icons.school_rounded` | `#E50914` | `CoursesScreen` |
| 3 | Podcast | `Icons.podcasts_rounded` | `#E50914` | `PodcastScreen` |
| 4 | Workshop | `Icons.co_present_rounded` | `#E50914` | *(empty — no navigation)* |
| 5 | E-Book | `Icons.menu_book_rounded` | `#E50914` | `EBooksLibraryScreen` |
| 6 | Task | `Icons.task_alt_rounded` | `#E50914` | `TasksScreen` |

Layout: `Column(start)` of 3 rows. Each row is a `FadeInSlideTransition` with `delay = [100 ms, 250 ms, 400 ms][rowIndex]`. Row = `Row(Expanded, SizedBox 14, Expanded)`. First row `top: 0`, subsequent rows `top: 14`.

**AnimatedGlassCard** (main.dart:5310):
- Static constants (**not theme‑aware**):
  - `_cardBackground = 0xFF0B0B0D`
  - `_cardBackgroundPressed = 0xFF1A0709`
  - `_cardBorderColor = 0xFFB22222`
- Idle: height **110**, radius 16, border 1.4 `#B22222 @ 0.85`, shadow `#B22222 @ 0.15` blur 14 y 4
- Pressed: bg `#1A0709`, border `#B22222 @ 1.0`, shadow `#B22222 @ 0.3`, `AnimatedScale(0.94, 150 ms, easeOutBack)`
- Content (non‑fullWidth): Column center → `Icon(icon, color, 32)` + SizedBox 10 + `Text(title, white, 14.5, bold, ls 0.5)`
- Full‑width variant (unused on home): height 80, Row center → icon 30 + SizedBox 12 + title 16 bold ls 0.5

**FadeInSlideTransition** (main.dart:5232): starts after `delay`, fades opacity 0→1 and slides `Offset(0, 0.15) → zero` over 600 ms `easeOutCubic`.

---

## 5. Bottom Navigation Bar — `_buildBottomNavigationBar` (main.dart:4255)

Uses the local package `native_glass_navbar` (`NativeGlassNavigationBar` widget) with a `fallback:` Flutter widget. The fallback is used at runtime today. Both must render **HOME · WINS · VOICE OF SAKTHI · COURSES · PROFILE** in that order (indices 0–4). The middle tab is a **raised** avatar circle.

**Container**: max‑centered, `width = min(screenWidth, 500)`, height **75**, `Stack(clipBehavior: none)`.

**Layer 1 — Glass background** (`Positioned.fill → ClipRRect(topLeft/Right radius 24) → BackdropFilter(sigma 15)`):
- Container bg `#151515 @ 0.85` (dark) / `white @ 0.9` (light)
- Border 1 `borderCol`
- Top‑only rounded corners 24

**Layer 2 — Items** (`Positioned.fill → Row(spaceEvenly)`):
Five `Expanded` slots:
- 0 HOME `Icons.home` label `'HOME'`
- 1 WINS `Icons.emoji_events` label `'WINS'`
- 2 Voice of Sakthi (special — see below)
- 3 COURSES `Icons.school` label `'COURSES'`
- 4 PROFILE `Icons.person` label `'PROFILE'`

**`_buildNavItem(index, icon, label)`**:
- If `_currentTabIndex == index` (**selected**):
  - Container H‑margin 4, height 52, radius 12, bg `white @ 0.12` dark / `black @ 0.06` light, border 1 (`white @ 0.18` / `black @ 0.12`)
  - Column center → `Icon(icon, #E50914, 20)` + SizedBox 3 + `FittedBox → Text(label, #E50914, 10, w900)`
- Else (**inactive**): InkWell → Container height 52 → Column center → `Icon(icon, white38 dark / black45 light, 22)` + SizedBox 4 + `Text(label, same color, 10, bold)`
- Tap on 3 (Courses) or 4 (Profile) → `Navigator.push(...).then((_) => _currentTabIndex = 0)` (does not stay selected)
- Tap on 0/1 → `setState(_currentTabIndex = index)`

**`_buildVoiceOfSakthiItem(index)`** — the raised avatar:
- Height 75, `Stack(clipBehavior: none, alignment: center)`
- `Positioned(top: -24)` Column:
  - **Circle 54×54**, `shape: circle`, `border: 2` (`#E50914` if selected, else `Colors.amber.shade700` = `#FFA000`), `DecorationImage(assets/images/nav  bar.jpeg, cover)` — *note the double space in the filename*, `boxShadow(black @ 0.4, blur 8, y 4)`
  - SizedBox 3
  - `FittedBox → Text('VOICE OF SAKTHI', 8.5 px, w900, color: selected → #E50914 else white70/black87)`
- Tap → push `PodcastScreen`, `.then(_ => _currentTabIndex = 0)`

---

## 6. Drawer — `TbtAppDrawer` (main.dart:689–1112)

`Drawer(backgroundColor: transparent, elevation: 0)` → `Stack`:

1. **Glassmorphic backdrop**: `BackdropFilter(sigma 22) → Container(bg #0A0A0C @ 0.93 dark / white @ 0.94 light, right border 1.5 dividerColor)`
2. **Red accent strip**: `Positioned(left 0, top 0, bottom 0, width 3, gradient #E50914 → #8B0000 → #E50914 vertical)`
3. **Content SafeArea → Column(stretch)**:
   - **Header** (FadeIn + SlideIn from left, 420 ms `easeOutCubic`):
     - Padding LTRB 20/20/16/20, bottom border 1 dividerColor
     - Row(spaceBetween): `AppLogo.appBar()` | Close button (circle bg `white @ 0.06`/`black @ 0.04`, `Icons.close_rounded` textColor 20)
     - SizedBox 16
     - Row: Avatar with red gradient ring (`#E50914 → #8B0000`, padding 2, inner ring transparent padding 1.5, image 42×42 same source rules) | SizedBox 12 | Column: `Text('Thrisha', textColor, 16, bold, ls 0.2)` + SizedBox 2 + `Text('Co-Founder, Creative Studios', subTextColor, 11.5, 1 line ellipsis)`
   - **ListView (Bouncing)** padding LTRB 12/10/12/4 — 10 staggered items, each `FadeTransition + SlideTransition Offset(-0.25,0) → zero`, 55 ms between:

     | idx | icon | label | route |
     |---|---|---|---|
     | 0 | `Icons.home_rounded` | Home Feed | `popUntil(isFirst)` |
     | 1 | `Icons.emoji_events_rounded` | TBT Leaderboard | `popUntil(isFirst)` (then switch tab 1) |
     | 2 | `Icons.groups_rounded` | Community Feed | `pushAndRemoveUntil → CommunityScreen` |
     | 3 | `Icons.school_rounded` | Courses Path | `pushAndRemoveUntil → CoursesScreen` |
     | 4 | `Icons.map_rounded` | Course Quest | `push → CourseQuestScreen` |
     | 5 | `Icons.podcasts_rounded` | Voice of Sakthi | `push → PodcastScreen` |
     | 6 | `Icons.menu_book_rounded` | E-Book Library | `push → EBooksLibraryScreen` |
     | 7 | `Icons.auto_awesome_rounded` | Content Buddy AI | `push → AIContentScreen` |
     | 8 | `Icons.notifications_rounded` | Notifications | `push → NotificationsScreen` |
     | 9 | `Icons.person_rounded` | My Profile | `push → ProfileScreen` |

   - **Footer** (item 10): top divider, `_TbtDrawerItem(Icons.logout_rounded, 'Logout', iconColor #E50914, labelColor #E50914)` → `push → LogoutConfirmationScreen`

**`_TbtDrawerItem`** press interaction: `AnimatedController` 120 ms, `Tween(1.0 → 0.94, easeInOut)`, `onTapDown/Up` scales and triggers callback after 100 ms delay. Icon color `#E50914` when pressed or selected, otherwise textColor.

---

## 7. Data Sources

### 7.1 Home Carousel — `home_carousel`
Supabase table (SQL below). Fetched via `supabase.from('home_carousel').select().eq('status','active').order('sort_order asc')` in `_fetchCarouselItems()`.

Realtime: `channel('public:home_carousel').onPostgresChanges(all)` calls `_fetchCarouselItems()` on any change. Plus a 4 s backup poll timer.

Schema (`admin-app/home_carousel.sql`):
```
id UUID PK
title VARCHAR(255) NOT NULL
subtitle TEXT
description TEXT
media_type VARCHAR(50) DEFAULT 'image'   -- 'image' | 'video'
media_url TEXT NOT NULL
thumbnail_url TEXT
button_text VARCHAR(100)
button_link TEXT
sort_order INTEGER DEFAULT 0
status VARCHAR(50) DEFAULT 'active'      -- 'active' | 'inactive'
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Admin endpoints (`admin-app/server.js:173–235`):
- `GET /api/home_carousel`
- `POST /api/home_carousel`
- `PUT /api/home_carousel/:id`
- `DELETE /api/home_carousel/:id`

**Hardcoded fallback** when `_carouselItems.isEmpty`:
```
[
  { media_url: 'assets/images/whatsapp_image.jpeg', is_asset: true,
    title: 'Tamil Business Tribe',
    subtitle: 'Tamil Business Tribe - Guide. Inspire. Empower.' },
  { media_url: 'assets/images/tbt_2.jpeg', is_asset: true,
    title: 'TBT Quote of the Day',
    subtitle: '"To get something you never had, you have to do something you never did."\n\n- Tamil Business Tribe Mentor Quote' },
]
```

### 7.2 Habits — `habits`
Supabase table. Fetched via `.select().order('sort_order asc')` in `_fetchDynamicHabits()`. On Supabase failure, falls back to HTTP LAN polling in this order:
1. `192.168.0.115` (LAN — hardcoded first)
2. web only: `localhost`, `127.0.0.1`
3. Android emulator: `10.0.2.2`
4. iOS: `localhost`, `127.0.0.1`
5. `192.168.0.123` (secondary LAN)

Each host tried with 1 s timeout, `HttpClient(badCertificateCallback → true)`, endpoint `http://{host}:5000/api/habits`.

Schema (`admin-app/habits_schema.sql`):
```
id UUID PK
icon VARCHAR(100) DEFAULT 'fa-sun'    -- font-awesome icon key
raw_question TEXT NOT NULL
highlight_word VARCHAR(255) DEFAULT ''
subtitle VARCHAR(255) DEFAULT ''
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
```

`_getDynamicIcon(faKey)` maps: `fa-sun→wb_sunny_outlined`, `fa-spa→self_improvement`, `fa-bullseye→track_changes`, `fa-dumbbell→fitness_center`, `fa-coffee→local_cafe` (etc.).

**Hardcoded fallback** (used until backend responds) — 5 habits:
```
[
  { icon: 'fa-sun',      rawQuestion: 'Did you write your morning pages?',   highlightWord: 'morning pages',   subtitle: 'Build clarity. Boost focus. Start your day right.' },
  { icon: 'fa-spa',      rawQuestion: 'Did you meditate for 10 minutes?',    highlightWord: 'for 10 minutes',  subtitle: 'Calm your mind. Find presence. Center yourself.' },
  { icon: 'fa-bullseye', rawQuestion: 'Did you plan your daily goals?',      highlightWord: 'daily goals',     subtitle: 'Prioritize tasks. Direct your energy. Stay productive.' },
  { icon: 'fa-dumbbell', rawQuestion: 'Did you exercise or stretch today?',  highlightWord: 'stretch today',   subtitle: 'Activate your body. Boost energy. Stay healthy.' },
  { icon: 'fa-coffee',   rawQuestion: 'Did you eat a healthy breakfast?',    highlightWord: 'healthy breakfast', subtitle: 'Nourish your body. Fuel your mind for the day.' },
]
```

### 7.3 Buttons Config — `buttons_config`
Supabase table. Fetched via `.eq('id','default').maybeSingle()`.

Schema:
```
id VARCHAR(50) PK DEFAULT 'default'
yes_label VARCHAR(100) DEFAULT 'Yes'
not_yet_label VARCHAR(100) DEFAULT 'Not Yet'
updated_at TIMESTAMPTZ
```

Realtime channel + 4 s poll same as habits. Fallback LAN endpoint `/api/buttons_config`.

Default JSON: `{ "yesLabel": "Yes", "notYetLabel": "Not Yet" }`.

### 7.4 Posts — `posts` (community feed)
Table used for `AchievementComposer` submissions. Insert with `is_approved: false` — admin must approve before feed shows it. Admin approves via `PUT /api/posts/:id/approve`.

Table (inferred from insert): `name, role, badge, badge_color(#hex string), avatar_url, content, likes, comments, shares, is_liked, is_bookmarked, is_following, is_mentor, has_images, images(json array), has_video, video_thumbnail, is_approved, status`.

Storage: uploaded images live in Supabase Storage bucket `community` under `posts/{ts}_{filename}`.

### 7.5 Notifications
`NotificationBadge.instance.unreadCount` — global `ChangeNotifier` singleton. Backed by `admin-app`'s notifications endpoints and/or local FCM tracking. Bell tap opens `NotificationsScreen` then calls `.refresh()`.

### 7.6 Streak count
**Hardcoded "12"** in `_buildStreakWidget`. For our port, source from `MemberXP` / `TbtActivityLog` (see `tbt_activity_log` table already created in our backend startup SQL).

### 7.7 Profile avatar
`ProfileScreen.profileImagePath` static, else Unsplash placeholder, else fallback icon. Our port already reads `me.avatarUrl` — remains the correct source.

---

## 8. Fonts, Sizing, Spacing (consolidated)

**Font sizes** encountered in home widgets:
`8` (nav badge), `8.5` (Voice of Sakthi label), `9` (streak "12"), `10` (nav labels, poster description), `11` (poster button, milestone chip), `11.5` (composer media label, drawer subtitle), `12` (ritual pill, poster subtitle, ritual button), `13.5` (composer subtitle), `14` (post button text), `14.5` (menu tile title), `15` (composer input, ritual button label), `16` (poster title, drawer name, composer full-width tile), `16.2` (AppLogo fallback), `18` (composer header), `22` (greeting, ritual question, ritual completed).

**Weights**: `w400` (subtitles), `w500` (composer media label), `w700`/`bold` (most CTAs), `w900` (streak number, active nav label, Voice of Sakthi label).

**Spacing constants**: `2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 40, 42, 52, 54, 60, 70, 75, 110, 120, 200, 500`.

**Radii**: `1` (hamburger line), `2` (dot), `6` (poster button), `8` (ritual icon pill), `12` (ritual step pill / avatar clip), `16` (menu card / ritual card / ritual body button), `20` (composer card), `22.5` (poster inner clip), `24` (poster outer / nav top corners / composer emoji picker / post button).

**Shadows**: black @ 0.05 (light) / 0.20 (dark) blur 10 y 4 — used for the composer card. Red glow variants for pressed states and active elements as listed inline above.

---

## 9. Package Dependencies (only ones used by home page)

From co-worker `pubspec.yaml`:

| Package | Used for |
|---|---|
| `supabase_flutter ^2.6` | carousel/habits/buttons_config/posts data + realtime |
| `firebase_core ^3.15`, `firebase_messaging ^15.2` | notifications (via `NotificationBadge`/FCM) |
| `image_picker ^1.1` | composer image/video pick fallback |
| `wechat_assets_picker ^9.8` | composer gallery picker (primary) |
| `file_picker ^8.0` | composer audio pick |
| `share_plus ^10.1` | poster share action |
| `just_audio ^0.9` | audio previews (composer + Voice of Sakthi) |
| `video_player ^2.9` | `CarouselVideoPlayer` |
| `cached_network_image ^3.4` | poster image caching |
| `connectivity_plus 6.1` | offline overlay |
| `native_glass_navbar` (path override) | bottom nav |
| `url_launcher ^6.3` | poster button link |
| `path_provider ^2.1` | local `communityPosts` JSON persistence |
| `shared_preferences ^2.3` | anonymous UUID (posts identity, `_showMorningRitual`) |
| `permission_handler ^11.3` | image/audio permissions |
| `http ^1.2`, `http_parser ^4.0` | LAN polling fallback |

Our app already has: `supabase_flutter` (unused so far), `cached_network_image`, `firebase_messaging`, `just_audio`, `flutter_pdfview`, `video_player`, `flutter_secure_storage`, `dio`, `go_router`, `flutter_riverpod`. **Missing on our side**: `wechat_assets_picker`, `file_picker`, `share_plus`, `native_glass_navbar`, `url_launcher`, `permission_handler`, `image_picker` (worth verifying).

---

## 10. Gap Analysis vs current `F:/admin/tbt_app/`

### 10.1 Structural gaps (widgets present but incomplete)
| Widget | Status | Gap |
|---|---|---|
| `HomeHeader` | ✅ built | Missing streak count source (currently a hardcoded flame icon widget with no count); missing gradient shader; TBT wordmark shows text instead of image asset |
| `AchievementComposer` | ⚠️ partial | Missing: emoji picker (60‑emoji grid), avatar next to input, media picker (image/video/audio), attachment preview strip, visibility bottom sheet, milestone chip pill, Supabase submit path (uses backend REST + `is_approved: false`), success snackbar |
| `HomeCarousel` | ⚠️ partial | Missing: hardcoded fallback slides when backend empty, video slide support (`CarouselVideoPlayer`), `BlinkingShareButton` in top-right, poster CTA button, description line, infinite loop with initialPage 1000, `_shareCarouselQuote`/`_shareAssetImage` |
| `MorningRitualCard` | ⚠️ partial | Missing: 5 hardcoded fallback habits, RichText highlight word coloring, glow shadow on progress bars, PageView swipe navigation, completion celebration state, expand/collapse chevron, "MORNING RITUAL" red pill header, step "n / total" pill |
| `HomeMenuGrid` | ✅ built | Missing: `AnimatedGlassCard` press animation (scale 0.94, 150 ms easeOutBack), `FadeInSlideTransition` staggered row entrance (100/250/400 ms), crimson `#B22222` border color, red-glow shadow, exact tile height 110, exact icon 32 + gap 10 + title 14.5 |
| `AppBottomTabBar` | ⚠️ partial | Missing: BackdropFilter glass background, top-radius 24 border, selected‑pill background per tab (12 px radius), amber vs red border color rule on Voice of Sakthi, image asset (`nav  bar.jpeg`), boxShadow (black @ 0.4 blur 8 y 4), FittedBox scale-down |
| `TbtAppDrawer` | ❌ missing | Not implemented — full glassmorphic drawer with staggered items, red gradient accent strip, 10 items + logout footer |
| `NotificationBadge` singleton | ❌ missing | Not implemented as ChangeNotifier; badge in header is static |

### 10.2 Data / API gaps
- `home_carousel` table + realtime subscription — **not wired**. Our `homeHeroProvider` uses `/api/hero-slides` which is empty. Options:
  - (a) Wire the primary user-web hero endpoint properly.
  - (b) Add a new `homeCarouselProvider` that mirrors co-worker's `home_carousel` shape and hits `/api/home-carousel` (needs backend module).
- `habits` + `buttons_config` tables — **already exist** in our backend (`plugins/prisma.ts` startup seeds 5 default habits). Need to verify the `/api/rituals` endpoint returns them in the shape `{icon, rawQuestion, highlightWord, subtitle}`.
- `posts` community submit — **exists** at `/api/community/feed` but the composer needs to POST with the new fields (milestone, visibility, image URL, video URL, audio URL).
- Supabase realtime — our app doesn't use Supabase client at all. Use TanStack Query polling instead (10‑15 s interval) or add a lightweight WebSocket.

### 10.3 Visual gaps
1. **TBT wordmark** — currently rendered as three red-and-grey letters; should be an image asset (need to add `assets/images/TBT C Pvt Final logo-04.png` + `-light.png`).
2. **Streak flame** — needs ShaderMask gradient `#FF416C → #FF4B2B` and overlaid "12" (or dynamic count).
3. **Menu tile background** — currently light red pastel; should be near-black `#0B0B0D` with crimson `#B22222` border. This is the biggest single visual mismatch.
4. **Menu grid entrance animation** — completely absent in our port.
5. **Voice of Sakthi center circle** — currently a radial-gradient mic icon; the co-worker uses an image asset `nav  bar.jpeg` (avatar of Sakthi).
6. **Drawer** — completely missing; hamburger currently opens nothing.
7. **Poster card** — invisible without slides; needs the two hardcoded fallback quotes + `BlinkingShareButton`.
8. **Morning ritual** — invisible without habits; needs the 5 hardcoded defaults.

### 10.4 Behavior gaps
- Auto-scroll carousel every 4 s with `nextPage(dur 350, easeIn)`.
- Backup 4 s poll timer for both carousel and habits.
- LAN fallback host list for habits (we can skip this — we're not on LAN dev).
- Pull-to-refresh: currently invalidates providers; matches co-worker behaviour.
- Composer emoji cursor insertion & focus toggle.

### 10.5 Assets missing in `F:/admin/tbt_app/assets/`
- `assets/images/TBT C Pvt Final logo-04.png` (dark theme wordmark)
- `assets/images/TBT C Pvt Final logo-light.png` (light theme wordmark)
- `assets/images/whatsapp_image.jpeg` (poster fallback 1)
- `assets/images/tbt_2.jpeg` (poster fallback 2)
- `assets/images/nav  bar.jpeg` (Voice of Sakthi center avatar — note double space in filename)

---

## 11. Implementation Order (recommended)

1. **Assets** — copy the 5 image assets from `co-worker/moble app/moble app/assets/images/` to `F:/admin/tbt_app/assets/images/`, register in `pubspec.yaml`.
2. **AppLogo** — swap the current text wordmark for the asset-based `AppLogo.appBar()` variant.
3. **AnimatedGlassCard** — rewrite `HomeMenuGrid` tiles to use `#0B0B0D` / `#B22222` and the press animation. Add `FadeInSlideTransition` row wrappers.
4. **Streak flame** — add ShaderMask + count digit + real streak source.
5. **Hero carousel fallback** — inject the 2 hardcoded quote slides when `homeHeroProvider` returns empty. Add `BlinkingShareButton` overlay. Add `Timer.periodic(4s)` auto-scroll.
6. **Morning Ritual** — inject 5 default habits when `habitsProvider` returns empty. Add progress bar glow. Convert to PageView with completion celebration state.
7. **Voice of Sakthi tab** — swap radial-gradient mic for `AssetImage('assets/images/nav  bar.jpeg')`, amber border when idle, add shadow.
8. **Bottom nav glass** — wrap in `BackdropFilter(sigma 15)` + top-radius 24. Selected tab bg pill.
9. **TbtAppDrawer** — implement the 10-item staggered drawer with red accent strip and glassmorphic backdrop.
10. **AchievementComposer** — port the emoji picker, milestone chip pill, visibility sheet, media picker, attachment preview strip.
11. **NotificationBadge** — implement a global `ChangeNotifier` (or a Riverpod provider) fed by our `/api/notifications` unread count, wire the header bell to it.

---

## 12. Testing checklist

- [ ] Header 70 px, all 5 elements visible with correct spacing
- [ ] TBT wordmark renders from asset (not text fallback)
- [ ] Streak flame shows red gradient + "12" (or actual count) with black shadow
- [ ] Bell badge only shows when count > 0; shows `9+` cap
- [ ] Profile avatar has red 1.5 px ring, tap → `/profile`
- [ ] Greeting reads "Hi, {firstName}"
- [ ] Composer starts expanded with title "What did you achieve today? 🚀"
- [ ] Emoji picker opens (7 cols, 60 emojis) and inserts at cursor
- [ ] Media picker: only one of image/video/audio at a time; preview + close pill
- [ ] Milestone chip appears when selected; hides otherwise
- [ ] Visibility bottom sheet shows Public + Friends with check icon
- [ ] Post button submits with `is_approved: false` and clears + collapses card
- [ ] Snackbar "Successfully posted to Community! 🎉" on success (green)
- [ ] Mentor poster shows 2 fallback slides when backend empty; both have quote text
- [ ] Auto-scroll every 4 s; slides loop infinitely; dots animate width 6↔18
- [ ] Share button blinks (1.5 s opacity loop) and triggers native share
- [ ] Morning ritual shows 5 default habits when backend empty
- [ ] Progress bars glow red for completed/active steps
- [ ] Question highlights the `highlightWord` in red
- [ ] Yes button gradient `#FF3B30 → #FF5E3A` with drop shadow
- [ ] After all 5 answered, celebration state shows green check + count text
- [ ] Ritual collapses on chevron tap
- [ ] Menu grid: 6 tiles, black bg `#0B0B0D`, crimson `#B22222` border
- [ ] Tap tile: scale 0.94 press animation
- [ ] Row entrance: staggered fade+slide 100/250/400 ms delays
- [ ] Bottom nav: glass backdrop, top-radius 24, height 75
- [ ] HOME/COURSES/PROFILE/WINS: red icon when selected with pill background
- [ ] Voice of Sakthi: 54 px avatar image, amber border idle, red when active, raised -24
- [ ] Drawer opens via hamburger, glassmorphic backdrop with red edge strip
- [ ] Drawer items stagger in from left (55 ms between)
- [ ] Logout item is red

---

**Version**: 2.0 (rewritten from source code)
**Generated**: 2026-07-20
**Owner**: TBT app port (`F:/admin/tbt_app/`)
