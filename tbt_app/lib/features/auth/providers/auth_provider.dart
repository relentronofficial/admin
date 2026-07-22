import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/api/services/auth_service.dart';
import '../../../shared/api/token_storage.dart';
import '../../../shared/cache/response_cache.dart';
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
    // Per product decision: the session persists until the user MANUALLY
    // logs out (drawer / profile / pending-approval sign-out button). No
    // automatic wipe on refresh failure — not on transient network issues,
    // not on server-declared 401/403 from /refresh. If a token exists,
    // enter authenticated optimistically; the RefreshInterceptor will
    // attempt to renew on the first authenticated request. If that also
    // fails, individual screens surface their own error state but the
    // session cookies stay put so the user can retry (or log out
    // manually) rather than being kicked to /login unexpectedly.
    final access = await TokenStorage.readAccessToken();
    final refresh = await TokenStorage.readRefreshToken();
    if (access != null || refresh != null) {
      if (refresh != null && access == null) {
        try {
          await ref.read(authServiceProvider).refresh();
        } catch (e, st) {
          if (kDebugMode) {
            debugPrint('[AuthNotifier.build] cold-start refresh failed: $e\n$st'
                ' — KEEPING tokens, entering authenticated optimistically');
          }
        }
      }
      return const AuthState(step: AuthStep.authenticated);
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
    // Purge cached responses so the next user doesn't render the
    // previous user's dashboard on first launch.
    await ResponseCache.clear();
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
