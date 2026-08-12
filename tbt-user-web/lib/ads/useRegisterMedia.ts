"use client";

import { useEffect, useRef } from "react";
import { registerMedia, suppressAds, unsuppressAds, type InterruptibleMedia } from "./mediaRegistry";

/**
 * Register a player with the ad media coordinator for its lifetime.
 *
 * The controls object is held in a ref and read lazily, so a player can pass
 * closures over refs/state without re-registering on every render — the
 * registry only ever calls these at interrupt/restore time.
 *
 * Usage (course player):
 *
 *   useRegisterMedia("course-player", "video", {
 *     isPlaying: () => isPlayingRef.current,
 *     getPosition: () => playerRef.current?.currentTime ?? 0,
 *     pause: () => pausePlayerRef.current(),
 *     resume: () => resumePlayerRef.current(),
 *     seek: (s) => seekPlayerRef.current(s),
 *   });
 */
export function useRegisterMedia(
  id: string,
  kind: InterruptibleMedia["kind"],
  controls: Omit<InterruptibleMedia, "id" | "kind">,
  enabled: boolean = true,
): void {
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    if (!enabled) return;
    const unregister = registerMedia({
      id,
      kind,
      isPlaying: () => controlsRef.current.isPlaying(),
      getPosition: () => controlsRef.current.getPosition(),
      pause: () => controlsRef.current.pause(),
      resume: () => controlsRef.current.resume(),
      seek: (s) => controlsRef.current.seek(s),
    });
    return unregister;
  }, [id, kind, enabled]);
}

/**
 * Suppress ads for as long as this component is mounted (or `active` is true).
 *
 * For screens where a fullscreen ad would be destructive rather than merely
 * annoying — live calls, auth flows, an open quiz modal (speckit §7.4).
 */
export function useSuppressAds(reason: string, active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    suppressAds(reason);
    return () => unsuppressAds(reason);
  }, [reason, active]);
}
