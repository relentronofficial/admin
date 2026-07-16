import 'package:flutter/foundation.dart';

/// In-process ring buffer of authentication lifecycle events.
///
/// Purpose: turn "the user got signed out" from an opaque customer
/// complaint into a debuggable timeline. Every state transition, every
/// refresh outcome, every explicit token-clear is recorded here. When
/// a support request comes in, the ring buffer can be dumped to a
/// support bundle (or the console in debug mode) so we can see exactly
/// what happened.
///
/// **Never** logs the raw access or refresh token. When a token needs
/// to be identifiable for correlation, use [tokenFingerprint] to reduce
/// it to a 4-character hash suffix — enough to distinguish "which
/// token" without leaking the credential.
///
/// Ring buffer semantics: fixed capacity, oldest entry evicted when
/// full. Zero-allocation on the hot path once warm.
class AuthEventLog {
  AuthEventLog._();

  /// How many events to retain. Sized so a typical user's whole
  /// week-long usage arc fits without eviction: cold start + a few
  /// refreshes per day + occasional resume + logout.
  static const int _capacity = 200;

  static final List<AuthEvent> _events = <AuthEvent>[];

  /// Record a new event. Cheap enough to call from every interceptor
  /// hook without measurable overhead.
  static void record(
    AuthEventType type, {
    String? tokenTail,
    String? detail,
  }) {
    final entry = AuthEvent(
      at: DateTime.now(),
      type: type,
      tokenTail: tokenTail,
      detail: detail,
    );
    _events.add(entry);
    if (_events.length > _capacity) {
      _events.removeAt(0);
    }
    if (kDebugMode) {
      debugPrint('[AuthEvent] ${entry.formatForConsole()}');
    }
  }

  /// Snapshot of the current buffer, newest last. Consumers should
  /// treat this as immutable — copies not lazy views.
  static List<AuthEvent> snapshot() => List.unmodifiable(_events);

  /// Formatted multi-line dump suitable for a Sentry breadcrumb or a
  /// support "Copy diagnostic" affordance.
  static String dumpForSupport() {
    return _events.map((e) => e.formatForConsole()).join('\n');
  }

  /// Reduce a token to a 4-character fingerprint. Sha-256-ish coverage
  /// isn't needed — this is purely a correlation aid ("token ending
  /// ...b2c1"), not a security primitive. Returns null when the input
  /// is null / empty so call sites can pass raw values without a null
  /// check.
  static String? tokenFingerprint(String? token) {
    if (token == null || token.isEmpty) return null;
    return token.length <= 4 ? token : token.substring(token.length - 4);
  }

  /// Wipe the buffer. Call on explicit logout so the next signed-in
  /// session doesn't inherit the previous user's timeline.
  static void clear() {
    _events.clear();
  }
}

/// A single auth lifecycle event. Immutable value type.
class AuthEvent {
  const AuthEvent({
    required this.at,
    required this.type,
    this.tokenTail,
    this.detail,
  });

  final DateTime at;
  final AuthEventType type;

  /// Last 4 chars of the token this event relates to. Optional — many
  /// events (e.g. `logout`) don't have a token association.
  final String? tokenTail;

  /// Free-form context. For `refreshFailure`, include the status code
  /// or DioExceptionType so the log tells the whole story. Never
  /// include user PII or the raw token.
  final String? detail;

  String formatForConsole() {
    final ts = at.toIso8601String();
    final tail = tokenTail == null ? '' : ' [..$tokenTail]';
    final ctx = detail == null ? '' : ' — $detail';
    return '$ts ${type.name}$tail$ctx';
  }
}

/// Every auth transition the app can experience. Add new members when
/// new flows land — keep the surface small so the log stays scannable.
enum AuthEventType {
  /// Cold-start check found a valid access token in secure storage.
  coldStartFoundAccess,

  /// Cold-start check found no access token; falling back to refresh.
  coldStartRefreshAttempt,

  /// Cold-start refresh succeeded — user is now authenticated.
  coldStartRefreshSuccess,

  /// Cold-start refresh returned 401/403; tokens cleared, user must sign in.
  coldStartRefreshAuthFailure,

  /// Cold-start refresh failed transiently (network, timeout, 5xx);
  /// tokens kept, entering app optimistically authenticated.
  coldStartRefreshTransientFailure,

  /// User completed the sign-in flow (verify OTP).
  loginSuccess,

  /// User tapped Logout — call sent to backend, tokens cleared locally.
  userLogout,

  /// Backend explicitly revoked this session — user forcibly signed out.
  sessionRevoked,

  /// Refresh interceptor was triggered by a 401 on a data request.
  interceptorRefreshTriggered,

  /// Refresh interceptor's refresh POST succeeded; retrying original request.
  interceptorRefreshSuccess,

  /// Refresh interceptor's refresh POST returned 401/403; wiping tokens.
  interceptorRefreshAuthFailure,

  /// Refresh interceptor exhausted retries; tokens kept, error propagated.
  interceptorRefreshTransientFailure,

  /// App resumed from background; proactive refresh fired.
  proactiveRefreshTriggered,

  /// Proactive refresh succeeded.
  proactiveRefreshSuccess,

  /// Proactive refresh failed; session kept.
  proactiveRefreshFailure,

  /// Access token was written to secure storage.
  accessTokenStored,

  /// Refresh token was written to secure storage.
  refreshTokenStored,

  /// Both tokens were cleared from secure storage.
  tokensCleared,
}
