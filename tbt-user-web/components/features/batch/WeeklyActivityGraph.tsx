"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useMyWeeklyGraph } from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WeeklyGraphActivity, WeeklyGraphWeek } from "@/lib/api/services/batchProgram.service";
import { revenueAxisLabel, revenueAxisTicks, revenueAxisTop, revenueLinePath, revenueLinePoints } from "./weeklyGraphRevenueAxis";

// Revenue graph: weeks along X, Revenue Generated (₹) up Y. Everything comes
// from the API (GET /api/user-batch/weekly-graph): the program's weeks and
// activities and this member's real data (task statuses, reported revenue).
//
//  • a red line through each week's reported revenue (week.revenue — the
//    "Revenue Generated" figures placed on that program week), on a linear ₹
//    scale, rising and falling week to week; a week with nothing reported is a
//    gap, never ₹0 (weeklyGraphRevenueAxis.ts);
//  • one marker per activity in its week, in a row on the ₹0 baseline; its fill
//    shows the activity's own status.
// Every marker is a keyboard-focusable button that opens a popup with the
// Week, Milestone and Activity.

const LEFT = 76;     // room for the ₹ axis labels
const RIGHT = 16;
const TOP = 16;
const LEVEL_GAP = 36;
const PLOT_LEVELS = 6; // plot height in LEVEL_GAP units
const BOTTOM = 28;   // room for the week labels
const MIN_COL = 64;  // below this the chart scrolls horizontally instead of squeezing
const R = 6;         // marker radius
const POP_W = 240;   // popup width
const BOX_PAD = 12;  // the chart box's p-3 padding

/** Admin can hide the graph (Settings → Navigation → Platform Sections → "weekly_graph"). */
export const WEEKLY_GRAPH_MENU_KEY = "weekly_graph";

export default function WeeklyActivityGraph() {
  const { hiddenMenuKeys } = useSiteConfig();
  // Hidden by the admin: render nothing and don't fetch the graph at all.
  if ((hiddenMenuKeys ?? []).includes(WEEKLY_GRAPH_MENU_KEY)) return null;
  return <WeeklyActivityGraphContent />;
}

type Selection = { kind: "activity"; key: string; week: WeeklyGraphWeek; activity: WeeklyGraphActivity; x: number; y: number };

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

function WeeklyActivityGraphContent() {
  const { data: graph, isLoading, isError } = useMyWeeklyGraph();
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;

  // Lay out in real pixels from the container width so labels stay a constant,
  // readable size on every screen.
  const outerRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const returnFocusRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph]);

  const close = useCallback((restoreFocus = true) => {
    setSelected(null);
    if (restoreFocus) returnFocusRef.current?.focus();
  }, []);

  // Escape or a click outside closes the popup; scrolling the chart closes it
  // too, since the popup is positioned for the marker's current place.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onDown = (e: MouseEvent) => {
      if (outerRef.current && !outerRef.current.contains(e.target as Node)) close(false);
    };
    const box = boxRef.current;
    const onScroll = () => close(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    box?.addEventListener("scroll", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      box?.removeEventListener("scroll", onScroll);
    };
  }, [selected, close]);

  // A refreshed graph (admin edit, new revenue) may no longer contain the selected marker.
  useEffect(() => { setSelected(null); }, [graph]);

  if (isLoading) {
    return <div className="h-48 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay-md)" }} />;
  }
  // Not in a batch — the page already handles that state.
  if (!isError && !graph) return null;

  const title = s?.batchGraphTitle ?? "Weekly Activity Graph";
  const header = <h3 className="text-sm font-semibold opacity-60 uppercase tracking-widest mb-3">{title}</h3>;
  const notice = (text: string) => (
    <div>
      {header}
      <p className="text-sm text-muted-foreground rounded-xl border p-4" style={{ borderColor: "var(--color-border-subtle)" }}>{text}</p>
    </div>
  );

  if (isError) return notice(s?.batchGraphError ?? "Could not load your weekly graph.");

  const weeks: WeeklyGraphWeek[] = Array.isArray(graph!.weeks) ? graph!.weeks : [];
  if (weeks.length === 0) return notice(s?.batchGraphNoWeeks ?? "No weeks have been set up for your program yet.");

  const weekPrefix = s?.batchGraphWeekPrefix ?? "W";
  const weekLabel = (w: WeeklyGraphWeek) => w.label || `${weekPrefix}${w.weekNumber}`;
  // The Y axis is Revenue Generated (₹), linear from ₹0 to the smallest axis
  // step covering the best week; it is recomputed from the API data every render.
  const PLOT_H = LEVEL_GAP * PLOT_LEVELS;
  const revTop = revenueAxisTop(weeks.map((w) => w.revenue));
  const yRev = (v: number) => TOP + PLOT_H - (Math.min(Math.max(v, 0), revTop) / revTop) * PLOT_H;
  const baseY = yRev(0);
  const ticks = revenueAxisTicks(revTop, PLOT_H);
  const col = Math.max(MIN_COL, (boxWidth - LEFT - RIGHT) / weeks.length || 0);
  const width = LEFT + weeks.length * col + RIGHT;
  const height = TOP + PLOT_H + BOTTOM;
  const colX = (i: number) => LEFT + i * col + col / 2;

  const statusLabel: Record<string, string> = {
    completed: s?.batchGraphStatusCompleted ?? "Completed",
    submitted: s?.batchGraphStatusSubmitted ?? "Awaiting approval",
    needs_revision: s?.batchGraphStatusNeedsRevision ?? "Needs revision",
    in_progress: s?.batchGraphStatusInProgress ?? "In progress",
    not_started: s?.batchGraphStatusNotStarted ?? "Not started",
    upcoming: s?.batchGraphStatusUpcoming ?? "Upcoming",
  };
  const noMilestone = s?.batchGraphNoMilestone ?? "No milestone";

  // Activity markers: each week's activities in a row on the ₹0 baseline, spread
  // across the column so several in one week stay individually reachable.
  type Marker = { key: string; x: number; y: number; week: WeeklyGraphWeek; activity: WeeklyGraphActivity };
  const markers: Marker[] = [];
  weeks.forEach((w, i) => {
    const acts = w.activities ?? [];
    const step = Math.min(2 * R + 4, (col - 2 * R - 8) / Math.max(acts.length - 1, 1));
    acts.forEach((a, k) => {
      markers.push({ key: `a:${w.weekNumber}:${a.taskId}`, x: colX(i) + (k - (acts.length - 1) / 2) * step, y: baseY, week: w, activity: a });
    });
  });

  // Red line: one point per week at its reported revenue, joined week to week;
  // a week with nothing reported breaks the line (weeklyGraphRevenueAxis.ts).
  const revenuePts = revenueLinePoints(weeks, colX, yRev);
  const linePoints = revenueLinePath(revenuePts);
  const revenueTitle = (w: WeeklyGraphWeek, v: number) =>
    `${weekLabel(w)}: ${inr(v)} ${s?.batchGraphRevenueGenerated ?? "revenue generated"}`;

  const summary = graph!.summary ?? { total: 0, completed: 0, completionPercent: null };
  const revenueTotal = graph!.revenue?.totalToDate ?? null;

  const open = (sel: Selection, el: SVGGElement) => {
    returnFocusRef.current = el;
    setSelected((cur) => (cur?.key === sel.key ? null : sel));
  };
  const keyOpen = (e: React.KeyboardEvent<SVGGElement>, sel: Selection) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(sel, e.currentTarget);
    }
  };

  // Popup position: the marker's place inside the scrolled chart, relative to
  // the outer box; flipped below the marker near the top and kept inside the box.
  const popup = (() => {
    if (!selected) return null;
    const box = boxRef.current;
    const outerW = outerRef.current?.clientWidth ?? 0;
    const offsetX = (box?.offsetLeft ?? 0) + (box?.clientLeft ?? 0) + BOX_PAD - (box?.scrollLeft ?? 0);
    const offsetY = (box?.offsetTop ?? 0) + (box?.clientTop ?? 0) + BOX_PAD;
    const left = outerW > 0
      ? Math.min(Math.max(selected.x + offsetX - POP_W / 2, 0), Math.max(outerW - POP_W, 0))
      : 0;
    const below = selected.y < 110;
    const top = below ? selected.y + offsetY + R + 8 : selected.y + offsetY - R - 8;
    return { left, top, below };
  })();

  const markerStyle = (a: WeeklyGraphActivity) => {
    switch (a.status) {
      case "completed": return { fill: "var(--color-accent)", stroke: "var(--color-accent)", dash: undefined };
      case "submitted":
      case "in_progress": return { fill: "var(--color-bg-surface)", stroke: "var(--color-accent)", dash: "3,2" };
      case "needs_revision": return { fill: "var(--color-bg-surface)", stroke: "var(--color-alert, #f59e0b)", dash: undefined };
      default: return { fill: "var(--color-bg-surface)", stroke: "var(--color-text-subtle)", dash: undefined };
    }
  };

  const focusRing = (key: string, x: number, y: number, r: number) =>
    focusedKey === key || selected?.key === key
      ? <circle cx={x} cy={y} r={r + 4} fill="none" stroke="var(--color-text-normal)" strokeWidth={2} />
      : null;

  return (
    <div ref={outerRef} className="relative">
      {header}

      {/* Summary: approved tasks, and the reported revenue the revenue milestones use */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        <span>
          {summary.completed} of {summary.total} {s?.batchGraphTasksApproved ?? "tasks approved"}
        </span>
        {revenueTotal !== null && (
          <span data-testid="revenue-total">
            {s?.batchGraphRevenueToDate ?? "Reported revenue to date"}:{" "}
            <strong style={{ color: "var(--color-text-normal)" }}>{inr(revenueTotal)}</strong>
          </span>
        )}
      </div>

      <div
        ref={boxRef}
        className="rounded-xl border p-3 overflow-x-auto"
        style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title} className="block">
          {/* Current week column highlight */}
          {weeks.map((w, i) =>
            w.isCurrent ? (
              <rect key={`col-${w.weekNumber}`} x={LEFT + i * col + 2} y={TOP - 6} width={col - 4} height={PLOT_H + 6} rx={3}
                fill="var(--color-accent)" opacity={0.08} aria-hidden="true" />
            ) : null,
          )}

          {/* ₹ gridlines: always subtle and dashed, so the red revenue line is the
              only red line on the chart. */}
          {ticks.filter((v) => v > 0).map((v) => (
            <g key={`t${v}`} aria-hidden="true">
              <line x1={LEFT} x2={width - RIGHT} y1={yRev(v)} y2={yRev(v)}
                stroke="var(--color-border-subtle)" strokeWidth={1} strokeDasharray="3,3" opacity={0.9} />
              <text data-testid="revenue-axis-label" x={LEFT - 8} y={yRev(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-secondary)">
                {revenueAxisLabel(v)}
              </text>
            </g>
          ))}

          {/* Axes + ₹0 baseline label */}
          <g aria-hidden="true">
            <line x1={LEFT} x2={LEFT} y1={TOP - 6} y2={baseY} stroke="var(--color-text-subtle)" />
            <line x1={LEFT} x2={width - RIGHT} y1={baseY} y2={baseY} stroke="var(--color-text-subtle)" />
            <text data-testid="revenue-axis-label" x={LEFT - 8} y={baseY + 4} textAnchor="end" fontSize="11" fill="var(--color-text-subtle)">
              {revenueAxisLabel(0)}
            </text>
          </g>

          {/* Week labels — current week in accent + bold */}
          {weeks.map((w, i) => (
            <text key={`wl-${w.weekNumber}`} data-testid="week-label" x={colX(i)} y={baseY + 18} textAnchor="middle" fontSize="11"
              aria-hidden="true" fill={w.isCurrent ? "var(--color-accent)" : "var(--color-text-secondary)"} fontWeight={w.isCurrent ? "700" : "400"}>
              {weekLabel(w)}
            </text>
          ))}

          {/* Revenue line + one dot per week's reported revenue (drawn before
              the activity markers so those stay on top) */}
          {linePoints && (
            <path data-testid="progress-line" d={linePoints} fill="none" stroke="var(--color-accent, #dc2626)"
              strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />
          )}
          {revenuePts.map((p) => (
            <circle key={`pp-${p.weekNumber}`} data-testid="progress-point" cx={p.x} cy={p.y} r={2.5}
              fill="var(--color-accent, #dc2626)" stroke="var(--color-bg-surface)" strokeWidth={1.5}>
              <title>{revenueTitle(weeks[p.weekIndex], p.revenue)}</title>
            </circle>
          ))}

          {/* Activity markers */}
          {markers.map((m) => {
            const st = markerStyle(m.activity);
            const msLabel = m.activity.milestoneLabel ?? noMilestone;
            const sel: Selection = { kind: "activity", key: m.key, week: m.week, activity: m.activity, x: m.x, y: m.y };
            return (
              <g
                key={m.key}
                role="button"
                tabIndex={0}
                aria-label={`${weekLabel(m.week)}, ${msLabel}, ${m.activity.title}, ${statusLabel[m.activity.status] ?? m.activity.status}`}
                aria-haspopup="dialog"
                aria-expanded={selected?.key === m.key}
                data-testid="activity-marker"
                className="cursor-pointer outline-none"
                onClick={(e) => open(sel, e.currentTarget)}
                onKeyDown={(e) => keyOpen(e, sel)}
                onFocus={() => setFocusedKey(m.key)}
                onBlur={() => setFocusedKey((k) => (k === m.key ? null : k))}
              >
                {focusRing(m.key, m.x, m.y, R)}
                <circle cx={m.x} cy={m.y} r={R} fill={st.fill} stroke={st.stroke} strokeWidth={2} strokeDasharray={st.dash} />
                {/* Larger invisible hit area for touch */}
                <circle cx={m.x} cy={m.y} r={R + 6} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }} aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />{statusLabel.completed}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed" style={{ borderColor: "var(--color-accent)" }} />{statusLabel.submitted}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--color-text-subtle)" }} />{statusLabel.not_started}</span>
      </div>

      {/* Popup: Week, Milestone, Activity */}
      {selected && popup && (
        <div
          role="dialog"
          aria-label={s?.batchGraphDetailsLabel ?? "Activity details"}
          className="absolute z-20 rounded-xl border shadow-xl p-3 text-xs"
          style={{
            left: popup.left,
            top: popup.top,
            width: POP_W,
            maxWidth: "100%",
            transform: popup.below ? undefined : "translateY(-100%)",
            background: "var(--color-modal-bg, var(--color-bg-surface))",
            borderColor: "var(--color-border-subtle)",
            color: "var(--color-text-normal)",
          }}
        >
          <button
            type="button"
            onClick={() => close()}
            aria-label={s?.batchGraphClose ?? "Close"}
            className="absolute top-2 right-2 p-1 rounded-md opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2"
          >
            <X size={14} />
          </button>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 pr-5">
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphWeekField ?? "Week"}</dt>
            <dd className="font-semibold">{weekLabel(selected.week)}</dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphMilestoneField ?? "Milestone"}</dt>
            <dd className="font-semibold">{selected.activity.milestoneLabel ?? noMilestone}</dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphActivityField ?? "Activity"}</dt>
            <dd className="font-semibold break-words">{selected.activity.title}</dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphStatusField ?? "Status"}</dt>
            <dd>{statusLabel[selected.activity.status] ?? selected.activity.status}</dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphDayField ?? "Day"}</dt>
            <dd>{selected.activity.dayNumber}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
