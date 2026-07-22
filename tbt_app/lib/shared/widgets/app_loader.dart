import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/theme_tokens.dart';

/// Shimmer-based skeleton loader — the app-wide replacement for the
/// old spinning `CircularProgressIndicator` in content-loading states.
///
/// Guidance:
///   * Use inside `AsyncValue.loading()` / `FutureBuilder` `waiting` states
///     to hint at the shape of the incoming content.
///   * For a page/section with unknown height, `AppLoader.center()`
///     drops a couple of skeleton rows into a Center to fill the space
///     — same visual weight as the old `CircularProgressIndicator(color: kColorAccent)`
///     but non-spinning.
///   * For list-like sections use `AppLoader.list()` (three stacked
///     card-row skeletons).
///   * For a single card / thumbnail use `AppLoader.box(...)`.
///
/// Button loaders (inside a small 20×20 SizedBox inside a Sign-In / Submit
/// button) are intentionally NOT replaced with shimmer — a shimmering pill
/// makes no sense as an action-in-progress affordance. Keep the small
/// `CircularProgressIndicator` there.
class AppLoader extends StatelessWidget {
  const AppLoader.box({
    super.key,
    this.height = 20,
    this.width,
    this.radius = 8,
  })  : rows = 0,
        _variant = _Variant.box;

  const AppLoader.list({super.key, this.rows = 3})
      : height = null,
        width = null,
        radius = 12,
        _variant = _Variant.list;

  const AppLoader.center({super.key})
      : height = null,
        width = null,
        radius = 12,
        rows = 3,
        _variant = _Variant.center;

  final _Variant _variant;
  final double? height;
  final double? width;
  final double radius;
  final int rows;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark ? const Color(0xFF1a1a1a) : const Color(0xFFe5e5e5);
    final highlight = isDark ? const Color(0xFF2a2a2a) : const Color(0xFFf5f5f5);

    switch (_variant) {
      case _Variant.box:
        return Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          period: const Duration(milliseconds: 1400),
          child: Container(
            height: height,
            width: width,
            decoration: BoxDecoration(
              color: tokens.bgSurface,
              borderRadius: BorderRadius.circular(radius),
            ),
          ),
        );

      case _Variant.list:
        return Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          period: const Duration(milliseconds: 1400),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (int i = 0; i < rows; i++) ...[
                _SkeletonRow(tokens: tokens),
                if (i < rows - 1) const SizedBox(height: 12),
              ],
            ],
          ),
        );

      case _Variant.center:
        return Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Shimmer.fromColors(
              baseColor: base,
              highlightColor: highlight,
              period: const Duration(milliseconds: 1400),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (int i = 0; i < rows; i++) ...[
                    _SkeletonRow(tokens: tokens),
                    if (i < rows - 1) const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
          ),
        );
    }
  }
}

enum _Variant { box, list, center }

/// One row of skeleton — avatar circle + two lines of varying length.
class _SkeletonRow extends StatelessWidget {
  const _SkeletonRow({required this.tokens});
  final ThemeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: tokens.bgSurface,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 12,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: tokens.bgSurface,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(height: 8),
              FractionallySizedBox(
                widthFactor: 0.65,
                alignment: Alignment.centerLeft,
                child: Container(
                  height: 12,
                  decoration: BoxDecoration(
                    color: tokens.bgSurface,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
