"use client";

import { useEffect, useRef, useState } from "react";
import { useMyWeeklyGraph } from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

// Two-axis milestone graph: weeks along X, the five milestones up Y, one line
// through each started week's point. Point heights (week.progressLevel) are
// computed server-side from approved tasks only — see weeklyGraphLogic.ts.
// The revenue milestones (levels 4–5) are axis labels only; task progress
// never reaches them.

const LEFT = 64;     // room for the milestone labels
const RIGHT = 12;
const TOP = 12;
const LEVEL_GAP = 32;
const LEVELS = 5;
const PLOT_H = LEVEL_GAP * LEVELS;
const BOTTOM = 26;   // room for the week labels
const MIN_COL = 40;  // below this the chart scrolls horizontally instead of squeezing

const yFor = (level: number) => TOP + PLOT_H - level * LEVEL_GAP;

export default function WeeklyActivityGraph() {
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
  const milestones = [
    s?.batchGraphMilestoneAds ?? "Ads",
    s?.batchGraphMilestoneWebsite ?? "Website",
    s?.batchGraphMilestoneFunnels ?? "Funnels",
    s?.batchGraphMilestoneLakh ?? "1 lakh",
    s?.batchGraphMilestoneCrore ?? "1 crore",
  ];

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
              {`${weekPrefix}${w.weekNumber}`}
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
              <title>{`${weekPrefix}${w.weekNumber}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
