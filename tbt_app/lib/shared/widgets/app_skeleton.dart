import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/design_tokens.dart';
import '../theme/theme_tokens.dart';

/// Unified shimmer wrapper — every screen's loading state should render
/// its skeleton through this instead of hand-rolling
/// [Shimmer.fromColors] with different baseColor/highlightColor pairs
/// (which is how the app ended up with 4 different shimmer shades).
///
/// Usage:
///
/// ```dart
/// AppSkeleton(
///   child: Column(children: [
///     AppSkeletonBlock(width: 180, height: 20),
///     const SizedBox(height: AppSpacing.md),
///     AppSkeletonBlock(width: double.infinity, height: 14),
///     AppSkeletonBlock(width: 120, height: 14),
///   ]),
/// )
/// ```
class AppSkeleton extends StatelessWidget {
  const AppSkeleton({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Shimmer.fromColors(
      // baseColor renders as the placeholder fill; highlightColor as the
      // shimmer highlight. Tuned per-theme so the same widget reads
      // correctly on either.
      baseColor: tokens.bgSurface,
      highlightColor: tokens.bgInput,
      period: const Duration(milliseconds: 1200),
      child: child,
    );
  }
}

/// A single rectangular skeleton block. Colour comes from the enclosing
/// [AppSkeleton]'s shimmer — this widget just paints the shape.
class AppSkeletonBlock extends StatelessWidget {
  const AppSkeletonBlock({
    super.key,
    required this.width,
    required this.height,
    this.radius = AppRadius.sm,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Circular skeleton (avatar / icon placeholder).
class AppSkeletonCircle extends StatelessWidget {
  const AppSkeletonCircle({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tokens.bgInput,
        shape: BoxShape.circle,
      ),
    );
  }
}
