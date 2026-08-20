"use client";

/**
 * Ad triggers — TBT_ADS_SPECKIT.md §9.
 *
 * The three trigger types the clients emit today: `app_launch`, `route_enter`
 * and `timed_interval`. Each one only ever *asks* for an ad; every rule about
 * whether one may actually show (in-flight guard, display lock, suppression,
 * blocked routes) lives in the orchestrator, and the eligibility decision
 * itself is the server's. Keeping that split is what stops a fourth trigger
 * from quietly acquiring its own copy of the rules.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import type { AdTriggerType } from "@/types";

/** Let the first route settle and players register before asking, so the
 *  interruption snapshot is complete when an ad does come back. */
export const LAUNCH_DELAY_MS = 1_200;

/** Debounce for route entry — a redirect chain (`/` → `/dashboard`) should
 *  produce one request, not three. */
export const ROUTE_SETTLE_MS = 600;

export const TIMED_INTERVAL_CHECK_MS = 30_000;

export type AdTriggerFn = (
  triggerType: AdTriggerType,
  placementOverride?: string,
) => void;

/**
 * Wire all three triggers to `fire`.
 *
 * `fire` is expected to be referentially stable (a `useCallback` with an empty
 * dependency list in the orchestrator); the timers below are keyed on it, and
 * a fresh identity every render would re-arm them constantly.
 */
export function useAdTriggers(fire: AdTriggerFn): void {
  const pathname = usePathname() ?? "/";

  // ── app_launch ────────────────────────────────────────────────────────────
  // Once per mount of the host, not once per route change.
  const launchFiredRef = useRef(false);
  useEffect(() => {
    if (launchFiredRef.current) return;
    launchFiredRef.current = true;
    const t = setTimeout(() => fire("app_launch", "app_launch"), LAUNCH_DELAY_MS);
    return () => {
      clearTimeout(t);
      // Reset so React Strict Mode's double-invoke (cleanup → remount) can
      // schedule the real timer on the second mount.
      launchFiredRef.current = false;
    };
  }, [fire]);

  // ── route_enter ───────────────────────────────────────────────────────────
  const lastPathRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip the very first render: that is the launch trigger's job, and firing
    // both would have them race for the same display lock.
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const t = setTimeout(() => fire("route_enter"), ROUTE_SETTLE_MS);
    return () => clearTimeout(t);
  }, [pathname, fire]);

  // ── timed_interval ────────────────────────────────────────────────────────
  // Hidden tabs are skipped: a background tab firing an ad would burn a
  // frequency cap on something nobody saw.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fire("timed_interval");
    }, TIMED_INTERVAL_CHECK_MS);
    return () => clearInterval(id);
  }, [fire]);

  // ── foreground re-check ───────────────────────────────────────────────────
  // Campaigns can have started, ended or been paused while the tab sat in the
  // background, and a backgrounded tab receives no useful realtime either.
  // §12 is explicit that realtime is an optimisation, not a correctness
  // requirement — this is the part that makes that true. Without it, a tab left
  // open overnight waits up to the full interval before noticing anything.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fire("timed_interval");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fire]);
}
