"use client";

import { useEffect, useRef, useState } from "react";
import type { AdCampaign } from "@/types";

interface ImageAdViewProps {
  campaign: AdCampaign;
  /** Ticks up once per second of *visible* elapsed time. Owned by the overlay
   *  so skip/close/CTA gating all share one clock. */
  elapsedSeconds: number;
  /** Start on the fallback creative. Set when a video ad's own media failed and
   *  the fallback image is standing in — `mediaUrl` is a video there and would
   *  fail a second time before we got here anyway. */
  forceFallback?: boolean;
  onLoaded: () => void;
  onError: () => void;
  /** Fired once the configured display duration has been reached. */
  onDurationReached: () => void;
}

const objectFitClass = (fit: AdCampaign["objectFit"]) =>
  fit === "cover" ? "object-cover" : fit === "fill" ? "object-fill" : "object-contain";

export function ImageAdView({
  campaign,
  elapsedSeconds,
  forceFallback = false,
  onLoaded,
  onError,
  onDurationReached,
}: ImageAdViewProps) {
  const [useFallback, setUseFallback] = useState(forceFallback);
  const firedRef = useRef(false);

  const src = useFallback ? campaign.fallbackMediaUrl : campaign.mediaUrl;

  // Auto-close once the admin-configured duration elapses (criterion 24).
  useEffect(() => {
    const duration = campaign.durationSeconds ?? 0;
    if (duration <= 0 || firedRef.current) return;
    if (elapsedSeconds >= duration) {
      firedRef.current = true;
      onDurationReached();
    }
  }, [elapsedSeconds, campaign.durationSeconds, onDurationReached]);

  if (!src) {
    // Nothing renderable. Report and let the overlay tear down rather than
    // leaving the user staring at an empty black screen.
    return <FailedMedia onMount={onError} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={campaign.name}
      className={`h-full w-full ${objectFitClass(campaign.objectFit)}`}
      onLoad={onLoaded}
      onError={() => {
        // One shot at the fallback creative before giving up entirely.
        if (!useFallback && campaign.fallbackMediaUrl) {
          setUseFallback(true);
          return;
        }
        onError();
      }}
      draggable={false}
    />
  );
}

/** Effect-only child so `onError` fires from a render-safe location. */
function FailedMedia({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}
