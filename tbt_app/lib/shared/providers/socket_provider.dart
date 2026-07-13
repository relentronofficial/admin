import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../api/token_storage.dart';
import '../socket/socket_client.dart';
import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/providers/auth_provider.dart';

part 'socket_provider.g.dart';

/// Manages the Socket.IO connection lifecycle tied to the user's auth state.
///
/// State (`bool`) reflects whether the socket is currently connected.
/// The underlying [SocketClient] is accessible via `.notifier.client` for
/// CC-49 event wiring (e.g. room joins, per-provider `on`/`off` calls).
@Riverpod(keepAlive: true)
class SocketNotifier extends _$SocketNotifier {
  final _client = SocketClient();

  SocketClient get client => _client;

  @override
  bool build() {
    ref.onDispose(_client.disconnect);

    // Connect/disconnect in response to auth state changes.
    ref.listen<AsyncValue<AuthState>>(
      authNotifierProvider,
      (_, next) => _onAuthChange(next),
      fireImmediately: true,
    );

    return false;
  }

  Future<void> _onAuthChange(AsyncValue<AuthState> authAsync) async {
    final authState = authAsync.valueOrNull;
    if (authState == null) return;

    if (authState.step == AuthStep.authenticated) {
      final token = await TokenStorage.readAccessToken();
      if (token != null) {
        _client.connect(token);
        state = true;
      }
    } else if (authState.step == AuthStep.idle) {
      _client.disconnect();
      state = false;
    }
  }

  // ── Delegation helpers for CC-49 event wiring ──────────────────────────────

  void on(String event, Function(dynamic) handler) =>
      _client.on(event, handler);

  void off(String event, [Function(dynamic)? handler]) =>
      _client.off(event, handler);

  void emit(String event, [dynamic data]) => _client.emit(event, data);

  bool get isConnected => _client.isConnected;
}
