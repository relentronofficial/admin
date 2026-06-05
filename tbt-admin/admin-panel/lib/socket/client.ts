import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;
let _getToken: (() => Promise<string | null>) | null = null;

export function initAdminSocket(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

export async function getAdminSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  const token = _getToken ? await _getToken() : null;

  _socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // Clerk tokens expire — on each reconnect attempt, destroy and recreate with a
  // fresh token so the handshake doesn't fail with a stale JWT.
  _socket.io.on('reconnect_attempt', async () => {
    disconnectAdminSocket();
    await getAdminSocket();
  });

  return _socket;
}

export function disconnectAdminSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
