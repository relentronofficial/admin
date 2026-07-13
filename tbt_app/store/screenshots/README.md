# Store Screenshots

## Required device sizes

Screenshots must be captured on real devices or simulators after Phase 22 (integration tests) passes. Do NOT use design mockups — Apple + Google both require app-generated screenshots.

### iOS (App Store Connect)

| Device | Resolution | Min count | Notes |
|---|---|---|---|
| iPhone 6.7" (iPhone 15 Pro Max / 14 Pro Max) | 1290 × 2796 | 3 | Primary — required |
| iPhone 6.5" (iPhone 11 Pro Max / XS Max) | 1242 × 2688 | 3 | Legacy — required if 6.7" not provided |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 | 3 | Required only if iPad support declared |

### Android (Play Console)

| Device class | Resolution | Min count | Notes |
|---|---|---|---|
| Phone (Pixel 9 or similar) | 1080 × 2400 (or 1440 × 3200) | 3 | Portrait; PNG or JPEG |
| 7" tablet | 1200 × 1920 | 1 | Only if tablet support declared |
| 10" tablet | 1600 × 2560 | 1 | Only if tablet support declared |

Both stores accept up to 8 screenshots per device — first 3 are shown on the store card without swiping. Order matters.

## Recommended screen sequence (portrait, 3 per locale minimum)

1. **Dashboard** — hero + "Continue Watching" row + XP + streak
2. **Course lesson player** — video with progress bar and quiz cue visible
3. **Batch program calendar** — month grid with mixed status colours (approved / submitted / in_progress)
4. **Workshop detail** — 4-tab layout with Live Calls tab active
5. **Notifications** — mixed unread and read items with type badges
6. **Profile** — member card + membership plan + logout affordance

## Capture instructions

### iOS

```
1. Launch the release build in the target simulator
   (or a physical device with iOS 16+)
2. Sign in as the reviewer account (see ../review_notes.txt)
3. Set the language to English (en-US) in Settings
4. Take screenshots with Cmd+S (simulator) or side button + volume up (device)
5. Verify each screenshot matches the required resolution exactly —
   simulator screenshots default to the correct native resolution
```

### Android

```
1. Launch the release AAB on Pixel 9 emulator API 34+ or a physical device
2. Sign in as the reviewer account
3. Set the language to English (en-US) in Settings → System → Languages
4. Take screenshots via power + volume down, or `adb exec-out screencap -p > shot.png`
5. Confirm resolution matches 1080 × 2400 (or the device's native)
```

## File naming

```
screenshots/
  ios/
    en-US/
      6.7-inch/
        01-dashboard.png
        02-lesson-player.png
        03-batch-calendar.png
        ...
  android/
    en-US/
      phone/
        01-dashboard.png
        ...
```

Screenshots are NOT committed to the main branch — add them to `.gitignore` if they land in this folder locally. Store submission uploads should be handled via Fastlane deliver + supply, driven from CI on release tags.
