"use client";

import { useAdOrchestrator } from "@/lib/hooks/useAds";
import { FullscreenAdOverlay } from "./FullscreenAdOverlay";

/**
 * Single mount point for the ad system — TBT_ADS_SPECKIT.md §9.
 *
 * Lives in the platform layout beside <AudioController />, so triggers and the
 * display lock are owned in exactly one place instead of being duplicated per
 * page. Renders nothing until a campaign is actually selected.
 */
export function AdHost() {
  const { active, endAd } = useAdOrchestrator();

  if (!active) return null;

  return (
    <FullscreenAdOverlay
      // Remount cleanly per campaign — carrying state (elapsed clock, skip
      // gate, loaded flag) across two different ads would be wrong.
      key={active.displayToken}
      campaign={active.campaign}
      displayToken={active.displayToken}
      onEnd={endAd}
    />
  );
}
