import 'package:flutter/material.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// TBT DESIGN TOKENS
/// ─────────────────────────────────────────────────────────────────────────
///
/// The single source of truth for spacing, radius, elevation, motion, and
/// icon sizing across the mobile app. Every widget should reference these
/// tokens instead of raw numeric literals — that's what keeps the app
/// visually cohesive as new features are added.
///
/// Naming convention: **t-shirt scale** (xs / sm / md / lg / xl / xxl) —
/// deliberate and small so nobody has to look up "what does level 4 mean."
///
/// Scale rationale:
///   * Spacing follows an 8-point grid (with a half-step of 4 for tight
///     places). Matches Material Design 3, Human Interface Guidelines,
///     and most modern design systems. Predictable rhythm across the app.
///   * Radius is a 4-point scale with a `pill` sentinel for fully-round
///     surfaces. Matches Linear / Notion / Stripe.
///   * Elevation is limited to five tiers — trying to have more than
///     that creates a "which is on top" ambiguity that flat 2D UIs like
///     Apple's have already solved by using very few, well-tuned shadows.
///   * Motion mirrors Material 3's spec — a small set of standard
///     durations + curves. `emphasized` is the new-default expressive
///     curve; `standard` is the workhorse for state changes.
///   * Icon sizing has five canonical sizes so the same-purpose icon
///     doesn't ship at 12, 13, 14, 16 across screens.

/// Spacing tokens — an 8-point grid with a 4-point half-step.
///
/// Prefer these over raw `EdgeInsets.all(<n>)`:
///
/// ```dart
/// padding: const EdgeInsets.all(AppSpacing.md),
/// padding: EdgeInsets.symmetric(
///   horizontal: AppSpacing.lg,
///   vertical: AppSpacing.md,
/// ),
/// ```
abstract final class AppSpacing {
  static const double xs = 4;   // 0.5 × grid — tight inline gaps
  static const double sm = 8;   // 1 × grid   — micro spacing
  static const double md = 12;  // 1.5 × grid — inside components
  static const double lg = 16;  // 2 × grid   — default screen padding
  static const double xl = 20;  // 2.5 × grid — between sections
  static const double xxl = 24; // 3 × grid   — major section spacing
  static const double xxxl = 32;// 4 × grid   — hero-adjacent spacing
  static const double huge = 48;// 6 × grid   — empty-state breathing room

  /// Prebuilt insets covering the top 95% of uses. Prefer these to
  /// `const EdgeInsets.all(AppSpacing.md)` — one fewer allocation per
  /// build and a shorter, more readable call site.
  static const EdgeInsets pageMargin = EdgeInsets.symmetric(
    horizontal: lg,
    vertical: md,
  );

  /// Section-level vertical rhythm.
  static const EdgeInsets sectionInset = EdgeInsets.only(bottom: xxl);
}

/// Radius tokens — a 4-point scale + `pill` sentinel.
///
/// Rule of thumb:
///   * `sm` — chips, badges, small pills.
///   * `md` — buttons, input fields.
///   * `lg` — cards, list rows.
///   * `xl` — bottom sheets, dialogs, hero surfaces.
///   * `pill` — anything intended to render as a full pill (Chip's
///     default, avatar rings, floating-action-button, etc.).
///
/// Access as raw doubles for callers that build their own
/// [BorderRadius] instances:
///
/// ```dart
/// borderRadius: BorderRadius.circular(AppRadius.lg),
/// ```
///
/// or via the prebuilt [BorderRadius] shortcuts:
///
/// ```dart
/// borderRadius: AppRadius.lgRadius,
/// ```
abstract final class AppRadius {
  static const double sm = 6;
  static const double md = 10;
  static const double lg = 14;
  static const double xl = 20;
  static const double pill = 999;

  // Prebuilt BorderRadius shortcuts — one allocation per app run, zero
  // per widget build.
  static final BorderRadius smRadius = BorderRadius.circular(sm);
  static final BorderRadius mdRadius = BorderRadius.circular(md);
  static final BorderRadius lgRadius = BorderRadius.circular(lg);
  static final BorderRadius xlRadius = BorderRadius.circular(xl);

  /// Sheet-style top-only radius, matching the token for `xl` surfaces.
  static final BorderRadius sheetTop = BorderRadius.vertical(
    top: Radius.circular(xl),
  );
}

/// Elevation tokens — five tuned tiers with matching shadow specs.
///
/// The shadows are intentionally soft and low-contrast: dark UI reads
/// depth better through subtle luminance changes than through hard
/// drop-shadows. Light mode uses the same offsets with a slightly darker
/// alpha to preserve contrast on white surfaces.
///
/// Consult [shadowsFor] to get the actual [BoxShadow] list to plug into
/// [BoxDecoration] — this way the same widget renders correct shadows in
/// both themes.
abstract final class AppElevation {
  /// Flat surface — no shadow. Cards on flat scaffolds default to this.
  static const int none = 0;

  /// Barely-there — a hint of separation without visible shadow.
  static const int subtle = 1;

  /// Standard raised card / list row.
  static const int card = 2;

  /// Sheets, dropdowns, popovers.
  static const int sheet = 4;

  /// Dialog / hero overlay — the highest tier we should ever need.
  static const int dialog = 8;

  /// Returns theme-aware [BoxShadow]s for [level]. Never emits a shadow
  /// for `none`; every other level emits a single soft shadow tuned to
  /// the current brightness so cards read the same on both themes.
  static List<BoxShadow> shadowsFor(int level, Brightness brightness) {
    if (level <= none) return const [];
    final isDark = brightness == Brightness.dark;
    final baseAlpha = isDark ? 0.5 : 0.08;
    final alpha = baseAlpha * (level / 8.0 + 0.5).clamp(0.35, 1.0);
    final blur = 4.0 + level * 2.0;
    final yOffset = 1.0 + level * 0.5;
    return [
      BoxShadow(
        color: Colors.black.withValues(alpha: alpha),
        blurRadius: blur,
        offset: Offset(0, yOffset),
        spreadRadius: 0,
      ),
    ];
  }
}

/// Motion tokens — mirrors Material 3's expressive motion spec but pared
/// down to the five durations we actually need.
///
/// Reference: <https://m3.material.io/styles/motion/easing-and-duration>.
abstract final class AppMotion {
  /// Instant state flips (checkbox toggle, radio, small selection).
  static const Duration instant = Duration(milliseconds: 100);

  /// Standard state change — button press, chip select, hover-ish.
  static const Duration short = Duration(milliseconds: 200);

  /// Full-panel animations — bottom sheet, dialog appear.
  static const Duration medium = Duration(milliseconds: 300);

  /// Emphasized entrances — hero page transitions, splash.
  static const Duration long = Duration(milliseconds: 500);

  /// Standard easing for state changes.
  static const Curve standard = Curves.easeInOutCubicEmphasized;

  /// Expressive easing for entrances — Material 3's default page curve.
  static const Curve emphasized = Cubic(0.05, 0.7, 0.1, 1.0);

  /// Snappy easing for micro-interactions (button press, chip toggle).
  static const Curve snappy = Curves.easeOutCubic;
}

/// Icon-size tokens. Five canonical sizes — every icon in the app should
/// pick one of these.
abstract final class AppIconSize {
  /// Inline / trailing indicators (chevrons in a row).
  static const double xs = 14;

  /// Small chips, tight badges.
  static const double sm = 18;

  /// Default AppBar action icons, inline-with-text.
  static const double md = 20;

  /// Standard tap-target icons (bottom nav, primary actions).
  static const double lg = 24;

  /// Large decorative icons (empty states, illustrations).
  static const double xl = 40;
}

/// Minimum tap-target size per WCAG 2.1 Success Criterion 2.5.5 (48dp).
/// Any interactive element smaller than this on the touch surface needs
/// to be wrapped in a padded [GestureDetector]/[InkWell].
abstract final class AppTapTarget {
  static const double min = 48;
}
