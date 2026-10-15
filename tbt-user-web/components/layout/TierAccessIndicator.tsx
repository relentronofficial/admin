"use client";

import { CalendarDays } from "lucide-react";
import { useMentorshipStats } from "@/lib/hooks/useMentorship";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

/**
 * Shared box for the two navbar counters (StreakButton + TierAccessIndicator):
 * same height, padding, icon-to-number gap and surface, so the two numbers sit
 * on one baseline at every width. Plain — no glow, no animated badge.
 */
export const NAV_COUNTER_CLASS =
  "flex items-center gap-1 h-8 px-2 rounded-xl flex-shrink-0 select-none text-xs font-bold tabular-nums whitespace-nowrap";
export const NAV_COUNTER_STYLE = {
  background: "var(--color-surface-overlay-xs)",
  border: "1px solid var(--color-border-subtle)",
} as const;
export const NAV_COUNTER_ICON_SIZE = 15;

/**
 * Navbar Tier Access indicator — its own element, separate from the streak flame
 * (StreakButton). Shows activeDays/totalDays from the same useMentorshipStats()
 * query (same key → one shared cached request) and the same fields as the
 * dashboard's "Tier Access" tile, so both always show the same value. It never
 * reads the streak.
 */
export function TierAccessIndicator() {
  const { uiStrings } = useSiteConfig();
  const { data: stats, isLoading } = useMentorshipStats();

  const label = (uiStrings as any)?.tierAccessLabel ?? "Tier Access";
  const active = stats?.activeDays ?? 0;
  const total = stats?.totalDays ?? 0;
  // Visible: the count only (e.g. 📅 12). Screen readers / tooltip get the full
  // "Tier Access: 12/90d" context.
  const value = isLoading || !stats ? "–" : String(active);
  const fullText = isLoading || !stats ? "–" : total > 0 ? `${active}/${total}d` : `${active}d`;

  return (
    <div
      role="status"
      aria-label={`${label}: ${fullText}`}
      title={`${label}: ${fullText}`}
      className={NAV_COUNTER_CLASS}
      style={NAV_COUNTER_STYLE}
    >
      <CalendarDays size={NAV_COUNTER_ICON_SIZE} aria-hidden className="flex-shrink-0" style={{ color: "var(--color-accent)" }} />
      <span className="text-foreground">{value}</span>
    </div>
  );
}
