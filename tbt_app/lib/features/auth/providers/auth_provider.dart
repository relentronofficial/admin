import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/api/services/auth_service.dart';
import '../../../shared/api/token_storage.dart';
import '../../../shared/providers/me_provider.dart';
import '../../notifications/data/fcm_service.dart';
import '../domain/auth_state.dart';

part 'auth_provider.g.dart';

@Riverpod(keepAlive: true)
class AuthNotifier extends _$AuthNotifier {
  @override
  Future<AuthState> build() async {
    // Session-check on app start:
    //   1. If an access token is present, treat as authenticated. (Access
    //      tokens are 15-min TTL so this is usually enough for warm starts.)
    //   2. Else, if a refresh token exists, try to refresh silently. If the
    //      server explicitly says the refresh token is invalid (401/403),
    //      wipe tokens and fall through to idle. If the refresh call fails
    //      for any other reason (network / timeout / 5xx), assume the token
    //      is still valid on the server — start optimistically authenticated
    //      so per-request refresh can kick in once connectivity returns.
    //      This closes an intermittent-logout bug where a poor connection
    //      on cold start was permanently wiping the session.
    final access = await TokenStorage.readAccessToken();
    if (access != null) {
      return const AuthState(step: AuthStep.authenticated);
    }
    final refresh = await TokenStorage.readRefreshToken();
    if (refresh != null) {
      try {
        await ref.read(authServiceProvider).refresh();
        return const AuthState(step: AuthStep.authenticated);
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        if (status == 401 || status == 403) {
          // Server-declared invalid — really do sign out.
          if (kDebugMode) {
            debugPrint('[AuthNotifier.build] cold-start refresh got $status'
                ' — clearing tokens');
          }
          await TokenStorage.clearAll();
        } else {
          // Transient (network / timeout / 5xx). Keep the refresh token
          // and enter the app optimistically; the RefreshInterceptor will
          // exchange it for a new access token as soon as the first
          // authenticated request runs on a healthier network.
          if (kDebugMode) {
            debugPrint('[AuthNotifier.build] transient refresh failure'
                ' (${e.type}, status=$status) — KEEPING tokens,'
                ' entering authenticated optimistically');
          }
          return const AuthState(step: AuthStep.authenticated);
        }
      } catch (e, st) {
        // Non-Dio errors (SecureStorage failure, etc.). Keep tokens; the
        // user is very likely still valid on the backend.
        if (kDebugMode) {
          debugPrint('[AuthNotifier.build] non-Dio refresh error: $e\n$st'
              ' — KEEPING tokens, entering authenticated optimistically');
        }
        return const AuthState(step: AuthStep.authenticated);
      }
    }
    return const AuthState(step: AuthStep.idle);
  }

  /// Return payload from a successful login step-1 (before OTP).
  /// - [phone] is the canonical DB phone the OTP is keyed against.
  /// - [otp] is the actual OTP when the backend ships it inline (dev / staging
  ///   fallback when WhatsApp delivery is unavailable). Prod always omits it.
  Future<({String? phone, String? otp})?> loginWithOtp(
      String phone, String password) async {
    state = const AsyncValue.loading();
    String? resolvedPhone;
    String? inlineOtp;
    state = await AsyncValue.guard(() async {
      final res = await ref
          .read(authServiceProvider)
          .login(phone: phone, password: password);
      final data = res['data'];
      if (data is Map) {
        final p = data['phone'];
        if (p is String && p.isNotEmpty) resolvedPhone = p;
        final o = data['otp'];
        if (o is String && o.isNotEmpty) inlineOtp = o;
      }
      return const AuthState(step: AuthStep.otpSent);
    });
    if (state.hasError) return null;
    return (phone: resolvedPhone ?? phone, otp: inlineOtp);
  }

  /// Backward-compatible signature used by legacy call sites — returns just
  /// the phone. New code should prefer [loginWithOtp].
  Future<String?> login(String phone, String password) async {
    final res = await loginWithOtp(phone, password);
    return res?.phone;
  }

  Future<void> verifyOtp(String phone, String otp) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final svc = ref.read(authServiceProvider);
      await svc.verifyOtp(phone: phone, otp: otp);
      final member = await svc.getMe();
      return AuthState(step: AuthStep.authenticated, member: member);
    });
    if (state.valueOrNull?.step == AuthStep.authenticated) {
      _registerFcm();
    }
  }

  Future<void> logout() async {
    await ref.read(authServiceProvider).logout();
    ref.invalidate(meNotifierProvider);
    state = const AsyncValue.data(AuthState(step: AuthStep.idle));
  }

  Future<void> sendForgotPassword(String phone) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await ref
          .read(authServiceProvider)
          .forgotPassword(phone: phone);
      return const AuthState(step: AuthStep.otpSent);
    });
  }

  Future<void> resetPassword(
      String phone, String otp, String newPassword) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final svc = ref.read(authServiceProvider);
      await svc.resetPassword(phone: phone, otp: otp, newPassword: newPassword);
      final member = await svc.getMe();
      return AuthState(step: AuthStep.authenticated, member: member);
    });
    if (state.valueOrNull?.step == AuthStep.authenticated) {
      _registerFcm();
    }
  }

  void _registerFcm() {
    final fcm = ref.read(fcmServiceProvider);
    fcm
        .requestPermission()
        .then((_) => fcm.getAndRegisterToken())
        .catchError((_) {});
  }
}
