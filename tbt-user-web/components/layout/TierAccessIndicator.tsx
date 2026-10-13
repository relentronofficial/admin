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
  const value = isLoading || !stats ? "–" : total > 0 ? `${active}/${total}d` : `${active}d`;

  return (
    <div
      role="status"
      aria-label={`${label}: ${value}`}
      title={label}
      className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl flex-shrink-0 select-none text-muted-foreground"
      style={{
        background: "var(--color-surface-overlay-xs)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <CalendarDays size={15} className="flex-shrink-0 hidden min-[380px]:block" style={{ color: "var(--color-accent)" }} />
      <span className="hidden sm:inline text-[11px] font-semibold whitespace-nowrap">{label}</span>
      {/* Phones stack "12" over "/90d" to save width; inline from `sm` up. */}
      <span className="font-bold tabular-nums whitespace-nowrap text-foreground leading-none flex flex-col items-start sm:flex-row sm:items-baseline">
        {isLoading || !stats ? (
          <span className="text-xs">–</span>
        ) : (
          <>
            <span className="text-[11px] sm:text-xs">{active}</span>
            <span className="text-[9px] sm:text-xs opacity-80 sm:opacity-100">{total > 0 ? `/${total}d` : "d"}</span>
          </>
        )}
      </span>
    </div>
  );
}
