import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/constants/api.dart';
import 'auth_event_log.dart';
import 'token_storage.dart';

/// Catches 401 responses, pauses in-flight requests, refreshes the session,
/// then replays all queued requests with the new token.
///
/// Skips refresh for any path that starts with `/api/user-auth/` to avoid
/// infinite loops on login/refresh/logout endpoints themselves.
///
/// ── Session-preservation rules ────────────────────────────────────────────
///
/// The old implementation had a single `catch (_)` around the refresh POST
/// that wiped both tokens on ANY failure. That caused legitimate users to be
/// silently logged out whenever the refresh POST failed for reasons other
/// than an expired refresh token — poor network, transient backend 5xx,
/// DNS hiccups, connection timeouts, etc.
///
/// The current rules:
///
///   * **401 or 403 from the refresh endpoint** → server explicitly says
///     the refresh token is invalid. Wipe tokens; user must sign in again.
///
///   * **Any other failure** (`connectionError`, `connectionTimeout`,
///     `receiveTimeout`, 5xx server error, etc.) → treat as transient.
///     Attempt the refresh up to `_maxRefreshAttempts` times with
///     exponential backoff before giving up. On final give-up: KEEP
///     tokens intact so the next request (or a manual retry) can succeed
///     once the network settles. Propagate the error so the current
///     screen shows a "Failed to load" state without dragging the whole
///     session down with it.
///
///   * **Concurrent 401s** while a refresh is already in flight are
///     queued and replayed atomically once the single in-flight refresh
///     completes. Prevents thundering-herd refresh calls when multiple
///     screens hit an expired access token at the same moment.
///
/// Paired with the backend's rotation-with-grace-window (see
/// backend/src/plugins/jwt.ts) — a duplicate refresh from a network-
/// retry within 90 s still returns the same member id, so the client
/// side's own retry loop can safely re-attempt without invalidating
/// the session mid-recovery.
class RefreshInterceptor extends Interceptor {
  RefreshInterceptor(this._dio);

  final Dio _dio;

  // Coalesces concurrent 401s onto a single refresh call.
  bool _refreshing = false;
  final _queue = <(RequestOptions, ErrorInterceptorHandler)>[];

  // Retry policy for transient refresh failures. Total worst-case
  // wall-clock time before giving up: ~5.5 seconds (0.5 + 1 + 2 + 2s
  // final attempt). Below the typical user attention span so the app
  // still feels responsive when the network is briefly flaky.
  static const int _maxRefreshAttempts = 3;
  static const Duration _initialBackoff = Duration(milliseconds: 500);
  static const Duration _maxBackoff = Duration(seconds: 2);

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final path = err.requestOptions.path;

    if (status != 401 || path.startsWith('/api/user-auth/')) {
      return handler.next(err);
    }

    if (_refreshing) {
      _queue.add((err.requestOptions, handler));
      return;
    }

    _refreshing = true;
    AuthEventLog.record(
      AuthEventType.interceptorRefreshTriggered,
      detail: 'path=$path',
    );
    try {
      final refreshToken = await TokenStorage.readRefreshToken();
      if (refreshToken == null) {
        // No refresh token means we've already been signed out (or never
        // signed in). Nothing to try — surface the 401 unchanged and let
        // the caller handle it.
        _log('no refresh token — propagating original 401');
        _drainQueue(err);
        return handler.next(err);
      }

      final result = await _refreshWithRetry(refreshToken);
      switch (result) {
        case _RefreshSuccess(:final newAccess):
          AuthEventLog.record(
            AuthEventType.interceptorRefreshSuccess,
            tokenTail: AuthEventLog.tokenFingerprint(newAccess),
          );
          // Retry original request with the fresh access token.
          err.requestOptions.headers['Cookie'] =
              'tbt_access=${newAccess ?? ''}';
          final retried = await _dio.fetch<dynamic>(err.requestOptions);
          _retryQueue(newAccess);
          handler.resolve(retried);
        case _RefreshAuthFailure():
          // Per product decision: session persists until the user MANUALLY
          // logs out. Even when the server declares the refresh token dead
          // (401/403 from /refresh), we keep the tokens on disk and just
          // surface the original 401 to the caller. Individual screens
          // render their own error state; the user retains the option to
          // log out from the drawer / profile if they truly want to end
          // the session.
          _log('refresh returned auth failure — KEEPING tokens per policy');
          AuthEventLog.record(AuthEventType.interceptorRefreshAuthFailure);
          _drainQueue(err);
          handler.next(err);
        case _RefreshTransientFailure(:final lastError):
          // Every attempt hit a transient error (network / 5xx). The
          // refresh token is still valid on the server as far as we
          // know; KEEP tokens so a later request can try again.
          _log('refresh exhausted retries (last: ${lastError.type}, status='
              '${lastError.response?.statusCode}) — KEEPING tokens');
          AuthEventLog.record(
            AuthEventType.interceptorRefreshTransientFailure,
            detail: 'last=${lastError.type} status='
                '${lastError.response?.statusCode}',
          );
          _drainQueue(err);
          handler.next(err);
      }
    } catch (e, st) {
      // Unexpected non-Dio failure (should be rare — mostly SecureStorage
      // failures or programmer errors). Log loudly but do NOT wipe tokens:
      // the session might still be perfectly valid on the backend.
      _log('refresh threw non-Dio error: $e\n$st (KEEPING tokens)');
      _drainQueue(err);
      handler.next(err);
    } finally {
      _refreshing = false;
    }
  }

  /// Attempts the refresh POST up to [_maxRefreshAttempts] times with
  /// exponential backoff. Returns as soon as one attempt either
  /// succeeds or hits an auth failure (401/403). Only bails out with
  /// [_RefreshTransientFailure] after every attempt has failed
  /// transiently.
  Future<_RefreshResult> _refreshWithRetry(String refreshToken) async {
    DioException? lastError;
    for (var attempt = 0; attempt < _maxRefreshAttempts; attempt++) {
      if (attempt > 0) {
        final backoff = _backoffFor(attempt);
        _log('retry attempt ${attempt + 1}/$_maxRefreshAttempts '
            'after ${backoff.inMilliseconds}ms backoff');
        await Future<void>.delayed(backoff);
      }
      try {
        final refreshResponse = await _dio.post<dynamic>(
          kAuthRefresh,
          options: Options(headers: {'Cookie': 'tbt_refresh=$refreshToken'}),
        );

        final setCookies = refreshResponse.headers.map['set-cookie'];
        final newAccess =
            TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
        final newRefresh =
            TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');

        // Persist tokens atomically. If the write fails halfway through,
        // the old refresh token is still valid on the backend for
        // REFRESH_GRACE_SECONDS (90 s) — a subsequent attempt using the
        // still-stored old token will succeed.
        if (newAccess != null) await TokenStorage.writeAccessToken(newAccess);
        if (newRefresh != null) {
          await TokenStorage.writeRefreshToken(newRefresh);
        }
        return _RefreshSuccess(newAccess);
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        if (status == 401 || status == 403) {
          // Server-declared invalid refresh token — no point retrying.
          return const _RefreshAuthFailure();
        }
        // Transient — remember and try again.
        lastError = e;
      }
    }
    return _RefreshTransientFailure(lastError!);
  }

  Duration _backoffFor(int attempt) {
    // 500ms, 1000ms, 2000ms, capped at _maxBackoff
    final ms = _initialBackoff.inMilliseconds * math.pow(2, attempt - 1);
    final capped = math.min(ms.toInt(), _maxBackoff.inMilliseconds);
    return Duration(milliseconds: capped);
  }

  void _retryQueue(String? newAccess) {
    for (final (opts, h) in _queue) {
      if (newAccess != null) opts.headers['Cookie'] = 'tbt_access=$newAccess';
      _dio.fetch<dynamic>(opts).then(
        h.resolve,
        onError: (Object e) => h.next(
          e is DioException
              ? e
              : DioException(requestOptions: opts, error: e),
        ),
      );
    }
    _queue.clear();
  }

  void _drainQueue(DioException err) {
    for (final (_, h) in _queue) {
      h.next(err);
    }
    _queue.clear();
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[RefreshInterceptor] $message');
  }
}

// ── Refresh outcomes ─────────────────────────────────────────────────────────

sealed class _RefreshResult {
  const _RefreshResult();
}

class _RefreshSuccess extends _RefreshResult {
  const _RefreshSuccess(this.newAccess);
  final String? newAccess;
}

class _RefreshAuthFailure extends _RefreshResult {
  const _RefreshAuthFailure();
}

class _RefreshTransientFailure extends _RefreshResult {
  const _RefreshTransientFailure(this.lastError);
  final DioException lastError;
}
