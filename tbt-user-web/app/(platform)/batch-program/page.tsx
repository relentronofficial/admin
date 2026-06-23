"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Circle,
  CalendarDays,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useMyBatchProgram } from "@/lib/hooks/useBatchProgram";
import { useMe } from "@/lib/hooks/useUser";
import { differenceInDays, format, isValid } from "date-fns";

type DayStatus = "not_started" | "in_progress" | "pending_approval" | "approved" | "rejected";

const STATUS_CONFIG: Record<DayStatus, { label: string; icon: any; color: string; bg: string }> = {
  not_started:      { label: "Not started",       icon: Circle,        color: "var(--color-text-muted, #888)",    bg: "transparent" },
  in_progress:      { label: "In progress",        icon: Clock,         color: "#f59e0b",                          bg: "rgba(245,158,11,0.12)" },
  pending_approval: { label: "Pending review",     icon: AlertCircle,   color: "#a78bfa",                          bg: "rgba(167,139,250,0.12)" },
  approved:         { label: "Approved",           icon: CheckCircle2,  color: "#22c55e",                          bg: "rgba(34,197,94,0.12)" },
  rejected:         { label: "Needs revision",     icon: XCircle,       color: "#ef4444",                          bg: "rgba(239,68,68,0.12)" },
};

function getStatusForDay(progress: any): DayStatus {
  if (!progress) return "not_started";
  return (progress.status ?? "not_started") as DayStatus;
}

export default function BatchProgramPage() {
  const { data: me } = useMe();
  const { data: program, isLoading } = useMyBatchProgram();

  const { daysElapsed, progressMap, daysMap, stats } = useMemo((): {
    daysElapsed: number;
    progressMap: Record<string, any>;
    daysMap: Record<string, any>;
    stats: { approved: number; pending: number; rejected: number; inProgress: number } | null;
  } => {
    if (!program?.batch) return { daysElapsed: 0, progressMap: {}, daysMap: {}, stats: null };

    const start = new Date(program.batch.startsAt).getTime();
    const elapsed = Math.min(90, Math.max(0, Math.floor((Date.now() - start) / 86_400_000)));

    const pMap: Record<string, any> = {};
    for (const p of (program.progress ?? [])) pMap[String(p.dayNumber)] = p;

    const dMap: Record<string, any> = {};
    for (const d of (program.days ?? [])) dMap[String(d.dayNumber)] = d;

    const approved = Object.values(pMap).filter((p: any) => p.status === "approved").length;
    const pending = Object.values(pMap).filter((p: any) => p.status === "pending_approval").length;
    const rejected = Object.values(pMap).filter((p: any) => p.status === "rejected").length;
    const inProgress = Object.values(pMap).filter((p: any) => p.status === "in_progress").length;

    return {
      daysElapsed: elapsed,
      progressMap: pMap,
      daysMap: dMap,
      stats: { approved, pending, rejected, inProgress },
    };
  }, [program]);

  if (isLoading) return <PageLoader />;

  if (!program?.batch) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Program</h2>
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
          <GraduationCap size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">You haven&apos;t been assigned to a batch yet.</p>
          <p className="text-muted-foreground text-sm mt-1">Contact your account manager to get assigned.</p>
        </div>
      </div>
    );
  }

  const startDate = new Date(program.batch.startsAt);
  const todayDay = daysElapsed + 1; // 1-based current day

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{(program as any).programName ?? program.batch.name}</h2>
        {(program as any).programName && (
          <p className="text-muted-foreground text-sm mt-1">{program.batch.name}</p>
        )}
      </div>

      {/* Batch info + stats */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="opacity-50" />
            <span className="text-sm text-muted-foreground">
              Started {isValid(startDate) ? format(startDate, "dd MMM yyyy") : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: "var(--color-accent)" }} />
            <span className="text-sm font-semibold">Day {Math.min(daysElapsed, 90)} of 90</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">{stats?.approved ?? 0} days approved</span>
            <span className="text-xs font-semibold">{Math.round(((stats?.approved ?? 0) / 90) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((stats?.approved ?? 0) / 90) * 100}%`, background: "var(--color-accent)" }}
            />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: `${stats?.approved ?? 0} Approved`, color: "#22c55e" },
            { label: `${stats?.pending ?? 0} Pending`, color: "#a78bfa" },
            { label: `${stats?.rejected ?? 0} Needs Revision`, color: "#ef4444" },
            { label: `${stats?.inProgress ?? 0} In Progress`, color: "#f59e0b" },
          ].map(s => (
            <span
              key={s.label}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${s.color}18`, color: s.color }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Days grid / list */}
      <div>
        <h3 className="text-sm font-semibold mb-3 opacity-60 uppercase tracking-widest">All 90 Days</h3>

        {/* Visual mini-grid (dots) */}
        <div className="flex flex-wrap gap-1 mb-6 p-4 rounded-2xl border" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
          {Array.from({ length: 90 }, (_, i) => {
            const dayNum = i + 1;
            const prog = progressMap[String(dayNum)];
            const status = getStatusForDay(prog);
            const cfg = STATUS_CONFIG[status];
            const isToday = dayNum === todayDay;
            return (
              <Link
                key={dayNum}
                href={`/batch-program/${dayNum}`}
                title={`Day ${dayNum}${daysMap[String(dayNum)]?.title ? ` — ${daysMap[String(dayNum)].title}` : ""}`}
                className="relative flex-shrink-0 rounded transition-all hover:scale-125"
                style={{
                  width: 20,
                  height: 20,
                  background: status === "approved" ? "#22c55e"
                    : status === "pending_approval" ? "#a78bfa"
                    : status === "rejected" ? "#ef4444"
                    : status === "in_progress" ? "#f59e0b"
                    : "rgba(255,255,255,0.06)",
                  outline: isToday ? "2px solid var(--color-accent)" : undefined,
                  outlineOffset: isToday ? "2px" : undefined,
                }}
              />
            );
          })}
        </div>

        {/* Day list */}
        <div className="space-y-2">
          {Array.from({ length: 90 }, (_, i) => {
            const dayNum = i + 1;
            const prog = progressMap[String(dayNum)];
            const dayContent = daysMap[String(dayNum)];
            const status = getStatusForDay(prog);
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const isToday = dayNum === todayDay;
            const isFuture = dayNum > todayDay;

            return (
              <Link
                key={dayNum}
                href={`/batch-program/${dayNum}`}
                className="flex items-center gap-4 p-4 rounded-xl border transition-all group"
                style={{
                  borderColor: isToday
                    ? "var(--color-accent)"
                    : status === "approved"
                      ? "rgba(34,197,94,0.25)"
                      : "var(--color-border, rgba(255,255,255,0.08))",
                  background: isToday
                    ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-surface, transparent))"
                    : "var(--color-bg-surface)",
                  opacity: isFuture && status === "not_started" ? 0.6 : 1,
                }}
              >
                {/* Day number */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: isToday ? "var(--color-accent)" : cfg.bg || "rgba(255,255,255,0.06)",
                    color: isToday ? "#fff" : cfg.color,
                  }}
                >
                  {dayNum}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {dayContent?.title ?? `Day ${dayNum}`}
                    {isToday && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent)", color: "#fff" }}>Today</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon size={11} style={{ color: cfg.color, flexShrink: 0 }} />
                    <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
                    {prog?.reviewNote && status === "rejected" && (
                      <span className="text-xs text-muted-foreground truncate">— {prog.reviewNote}</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="opacity-30 group-hover:opacity-70 flex-shrink-0 transition-opacity" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
