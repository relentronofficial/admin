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

  const weeks = graph!.weeks;
  if (weeks.length === 0) return null;

  const weekPrefix = s?.batchGraphWeekPrefix ?? "W";
  // Y axis bottom → top: the program's configured milestones from the API, or
  // the original five when talking to a backend that predates the config.
  const configured = graph!.config?.milestones;
  const milestones = configured?.length
    ? configured.map((m) => m.label)
    : [
        s?.batchGraphMilestoneAds ?? "Ads",
        s?.batchGraphMilestoneWebsite ?? "Website",
        s?.batchGraphMilestoneFunnels ?? "Funnels",
        s?.batchGraphMilestoneLakh ?? "1 lakh",
        s?.batchGraphMilestoneCrore ?? "1 crore",
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
    .map((w, i) => ({ w, x: colX(i) }))
    .filter(({ w }) => w.progressLevel !== null);
  const linePoints = plotted.map(({ w, x }) => `${x},${yFor(w.progressLevel!)}`).join(" ");

  return (
    <div>
      {header}
      <div
        ref={boxRef}
        className="rounded-xl border p-3 overflow-x-auto"
        style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="block">
          {/* Milestone gridlines + labels */}
          {milestones.map((label, i) => (
            <g key={i}>
              <line
                x1={LEFT} x2={width - RIGHT} y1={yFor(i + 1)} y2={yFor(i + 1)}
                stroke="var(--color-border-subtle)"
              />
              <text x={LEFT - 10} y={yFor(i + 1) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-secondary)">
                {label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={LEFT} x2={LEFT} y1={TOP - 4} y2={yFor(0)} stroke="var(--color-text-subtle)" />
          <line x1={LEFT} x2={width - RIGHT} y1={yFor(0)} y2={yFor(0)} stroke="var(--color-text-subtle)" />

          {/* Week labels */}
          {weeks.map((w, i) => (
            <text key={w.weekNumber} x={colX(i)} y={yFor(0) + 17} textAnchor="middle" fontSize="11" fill="var(--color-text-secondary)">
              {weekLabel(w)}
            </text>
          ))}

          {/* Progress line + weekly points */}
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
          {plotted.map(({ w, x }) => (
            <circle key={w.weekNumber} cx={x} cy={yFor(w.progressLevel!)} r={4} fill="var(--color-accent)">
              <title>{weekLabel(w)}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
