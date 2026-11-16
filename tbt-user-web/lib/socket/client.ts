import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "@/lib/api/base";

let _socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  // Same origin as the app (proxied by next.config rewrites) so the first-party
  // auth cookies are sent on the handshake. No trailing slash on the path:
  // Next.js would redirect `/socket.io/` before the rewrite runs.
  _socket = io(typeof window !== "undefined" ? window.location.origin : BACKEND_URL, {
    addTrailingSlash: false,
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
