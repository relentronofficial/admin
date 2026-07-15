import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/exceptions/app_exception.dart';
import '../theme/theme_tokens.dart';

/// Shared error-state widget used by every list / detail screen when a
/// data provider fails. Distinguishes between network, server, session, and
/// validation failures via the [AppException] hierarchy so users get an
/// action-appropriate message + retry affordance.
///
/// Silent auto-retry: for transient failure types ([NetworkException],
/// [UnauthorizedException]) the widget fires `onRetry` once, silently,
/// ~800 ms after it's mounted. This picks up the common case where the
/// refresh interceptor just finished rotating tokens or the network hiccup
/// resolved between build cycles — the user sees the loading spinner come
/// back instead of a dead-end error screen requiring a manual tap. The
/// retry only fires once per widget instance, so we can't spin.
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
///
/// Pass any error object — `AppException` subtypes are formatted specially,
/// everything else falls through to a generic "Failed to load" message.
class AppErrorState extends StatefulWidget {
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
  State<AppErrorState> createState() => _AppErrorStateState();
}

class _AppErrorStateState extends State<AppErrorState> {
  Timer? _autoRetryTimer;

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
    _autoRetryTimer = Timer(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      widget.onRetry?.call();
    });
  }

  ({IconData icon, String title, String subtitle}) _copyFor() {
    final e = widget.error;
    if (e is NetworkException) {
      return (
        icon: Icons.wifi_off_outlined,
        title: 'Check your connection',
        subtitle: 'We couldn\'t reach the server. Try again once you\'re back '
            'online.',
      );
    }
    if (e is UnauthorizedException) {
      return (
        icon: Icons.lock_outline,
        title: 'Session expired',
        subtitle: 'Please sign in again to continue.',
      );
    }
    if (e is ForbiddenException) {
      return (
        icon: Icons.block_outlined,
        title: 'Access not available',
        subtitle: e.message,
      );
    }
    if (e is ValidationException) {
      return (
        icon: Icons.error_outline,
        title: 'Something\'s off',
        subtitle: e.message,
      );
    }
    if (e is ServerException) {
      return (
        icon: Icons.cloud_off_outlined,
        title: 'Server error',
        subtitle: 'Something went wrong on our side. Try again in a moment.',
      );
    }
    return (
      icon: Icons.error_outline,
      title: widget.fallbackTitle,
      subtitle: 'Something went wrong. Try again.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final copy = _copyFor();
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
              TextButton(onPressed: widget.onRetry, child: const Text('Retry')),
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
                child: const Text('Try again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
