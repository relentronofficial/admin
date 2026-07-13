import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/constants/api.dart';

/// Manages a single Socket.IO connection to the TBT backend.
///
/// Authentication passes the JWT access token as an HTTP cookie header
/// (`cookie: tbt_access=<token>`), matching the backend socket middleware
/// which reads `socket.handshake.headers.cookie`.
///
/// Reconnection uses socket.io's built-in exponential back-off:
/// 1 s → 2 s → 4 s → 8 s → 16 s → 30 s (capped), reset on `connect`.
///
/// Handler registry: all handlers registered via [on] are stored in
/// [_handlers] and automatically re-registered on each [connect] call.
/// This prevents the race where providers register handlers before the
/// first socket connection completes.
class SocketClient {
  io.Socket? _socket;

  /// Master registry of all currently active handlers.
  /// Keyed by event name; value is the ordered list of handlers.
  final Map<String, List<Function(dynamic)>> _handlers = {};

  bool get isConnected => _socket?.connected ?? false;

  /// Connects to the backend, passing [accessToken] as a cookie.
  /// Disposes any existing socket, creates a new one, and re-registers
  /// all previously registered handlers so they survive re-login.
  void connect(String accessToken) {
    _socket?.dispose();
    _socket = io.io(
      kApiBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setExtraHeaders({'cookie': 'tbt_access=$accessToken'})
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(30000)
          .setRandomizationFactor(0)
          .build(),
    );
    // Re-register all handlers on the new socket instance.
    _handlers.forEach((event, handlers) {
      for (final h in handlers) {
        _socket!.on(event, h);
      }
    });
    _socket!.connect();
  }

  /// Closes the connection. Registered handlers are preserved so they
  /// are restored on the next [connect] call.
  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  /// Registers [handler] for [event].
  /// If the socket is not yet connected the handler is queued and will
  /// be registered when [connect] is called.
  void on(String event, Function(dynamic) handler) {
    _handlers.putIfAbsent(event, () => []).add(handler);
    _socket?.on(event, handler);
  }

  /// Removes [handler] (or all handlers) for [event].
  void off(String event, [Function(dynamic)? handler]) {
    if (handler != null) {
      _handlers[event]?.remove(handler);
      if (_handlers[event]?.isEmpty ?? false) _handlers.remove(event);
    } else {
      _handlers.remove(event);
    }
    _socket?.off(event, handler);
  }

  /// Emits [event] with optional [data] to the server.
  void emit(String event, [dynamic data]) => _socket?.emit(event, data);
}
