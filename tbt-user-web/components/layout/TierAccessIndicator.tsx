"use client";

import { useMentorshipStats } from "@/lib/hooks/useMentorship";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

/**
 * Shared box for the two navbar counters (StreakButton + TierAccessIndicator):
 * same height, padding and surface, so the two values sit on one baseline at
 * every width. Plain — no icon, no glow, no animated badge.
 */
export const NAV_COUNTER_CLASS =
  "flex items-center gap-1 h-8 px-2 rounded-xl flex-shrink-0 select-none text-xs font-bold tabular-nums whitespace-nowrap";
export const NAV_COUNTER_STYLE = {
  background: "var(--color-surface-overlay-xs)",
  border: "1px solid var(--color-border-subtle)",
} as const;

/**
 * Navbar Tier Access indicator — its own element, separate from the streak counter
 * (StreakButton). Shows activeDays/totalDays from the same useMentorshipStats()
 * query (same key → one shared cached request) and the same fields as the
 * dashboard's "Tier Access" tile, so both always show the same value. It never
 * reads the streak.
 */
export function TierAccessIndicator() {
  const { uiStrings } = useSiteConfig();
  const { data: stats, isLoading } = useMentorshipStats();

  const label = (uiStrings as any)?.tierAccessLabel ?? "Tier Access";
  // activeDays = distinct qualifying active days in the program window (independent
  // of the streak); totalDays = the member's program duration (+ extended days).
  const active = stats?.activeDays ?? 0;
  const total = stats?.totalDays ?? 0;
  // Visible: the count with its duration, e.g. "12/90d" — no icon.
  const value = isLoading || !stats ? "–" : total > 0 ? `${active}/${total}d` : `${active}d`;

  return (
    <div
      role="status"
      aria-label={`${label}: ${value}`}
      title={`${label}: ${value}`}
      className={NAV_COUNTER_CLASS}
      style={NAV_COUNTER_STYLE}
    >
      <span className="text-foreground">{value}</span>
    </div>
  );
}
