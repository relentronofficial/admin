import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/constants/api.dart';
import '../../core/exceptions/app_exception.dart';
import 'auth_interceptor.dart';
import 'dedup_interceptor.dart';
import 'log_interceptor.dart';
import 'refresh_interceptor.dart';
import 'session_state.dart';

/// Creates and returns the app's configured [Dio] instance.
///
/// Interceptor order:
///   1. [DedupInterceptor]   — short-circuits duplicate in-flight GETs
///   2. [AuthInterceptor]    — attaches `Cookie: tbt_access=<token>`
///   3. [RefreshInterceptor] — retries on 401 after refreshing
///   4. [TbtLogInterceptor]  — debug-only request/response logging
///
/// ── Transport security ──────────────────────────────────────────────────
///
/// In release builds we assert the configured API base URL is https:// so a
/// misconfigured build never accidentally sends session cookies over
/// cleartext. Debug builds allow http:// so devs can point at
/// `http://localhost:8000`.
///
/// Certificate pinning is intentionally NOT hard-coded here. Pinning to a
/// specific SPKI hash without a paired rotation plan is a footgun — the day
/// the certificate rotates (e.g. Cloud Run's managed cert renewal or an
/// LB cert swap), every installed APK stops working until a fresh build
/// ships to the store, which can take days. The industry-standard
/// mitigation is pinning to the CA chain + shipping a fallback pin, ideally
/// via `http_certificate_pinning` or a custom `HttpClientAdapter` — see
/// `dio_client.dart` docstring for the wiring stub if / when a security
/// team greenlights pinning with a rotation calendar.
/// Builds the app's Dio client. [onSessionState], if provided, is called
/// whenever the [RefreshInterceptor] observes a session outcome (success
/// after refresh, transient failure, or server-declared revocation).
/// Callers wire this to `sessionStateProvider` so the router + UI can
/// react without inspecting Dio directly.
Dio createDioClient({void Function(SessionState)? onSessionState}) {
  if (kReleaseMode) {
    assert(
      kApiBaseUrl.startsWith('https://'),
      'Refusing to construct a Dio client with a non-HTTPS base URL in a '
      'release build (got "$kApiBaseUrl"). Rebuild with '
      '`--dart-define=API_BASE_URL=https://…`.',
    );
  }
  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  dio.interceptors.addAll([
    DedupInterceptor(),
    AuthInterceptor(),
    RefreshInterceptor(dio, onSessionState: onSessionState),
    TbtLogInterceptor(),
  ]);

  return dio;
}

/// Maps a [DioException] to the appropriate [AppException] subtype.
/// Call this in every service's catch block.
AppException mapDioError(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.sendTimeout:
      return const NetworkException();
    default:
      break;
  }

  final status = e.response?.statusCode;
  final data = e.response?.data;
  // Backend uses { success: false, data: null, error: '<message>' } for all
  // 4xx responses. Surface that message so the user sees "Invalid OTP" instead
  // of a generic "Something went wrong".
  final backendMsg = data is Map
      ? (data['error'] ?? data['message'])?.toString()
      : null;

  if (status == 401) {
    return backendMsg != null && backendMsg.isNotEmpty
        ? UnauthorizedException(backendMsg)
        : const UnauthorizedException();
  }
  if (status == 403) {
    return backendMsg != null && backendMsg.isNotEmpty
        ? ForbiddenException(backendMsg)
        : const ForbiddenException();
  }
  if (status == 422 || status == 400 || status == 404 || status == 429) {
    return ValidationException(backendMsg ?? 'Validation error');
  }

  return backendMsg != null && backendMsg.isNotEmpty
      ? ServerException(backendMsg)
      : const ServerException();
}
