import 'package:flutter/material.dart';

// ── Background ────────────────────────────────────────────────────────────────
const Color kColorBgPage = Color(0xFF0f0f0f);
const Color kColorBgSurface = Color(0xFF181818);
const Color kColorBgInput = Color(0xFF1a1a1a);
const Color kColorBgModal = Color(0xFF141414);

// ── Border ────────────────────────────────────────────────────────────────────
const Color kColorBorderCard = Color(0xFF2a2a2a);
const Color kColorBorderInput = Color(0xFF333333);

// ── Text ──────────────────────────────────────────────────────────────────────
const Color kColorTextPrimary = Color(0xFFf0f0f0);
const Color kColorTextSecondary = Color(0xFFa0a0a0);
const Color kColorTextMuted = Color(0xFF606060);
const Color kColorTextSubtle = Color(0xFF444444);

// ── Accent ────────────────────────────────────────────────────────────────────
const Color kColorAccent = Color(0xFFdc2626);

// ── Locked content ────────────────────────────────────────────────────────────
const Color kColorLocked = Color(0xFF4a4a4a);

// ── Input decoration ──────────────────────────────────────────────────────────
InputDecoration kInputDecoration(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: kColorTextMuted, fontSize: 14),
      filled: true,
      fillColor: kColorBgInput,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorBorderCard),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
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

// ── Label text style (Rajdhani, 11px, uppercase, muted) ───────────────────────
const TextStyle kLabelStyle = TextStyle(
  fontFamily: 'Rajdhani',
  fontSize: 11,
  fontWeight: FontWeight.w700,
  color: kColorTextMuted,
  letterSpacing: 1.5,
);
