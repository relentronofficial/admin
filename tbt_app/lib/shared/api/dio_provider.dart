import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  );
});
