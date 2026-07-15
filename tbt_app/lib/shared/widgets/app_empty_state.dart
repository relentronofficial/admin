import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/theme_tokens.dart';
import 'app_button.dart';

/// Canonical empty-state widget. Every "you don't have any X yet" screen
/// should route through this so all empty states share the same anatomy:
///
///   * A large muted icon (or custom illustration).
///   * A bold title in the primary text colour.
///   * A muted-secondary supporting line.
///   * An optional primary-CTA button.
///
/// This is deliberately separate from [AppErrorState] — error states
/// need error copy + retry semantics, empty states are neutral.
///
/// ```dart
/// AppEmptyState(
///   icon: Icons.videocam_outlined,
///   title: 'No webinars scheduled',
///   subtitle: 'Check back soon — new sessions are announced weekly.',
///   ctaLabel: 'Browse workshops',
///   onCtaPressed: () => context.push('/workshops'),
/// )
/// ```
class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.ctaLabel,
    this.onCtaPressed,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? ctaLabel;
  final VoidCallback? onCtaPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xxxl,
          vertical: AppSpacing.huge,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Iconography sits in a soft-tinted circle — same visual
            // weight as our error/loading states, gives empty screens a
            // proper focal point instead of a floating grey icon.
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: scheme.primary.withValues(alpha: 0.85),
                size: AppIconSize.xl,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle!,
                style: TextStyle(
                  color: tokens.textMuted,
                  fontSize: 14,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (ctaLabel != null && onCtaPressed != null) ...[
              const SizedBox(height: AppSpacing.xl),
              AppPrimaryButton(
                label: ctaLabel!,
                onPressed: onCtaPressed,
                size: AppButtonSize.md,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
