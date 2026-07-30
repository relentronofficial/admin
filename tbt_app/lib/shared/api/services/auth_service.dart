import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../core/exceptions/app_exception.dart';
import '../dio_client.dart';
import '../dio_provider.dart';
import '../token_storage.dart';
import '../../models/member.dart';

class AuthService {
  const AuthService(this._dio);
  final Dio _dio;

  /// Step 1 of login: send phone + password, triggers OTP delivery.
  Future<Map<String, dynamic>> login({
    required String phone,
    required String password,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAuthLogin,
        data: {'phone': phone, 'password': password},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Step 2 of login: verify OTP and store the issued JWT cookies.
  Future<void> verifyOtp({
    required String phone,
    required String otp,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAuthVerifyOtp,
        data: {'phone': phone, 'otp': otp},
      );
      final setCookies = res.headers.map['set-cookie'];
      final access =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
      final refresh =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');
      if (access != null) await TokenStorage.writeAccessToken(access);
      if (refresh != null) await TokenStorage.writeRefreshToken(refresh);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> logout() async {
    try {
      // Attach the refresh cookie explicitly so the server can revoke it
      // from Redis. Without this the token would linger on the backend
      // until its 30-day TTL, letting another actor on the same account
      // continue to refresh with a stolen copy. `AuthInterceptor` skips
      // /api/user-auth/* so the caller's Cookie header is preserved.
      final refresh = await TokenStorage.readRefreshToken();
      await _dio.post<dynamic>(
        kAuthLogout,
        options: refresh != null
            ? Options(headers: {'Cookie': 'tbt_refresh=$refresh'})
            : null,
      );
    } on DioException catch (_) {
      // Ignore server errors — always clear local tokens.
    } finally {
      await TokenStorage.clearAll();
    }
  }

  Future<Map<String, dynamic>> forgotPassword({required String phone}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAuthForgotPassword,
        data: {'phone': phone},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> resetPassword({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAuthResetPassword,
        data: {'phone': phone, 'otp': otp, 'newPassword': newPassword},
      );
      // Reset password also issues new session cookies.
      final setCookies = res.headers.map['set-cookie'];
      final access =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
      final refresh =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');
      if (access != null) await TokenStorage.writeAccessToken(access);
      if (refresh != null) await TokenStorage.writeRefreshToken(refresh);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> signup(Map<String, dynamic> data) async {
    try {
      final res =
          await _dio.post<Map<String, dynamic>>(kAuthSignup, data: data);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Explicitly refreshes the session using the stored refresh token.
  /// The [RefreshInterceptor] handles 401-triggered refreshes automatically;
  /// this method is for proactive refresh (e.g. on app resume) and unit
  /// testing.
  ///
  /// Session-preservation rule: the session persists until the user
  /// MANUALLY logs out. Refresh failures — transient (network / 5xx) or
  /// server-declared auth failure (401/403 from /refresh) — never wipe
  /// tokens. The caller receives the mapped error and can decide how to
  /// surface it, but the stored tokens remain so a later attempt can
  /// succeed and the router doesn't unexpectedly kick the user to /login.
  Future<void> refresh() async {
    final refreshToken = await TokenStorage.readRefreshToken();
    if (refreshToken == null) throw const UnauthorizedException();

    try {
      final res = await _dio.post<dynamic>(
        kAuthRefresh,
        options: Options(headers: {'Cookie': 'tbt_refresh=$refreshToken'}),
      );

      final setCookies = res.headers.map['set-cookie'];
      final newAccess =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
      final newRefresh =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');

      if (newAccess != null) await TokenStorage.writeAccessToken(newAccess);
      if (newRefresh != null) await TokenStorage.writeRefreshToken(newRefresh);
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint('[AuthService.refresh] failed '
            '(${e.type}, status=${e.response?.statusCode}) — KEEPING tokens');
      }
      throw mapDioError(e);
    }
  }

  /// Returns the authenticated member's profile — typed [Member].
  /// Used by [MeNotifier] and [AuthNotifier] after successful auth events.
  Future<Member> getMe() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserMe);
      final raw = res.data?['data'] as Map<String, dynamic>?;
      if (raw == null) throw const ServerException('User data not found');
      // Backend returns firstName + lastName but not `name`, and uses
      // `avatarUrl` while Member also accepts either. Compose the missing
      // `name` and hand a normalized copy to freezed so `Member.fromJson`
      // doesn't throw a TypeError on the required `name` field.
      final normalized = <String, dynamic>{...raw};
      if (normalized['name'] == null) {
        final first = (raw['firstName'] as String?) ?? '';
        final last = (raw['lastName'] as String?) ?? '';
        final composed = [first, last].where((s) => s.isNotEmpty).join(' ').trim();
        normalized['name'] = composed.isEmpty ? 'Member' : composed;
      }
      return Member.fromJson(normalized);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(dioProvider)),
);
