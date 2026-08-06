import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/theme_tokens.dart';

/// Universal member avatar — used across community, comments, drawer,
/// leaderboard, mentions, profile sheets, etc.
///
/// Rendering rules (in priority order):
///   1. If [photoUrl] is non-null and non-empty → `CachedNetworkImage`,
///      with a soft placeholder while loading and the colored initial
///      fallback if the image fails to load.
///   2. Else → a **deterministic pastel gradient circle** derived from
///      [memberId] (or [name], whichever is stable) so every member
///      keeps the same recognizable color across screens. The gradient
///      runs from a light shade to a slightly darker shade of the same
///      hue for a subtle photo-like feel.
///   3. Overlaid: the first letter of [name] in white bold.
///
/// If [isMentor] is true the avatar gets a **gold ring** (`#D4AF37`,
/// 2 px) with a 4 px `bgSurface` gap between the ring and the image
/// — the photo-frame effect that instantly communicates authority in
/// social feeds (LinkedIn Top Voice / X Verified style).
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.size,
    this.photoUrl,
    this.name,
    this.memberId,
    this.isMentor = false,
  });

  final double size;
  final String? photoUrl;
  final String? name;

  /// Stable identifier used to seed the fallback gradient hue. When
  /// null, [name] is used instead. When both are null, a neutral gray
  /// fallback is used.
  final String? memberId;

  final bool isMentor;

  @override
  Widget build(BuildContext context) {
    // Compose the inner (image or gradient) as an oval-clipped box.
    Widget inner = _buildInner(context);

    if (isMentor) {
      // Photo-frame effect: outer gold ring (2 px) + inner surface gap
      // (4 px) around the avatar. Total footprint = size + 8 px.
      final tokens = context.tokens;
      inner = Container(
        padding: const EdgeInsets.all(2),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFD4AF37), Color(0xFFB8951F)],
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: tokens.bgSurface,
          ),
          child: SizedBox(width: size, height: size, child: inner),
        ),
      );
      return inner;
    }

    return SizedBox(width: size, height: size, child: inner);
  }

  Widget _buildInner(BuildContext context) {
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: photoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _fallbackGradient(context),
          errorWidget: (_, __, ___) => _fallbackGradient(context),
          fadeInDuration: const Duration(milliseconds: 220),
        ),
      );
    }
    return _fallbackGradient(context);
  }

  Widget _fallbackGradient(BuildContext context) {
    final seed = _stableSeed(memberId ?? name ?? '');
    final hue = (seed % 360).toDouble();
    // Muted pastel palette — high enough saturation to differentiate
    // members but not garish. Two-stop gradient (light → dark) gives a
    // subtle 3D feel that flat colors don't.
    final bg1 = HSLColor.fromAHSL(1.0, hue, 0.55, 0.60).toColor();
    final bg2 = HSLColor.fromAHSL(1.0, hue, 0.60, 0.45).toColor();
    final initial = _firstLetter(name);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [bg1, bg2],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.42,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
    );
  }

  static String _firstLetter(String? name) {
    if (name == null) return '?';
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '?';
    // Pick the first non-whitespace character. For emoji names (rare),
    // fall back to '?'.
    final ch = trimmed[0];
    final code = ch.codeUnitAt(0);
    // Rough ASCII / basic-latin filter — avoids showing broken glyphs
    // for surrogate-pair emoji.
    if (code >= 0x20 && code <= 0x7E) return ch.toUpperCase();
    return trimmed.substring(0, 1).toUpperCase();
  }

  /// Fast deterministic hash → int in [0, 360). Uses a simple FNV-1a
  /// style rolling hash which is enough for good hue distribution
  /// across UUIDs.
  static int _stableSeed(String s) {
    if (s.isEmpty) return 210; // neutral blue-gray fallback
    int h = 0x811c9dc5;
    for (int i = 0; i < s.length; i++) {
      h ^= s.codeUnitAt(i);
      h = (h * 0x01000193) & 0xffffffff;
    }
    return h.abs();
  }
}
