"use client";

import { useEffect } from "react";
import { activityService } from "@/lib/api/services/activity.service";

/** How often a heartbeat is sent while the member is active. */
export const HEARTBEAT_INTERVAL_MS = 60_000;
/** No click/key/scroll/touch for this long = idle (unless media is playing). */
export const IDLE_AFTER_MS = 5 * 60_000;

function isMediaPlaying(): boolean {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some(
    (m) => !m.paused && !m.ended && m.readyState > 2,
  );
}

/**
 * Daily Time Spent tracker. Sends at most one heartbeat a minute, and only
 * while the tab is visible AND the member interacted recently or media is
 * playing. Hidden tabs, idle tabs and closed browsers send nothing, so they
 * are never counted. The server de-duplicates per minute across tabs and
 * devices, so this is safe to run in every open tab.
 *
 * Embedded (iframe) video players can't be observed from here; their progress
 * updates are counted on the server instead.
 */
export function useActivityHeartbeat() {
  useEffect(() => {
    let lastInteraction = Date.now();
    let lastSent = 0;
    let inFlight = false;

    const markInteraction = () => {
      lastInteraction = Date.now();
    };

    const send = () => {
      if (inFlight || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSent < HEARTBEAT_INTERVAL_MS - 2_000) return;
      const interacted = now - lastInteraction < IDLE_AFTER_MS;
      const media = isMediaPlaying();
      if (!interacted && !media) return;
      inFlight = true;
      lastSent = now;
      activityService
        .heartbeat({ visible: true, interacted, media })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        markInteraction();
        send();
      }
    };

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, markInteraction, { passive: true }));
    let lastMove = 0;
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove > 10_000) {
        lastMove = now;
        markInteraction();
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    const first = window.setTimeout(send, 5_000);
    const timer = window.setInterval(send, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, markInteraction));
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
