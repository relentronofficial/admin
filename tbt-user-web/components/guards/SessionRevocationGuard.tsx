"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket/client";
import { markSessionRevoked } from "@/lib/api/client";

/**
 * Listens for `session:revoked` socket events emitted by the backend when a
 * new login on another device calls completeLogin, kicking the current session.
 *
 * Handles the real-time path (socket). The HTTP path is handled in
 * lib/api/client.ts (SESSION_REVOKED code on 401 response).
 *
 * Rendered once in (platform)/layout.tsx — outside SubscriptionGate so it
 * fires even on the Products/profile exempt routes.
 *
 * Uses window.location.href (hard navigation) instead of router.replace so the
 * React tree tears down immediately. A soft navigation keeps the tree alive long
 * enough for SubscriptionGate to fire its own competing router.replace when
 * useMe() errors, causing repeated flicker before the transition completes.
 */
export function SessionRevocationGuard() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      const handler = () => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("tbt_session_kicked", "1");
          markSessionRevoked(); // stops proactive refresh in the request interceptor
          window.location.href = "/login";
        }
      };
      socket.on("session:revoked", handler);
      cleanup = () => socket.off("session:revoked", handler);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return null;
}
