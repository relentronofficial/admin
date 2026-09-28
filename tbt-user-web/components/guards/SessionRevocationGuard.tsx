"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket/client";

/**
 * Listens for `session:revoked` socket events emitted by the backend when a
 * new login on another device calls completeLogin, kicking the current session.
 *
 * Handles the real-time path (socket). The HTTP path is handled in
 * lib/api/client.ts (SESSION_REVOKED code on 401 response).
 *
 * Rendered once in (platform)/layout.tsx — outside SubscriptionGate so it
 * fires even on the Products/profile exempt routes.
 */
export function SessionRevocationGuard() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      const handler = () => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("tbt_session_kicked", "1");
          localStorage.removeItem("tbt_access_exp");
          router.replace("/login");
        }
      };
      socket.on("session:revoked", handler);
      cleanup = () => socket.off("session:revoked", handler);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [router]);

  return null;
}
