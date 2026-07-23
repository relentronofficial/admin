import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions/app_exception.dart';
import '../providers/connectivity_provider.dart';
import '../theme/theme_tokens.dart';

/// Shared error-state widget used by every list / detail screen when a
/// data provider fails. Distinguishes between network, server, session, and
/// validation failures via the [AppException] hierarchy so users get an
/// action-appropriate message + retry affordance.
///
/// **Silent auto-retry** for transient failures:
///
///   * Fires `onRetry` once 800 ms after mount for [NetworkException]
///     and [UnauthorizedException]. Covers the common case where the
///     refresh interceptor just rotated tokens or the network hiccup
///     resolved between build cycles.
///   * On top of that, listens to [connectivityProvider] and fires
///     `onRetry` the moment connectivity flips from offline → online,
///     regardless of error type. So if the user was offline and comes
///     back, the screen recovers itself instead of leaving a Retry
///     button.
///
/// Both mechanisms are guarded to a single retry per widget instance
/// — the widget rebuilds if the parent re-invokes it after a retry
/// completes.
///
/// Usage:
/// ```dart
/// asyncValue.when(
///   loading: () => …,
///   error: (e, _) => AppErrorState(
///     error: e,
///     onRetry: () => ref.invalidate(myProvider),
///   ),
///   data: (v) => …,
/// )
/// ```
class AppErrorState extends ConsumerStatefulWidget {
  const AppErrorState({
    super.key,
    required this.error,
    this.onRetry,
    this.fallbackTitle = 'Failed to load',
    this.compact = false,
  });

  final Object error;
  final VoidCallback? onRetry;

  /// Title shown when the error isn't an [AppException] we recognise.
  final String fallbackTitle;

  /// When `true`, renders a slim horizontal row instead of a centred column.
  /// Suitable for inline error strips (e.g. a Dashboard section that failed
  /// while other sections succeeded).
  final bool compact;

  @override
  ConsumerState<AppErrorState> createState() => _AppErrorStateState();
}

class _AppErrorStateState extends ConsumerState<AppErrorState> {
  Timer? _autoRetryTimer;
  bool _retried = false;

  @override
  void initState() {
    super.initState();
    _scheduleAutoRetryIfTransient();
  }

  @override
  void dispose() {
    _autoRetryTimer?.cancel();
    super.dispose();
  }

  /// Fire `onRetry` once, silently, for error types we know are transient.
  /// Delay gives the refresh interceptor time to finish rotating tokens
  /// (so `UnauthorizedException` on tab reload usually clears itself) and
  /// avoids flash-of-error when the network hiccup lasted <1 s.
  void _scheduleAutoRetryIfTransient() {
    if (widget.onRetry == null) return;
    final e = widget.error;
    final isTransient = e is NetworkException || e is UnauthorizedException;
    if (!isTransient) return;
    _autoRetryTimer = Timer(const Duration(milliseconds: 800), _fireRetryOnce);
  }

  void _fireRetryOnce() {
    if (!mounted || _retried) return;
    _retried = true;
    widget.onRetry?.call();
  }

  ({IconData icon, String title, String subtitle}) _copyFor(AppL10n l10n) {
    final e = widget.error;
    if (e is NetworkException) {
      return (
        icon: Icons.wifi_off_outlined,
        title: l10n.errorCheckConnection,
        subtitle: l10n.errorCheckConnectionSubtitle,
      );
    }
    if (e is UnauthorizedException) {
      // A 401 that reaches this widget is either (a) transient — the
      // refresh interceptor is about to retry it and the auto-retry
      // below will resolve it, or (b) a truly revoked session, in
      // which case the router's `sessionState == revoked` guard has
      // already redirected to /login before we ever render. Either
      // way, the "SESSION EXPIRED" copy is misleading — pick a softer
      // "trouble reaching the server" wording. The `_copyFor` -> icon
      // stays a subtle wifi-ish glyph to hint at the transient nature.
      return (
        icon: Icons.sync_problem_outlined,
        title: l10n.errorFailedToLoad,
        subtitle: l10n.errorCheckConnectionSubtitle,
      );
    }
    if (e is ForbiddenException) {
      return (
        icon: Icons.block_outlined,
        title: l10n.errorAccessDenied,
        subtitle: e.message,
      );
    }
    if (e is ValidationException) {
      return (
        icon: Icons.error_outline,
        title: l10n.errorFailedToLoad,
        subtitle: e.message,
      );
    }
    if (e is ServerException) {
      return (
        icon: Icons.cloud_off_outlined,
        title: l10n.errorServer,
        subtitle: l10n.errorServerSubtitle,
      );
    }
    return (
      icon: Icons.error_outline,
      title: widget.fallbackTitle,
      subtitle: l10n.errorGeneric,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Fire onRetry the instant connectivity returns after being offline.
    // Guarded via `_retried` so a flapping connection doesn't spin.
    ref.listen<AsyncValue<bool>>(connectivityProvider, (previous, next) {
      final wasOffline = previous?.valueOrNull == false;
      final nowOnline = next.valueOrNull == true;
      if (wasOffline && nowOnline) {
        _fireRetryOnce();
      }
    });

    final l10n = AppL10n.of(context)!;
    final copy = _copyFor(l10n);
    final t = context.tokens;

    if (widget.compact) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(copy.icon, color: t.textMuted, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                copy.title,
                style: TextStyle(color: t.textSecondary, fontSize: 13),
              ),
            ),
            if (widget.onRetry != null)
              TextButton(
                onPressed: widget.onRetry,
                child: Text(l10n.commonRetry),
              ),
          ],
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(copy.icon, color: t.textMuted, size: 44),
            const SizedBox(height: 14),
            Text(
              copy.title,
              style: TextStyle(
                color: t.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              copy.subtitle,
              style: TextStyle(
                color: t.textMuted,
                fontSize: 13,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            if (widget.onRetry != null) ...[
              const SizedBox(height: 16),
              TextButton(
                onPressed: widget.onRetry,
                child: Text(l10n.commonTryAgain),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
