import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';

import '../theme/theme_tokens.dart';

/// Canonical network-image primitive.
///
/// Solves three problems every `CachedNetworkImage` call site had to
/// re-solve inline:
///
/// 1. **Memory-bounded decoding.** Sets `memoryCacheWidth` to the target
///    layout width in physical pixels (dp × devicePixelRatio). A 100dp
///    thumbnail on a 3x screen decodes at 300px instead of the full
///    source resolution — critical when a list renders 100+ cards.
/// 2. **Blurhash-when-available placeholders.** If the API returns a
///    `blurhash` string (compact perceptual hash of the source image),
///    decode it as the placeholder for a smooth fade-in instead of a
///    solid-color rectangle.
/// 3. **Consistent error UX.** One shared error widget so every failed
///    image looks the same instead of each screen inventing its own.
///
/// Callers pass logical (dp) dimensions — the widget computes physical
/// pixels internally.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.blurhash,
    this.fallbackIcon = Icons.image_outlined,
  });

  /// Image URL. If null or empty, renders the fallback placeholder.
  final String? url;

  /// Logical width (dp). If both dimensions are null, no memory bound is
  /// applied — appropriate only for hero images that fill the screen.
  final double? width;

  /// Logical height (dp).
  final double? height;

  final BoxFit fit;

  /// Optional clip radius. Applied to both the image and its placeholder
  /// so nothing spills past the corners while loading.
  final BorderRadius? borderRadius;

  /// Optional blurhash string from the backend. When present, decoded
  /// as the placeholder for a low-fi preview before the network image
  /// arrives.
  final String? blurhash;

  /// Icon shown when [url] is null/empty or the network fetch fails.
  final IconData fallbackIcon;

  int? _cacheDim(double? dp, double dpr) {
    if (dp == null) return null;
    // Cap at 2000 px to keep memory reasonable on 4x devices with wide
    // (>500dp) images — the visual difference above that is minimal.
    final px = (dp * dpr).round();
    return px.clamp(1, 2000);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheWidth = _cacheDim(width, dpr);
    final cacheHeight = _cacheDim(height, dpr);

    Widget content;
    if (url == null || url!.isEmpty) {
      content = _fallback(tokens);
    } else {
      content = CachedNetworkImage(
        imageUrl: url!,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: cacheWidth,
        memCacheHeight: cacheHeight,
        placeholder: (_, __) => _placeholder(tokens),
        errorWidget: (_, __, ___) => _fallback(tokens),
        fadeInDuration: const Duration(milliseconds: 200),
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: content);
    }
    return content;
  }

  Widget _placeholder(ThemeTokens tokens) {
    if (blurhash != null && blurhash!.isNotEmpty) {
      // BlurHash renders synchronously via a small isolate; it's cheap
      // enough to inline. Wrapped in SizedBox so it respects the
      // declared dimensions during the decode window.
      return SizedBox(
        width: width,
        height: height,
        child: BlurHash(hash: blurhash!),
      );
    }
    return Container(
      width: width,
      height: height,
      color: tokens.bgInput,
    );
  }

  Widget _fallback(ThemeTokens tokens) {
    return Container(
      width: width,
      height: height,
      color: tokens.bgInput,
      child: Center(
        child: Icon(fallbackIcon, color: tokens.textSubtle, size: 28),
      ),
    );
  }
}
