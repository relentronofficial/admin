"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { adsService, initAdTracking } from "@/lib/api/services/ads.service";
import {
  acquireAdLock,
  releaseAdLock,
  interruptAll,
  restoreAll,
  isSuppressed,
  isAdShowing,
  subscribe,
} from "@/lib/ads/mediaRegistry";
import {
  getAdSessionId,
  getAnonymousId,
  getLaunchCount,
  getSessionElapsedSeconds,
} from "@/lib/ads/session";
import { useAdTriggers } from "@/lib/ads/adTriggers";
import type { AdCampaign, AdEligibleRequest, AdTriggerType } from "@/types";

/** Why an ad ended. Every one of these runs the same teardown. */
export type AdEndReason =
  | "completed"
  | "skipped"
  | "closed"
  | "cta"
  | "media_error"
  | "load_timeout"
  | "invalidated";

export interface ActiveAd {
  campaign: AdCampaign;
  displayToken: string;
}

/** Placement derived from the current route. Kept deliberately coarse — the
 *  admin picks from this list, so adding one here means adding it to the admin
 *  multi-select too. */
function placementForRoute(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "home";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/podcasts")) return "podcast";
  if (pathname.startsWith("/ebooks")) return "ebook";
  if (pathname.startsWith("/courses") || pathname.startsWith("/learning")) return "course";
  if (pathname.startsWith("/workshop")) return "workshop";
  if (pathname.startsWith("/watch")) return "video";
  if (pathname.startsWith("/profile")) return "profile";
  return "global";
}

/**
 * Routes where a fullscreen ad is never acceptable, independent of any
 * component-level suppression (speckit §7.4). Belt and braces: the live page
 * also calls `useSuppressAds`, but a route guard survives that component
 * failing to mount.
 */
const BLOCKED_ROUTE_PREFIXES = ["/live", "/login", "/signup", "/verify", "/loading"];

function isBlockedRoute(pathname: string): boolean {
  return BLOCKED_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useAdOrchestrator() {
  const pathname = usePathname() ?? "/";
  const [active, setActive] = useState<ActiveAd | null>(null);

  /** Guards against overlapping /eligible calls from rapid triggers or
   *  React re-renders. The backend is cheap but not free, and a duplicate
   *  response would race for the display lock. */
  const inFlightRef = useRef(false);
  const lockTokenRef = useRef<string | null>(null);
  const activeRef = useRef<ActiveAd | null>(null);
  activeRef.current = active;

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const request = useCallback(
    async (triggerType: AdTriggerType, placementOverride?: string) => {
      if (typeof window === "undefined") return;
      if (inFlightRef.current) return;
      if (activeRef.current) return;
      if (isAdShowing()) return;
      if (isSuppressed()) return;

      const path = pathnameRef.current;
      if (isBlockedRoute(path)) return;

      inFlightRef.current = true;
      try {
        const body: AdEligibleRequest = {
          sessionId: getAdSessionId(),
          anonymousId: getAnonymousId(),
          platform: "web",
          os: "web",
          placement: placementOverride ?? placementForRoute(path),
          route: path,
          triggerType,
          launchCount: getLaunchCount(),
          sessionElapsedSeconds: getSessionElapsedSeconds(),
          deviceInfo: {
            width: window.innerWidth,
            height: window.innerHeight,
            ua: navigator.userAgent.slice(0, 200),
          },
        };

        const res = await adsService.eligible(body);
        const data = res?.data;
        if (!data?.showAd || !data.campaign || !data.displayToken) return;

        // Conditions can change while the request is in flight — re-check
        // everything before committing to showing anything.
        if (activeRef.current || isSuppressed() || isBlockedRoute(pathnameRef.current)) return;

        const token = data.displayToken;
        if (!acquireAdLock(token)) return;
        lockTokenRef.current = token;

        // Pause app media BEFORE the overlay mounts, so ad audio and app audio
        // can never overlap (criterion 22).
        interruptAll();

        setActive({ campaign: data.campaign, displayToken: token });
      } catch {
        // An ad-system failure is invisible to the user (speckit §11).
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  /**
   * The single teardown path. Every exit — success, skip, close, error,
   * timeout, invalidation — funnels through here so media restoration can
   * never be skipped.
   */
  const endAd = useCallback((reason: AdEndReason) => {
    const current = activeRef.current;
    const token = lockTokenRef.current;

    setActive(null);
    activeRef.current = null;

    // Restore before releasing the lock, so a trigger firing on the next tick
    // cannot interleave with the restore.
    restoreAll();

    if (token) {
      releaseAdLock(token);
      lockTokenRef.current = null;
    }

    if (current && reason === "invalidated") {
      void adsService.events(current.displayToken, [{ eventType: "closed" }]);
    }
  }, []);

  // Drain anything a previous session left queued, and retry on reconnect
  // (§11). Idempotent, so mounting the host twice is harmless.
  useEffect(() => {
    initAdTracking();
  }, []);

  // ── Triggers (lib/ads/adTriggers.ts) ──────────────────────────────────
  // `request` is a stable useCallback, which the trigger timers depend on.
  useAdTriggers(request);

  // ── Realtime invalidation (speckit §12) ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { getSocket } = await import("@/lib/socket/client");
        const socket = await getSocket();
        if (cancelled) return;

        const onInvalidated = (payload: { campaignId: string; reason: string }) => {
          const current = activeRef.current;
          if (!current || current.campaign.id !== payload.campaignId) return;
          // Only urgent reasons tear down an ad already on screen; ordinary
          // edits apply to the next eligibility check.
          if (payload.reason === "paused" || payload.reason === "archived") {
            endAd("invalidated");
          }
        };

        socket.on("ads:campaign_invalidated", onInvalidated);
        cleanup = () => socket.off("ads:campaign_invalidated", onInvalidated);
      } catch {
        // Socket unavailable — eligibility checks still pick up changes.
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [endAd]);

  // Suppression can begin while an ad is up (e.g. a live call starting in
  // another tab of the app shell). Tear down rather than stacking.
  useEffect(() => {
    return subscribe(() => {
      if (activeRef.current && isSuppressed()) endAd("invalidated");
    });
  }, [endAd]);

  // Safety net: if this hook unmounts with an ad open, never strand the
  // paused media.
  useEffect(() => {
    return () => {
      restoreAll();
      const token = lockTokenRef.current;
      if (token) releaseAdLock(token);
    };
  }, []);

  return { active, endAd, requestAd: request };
}
