import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/theme_tokens.dart';

/// The canonical card surface for the app. Every "container that groups
/// related content on a scaffold" should use this instead of raw
/// [Container] + [BoxDecoration] copy.
///
/// Design decisions:
///   * `borderRadius: AppRadius.lg` (14) — matches the sheet radius, one
///     tier below dialog. Consistent with modern iOS card language.
///   * `background: context.tokens.bgSurface` — flips light/dark
///     automatically.
///   * `border: 1dp of context.tokens.borderCard` — provides separation
///     from the scaffold in both themes without needing a shadow.
///   * `elevation: AppElevation.none` by default — flat cards read
///     cleaner. Callers can opt into `raised` for hero cards.
///
/// Provides an `onTap` shortcut that wraps the card in an [InkWell] with
/// the correct ripple color, so calling code doesn't have to repeat the
/// material + splash boilerplate.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.margin,
    this.raised = false,
    this.borderColor,
    this.background,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;

  /// When `true`, adds a subtle shadow so the card lifts off the
  /// scaffold. Use for hero surfaces (course thumbnail card, live-call
  /// header card) — not for row items in a list.
  final bool raised;

  /// Override the default 1dp border. Use `Colors.transparent` to hide
  /// the border on solid-fill surfaces where a border would be
  /// distracting.
  final Color? borderColor;

  /// Override the default surface background. Use for tinted variants
  /// (e.g. an "unread" notification with an accent-blended fill).
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    final decoration = BoxDecoration(
      color: background ?? tokens.bgSurface,
      borderRadius: AppRadius.lgRadius,
      border: Border.all(color: borderColor ?? tokens.borderCard),
      boxShadow: raised
          ? AppElevation.shadowsFor(
              AppElevation.card,
              Theme.of(context).brightness,
            )
          : null,
    );

    final content = Padding(padding: padding, child: child);

    if (onTap == null) {
      return Container(
        margin: margin,
        decoration: decoration,
        child: content,
      );
    }

    // Wrapping in Material + InkWell requires a clip so the ripple stays
    // inside the rounded corner. `Material.type: transparency` avoids the
    // double-fill artifact when the parent already sets a background.
    return Container(
      margin: margin,
      decoration: decoration,
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          splashColor: scheme.primary.withValues(alpha: 0.08),
          highlightColor: scheme.primary.withValues(alpha: 0.05),
          child: content,
        ),
      ),
    );
  }
}
