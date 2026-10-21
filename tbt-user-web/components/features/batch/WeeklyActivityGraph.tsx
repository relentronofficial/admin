"use client";

import { useEffect, useRef, useState } from "react";
import { useMyWeeklyGraph } from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

// Two-axis milestone graph: weeks along X, milestones up Y, one line through
// each started week's point. Weeks, milestones (labels and order) and point
// heights all come from the API — the program's admin configuration (Admin →
// Weekly Graph) or the built-in defaults — see weeklyGraphLogic.ts. Task
// progress never reaches a revenue milestone; only an admin record does.

const LEFT = 64;     // room for the milestone labels
const RIGHT = 12;
const TOP = 12;
const LEVEL_GAP = 32;
const BOTTOM = 26;   // room for the week labels
const MIN_COL = 40;  // below this the chart scrolls horizontally instead of squeezing

/** Admin can hide the graph (Settings → Navigation → Platform Sections → "weekly_graph"). */
export const WEEKLY_GRAPH_MENU_KEY = "weekly_graph";

export default function WeeklyActivityGraph() {
  const { hiddenMenuKeys } = useSiteConfig();
  // Hidden by the admin: render nothing and don't fetch the graph at all.
  if ((hiddenMenuKeys ?? []).includes(WEEKLY_GRAPH_MENU_KEY)) return null;
  return <WeeklyActivityGraphContent />;
}

function WeeklyActivityGraphContent() {
  const { data: graph, isLoading, isError } = useMyWeeklyGraph();
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;

  // Lay out in real pixels from the container width so labels stay a constant,
  // readable size on every screen.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph]);

  if (isLoading) {
    return <div className="h-48 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay-md)" }} />;
  }
  // Not in a batch — the page already handles that state.
  if (!isError && !graph) return null;

  const title = s?.batchGraphTitle ?? "Weekly Activity Graph";
  const header = <h3 className="text-sm font-semibold opacity-60 uppercase tracking-widest mb-3">{title}</h3>;

  if (isError) {
    return (
      <div>
        {header}
        <p className="text-sm text-muted-foreground rounded-xl border p-4" style={{ borderColor: "var(--color-border-subtle)" }}>
          {s?.batchGraphError ?? "Could not load your weekly graph."}
        </p>
      </div>
    );
  }

  const weeks = graph!.weeks as any[];
  if (weeks.length === 0) return null;

  const weekPrefix = s?.batchGraphWeekPrefix ?? "W";

  // Build the milestone list with reached status from the API response.
  const configured = graph!.config?.milestones as any[] | undefined;
  const milestones: { label: string; reached: boolean }[] = configured?.length
    ? configured.map((m: any) => ({ label: m.label as string, reached: !!m.reached }))
    : [
        { label: s?.batchGraphMilestoneAds ?? "Ads", reached: false },
        { label: s?.batchGraphMilestoneWebsite ?? "Website", reached: false },
        { label: s?.batchGraphMilestoneFunnels ?? "Funnels", reached: false },
        { label: s?.batchGraphMilestoneLakh ?? "1 lakh", reached: false },
        { label: s?.batchGraphMilestoneCrore ?? "1 crore", reached: false },
      ];

  const weekLabel = (w: { label?: string; weekNumber: number }) => w.label || `${weekPrefix}${w.weekNumber}`;
  const PLOT_H = LEVEL_GAP * Math.max(milestones.length, 1);
  const yFor = (level: number) => TOP + PLOT_H - Math.min(level, milestones.length) * LEVEL_GAP;

  const col = Math.max(MIN_COL, (boxWidth - LEFT - RIGHT) / weeks.length || 0);
  const width = LEFT + weeks.length * col + RIGHT;
  const height = TOP + PLOT_H + BOTTOM;
  const colX = (i: number) => LEFT + i * col + col / 2;

  // Weeks that have started, in order — the line never extends into the future.
  const plotted = weeks
    .map((w: any, i: number) => ({ w, x: colX(i) }))
    .filter(({ w }: { w: any }) => w.progressLevel !== null);
  const linePoints = plotted
    .map(({ w, x }: { w: any; x: number }) => `${x},${yFor(w.progressLevel!)}`)
    .join(" ");

  const summary = graph!.summary as any;

  return (
    <div>
      {header}

      {/* Overall progress summary row */}
      <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        <span>
          {summary.completed} of {summary.total} tasks approved
        </span>
        {(summary.completionPercent ?? 0) > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
            style={{ background: "var(--color-accent)" }}
          >
            {summary.completionPercent}%
          </span>
        )}
      </div>

      <div
        ref={boxRef}
        className="rounded-xl border p-3 overflow-x-auto"
        style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
          className="block"
        >
          {/* Current week column background highlight */}
          {weeks.map((w: any, i: number) =>
            w.isCurrent ? (
              <rect
                key={`col-${i}`}
                x={LEFT + i * col + 2}
                y={TOP}
                width={col - 4}
                height={PLOT_H}
                rx={3}
                fill="var(--color-accent)"
                opacity={0.08}
              />
            ) : null
          )}

          {/* Milestone gridlines + labels.
              Reached milestones render in accent; unreached render as dashed gray. */}
          {milestones.map((m, i) => (
            <g key={i}>
              <line
                x1={LEFT}
                x2={width - RIGHT}
                y1={yFor(i + 1)}
                y2={yFor(i + 1)}
                stroke={m.reached ? "var(--color-accent)" : "var(--color-border-subtle)"}
                strokeWidth={m.reached ? 1.5 : 1}
                strokeDasharray={m.reached ? undefined : "3,3"}
                opacity={m.reached ? 0.55 : 0.9}
              />
              <text
                x={LEFT - 8}
                y={yFor(i + 1) + 4}
                textAnchor="end"
                fontSize="10"
                fill={m.reached ? "var(--color-accent)" : "var(--color-text-secondary)"}
                fontWeight={m.reached ? "600" : "400"}
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={LEFT} x2={LEFT} y1={TOP - 4} y2={yFor(0)} stroke="var(--color-text-subtle)" />
          <line
            x1={LEFT}
            x2={width - RIGHT}
            y1={yFor(0)}
            y2={yFor(0)}
            stroke="var(--color-text-subtle)"
          />

          {/* Y-axis baseline label */}
          <text
            x={LEFT - 8}
            y={yFor(0) + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-text-subtle)"
          >
            Start
          </text>

          {/* Week labels — current week in accent + bold */}
          {weeks.map((w: any, i: number) => (
            <text
              key={w.weekNumber}
              x={colX(i)}
              y={yFor(0) + 17}
              textAnchor="middle"
              fontSize="10"
              fill={w.isCurrent ? "var(--color-accent)" : "var(--color-text-secondary)"}
              fontWeight={w.isCurrent ? "700" : "400"}
            >
              {weekLabel(w)}
            </text>
          ))}

          {/* Progress line */}
          {plotted.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Weekly dots with rich tooltips.
              Hollow ring = work submitted/in-progress but not yet approved by admin.
              Filled circle = approved progress recorded. */}
          {plotted.map(({ w, x }: { w: any; x: number }) => {
            const activities: any[] = w.activities ?? [];
            const pendingCount = activities.filter(
              (a: any) => a.status === "submitted" || a.status === "in_progress"
            ).length;
            const hasPendingWork = (w.progressLevel ?? 0) === 0 && pendingCount > 0;
            const cy = yFor(w.progressLevel!);
            const pct = w.completionPercent ?? 0;

            // Milestone name this level corresponds to (floor — "at or past X level").
            const levelFloor = Math.floor(w.progressLevel!);
            const levelName =
              w.progressLevel! >= 1 && milestones[levelFloor - 1]
                ? milestones[levelFloor - 1].label
                : null;

            const tooltip = [
              weekLabel(w),
              w.total > 0 ? `${w.completed}/${w.total} tasks approved` : "No tasks",
              pct > 0 ? `(${pct}%)` : null,
              levelName ? `Level: ${levelName}` : null,
              pendingCount > 0 ? `${pendingCount} pending approval` : null,
              w.isCurrent ? "← Current week" : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return hasPendingWork ? (
              // Hollow ring: work done but awaiting admin approval
              <circle
                key={w.weekNumber}
                cx={x}
                cy={cy}
                r={5}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="3,2"
                opacity={0.6}
              >
                <title>{tooltip}</title>
              </circle>
            ) : (
              // Solid dot: approved progress
              <circle
                key={w.weekNumber}
                cx={x}
                cy={cy}
                r={5}
                fill="var(--color-accent)"
              >
                <title>{tooltip}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
