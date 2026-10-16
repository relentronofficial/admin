"use client";

import { useEffect, useMemo, useState } from "react";
import { useMyWeeklyGraph } from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type {
  WeeklyGraphActivityStatus,
  WeeklyGraphWeek,
} from "@/lib/api/services/batchProgram.service";

// Same status palette as the day list on /batch-program, so a task and its
// day read the same colour (approved green, pending violet, rejected red…).
const STATUS_COLOR: Record<WeeklyGraphActivityStatus, string> = {
  completed: "#22c55e",
  submitted: "#a78bfa",
  needs_revision: "#ef4444",
  in_progress: "#f59e0b",
  not_started: "var(--color-text-subtle)",
  upcoming: "var(--color-text-subtle)",
};

const STATUS_ORDER: WeeklyGraphActivityStatus[] = [
  "completed", "submitted", "in_progress", "needs_revision", "not_started", "upcoming",
];

// Chart geometry (SVG user units). Each week is one fixed-width column; the
// SVG scrolls horizontally inside its card instead of squeezing long programs.
const COL = 56;
const LEFT = 36;
const TOP = 12;
const PLOT_H = 120;
const DOT = 10;
const DOT_GAP = 4;
const DOTS_PER_ROW = 4;
const STRIP_TOP_GAP = 26;

/** y for a completion %, 0% at the bottom of the plot area, 100% at the top. */
const yFor = (percent: number) => TOP + PLOT_H - (percent / 100) * PLOT_H;
const colX = (index: number) => LEFT + index * COL + COL / 2;

export default function WeeklyActivityGraph() {
  const { data: graph, isLoading, isError } = useMyWeeklyGraph();
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;

  const statusLabel: Record<WeeklyGraphActivityStatus, string> = {
    completed: s?.batchGraphCompletedLabel ?? "Completed",
    submitted: s?.batchGraphSubmittedLabel ?? "Awaiting review",
    needs_revision: s?.batchGraphNeedsRevisionLabel ?? "Needs revision",
    in_progress: s?.batchGraphInProgressLabel ?? "In progress",
    not_started: s?.batchGraphNotStartedLabel ?? "Not started",
    upcoming: s?.batchGraphUpcomingLabel ?? "Upcoming",
  };
  const weekLabel = s?.batchWeekLabel ?? "Week";
  const dayLabel = s?.batchGraphDayLabel ?? "Day";

  const weeks = graph?.weeks ?? [];
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Default to the current week if it has activities, else the first week that does.
  useEffect(() => {
    if (!graph || selectedWeek !== null) return;
    const current = graph.weeks.find((w) => w.isCurrent && w.total > 0);
    const first = graph.weeks.find((w) => w.total > 0);
    setSelectedWeek((current ?? first)?.weekNumber ?? null);
  }, [graph, selectedWeek]);

  // Line segments only join consecutive weeks that both have activities — a
  // week with nothing assigned is a gap, never a fabricated 0% point.
  const segments = useMemo(() => {
    const runs: string[] = [];
    let run: string[] = [];
    weeks.forEach((w, i) => {
      if (w.completionPercent === null) {
        if (run.length > 1) runs.push(run.join(" "));
        run = [];
        return;
      }
      run.push(`${colX(i)},${yFor(w.completionPercent)}`);
    });
    if (run.length > 1) runs.push(run.join(" "));
    return runs;
  }, [weeks]);

  if (isLoading) {
    return <div className="h-48 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay-md)" }} />;
  }
  // Not in a batch — the page already handles that state.
  if (!isError && !graph) return null;

  const title = s?.batchGraphTitle ?? "Weekly Activity Graph";

  const header = (
    <div className="mb-3">
      <h3 className="text-sm font-semibold opacity-60 uppercase tracking-widest">{title}</h3>
      {graph?.hasActivities && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {s?.batchGraphSubtitle ?? "Each dot is an assigned activity. The line shows the share completed each week."}
        </p>
      )}
    </div>
  );

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

  if (!graph!.hasActivities) {
    return (
      <div>
        {header}
        <p
          className="text-sm text-muted-foreground rounded-xl border p-6 text-center"
          style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
        >
          {s?.batchGraphEmpty ?? "No activities have been assigned to your program yet."}
        </p>
      </div>
    );
  }

  // Dot strip height grows with the busiest week so no activity is ever hidden.
  const maxRows = Math.max(1, ...weeks.map((w) => Math.ceil(w.total / DOTS_PER_ROW)));
  const stripTop = TOP + PLOT_H + STRIP_TOP_GAP;
  const height = stripTop + maxRows * (DOT + DOT_GAP) + 8;
  const width = LEFT + weeks.length * COL + 8;
  const selected = weeks.find((w) => w.weekNumber === selectedWeek) ?? null;

  return (
    <div>
      {header}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
      >
        <div className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
            className="block"
          >
            {/* Y axis: completion % gridlines */}
            {[0, 50, 100].map((p) => (
              <g key={p}>
                <line
                  x1={LEFT} x2={width - 8} y1={yFor(p)} y2={yFor(p)}
                  stroke="var(--color-border-subtle)" strokeDasharray={p === 0 ? undefined : "3 3"}
                />
                <text x={LEFT - 6} y={yFor(p) + 3} textAnchor="end" fontSize="9" fill="var(--color-text-subtle)">
                  {p}%
                </text>
              </g>
            ))}

            {weeks.map((w, i) => (
              <WeekColumn
                key={w.weekNumber}
                week={w}
                index={i}
                stripTop={stripTop}
                height={height}
                selected={w.weekNumber === selectedWeek}
                weekLabel={weekLabel}
                dayLabel={dayLabel}
                statusLabel={statusLabel}
                noActivitiesLabel={s?.batchGraphNoActivitiesWeek ?? "No activities"}
                onSelect={() => w.total > 0 && setSelectedWeek(w.weekNumber)}
              />
            ))}

            {/* Weekly completion line + points (only weeks with activities) */}
            {segments.map((points, i) => (
              <polyline key={i} points={points} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
            ))}
            {weeks.map((w, i) =>
              w.completionPercent === null ? null : (
                <circle
                  key={w.weekNumber}
                  cx={colX(i)}
                  cy={yFor(w.completionPercent)}
                  r={3.5}
                  fill="var(--color-accent)"
                  pointerEvents="none"
                />
              ),
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {STATUS_ORDER.map((st) => (
            <span key={st} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <StatusDot status={st} />
              {statusLabel[st]}
            </span>
          ))}
        </div>

        {/* Selected week: every activity, by name, with its status in words */}
        {selected && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
            <p className="text-xs font-semibold mb-2">
              {weekLabel} {selected.weekNumber} · {selected.completed}/{selected.total}
              {selected.completionPercent !== null && ` · ${selected.completionPercent}%`}
            </p>
            <ul className="space-y-1.5">
              {selected.activities.map((a) => (
                <li key={a.taskId} className="flex items-center gap-2 text-xs">
                  <StatusDot status={a.status} />
                  <span className="text-muted-foreground shrink-0">{dayLabel} {a.dayNumber}</span>
                  <span className="truncate flex-1">{a.title}</span>
                  <span className="shrink-0" style={{ color: STATUS_COLOR[a.status] }}>
                    {statusLabel[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: WeeklyGraphActivityStatus }) {
  const color = STATUS_COLOR[status];
  // Upcoming is a hollow ring so it never reads as a recorded (filled) state.
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={status === "upcoming" ? { border: `1.5px solid ${color}` } : { background: color }}
    />
  );
}

function WeekColumn({
  week, index, stripTop, height, selected, weekLabel, dayLabel, statusLabel, noActivitiesLabel, onSelect,
}: {
  week: WeeklyGraphWeek;
  index: number;
  stripTop: number;
  height: number;
  selected: boolean;
  weekLabel: string;
  dayLabel: string;
  statusLabel: Record<WeeklyGraphActivityStatus, string>;
  noActivitiesLabel: string;
  onSelect: () => void;
}) {
  const x0 = LEFT + index * COL;
  const cx = colX(index);
  const dotsWidth = Math.min(week.total, DOTS_PER_ROW) * (DOT + DOT_GAP) - DOT_GAP;
  const interactive = week.total > 0;

  return (
    <g
      onClick={onSelect}
      style={{ cursor: interactive ? "pointer" : "default" }}
      aria-label={`${weekLabel} ${week.weekNumber}: ${week.completed}/${week.total}`}
    >
      <title>
        {week.total > 0
          ? `${weekLabel} ${week.weekNumber}: ${week.completed}/${week.total}`
          : `${weekLabel} ${week.weekNumber}: ${noActivitiesLabel}`}
      </title>
      {/* Column background — accent tint for the current week, outline for the selected one */}
      <rect
        x={x0 + 2} y={TOP - 6} width={COL - 4} height={height - TOP}
        rx={8}
        fill={week.isCurrent ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent"}
        stroke={selected ? "var(--color-accent)" : "none"}
        strokeWidth={1}
      />
      <text x={cx} y={TOP + PLOT_H + 14} textAnchor="middle" fontSize="10" fill="var(--color-text-subtle)">
        {week.weekNumber}
      </text>

      {week.total === 0 ? (
        <text x={cx} y={stripTop + DOT} textAnchor="middle" fontSize="10" fill="var(--color-text-subtle)">
          –
        </text>
      ) : (
        week.activities.map((a, i) => {
          const row = Math.floor(i / DOTS_PER_ROW);
          const col = i % DOTS_PER_ROW;
          const x = cx - dotsWidth / 2 + col * (DOT + DOT_GAP) + DOT / 2;
          const y = stripTop + row * (DOT + DOT_GAP) + DOT / 2;
          const color = STATUS_COLOR[a.status];
          return (
            <circle
              key={a.taskId}
              cx={x}
              cy={y}
              r={DOT / 2 - (a.status === "upcoming" ? 0.75 : 0)}
              fill={a.status === "upcoming" ? "transparent" : color}
              stroke={a.status === "upcoming" ? color : "none"}
              strokeWidth={1.5}
            >
              <title>{`${dayLabel} ${a.dayNumber} · ${a.title} · ${statusLabel[a.status]}`}</title>
            </circle>
          );
        })
      )}
    </g>
  );
}
