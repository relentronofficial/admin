import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  _socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000", {
    withCredentials: true, // send HttpOnly auth cookies automatically
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

// No-op kept for callers that imported it — no longer needed with cookie auth
export function initSocket(_getToken?: () => Promise<string | null>) {}
