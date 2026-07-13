import 'package:dio/dio.dart';

import '../../core/constants/api.dart';
import '../../core/exceptions/app_exception.dart';
import 'auth_interceptor.dart';
import 'log_interceptor.dart';
import 'refresh_interceptor.dart';

/// Creates and returns the app's configured [Dio] instance.
///
/// Interceptor order:
///   1. [AuthInterceptor]    — attaches `Cookie: tbt_access=<token>`
///   2. [RefreshInterceptor] — retries on 401 after refreshing
///   3. [TbtLogInterceptor]  — debug-only request/response logging
Dio createDioClient() {
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
    AuthInterceptor(),
    RefreshInterceptor(dio),
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

  if (status == 401) return const UnauthorizedException();
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
