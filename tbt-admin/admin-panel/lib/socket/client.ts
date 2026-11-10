import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;
let _getToken: (() => Promise<string | null>) | null = null;

export function initAdminSocket(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

export async function getAdminSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  // If a socket exists but is not connected yet (connecting), return it so
  // callers share the same instance rather than spawning a second one.
  if (_socket) return _socket;

  const token = _getToken ? await _getToken() : null;

  _socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
    auth: { token },
    // WebSocket-only: skip the HTTP long-polling upgrade handshake.
    // Polling added ~300ms latency on every connect/reconnect cycle because
    // the client had to wait for the server to confirm the upgrade.
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  // Refresh the Clerk token on every successful reconnect so the socket
  // doesn't authenticate with a stale JWT after a network interruption.
  // We do this on the 'connect' event (fires on initial connect AND every
  // reconnect) rather than 'reconnect_attempt', because:
  //   1. By 'connect' the handshake already succeeded with the last token.
  //   2. We call socket.auth = { token } + socket.disconnect()/connect()
  //      only when the token has actually changed, avoiding a reconnect loop.
  // The old 'reconnect_attempt' handler was broken: it called
  // disconnectAdminSocket() which nulled _socket, then getAdminSocket()
  // which re-entered this function and created a NEW socket — orphaning all
  // page-level .on() listeners that were registered on the old socket.
  _socket.on('connect', async () => {
    if (!_getToken) return;
    const freshToken = await _getToken().catch(() => null);
    if (freshToken && freshToken !== (_socket as any).auth?.token) {
      (_socket as any).auth = { token: freshToken };
    }
  });

  return _socket;
}

export function disconnectAdminSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
