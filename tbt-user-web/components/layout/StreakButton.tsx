"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Trophy, CalendarCheck } from "lucide-react";
import { useMyStreak } from "@/lib/hooks/useDashboard";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { cn } from "@/lib/utils/cn";

const STREAK_GOLD = "#f59e0b";

function weekdayInitial(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" });
}

export function StreakButton() {
  const { uiStrings } = useSiteConfig();
  const { data: streak, isLoading } = useMyStreak();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = streak?.currentStreak ?? 0;
  const activeToday = !!streak?.activeToday;
  // Streak exists but nothing logged today yet — it ends at midnight (UTC).
  const atRisk = current > 0 && !activeToday;
  const flameColor = activeToday ? STREAK_GOLD : undefined;
  const daysUnit = uiStrings?.streakDaysUnit ?? "days";
  const title = uiStrings?.streakTitle ?? "Learning Streak";

  const message = activeToday
    ? uiStrings?.streakActiveTodayMessage ?? "You're on fire! Today's activity is counted — see you tomorrow."
    : atRisk
      ? uiStrings?.streakAtRiskMessage ?? "Complete a lesson or task today to keep your streak alive."
      : uiStrings?.streakStartMessage ?? "Complete a lesson or task today to start a new streak.";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center gap-1 px-2 py-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label={`${title}: ${current} ${daysUnit}`}
        aria-expanded={open}
        title={title}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          style={{ background: "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface-overlay))" }}
        />
        <Flame
          size={17}
          className={cn("relative z-10", activeToday && "drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]")}
          style={flameColor ? { color: flameColor, fill: flameColor } : undefined}
        />
        <span className="relative z-10 text-xs font-bold tabular-nums" style={flameColor ? { color: flameColor } : undefined}>
          {isLoading ? "–" : current}
        </span>
        {atRisk && (
          <span
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full z-20 animate-pulse"
            style={{ background: "var(--color-alert)" }}
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50"
            style={{
              background: "var(--color-notif-bg)",
              border: "1px solid var(--color-border-medium)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
            role="dialog"
            aria-label={title}
          >
            {/* Hero */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: activeToday
                    ? "rgba(245,158,11,0.14)"
                    : "var(--color-surface-overlay-md)",
                }}
              >
                <Flame
                  size={24}
                  className={activeToday ? undefined : "text-muted-foreground"}
                  style={flameColor ? { color: flameColor, fill: flameColor } : undefined}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-2xl font-extrabold text-foreground leading-tight tabular-nums">
                  {current} <span className="text-sm font-semibold text-muted-foreground">{daysUnit}</span>
                </p>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              <p className="text-xs leading-snug" style={{ color: atRisk ? "var(--color-alert)" : "var(--color-text-secondary)" }}>
                {message}
              </p>

              {/* Last 7 days */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {uiStrings?.streakLast7DaysLabel ?? "Last 7 days"}
                </p>
                <div className="flex justify-between">
                  {(streak?.last7Days ?? []).map((d, i, arr) => {
                    const isToday = i === arr.length - 1;
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1" title={d.active ? `${d.date} · +${d.points}` : d.date}>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{
                            background: d.active ? "rgba(245,158,11,0.16)" : "var(--color-surface-overlay)",
                            border: isToday ? "1.5px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                          }}
                        >
                          {d.active ? (
                            <Flame size={13} style={{ color: STREAK_GOLD, fill: STREAK_GOLD }} />
                          ) : (
                            <span className="w-1 h-1 rounded-full" style={{ background: "var(--color-text-subtle)" }} />
                          )}
                        </div>
                        <span className={cn("text-[10px] font-semibold", isToday ? "text-foreground" : "text-muted-foreground")}>
                          {weekdayInitial(d.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "var(--color-surface-overlay-xs)" }}>
                  <Trophy size={14} style={{ color: STREAK_GOLD }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{uiStrings?.streakLongestLabel ?? "Longest"}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{streak?.longestStreak ?? 0}</p>
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "var(--color-surface-overlay-xs)" }}>
                  <CalendarCheck size={14} style={{ color: "var(--color-success)" }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{uiStrings?.streakActiveDaysLabel ?? "Active days"}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{streak?.totalActiveDays ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 text-center" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <Link
                href="/learning"
                onClick={() => setOpen(false)}
                className="text-[11px] font-bold transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                {uiStrings?.streakCtaLabel ?? "Keep learning →"}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
