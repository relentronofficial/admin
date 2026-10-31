"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useMyWeeklyGraph, weeklyGraphQueryKey } from "@/lib/hooks/useBatchProgram";
import { getSocket } from "@/lib/socket/client";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WeeklyGraphActivity, WeeklyGraphMilestone, WeeklyGraphWeek } from "@/lib/api/services/batchProgram.service";
import { amountFromRevenueLabel, revenueLevelOnAxis, revenueLinePoints, revenueLinePath } from "./weeklyGraphRevenueAxis";
import { weekLinePoints, weekProgressionPoints } from "./weeklyGraphProgression";

// Two-axis milestone graph: weeks along X, milestones up Y. Everything comes
// from the API (GET /api/user-batch/weekly-graph): the program's admin
// configuration (weeks, milestone labels and order, activities) and this
// member's real data (task statuses, reported revenue). Nothing is hardcoded:
// no milestone labels, no revenue thresholds.
//
//  • one marker per activity, on its week and on the row of the milestone it is
//    linked to (unlinked activities sit on the baseline). A marker's position
//    never means "achieved" — its fill shows the activity's own status;
//  • a diamond where a revenue milestone was reached (from reported revenue
//    against the admin threshold, or an admin record);
//  • ONE red line: task progress, from Start through each started week's
//    progress (week.progressLevel), rising and falling (weeklyGraphProgression.ts);
//  • a red-ring / white-centre point for each week with saved revenue
//    (week.revenue), at its actual amount on this same axis — not a line
//    (revenueLevelOnAxis). A week with nothing saved has no point (never ₹0).
// The graph refreshes live when the admin changes tasks, progress or revenue
// (socket batch:graph_updated / batch:day_approved / batch:day_rejected).
// Every marker is a keyboard-focusable button that opens a popup with the
// Week, Milestone and Activity.

const LEFT = 76;     // room for the milestone labels
const RIGHT = 16;
const TOP = 16;
const LEVEL_GAP = 36;
const BOTTOM = 28;   // room for the week labels
const MIN_COL = 64;  // below this the chart scrolls horizontally instead of squeezing
const R = 6;         // marker radius
const POP_W = 240;   // popup width
const BOX_PAD = 12;  // the chart box's p-3 padding

/** Admin can hide the graph (Settings → Navigation → Platform Sections → "weekly_graph"). */
export const WEEKLY_GRAPH_MENU_KEY = "weekly_graph";

/** Backend events to this member's room that mean the graph or revenue changed. */
export const GRAPH_REFRESH_EVENTS = ["batch:graph_updated", "batch:day_approved", "batch:day_rejected"] as const;

export default function WeeklyActivityGraph() {
  const { hiddenMenuKeys } = useSiteConfig();
  // Hidden by the admin: render nothing and don't fetch the graph at all.
  if ((hiddenMenuKeys ?? []).includes(WEEKLY_GRAPH_MENU_KEY)) return null;
  return <WeeklyActivityGraphContent />;
}

type Selection =
  | { kind: "activity"; key: string; week: WeeklyGraphWeek; activity: WeeklyGraphActivity; x: number; y: number }
  | { kind: "revenue"; key: string; week: WeeklyGraphWeek; milestone: WeeklyGraphMilestone; x: number; y: number };

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

function WeeklyActivityGraphContent() {
  const { data: graph, isLoading, isError } = useMyWeeklyGraph();
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;
  const queryClient = useQueryClient();

  // Live sync with the admin: when an admin approves/rejects a day, edits tasks or
  // progress, or saves this member's revenue, the backend tells the member's own
  // socket room. Refetch the graph and the revenue figures from the same APIs —
  // nothing is computed or stored here.
  useEffect(() => {
    let alive = true;
    let sock: Socket | null = null;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: weeklyGraphQueryKey });
      queryClient.invalidateQueries({ queryKey: ["user", "mentorship-revenue"] });
    };
    getSocket().then((s) => {
      if (!alive) return;
      sock = s;
      for (const e of GRAPH_REFRESH_EVENTS) s.on(e, refresh);
    }).catch(() => { /* no socket: the next page load is still correct */ });
    return () => {
      alive = false;
      if (sock) for (const e of GRAPH_REFRESH_EVENTS) sock.off(e, refresh);
    };
  }, [queryClient]);

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
  // The Y axis is exactly the configured milestones (bottom → top); nothing is filled in here.
  const milestones: WeeklyGraphMilestone[] = Array.isArray(graph!.config?.milestones) ? graph!.config!.milestones : [];
  const levels = Math.max(milestones.length, 1);

  const PLOT_H = LEVEL_GAP * levels;
  const yFor = (level: number) => TOP + PLOT_H - Math.min(Math.max(level, 0), levels) * LEVEL_GAP;
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

  // Activity markers: grouped by (week, level) and spread across the column so
  // several activities in one week stay individually reachable.
  type Marker = {
    key: string; x: number; y: number; week: WeeklyGraphWeek; activity: WeeklyGraphActivity;
    weekIndex: number; order: number; level: number;
  };
  const markers: Marker[] = [];
  weeks.forEach((w, i) => {
    const byLevel = new Map<number, Array<{ a: WeeklyGraphActivity; order: number }>>();
    (w.activities ?? []).forEach((a, order) => {
      const level = typeof a.level === "number" ? a.level : 0;
      byLevel.set(level, [...(byLevel.get(level) ?? []), { a, order }]);
    });
    byLevel.forEach((acts, level) => {
      const step = Math.min(2 * R + 4, (col - 2 * R - 8) / Math.max(acts.length - 1, 1));
      acts.forEach(({ a, order }, k) => {
        markers.push({
          key: `a:${w.weekNumber}:${a.taskId}`,
          x: colX(i) + (k - (acts.length - 1) / 2) * step,
          y: yFor(level),
          week: w,
          activity: a,
          weekIndex: i,
          order,
          level,
        });
      });
    });
  });

  // Revenue milestone markers: where a revenue milestone was reached, on its row.
  type RevenueMarker = { key: string; x: number; y: number; week: WeeklyGraphWeek; milestone: WeeklyGraphMilestone };
  const revenueMarkers: RevenueMarker[] = [];
  milestones.forEach((m, idx) => {
    if (m.kind !== "revenue" || !m.reached || !m.reachedWeek) return;
    const wi = weeks.findIndex((w) => w.weekNumber === m.reachedWeek);
    if (wi < 0) return;
    revenueMarkers.push({ key: `r:${m.id ?? idx}`, x: colX(wi), y: yFor(idx + 1), week: weeks[wi], milestone: m });
  });

  // The ONE red line: task progress. One point per started week at its measured
  // progress (week.progressLevel from the API — approved work, milestone links,
  // admin records), and the line runs from Start through each started week's
  // highest visible dot, rising and falling week to week (weeklyGraphProgression.ts).
  // Recomputed on every render, so it follows refreshed data and configuration.
  const progression = weekProgressionPoints(weeks, colX, yFor);
  const linePts = weekLinePoints(weeks, colX, yFor);
  const linePoints = linePts.length > 0
    ? [`M ${LEFT},${yFor(0)}`, ...linePts.map((p) => `L ${p.x},${p.y}`)].join(" ")
    : null;
  const progressTitle = (w: WeeklyGraphWeek) =>
    `${weekLabel(w)}: ${w.completed ?? 0} of ${w.total ?? 0} ${s?.batchGraphTasksApproved ?? "tasks approved"}`;

  // Revenue points (not a line): one per week with saved revenue, at its actual
  // amount on this axis — ₹0 at Start, each revenue milestone's amount on its own
  // row, proportional in between. A row's amount is its admin threshold, or, when
  // none is set (e.g. the built-in "1 lakh" / "5 Lakhs" / "1 crore" rows), the
  // amount its label names. A week with nothing saved has no point.
  const thresholds = milestones.map((m) =>
    m.kind === "revenue" ? (typeof m.threshold === "number" && m.threshold > 0 ? m.threshold : amountFromRevenueLabel(m.label)) : null);
  const revenuePoints = revenueLevelOnAxis(0, thresholds) === null
    ? [] // no revenue row with an amount: nothing to read an amount against
    : revenueLinePoints(weeks, colX, (v) => yFor(revenueLevelOnAxis(v, thresholds)!));
  const revenueTitle = (w: WeeklyGraphWeek, revenue: number) =>
    `${weekLabel(w)}: ${inr(revenue)} ${s?.batchGraphRevenueGenerated ?? "revenue generated"}`;

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

          {/* Milestone gridlines: always subtle and dashed, so the red progress line is the
              only red line on the chart. A reached milestone shows through its accent label. */}
          {milestones.map((m, i) => (
            <g key={m.id ?? `m${i}`} aria-hidden="true">
              <line x1={LEFT} x2={width - RIGHT} y1={yFor(i + 1)} y2={yFor(i + 1)}
                stroke="var(--color-border-subtle)" strokeWidth={1} strokeDasharray="3,3" opacity={0.9} />
              <text data-testid="milestone-label" x={LEFT - 8} y={yFor(i + 1) + 4} textAnchor="end" fontSize="11"
                fill={m.reached ? "var(--color-accent)" : "var(--color-text-secondary)"} fontWeight={m.reached ? "600" : "400"}>
                {m.label}
              </text>
            </g>
          ))}

          {/* Axes + baseline label */}
          <g aria-hidden="true">
            <line x1={LEFT} x2={LEFT} y1={TOP - 6} y2={yFor(0)} stroke="var(--color-text-subtle)" />
            <line x1={LEFT} x2={width - RIGHT} y1={yFor(0)} y2={yFor(0)} stroke="var(--color-text-subtle)" />
            <text x={LEFT - 8} y={yFor(0) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-subtle)">
              {s?.batchGraphStartLabel ?? "Start"}
            </text>
          </g>


          {/* Week labels — current week in accent + bold */}
          {weeks.map((w, i) => (
            <text key={`wl-${w.weekNumber}`} data-testid="week-label" x={colX(i)} y={yFor(0) + 18} textAnchor="middle" fontSize="11"
              aria-hidden="true" fill={w.isCurrent ? "var(--color-accent)" : "var(--color-text-secondary)"} fontWeight={w.isCurrent ? "700" : "400"}>
              {weekLabel(w)}
            </text>
          ))}

          {/* The one red line (task progress) + one dot per week's progress point — drawn
              before the task markers (as originally) so the markers keep their exact look
              on top of the line; it ignores the pointer. */}
          {linePoints && (
            <path data-testid="progress-line" d={linePoints} fill="none" stroke="var(--color-accent, #dc2626)"
              strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" pointerEvents="none" />
          )}
          {progression.map((p) => (
            <circle key={`pp-${p.weekNumber}`} data-testid="progress-point" cx={p.x} cy={p.y} r={2.5}
              fill="var(--color-accent, #dc2626)" stroke="var(--color-bg-surface)" strokeWidth={1.5} pointerEvents="none">
              <title>{progressTitle(weeks[p.weekIndex])}</title>
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

          {/* Revenue milestone markers (diamond) */}
          {revenueMarkers.map((m) => {
            const sel: Selection = { kind: "revenue", key: m.key, week: m.week, milestone: m.milestone, x: m.x, y: m.y };
            const d = R + 2;
            return (
              <g
                key={m.key}
                role="button"
                tabIndex={0}
                aria-label={`${weekLabel(m.week)}, ${m.milestone.label}, ${s?.batchGraphRevenueReached ?? "revenue milestone reached"}`}
                aria-haspopup="dialog"
                aria-expanded={selected?.key === m.key}
                data-testid="revenue-marker"
                className="cursor-pointer outline-none"
                onClick={(e) => open(sel, e.currentTarget)}
                onKeyDown={(e) => keyOpen(e, sel)}
                onFocus={() => setFocusedKey(m.key)}
                onBlur={() => setFocusedKey((k) => (k === m.key ? null : k))}
              >
                {focusRing(m.key, m.x, m.y, d)}
                <path d={`M ${m.x} ${m.y - d} L ${m.x + d} ${m.y} L ${m.x} ${m.y + d} L ${m.x - d} ${m.y} Z`}
                  fill="var(--color-success, #22c55e)" stroke="var(--color-bg-surface)" strokeWidth={1.5} />
                <circle cx={m.x} cy={m.y} r={d + 6} fill="transparent" />
              </g>
            );
          })}

          {/* Revenue line: connects consecutive reported weeks with a dashed line */}
          {(() => {
            const path = revenueLinePath(revenuePoints);
            return path ? (
              <path data-testid="revenue-line" d={path} fill="none"
                stroke="var(--color-accent, #dc2626)" strokeWidth={1.5}
                strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round"
                opacity={0.55} aria-hidden="true" pointerEvents="none" />
            ) : null;
          })()}

          {/* Revenue points: white centre with a solid red ring, so they can't be
              mistaken for task-status markers (filled, dashed or grey ring) */}
          {revenuePoints.map((p) => (
            <circle key={`rp-${p.weekNumber}`} data-testid="revenue-point" cx={p.x} cy={p.y} r={4.5}
              fill="#ffffff" stroke="var(--color-accent, #dc2626)" strokeWidth={2.5}>
              <title>{revenueTitle(weeks[p.weekIndex], p.revenue)}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }} aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />{statusLabel.completed}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed" style={{ borderColor: "var(--color-accent)" }} />{statusLabel.submitted}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--color-text-subtle)" }} />{statusLabel.not_started}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--color-accent, #dc2626)", background: "#ffffff" }} />{s?.batchGraphRevenueLineLegend ?? "Weekly revenue"}</span>
        {revenueMarkers.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45" style={{ background: "var(--color-success, #22c55e)" }} />
            {s?.batchGraphRevenueReachedLegend ?? "Revenue milestone reached"}
          </span>
        )}
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
            <dd className="font-semibold">
              {selected.kind === "activity" ? selected.activity.milestoneLabel ?? noMilestone : selected.milestone.label}
            </dd>
            {selected.kind === "activity" ? (
              <>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphActivityField ?? "Activity"}</dt>
                <dd className="font-semibold break-words">{selected.activity.title}</dd>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphStatusField ?? "Status"}</dt>
                <dd>{statusLabel[selected.activity.status] ?? selected.activity.status}</dd>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphDayField ?? "Day"}</dt>
                <dd>{selected.activity.dayNumber}</dd>
              </>
            ) : (
              <>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphReachedField ?? "Reached"}</dt>
                <dd>
                  {selected.milestone.reachedBy === "record"
                    ? s?.batchGraphReachedByRecord ?? "Recorded by your mentor"
                    : s?.batchGraphReachedByRevenue ?? "From your reported revenue"}
                </dd>
                {selected.milestone.threshold != null && (
                  <>
                    <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphThresholdField ?? "Target"}</dt>
                    <dd>{inr(selected.milestone.threshold)}</dd>
                  </>
                )}
                {selected.week.cumulativeRevenue != null && (
                  <>
                    <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphRevenueField ?? "Revenue by then"}</dt>
                    <dd>
                      {inr(selected.week.cumulativeRevenue)}{" "}
                      <span style={{ color: "var(--color-text-subtle)" }}>({s?.batchGraphSelfReported ?? "self-reported"})</span>
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
