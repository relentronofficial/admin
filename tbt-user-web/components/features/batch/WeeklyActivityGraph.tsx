"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useMyWeeklyGraph, weeklyGraphQueryKey } from "@/lib/hooks/useBatchProgram";
import { getSocket } from "@/lib/socket/client";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WeeklyGraphActivity, WeeklyGraphMilestone, WeeklyGraphWeek } from "@/lib/api/services/batchProgram.service";
import { achievementPoints, straightProgressionPath, type ProgressionPoint } from "./weeklyGraphProgression";

// Weekly growth graph (the member's hand-drawn reference design): weeks along
// the bottom (X), business milestones up the left (Y), and ONE line that starts
// at the bottom-left origin (week 0) and climbs in straight segments through a
// circular marker at each week where a new milestone level was achieved.
//
// Everything comes from GET /api/user-batch/weekly-graph — nothing is hardcoded
// or invented:
//  • the Y axis is the program's admin-configured milestones (bottom → top);
//  • the X axis is the program's weeks (13 for a 90-day program);
//  • a point is plotted only from week.progressLevel, which the backend builds
//    from admin-APPROVED work, reported revenue against the admin thresholds and
//    admin/mentor records. Pending, in-progress and upcoming work never lifts it.
//    A point marks a week where that confirmed progress reached a new high
//    (achievementPoints), so the line only ever rises.
// Hovering a marker (mouse) shows its popup; a click / tap / Enter pins it. The
// popup shows the week, milestone, status and the week's progress and revenue.
// No week is highlighted. The graph refreshes live when the admin approves work
// or saves revenue (socket batch:graph_updated / batch:day_approved / batch:day_rejected).

const LEFT = 76;     // room for the milestone labels
const RIGHT = 16;
const TOP = 20;
const LEVEL_GAP = 40;
const BOTTOM = 30;   // room for the week labels
const MIN_COL = 44;  // below this the chart scrolls horizontally instead of squeezing
const R = 6;         // marker radius
const POP_W = 230;   // popup width
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

// A milestone the admin set up for a week (an activity linked to a milestone in
// Admin → Weekly Graph) that is not approved yet: shown as a hollow marker on
// its week and milestone row — never on the line, never counted as achieved.
type Planned = { key: string; weekIndex: number; level: number; x: number; y: number; activities: WeeklyGraphActivity[]; awaiting: boolean };

// `pinned` = opened by click / tap / keyboard (stays until closed); otherwise a
// mouse-hover preview that closes when the pointer leaves the marker.
type Selection = { key: string; x: number; y: number; week: WeeklyGraphWeek; pinned: boolean } & (
  | { kind: "point"; point: ProgressionPoint }
  | { kind: "planned"; planned: Planned }
);

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

function WeeklyActivityGraphContent() {
  const { data: graph, isLoading, isError } = useMyWeeklyGraph();
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;
  const queryClient = useQueryClient();

  // Live sync with the admin: refetch the graph and the revenue figures from the
  // same APIs when the backend says something changed — nothing is computed or
  // stored here.
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

  // A refreshed graph (admin approval, new revenue) may no longer contain the selected point.
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
  // Week n sits at the centre of column n; the Y axis (x = LEFT) is week 0.
  const colX = (i: number) => LEFT + i * col + col / 2;
  const originY = yFor(0);

  // The growth line: backend-confirmed progress only, a point per new high.
  const points = achievementPoints(weeks, colX, yFor);
  const linePath = straightProgressionPath(points, LEFT, originY);

  // Planned milestones: the admin's milestone-linked activities that are not
  // approved yet, one hollow marker per (week, milestone row). A spot already
  // holding an achievement point shows only the achievement.
  const planned: Planned[] = [];
  weeks.forEach((w, i) => {
    const byLevel = new Map<number, WeeklyGraphActivity[]>();
    for (const a of w.activities ?? []) {
      const level = typeof a.level === "number" ? a.level : 0;
      if (level < 1 || level > levels || a.status === "completed") continue;
      byLevel.set(level, [...(byLevel.get(level) ?? []), a]);
    }
    byLevel.forEach((acts, level) => {
      if (points.some((p) => p.weekIndex === i && Math.abs(p.level - level) < 1e-9)) return;
      planned.push({
        key: `pl:${w.weekNumber}:${level}`, weekIndex: i, level, x: colX(i), y: yFor(level), activities: acts,
        awaiting: acts.some((a) => a.status === "submitted" || a.status === "in_progress"),
      });
    });
  });

  // The milestone a height corresponds to: the row it has reached (between two
  // rows — e.g. revenue on its way from 1 Lakh to 5 Lakhs — the lower one).
  const rowOf = (level: number) => Math.floor(level + 1e-9);
  const milestoneOf = (level: number): WeeklyGraphMilestone | null => {
    const row = rowOf(level);
    return row >= 1 && row <= milestones.length ? milestones[row - 1] : null;
  };
  const statusOf = (p: ProgressionPoint) => {
    const m = milestoneOf(p.level);
    if (m?.reached && m.reachedWeek === p.weekNumber) {
      if (m.reachedBy === "record") return s?.batchGraphReachedByRecord ?? "Recorded by your mentor";
      if (m.reachedBy === "revenue") return s?.batchGraphReachedByRevenue ?? "From your reported revenue";
    }
    return s?.batchGraphStatusApproved ?? "Completed — approved";
  };
  const pointLabel = (p: ProgressionPoint, w: WeeklyGraphWeek) =>
    `${weekLabel(w)}, ${milestoneOf(p.level)?.label ?? ""}, ${statusOf(p)}`;

  const summary = graph!.summary ?? { total: 0, completed: 0, completionPercent: null };
  const revenueTotal = graph!.revenue?.totalToDate ?? null;

  // Click / tap / keyboard pins the popup (again on a pinned marker closes it);
  // a mouse hover only previews it.
  const open = (sel: Selection, el: SVGGElement) => {
    returnFocusRef.current = el;
    setSelected((cur) => (cur?.key === sel.key && cur.pinned ? null : { ...sel, pinned: true }));
  };
  /** Shared props that make a marker a button with a hover / click popup. */
  const markerProps = (sel: Selection, label: string, testId: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": selected?.key === sel.key,
    "data-testid": testId,
    className: "cursor-pointer outline-none",
    onClick: (e: React.MouseEvent<SVGGElement>) => open(sel, e.currentTarget),
    onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(sel, e.currentTarget); }
    },
    onPointerEnter: (e: React.PointerEvent<SVGGElement>) => {
      if (e.pointerType !== "mouse") return; // touch: the tap (click) opens it
      setSelected((cur) => (cur?.pinned ? cur : sel));
    },
    onPointerLeave: () => setSelected((cur) => (cur && !cur.pinned && cur.key === sel.key ? null : cur)),
    onFocus: () => setFocusedKey(sel.key),
    onBlur: () => setFocusedKey((k) => (k === sel.key ? null : k)),
  });

  const statusLabel: Record<string, string> = {
    completed: s?.batchGraphStatusCompleted ?? "Completed",
    submitted: s?.batchGraphStatusSubmitted ?? "Awaiting approval",
    needs_revision: s?.batchGraphStatusNeedsRevision ?? "Needs revision",
    in_progress: s?.batchGraphStatusInProgress ?? "In progress",
    not_started: s?.batchGraphStatusNotStarted ?? "Not started",
    upcoming: s?.batchGraphStatusUpcoming ?? "Upcoming",
  };
  const plannedStatus = (pl: Planned) => pl.awaiting
    ? s?.batchGraphPlannedAwaiting ?? "Awaiting approval — not counted yet"
    : s?.batchGraphPlannedStatus ?? "Planned — not completed yet";
  const plannedLabel = (pl: Planned, w: WeeklyGraphWeek) =>
    `${weekLabel(w)}, ${milestoneOf(pl.level)?.label ?? ""}, ${plannedStatus(pl)}`;

  // Popup position: the marker's place inside the scrolled chart, relative to
  // the outer box. The line only climbs up and to the right, so the empty space
  // is below-right of a point (under the next segment) and above-left of it
  // (over the previous one): the popup goes there, never across the line.
  const popup = (() => {
    if (!selected) return null;
    const box = boxRef.current;
    const outerW = outerRef.current?.clientWidth ?? 0;
    const offsetX = (box?.offsetLeft ?? 0) + (box?.clientLeft ?? 0) + BOX_PAD - (box?.scrollLeft ?? 0);
    const offsetY = (box?.offsetTop ?? 0) + (box?.clientTop ?? 0) + BOX_PAD;
    const px = selected.x + offsetX;
    const py = selected.y + offsetY;
    const gap = R + 8;
    const fitsRight = outerW === 0 || px + gap + POP_W <= outerW;
    const fitsLeft = px - gap - POP_W >= 0;
    if (fitsRight) return { left: px + gap, top: py + gap / 2, transform: undefined };
    if (fitsLeft) return { left: px - gap - POP_W, top: py - gap / 2, transform: "translateY(-100%)" };
    // Narrow screens (no room beside the point): just under the chart box, lined
    // up with the point and kept inside — it never covers the plot.
    const left = Math.min(Math.max(px - POP_W / 2, 0), Math.max(outerW - POP_W, 0));
    return { left, top: offsetY + height + BOX_PAD + 6, transform: undefined };
  })();

  const sw = selected?.week;

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
          {/* Milestone guide lines + labels on the left (bottom → top) */}
          {milestones.map((m, i) => (
            <g key={m.id ?? `m${i}`} aria-hidden="true">
              <line x1={LEFT} x2={width - RIGHT} y1={yFor(i + 1)} y2={yFor(i + 1)}
                stroke="var(--color-border-subtle)" strokeWidth={1} strokeDasharray="4,4" />
              <text data-testid="milestone-label" x={LEFT - 10} y={yFor(i + 1) + 4} textAnchor="end" fontSize="12"
                fill={m.reached ? "var(--color-text-normal)" : "var(--color-text-secondary)"} fontWeight={m.reached ? "600" : "400"}>
                {m.label}
              </text>
            </g>
          ))}

          {/* Axes: vertical Y axis and horizontal X axis, meeting at the origin (week 0) */}
          <g aria-hidden="true" data-testid="axes">
            <line x1={LEFT} x2={LEFT} y1={TOP - 10} y2={originY} stroke="var(--color-text-secondary)" strokeWidth={1.5} />
            <line x1={LEFT} x2={width - RIGHT} y1={originY} y2={originY} stroke="var(--color-text-secondary)" strokeWidth={1.5} />
          </g>

          {/* Week labels along the bottom — all styled the same; no week is highlighted */}
          {weeks.map((w, i) => (
            <g key={`wl-${w.weekNumber}`} aria-hidden="true">
              <line x1={colX(i)} x2={colX(i)} y1={originY} y2={originY + 4} stroke="var(--color-text-secondary)" strokeWidth={1} />
              <text data-testid="week-label" x={colX(i)} y={originY + 18} textAnchor="middle" fontSize="11"
                fill="var(--color-text-secondary)" fontWeight="400">
                {weekLabel(w)}
              </text>
            </g>
          ))}

          {/* The growth line: straight segments from the origin through each achievement */}
          {linePath && (
            <path data-testid="progress-line" d={linePath} fill="none" stroke="var(--color-accent, #dc2626)"
              strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" pointerEvents="none" />
          )}

          {/* Markers in week order (so Tab moves week by week): planned milestones
              (admin-set, not approved yet — hollow, off the line) and the line's
              achievement points. They never share a spot. */}
          {[
            ...planned.map((pl) => ({ order: pl.weekIndex, kind: "planned" as const, pl })),
            ...points.map((p) => ({ order: p.weekIndex + 0.5, kind: "point" as const, p })),
          ].sort((a, b) => a.order - b.order).map((m) => m.kind === "planned" ? (() => {
            const pl = m.pl;
            const w = weeks[pl.weekIndex];
            const sel: Selection = { kind: "planned", key: pl.key, x: pl.x, y: pl.y, week: w, pinned: false, planned: pl };
            return (
              <g key={pl.key} {...markerProps(sel, plannedLabel(pl, w), "planned-milestone")}>
                {(focusedKey === pl.key || selected?.key === pl.key) &&
                  <circle cx={pl.x} cy={pl.y} r={R + 4} fill="none" stroke="var(--color-text-normal)" strokeWidth={2} />}
                <circle cx={pl.x} cy={pl.y} r={R - 1} fill="var(--color-bg-surface)" strokeWidth={2}
                  stroke={pl.awaiting ? "var(--color-accent, #dc2626)" : "var(--color-text-subtle)"}
                  strokeDasharray={pl.awaiting ? "3,2" : undefined} />
                <circle cx={pl.x} cy={pl.y} r={R + 8} fill="transparent" />
              </g>
            );
          })() : (() => {
            // Circular milestone marker on the line — a button with a hover / click popup
            const p = m.p;
            const w = weeks[p.weekIndex];
            const key = `p:${p.weekNumber}`;
            const sel: Selection = { kind: "point", key, x: p.x, y: p.y, week: w, pinned: false, point: p };
            return (
              <g key={key} {...markerProps(sel, pointLabel(p, w), "milestone-point")}>
                {(focusedKey === key || selected?.key === key) &&
                  <circle cx={p.x} cy={p.y} r={R + 4} fill="none" stroke="var(--color-text-normal)" strokeWidth={2} />}
                <circle cx={p.x} cy={p.y} r={R} fill="var(--color-accent, #dc2626)" stroke="var(--color-bg-surface)" strokeWidth={2} />
                {/* Larger invisible hit area for touch */}
                <circle cx={p.x} cy={p.y} r={R + 8} fill="transparent" />
              </g>
            );
          })())}
        </svg>
      </div>

      {planned.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }} aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />{s?.batchGraphAchievedLegend ?? "Milestone achieved"}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed" style={{ borderColor: "var(--color-accent)" }} />{s?.batchGraphStatusSubmitted ?? "Awaiting approval"}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--color-text-subtle)" }} />{s?.batchGraphPlannedLegend ?? "Planned"}</span>
        </div>
      )}

      {points.length === 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }} data-testid="no-progress">
          {s?.batchGraphNoProgress ?? "Your line starts once your first milestone is approved."}
        </p>
      )}

      {/* Popup: Week, Milestone, Status, progress and revenue */}
      {selected && sw && popup && (
        <div
          role="dialog"
          aria-label={s?.batchGraphDetailsLabel ?? "Milestone details"}
          className="absolute z-20 rounded-xl border shadow-xl p-3 text-xs"
          style={{
            left: popup.left,
            top: popup.top,
            width: POP_W,
            maxWidth: "100%",
            transform: popup.transform,
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
            <dd className="font-semibold">{weekLabel(sw)}</dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphMilestoneField ?? "Milestone"}</dt>
            <dd className="font-semibold">
              {milestoneOf(selected.kind === "point" ? selected.point.level : selected.planned.level)?.label ?? ""}
            </dd>
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphStatusField ?? "Status"}</dt>
            <dd>{selected.kind === "point" ? statusOf(selected.point) : plannedStatus(selected.planned)}</dd>
            {selected.kind === "planned" && (
              <>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphActivityField ?? "Activity"}</dt>
                <dd>
                  <ul className="space-y-0.5">
                    {selected.planned.activities.map((a) => (
                      <li key={a.taskId} className="break-words">
                        {a.title} <span style={{ color: "var(--color-text-subtle)" }}>· {statusLabel[a.status] ?? a.status}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
            <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphProgressField ?? "Week progress"}</dt>
            <dd>{sw.completed ?? 0} of {sw.total ?? 0} {s?.batchGraphTasksApproved ?? "tasks approved"}</dd>
            {sw.revenue != null && (
              <>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphWeekRevenueField ?? "Revenue this week"}</dt>
                <dd>{inr(sw.revenue)}</dd>
              </>
            )}
            {sw.cumulativeRevenue != null && (
              <>
                <dt style={{ color: "var(--color-text-secondary)" }}>{s?.batchGraphRevenueField ?? "Revenue by then"}</dt>
                <dd>
                  {inr(sw.cumulativeRevenue)}{" "}
                  <span style={{ color: "var(--color-text-subtle)" }}>({s?.batchGraphSelfReported ?? "self-reported"})</span>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
