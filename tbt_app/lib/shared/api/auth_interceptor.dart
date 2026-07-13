import 'package:dio/dio.dart';

import '../../core/utils/device_id.dart';
import 'token_storage.dart';

/// Attaches two headers on every outgoing request:
/// - `Cookie: tbt_access=<token>` — skipped when unauthenticated
/// - `X-Device-Id: <id>`          — identifies this device for security logging
class AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await TokenStorage.readAccessToken();
    if (token != null) {
      options.headers['Cookie'] = 'tbt_access=$token';
    }

    final deviceId = cachedDeviceId;
    if (deviceId != null) {
      options.headers['X-Device-Id'] = deviceId;
    }

    handler.next(options);
  }
}
