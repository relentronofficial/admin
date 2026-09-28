import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/providers/auth_provider.dart';
import 'dio_client.dart';
import 'session_state.dart';

/// Dio singleton wired to `sessionStateProvider`. Interceptors call
/// through the setter so refresh outcomes propagate to the router + UI
/// without inspecting Dio directly.
final dioProvider = Provider<Dio>((ref) {
  return createDioClient(
    onSessionState: (state) {
      // Use notifier.state directly — StateController updates are
      // synchronous and safe to call from an interceptor callback.
      ref.read(sessionStateProvider.notifier).state = state;
    },
    onSessionRevoked: () {
      // The backend sent 401 { code: 'SESSION_REVOKED' } — another device
      // has signed in and this session is dead. AuthInterceptor has already
      // cleared the stored tokens; we now flip the auth notifier to idle so
      // the router's guard (Guard 2: unauthenticated → /login) takes the
      // user back to the login screen without them having to tap "Log out".
      ref.read(authNotifierProvider.notifier).markRevoked();
    },
  );
});
