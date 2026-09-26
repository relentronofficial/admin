import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../api/token_storage.dart';
import '../socket/socket_client.dart';
import '../socket/socket_events.dart';
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
        _registerSessionRevokedListener();
      }
    } else if (authState.step == AuthStep.idle) {
      _client.disconnect();
      state = false;
    }
  }

  /// Listens for `session:revoked` — emitted by the backend when another
  /// device completes login and kicks this session (single-device policy).
  /// Clears local tokens and sets auth to idle so the router sends the user
  /// back to the login screen.
  void _registerSessionRevokedListener() {
    _client.off(kSocketSessionRevoked);
    _client.on(kSocketSessionRevoked, (_) async {
      await TokenStorage.clearAll();
      // Use microtask so the socket.io event callback frame completes before
      // the socket is disconnected by the auth-state change below.
      Future.microtask(() {
        ref.read(authNotifierProvider.notifier).markRevoked();
      });
    });
  }

  // ── Delegation helpers for CC-49 event wiring ──────────────────────────────

  void on(String event, Function(dynamic) handler) =>
      _client.on(event, handler);

  void off(String event, [Function(dynamic)? handler]) =>
      _client.off(event, handler);

  void emit(String event, [dynamic data]) => _client.emit(event, data);

  bool get isConnected => _client.isConnected;
}
