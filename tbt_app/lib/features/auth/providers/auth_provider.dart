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
    //   1. If an access token is present, treat as authenticated.
    //   2. Else, if a refresh token exists, try to refresh silently. If it
    //      succeeds, skip login. If it fails (expired / server error), fall
    //      through to the idle state so the user sees login.
    // This closes the P1 "always see login on cold start" bug — access tokens
    // are 15-min TTL, so without a refresh attempt users always land back on
    // /login after any short idle.
    final access = await TokenStorage.readAccessToken();
    if (access != null) {
      return const AuthState(step: AuthStep.authenticated);
    }
    final refresh = await TokenStorage.readRefreshToken();
    if (refresh != null) {
      try {
        await ref.read(authServiceProvider).refresh();
        return const AuthState(step: AuthStep.authenticated);
      } catch (_) {
        await TokenStorage.clearAll();
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
