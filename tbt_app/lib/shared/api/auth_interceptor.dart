import 'package:dio/dio.dart';

import '../../core/utils/device_id.dart';
import 'token_storage.dart';

/// Attaches two headers on every outgoing request:
/// - `Cookie: tbt_access=<token>` — skipped when unauthenticated
/// - `X-Device-Id: <id>`          — identifies this device for security logging
///
/// ── Why we skip `/api/user-auth/*` ────────────────────────────────────────
///
/// Auth-flow endpoints set their own `Cookie` header explicitly:
///   * `/refresh` sends `Cookie: tbt_refresh=<token>` from AuthService.refresh
///   * `/logout`  attaches the refresh cookie so the server can revoke it
///
/// If this interceptor blindly wrote `Cookie: tbt_access=<X>` on those paths
/// it would OVERWRITE the caller's cookie — the server would see the wrong
/// token (or no refresh token at all) and return
/// `{ error: 'No refresh token' }`. That was the primary cause of
/// "session expired frequently" reports: proactive-refresh was firing every
/// 12 min, hitting this bug, and the caller was left with a stale access
/// token and no successful refresh in between. Access tokens have a 15 min
/// TTL, so within a couple of minutes of that failure the next authenticated
/// request would 401, kick the interceptor's own refresh flow, hit the same
/// bug, fall back to OFFLINE, and the UI would appear to sit on a stale
/// session until the user manually logged in again.
///
/// Skipping the auth paths lets the caller's explicit Cookie header pass
/// through unchanged. Login / verify-otp / signup don't need any cookie
/// attached — the server rejects nothing on absence, and any stale
/// access token wouldn't help them anyway.
///
/// ── SESSION_REVOKED handling ──────────────────────────────────────────────
///
/// When the backend enforces single-device sessions it returns:
///   HTTP 401 { code: 'SESSION_REVOKED' }
/// This is distinct from an expired access token (which the RefreshInterceptor
/// can recover from by exchanging the refresh token). A revoked session means
/// the refresh token itself has been wiped on the server — retrying is
/// pointless. The interceptor detects this code, clears both stored tokens,
/// and calls [onSessionRevoked] so the app can transition to the logged-out
/// state without the user having to tap anything.
///
/// [onSessionRevoked] is injected at construction time (from dioProvider via
/// createDioClient) so this interceptor stays free of Riverpod imports.
class AuthInterceptor extends Interceptor {
  /// Called when the backend sends `{ code: 'SESSION_REVOKED' }` in a 401.
  /// Wired in [createDioClient] to clear Riverpod auth state and navigate to
  /// the login screen via the router's existing revocation guard.
  final void Function()? onSessionRevoked;

  const AuthInterceptor({this.onSessionRevoked});

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final deviceId = cachedDeviceId;
    if (deviceId != null) {
      options.headers['X-Device-Id'] = deviceId;
    }

    // Auth-flow endpoints set their own Cookie — don't clobber it.
    if (!options.path.startsWith('/api/user-auth/')) {
      final token = await TokenStorage.readAccessToken();
      if (token != null) {
        options.headers['Cookie'] = 'tbt_access=$token';
      }
    }

    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final data = err.response?.data;
    final code = data is Map ? data['code'] as String? : null;

    if (status == 401 && code == 'SESSION_REVOKED') {
      // The server has forcibly terminated this session (single-device
      // enforcement). Clear stored tokens so the app starts clean, then
      // signal the auth layer to transition back to idle/login.
      await TokenStorage.clearAll();
      onSessionRevoked?.call();
    }

    handler.next(err);
  }
}
