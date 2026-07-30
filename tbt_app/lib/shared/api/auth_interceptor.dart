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
class AuthInterceptor extends Interceptor {
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
}
