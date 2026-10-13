"use client";

import { CalendarDays } from "lucide-react";
import { useMentorshipStats } from "@/lib/hooks/useMentorship";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

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
      className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl flex-shrink-0 select-none text-muted-foreground"
      style={{
        background: "var(--color-surface-overlay-xs)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <CalendarDays size={15} className="flex-shrink-0 hidden min-[380px]:block" style={{ color: "var(--color-accent)" }} />
      <span className="text-xs font-bold tabular-nums whitespace-nowrap text-foreground">{value}</span>
    </div>
  );
}
