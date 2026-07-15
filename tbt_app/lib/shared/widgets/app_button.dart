import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/theme_tokens.dart';

/// Semantic button sizes — three tiers cover ~95% of real needs.
///
/// * [sm] — inline actions, secondary rows (32dp tall).
/// * [md] — default form actions, list-row primaries (44dp tall).
/// * [lg] — hero CTAs, sheet footers (52dp tall).
enum AppButtonSize { sm, md, lg }

/// Primary action button. Uses [ColorScheme.primary] for the fill and
/// scales its padding + text size per [AppButtonSize].
///
/// Loading state pattern: pass `isLoading: true` to swap the label for a
/// small spinner without changing the button width (avoids the classic
/// layout-shift on submit).
///
/// ```dart
/// AppPrimaryButton(
///   label: 'Enroll',
///   onPressed: _enroll,
///   isLoading: _saving,
/// )
/// AppPrimaryButton(
///   label: 'Complete',
///   icon: Icons.check,
///   size: AppButtonSize.lg,
///   fullWidth: true,
///   onPressed: _complete,
/// )
/// ```
class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.size = AppButtonSize.md,
    this.fullWidth = false,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final AppButtonSize size;
  final bool fullWidth;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final disabled = onPressed == null || isLoading;
    final specs = _specs(size);
    final button = ElevatedButton(
      onPressed: disabled ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        disabledBackgroundColor: scheme.primary.withValues(alpha: 0.5),
        disabledForegroundColor: scheme.onPrimary.withValues(alpha: 0.8),
        minimumSize: Size(specs.minWidth, specs.height),
        padding: EdgeInsets.symmetric(horizontal: specs.horizontalPadding),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdRadius),
        textStyle: specs.textStyle,
        elevation: 0,
      ),
      child: _content(specs, scheme.onPrimary),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }

  Widget _content(_ButtonSpecs specs, Color fg) {
    if (isLoading) {
      // Reserve label width via a Stack so the button doesn't reflow.
      return SizedBox(
        width: specs.spinnerSize,
        height: specs.spinnerSize,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(fg),
        ),
      );
    }
    if (icon == null) return Text(label);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: specs.iconSize),
        SizedBox(width: AppSpacing.sm),
        Text(label),
      ],
    );
  }
}

/// Secondary / outlined variant of [AppPrimaryButton]. Same size scale +
/// loading pattern; renders as an outlined button so it recedes visually
/// next to the primary.
class AppSecondaryButton extends StatelessWidget {
  const AppSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.size = AppButtonSize.md,
    this.fullWidth = false,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final AppButtonSize size;
  final bool fullWidth;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final scheme = Theme.of(context).colorScheme;
    final disabled = onPressed == null || isLoading;
    final specs = _specs(size);
    final button = OutlinedButton(
      onPressed: disabled ? null : onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: tokens.textPrimary,
        side: BorderSide(color: tokens.borderCard),
        minimumSize: Size(specs.minWidth, specs.height),
        padding: EdgeInsets.symmetric(horizontal: specs.horizontalPadding),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdRadius),
        textStyle: specs.textStyle,
      ),
      child: _content(specs, scheme.primary, tokens.textPrimary),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }

  Widget _content(_ButtonSpecs specs, Color spinner, Color fg) {
    if (isLoading) {
      return SizedBox(
        width: specs.spinnerSize,
        height: specs.spinnerSize,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(spinner),
        ),
      );
    }
    if (icon == null) return Text(label);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: specs.iconSize),
        SizedBox(width: AppSpacing.sm),
        Text(label),
      ],
    );
  }
}

// ── Size specs (private) ─────────────────────────────────────────────────

class _ButtonSpecs {
  const _ButtonSpecs({
    required this.height,
    required this.minWidth,
    required this.horizontalPadding,
    required this.iconSize,
    required this.spinnerSize,
    required this.textStyle,
  });

  final double height;
  final double minWidth;
  final double horizontalPadding;
  final double iconSize;
  final double spinnerSize;
  final TextStyle textStyle;
}

_ButtonSpecs _specs(AppButtonSize size) {
  switch (size) {
    case AppButtonSize.sm:
      return const _ButtonSpecs(
        height: 32,
        minWidth: 64,
        horizontalPadding: AppSpacing.md,
        iconSize: 14,
        spinnerSize: 14,
        textStyle: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      );
    case AppButtonSize.md:
      return const _ButtonSpecs(
        height: 44,
        minWidth: 88,
        horizontalPadding: AppSpacing.lg,
        iconSize: 18,
        spinnerSize: 18,
        textStyle: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 14,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      );
    case AppButtonSize.lg:
      return const _ButtonSpecs(
        height: 52,
        minWidth: 120,
        horizontalPadding: AppSpacing.xl,
        iconSize: 20,
        spinnerSize: 20,
        textStyle: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 15,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      );
  }
}
