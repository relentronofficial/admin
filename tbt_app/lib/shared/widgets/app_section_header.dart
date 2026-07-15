import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/theme_tokens.dart';

/// Canonical section header for the app.
///
/// Every "CONTINUE WATCHING", "RECENTLY WATCHED", "ABOUT THIS EVENT",
/// etc. label should render through this widget so they read as a
/// coherent system rather than 6 different Rajdhani-uppercase-tracked
/// variants copy-pasted around.
///
/// Renders as:
///
/// ```
///   SECTION LABEL              trailing? (View all →)
///   ───────
/// ```
///
/// * Label: `Rajdhani`, 11px, 700, letter-spaced, muted colour.
/// * Optional trailing widget (typically a text button — "See all").
/// * Optional descriptive subtitle below the label.
///
/// Callers control outer padding — the widget only manages its own
/// vertical rhythm.
class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    super.key,
    required this.label,
    this.subtitle,
    this.trailing,
    this.padding = const EdgeInsets.symmetric(
      horizontal: AppSpacing.lg,
      vertical: AppSpacing.sm,
    ),
  });

  final String label;
  final String? subtitle;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                    color: tokens.textMuted,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle!,
              style: TextStyle(
                color: tokens.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
