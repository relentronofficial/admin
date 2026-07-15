import 'package:flutter/material.dart';

import 'theme_tokens.dart';

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY dark-mode-only tokens. Kept as `const` so existing `const Widget(...)`
// call sites don't break; they always resolve to the DARK palette regardless
// of the active theme.
//
// Any widget that uses these tokens WILL LOOK BROKEN in light mode. Prefer
// `context.tokens.*` from `theme_tokens.dart` for new code and when touching
// existing files. The `context.tokens.*` reader picks the right palette off
// `Theme.of(context).brightness`.
//
// `context.tbt.accent / alert / success` (from `tbt_theme.dart`) covers the
// three brand colours that stay the same in both modes.
//
// The @Deprecated warnings are informational — the constants still work.
// ─────────────────────────────────────────────────────────────────────────────

// ── Background ────────────────────────────────────────────────────────────────
@Deprecated('Use context.tokens.bgPage — kColor* is dark-only')
const Color kColorBgPage = Color(0xFF0f0f0f);
@Deprecated('Use context.tokens.bgSurface — kColor* is dark-only')
const Color kColorBgSurface = Color(0xFF181818);
@Deprecated('Use context.tokens.bgInput — kColor* is dark-only')
const Color kColorBgInput = Color(0xFF1a1a1a);
@Deprecated('Use context.tokens.bgModal — kColor* is dark-only')
const Color kColorBgModal = Color(0xFF141414);

// ── Border ────────────────────────────────────────────────────────────────────
@Deprecated('Use context.tokens.borderCard — kColor* is dark-only')
const Color kColorBorderCard = Color(0xFF2a2a2a);
@Deprecated('Use context.tokens.borderInput — kColor* is dark-only')
const Color kColorBorderInput = Color(0xFF333333);

// ── Text ──────────────────────────────────────────────────────────────────────
@Deprecated('Use context.tokens.textPrimary — kColor* is dark-only')
const Color kColorTextPrimary = Color(0xFFf0f0f0);
@Deprecated('Use context.tokens.textSecondary — kColor* is dark-only')
const Color kColorTextSecondary = Color(0xFFa0a0a0);
@Deprecated('Use context.tokens.textMuted — kColor* is dark-only')
const Color kColorTextMuted = Color(0xFF606060);
@Deprecated('Use context.tokens.textSubtle — kColor* is dark-only')
const Color kColorTextSubtle = Color(0xFF444444);

// ── Accent ────────────────────────────────────────────────────────────────────
// Accent is brand red, same across both modes. New code should prefer
// `context.tbt.accent` which respects any tenant SiteConfig override.
const Color kColorAccent = Color(0xFFdc2626);

// ── Locked content ────────────────────────────────────────────────────────────
// Static neutral shade for locked/greyed items — intentionally the same in
// both modes; contrast is provided by the surrounding overlay.
const Color kColorLocked = Color(0xFF4a4a4a);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Theme-aware [InputDecoration]. Use this in place of the legacy
/// `kInputDecoration(hint)` — it inherits from `InputDecorationTheme` which
/// is set correctly for both modes in `app_theme.dart`, so callers only need
/// to pass a hint.
InputDecoration inputDecorationOf(BuildContext context, String hint) {
  final t = context.tokens;
  final accent = Theme.of(context).colorScheme.primary;
  return InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: t.textMuted, fontSize: 14),
    filled: true,
    fillColor: t.bgInput,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: t.borderCard),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: t.borderCard),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: accent),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: accent),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: accent),
    ),
  );
}

/// Legacy dark-only variant. Retained for backward compatibility; prefer
/// [inputDecorationOf] which respects the active theme.
@Deprecated('Use inputDecorationOf(context, hint) — kInputDecoration is dark-only')
InputDecoration kInputDecoration(String hint) => InputDecoration(
      hintText: hint,
      // ignore: deprecated_member_use_from_same_package
      hintStyle: const TextStyle(color: kColorTextMuted, fontSize: 14),
      filled: true,
      // ignore: deprecated_member_use_from_same_package
      fillColor: kColorBgInput,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        // ignore: deprecated_member_use_from_same_package
        borderSide: const BorderSide(color: kColorBorderCard),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        // ignore: deprecated_member_use_from_same_package
        borderSide: const BorderSide(color: kColorBorderCard),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorAccent),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorAccent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorAccent),
      ),
    );

/// Theme-aware label style. Prefer this over the legacy `kLabelStyle` const.
TextStyle labelStyleOf(BuildContext context) => TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 11,
      fontWeight: FontWeight.w700,
      color: context.tokens.textMuted,
      letterSpacing: 1.5,
    );

@Deprecated('Use labelStyleOf(context) — kLabelStyle is dark-only')
const TextStyle kLabelStyle = TextStyle(
  fontFamily: 'Rajdhani',
  fontSize: 11,
  fontWeight: FontWeight.w700,
  // ignore: deprecated_member_use_from_same_package
  color: kColorTextMuted,
  letterSpacing: 1.5,
);
