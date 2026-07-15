import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/constants/api.dart';
import 'token_storage.dart';

/// Catches 401 responses, pauses in-flight requests, refreshes the session,
/// then replays all queued requests with the new token.
///
/// Skips refresh for any path that starts with `/api/user-auth/` to avoid
/// infinite loops on login/refresh/logout endpoints themselves.
///
/// ── Session-preservation rules (see AUTH_ROBUSTNESS.md, added 2026-07-15) ──
///
/// The old implementation had a single `catch (_)` around the refresh POST
/// that wiped both tokens on ANY failure. That caused legitimate users to be
/// silently logged out whenever the refresh POST failed for reasons other
/// than an expired refresh token — poor network, transient backend 5xx,
/// DNS hiccups, connection timeouts, etc.
///
/// The current rules:
///
///   * 401 or 403 from the refresh endpoint → server explicitly says the
///     refresh token is invalid. Wipe tokens; user must sign in again.
///
///   * Any other failure (`connectionError`, `connectionTimeout`,
///     `receiveTimeout`, 5xx server error, etc.) → treat as transient.
///     KEEP tokens intact so the next request (or a manual retry) can
///     succeed once the network settles. Propagate the error so the
///     current screen shows a "Failed to load" state without dragging the
///     whole session down with it.
class RefreshInterceptor extends Interceptor {
  RefreshInterceptor(this._dio);

  final Dio _dio;
  bool _refreshing = false;
  final _queue = <(RequestOptions, ErrorInterceptorHandler)>[];

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

      final refreshResponse = await _dio.post<dynamic>(
        kAuthRefresh,
        options: Options(headers: {'Cookie': 'tbt_refresh=$refreshToken'}),
      );

      final setCookies = refreshResponse.headers.map['set-cookie'];
      final newAccess =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
      final newRefresh =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');

      if (newAccess != null) await TokenStorage.writeAccessToken(newAccess);
      if (newRefresh != null) await TokenStorage.writeRefreshToken(newRefresh);

      // Retry original request with the fresh access token.
      err.requestOptions.headers['Cookie'] = 'tbt_access=${newAccess ?? ''}';
      final retried = await _dio.fetch<dynamic>(err.requestOptions);
      _retryQueue(newAccess);
      handler.resolve(retried);
    } on DioException catch (refreshErr) {
      // The refresh POST itself failed. Distinguish auth failures from
      // transient network/server errors — only the former means the user
      // should be signed out.
      final isAuthFailure = _isAuthFailure(refreshErr);
      if (isAuthFailure) {
        _log('refresh returned ${refreshErr.response?.statusCode} — clearing '
            'session; user must re-authenticate');
        await TokenStorage.clearAll();
      } else {
        _log('refresh failed transiently (${refreshErr.type}, status='
            '${refreshErr.response?.statusCode}); KEEPING tokens for retry');
      }
      _drainQueue(err);
      handler.next(err);
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

  /// Returns true when the refresh POST's failure indicates the refresh
  /// token itself is no longer valid on the server (revoked or expired).
  /// Any other failure — network, timeout, 5xx — is transient.
  bool _isAuthFailure(DioException err) {
    final status = err.response?.statusCode;
    return status == 401 || status == 403;
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
