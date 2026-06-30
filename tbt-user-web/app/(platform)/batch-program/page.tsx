"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  ChevronLeft,
  Coffee,
  UserCheck,
  Send,
  Loader2,
  X,
  Flame,
  Download,
} from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useMyBatchProgram, useRequestBreak, useDownloadBatchCertificate } from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useSocket } from "@/lib/socket/useSocket";
import {
  format,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import { toast } from "react-hot-toast";

type DayStatus = "not_started" | "in_progress" | "pending_approval" | "approved" | "rejected";
type AttendanceStatus = "present" | "absent" | "break" | "future";

function getStatusForDay(progress: any): DayStatus {
  if (!progress) return "not_started";
  return (progress.status ?? "not_started") as DayStatus;
}

function getAttendanceForDay(
  attendanceMap: Record<number, any>,
  dayNum: number,
  breaks: any[],
  daysElapsed: number,
): AttendanceStatus {
  if (dayNum > daysElapsed) return "future";
  const rec = attendanceMap[dayNum];
  if (rec) return rec.status as AttendanceStatus;
  // Check approved breaks
  const onBreak = breaks.some(
    (b: any) =>
      b.status === "approved" &&
      Number(b.start_day) <= dayNum &&
      Number(b.end_day) >= dayNum,
  );
  if (onBreak) return "break";
  return "absent";
}

function BreakRequestModal({
  totalDays,
  batchStartsAt,
  onClose,
  uiStrings,
}: {
  totalDays: number;
  batchStartsAt: string;
  onClose: () => void;
  uiStrings: any;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const requestBreak = useRequestBreak();

  const batchStartMs = new Date(batchStartsAt).getTime();
  const minDate = new Date(batchStartsAt).toISOString().split("T")[0];
  const maxDateObj = new Date(batchStartsAt);
  maxDateObj.setDate(maxDateObj.getDate() + totalDays - 1);
  const maxDate = maxDateObj.toISOString().split("T")[0];

  const toDay = (dateStr: string) =>
    dateStr ? Math.floor((new Date(dateStr).getTime() - batchStartMs) / 86_400_000) + 1 : null;

  const computedStart = toDay(startDate);
  const computedEnd = toDay(endDate);
  const dayRangeText =
    computedStart !== null && computedEnd !== null
      ? `Days ${computedStart}–${computedEnd} of your batch`
      : null;

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
    color: "inherit",
  };

  const handleSubmit = async () => {
    const s = toDay(startDate);
    const e = toDay(endDate);
    if (!s || !e) { toast.error("Please select both dates"); return; }
    if (s > e) { toast.error("Start date must be before end date"); return; }
    if (s < 1 || e > totalDays) { toast.error(`Days must be within your batch (1–${totalDays})`); return; }
    try {
      await requestBreak.mutateAsync({ startDay: s, endDay: e, reason: reason || undefined });
      toast.success(uiStrings?.batchBreakSubmittedMsg ?? "Break request submitted");
      onClose();
    } catch {
      toast.error("Failed to submit break request");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="rounded-2xl border p-6 w-full max-w-sm space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          borderColor: "var(--color-border, rgba(255,255,255,0.1))",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {uiStrings?.batchRequestBreakLabel ?? "Request Break"}
          </h3>
          <button onClick={onClose}>
            <X size={18} className="opacity-50" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {uiStrings?.batchBreakStartLabel ?? "Start date"}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate && e.target.value > endDate) setEndDate(e.target.value);
              }}
              min={minDate}
              max={maxDate}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {uiStrings?.batchBreakEndLabel ?? "End date"}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || minDate}
              max={maxDate}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>
        {dayRangeText && (
          <p className="text-xs text-center font-semibold" style={{ color: "var(--color-accent)" }}>
            {dayRangeText}
          </p>
        )}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={uiStrings?.batchBreakReasonPlaceholder ?? "Reason for taking a break..."}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={requestBreak.isPending || !startDate || !endDate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "var(--color-accent)" }}
        >
          {requestBreak.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Submit Request
        </button>
      </div>
    </div>
  );
}

export default function BatchProgramPage() {
  const { uiStrings } = useSiteConfig();
  const { data: program, isLoading } = useMyBatchProgram();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [showBreakModal, setShowBreakModal] = useState(false);
  const downloadCertificate = useDownloadBatchCertificate();

  const totalDays: number = (program as any)?.totalDays ?? 90;

  const statusConfig = useMemo(
    () => ({
      not_started: {
        label: uiStrings?.batchStatusNotStarted ?? "Not started",
        icon: Circle,
        color: "var(--color-text-muted, #888)",
        bg: "transparent",
      },
      in_progress: {
        label: uiStrings?.batchStatusInProgress ?? "In progress",
        icon: Clock,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
      },
      pending_approval: {
        label: uiStrings?.batchStatusPendingReview ?? "Pending review",
        icon: AlertCircle,
        color: "#a78bfa",
        bg: "rgba(167,139,250,0.12)",
      },
      approved: {
        label: uiStrings?.batchStatusApproved ?? "Approved",
        icon: CheckCircle2,
        color: "#22c55e",
        bg: "rgba(34,197,94,0.12)",
      },
      rejected: {
        label: uiStrings?.batchStatusNeedsRevision ?? "Needs revision",
        icon: XCircle,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
      },
    }),
    [uiStrings],
  );

  const { daysElapsed, progressMap, daysMap, attendanceMap, stats } = useMemo(() => {
    if (!program?.batch)
      return { daysElapsed: 0, progressMap: {} as Record<string, any>, daysMap: {} as Record<string, any>, attendanceMap: {} as Record<number, any>, stats: null };

    const start = new Date(program.batch.startsAt).getTime();
    const elapsed = Math.min(
      totalDays,
      Math.max(0, Math.floor((Date.now() - start) / 86_400_000)),
    );

    const pMap: Record<string, any> = {};
    for (const p of program.progress ?? []) pMap[String(p.dayNumber)] = p;

    const dMap: Record<string, any> = {};
    for (const d of program.days ?? []) dMap[String(d.dayNumber)] = d;

    const aMap: Record<number, any> = {};
    for (const a of (program as any).attendance ?? []) aMap[Number(a.day_number)] = a;

    const breaks: any[] = (program as any).breaks ?? [];

    const approved = Object.values(pMap).filter((p: any) => p.status === "approved").length;
    const pending = Object.values(pMap).filter((p: any) => p.status === "pending_approval").length;
    const rejected = Object.values(pMap).filter((p: any) => p.status === "rejected").length;
    const inProgress = Object.values(pMap).filter((p: any) => p.status === "in_progress").length;

    // Attendance stats
    let presentCount = 0;
    let breakCount = 0;
    for (let d = 1; d <= elapsed; d++) {
      const att = aMap[d];
      if (att?.status === "present") presentCount++;
      else if (att?.status === "break") breakCount++;
      else {
        const onBreak = breaks.some(
          (b: any) =>
            b.status === "approved" &&
            Number(b.start_day) <= d &&
            Number(b.end_day) >= d,
        );
        if (onBreak) breakCount++;
      }
    }
    const effectiveDays = elapsed - breakCount;
    const attendanceRate =
      effectiveDays > 0 ? Math.round((presentCount / effectiveDays) * 100) : 0;

    return {
      daysElapsed: elapsed,
      progressMap: pMap,
      daysMap: dMap,
      attendanceMap: aMap,
      stats: {
        approved,
        pending,
        rejected,
        inProgress,
        presentCount,
        breakCount,
        effectiveDays,
        attendanceRate,
      },
    };
  }, [program, totalDays]);

  // Build calendar cells for the current month
  const calendarDays = useMemo(() => {
    if (!program?.batch) return [];
    const start = new Date(program.batch.startsAt);
    start.setHours(0, 0, 0, 0);

    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const breaks: any[] = (program as any).breaks ?? [];

    return days.map((date) => {
      const diff = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
      const dayNum = diff + 1; // 1-based

      if (dayNum < 1 || dayNum > totalDays)
        return { date, dayNum: null, taskStatus: null, attendanceStatus: null };

      const prog = progressMap[String(dayNum)];
      const taskStatus = getStatusForDay(prog);
      const attendanceStatus = getAttendanceForDay(attendanceMap, dayNum, breaks, daysElapsed);

      return { date, dayNum, taskStatus, attendanceStatus };
    });
  }, [program, calMonth, progressMap, attendanceMap, daysElapsed, totalDays]);

  const submitStreak = useMemo(() => {
    let streak = 0;
    for (let day = daysElapsed; day >= 1; day--) {
      const p = progressMap[String(day)];
      if (p && ["pending_approval", "approved"].includes(p.status)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [progressMap, daysElapsed]);

  const breaks: any[] = (program as any)?.breaks ?? [];

  const todayDay = daysElapsed + 1;
  const batchNotStarted = program?.batch
    ? new Date(program.batch.startsAt) > new Date()
    : false;
  const batchCompleted = daysElapsed >= totalDays;
  const todayStatus = (progressMap[String(todayDay)]?.status ?? "not_started") as DayStatus;

  // Auto-scroll the day list to today's row once batch data loads
  useEffect(() => {
    if (!program?.batch || batchNotStarted || batchCompleted) return;
    const el = document.getElementById(`day-row-${todayDay}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.batch?.id]);

  // Real-time: update when admin approves or rejects a day
  useEffect(() => {
    if (!socket) return;
    const handleApproved = (payload: { dayNumber: number; xpAwarded: number }) => {
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
      toast.success(`Day ${payload.dayNumber} approved! +${payload.xpAwarded} XP`);
    };
    const handleRejected = (payload: { dayNumber: number; reviewNote: string }) => {
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
      toast.error(`Day ${payload.dayNumber} needs revision`);
    };
    const handleCompleted = (payload: { totalDays: number }) => {
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
      toast.success(uiStrings?.batchCompletedMsg ?? `Congratulations! You completed all ${payload.totalDays} days. 🏆`);
    };
    socket.on("batch:day_approved", handleApproved);
    socket.on("batch:day_rejected", handleRejected);
    socket.on("batch:completed", handleCompleted);
    return () => {
      socket.off("batch:day_approved", handleApproved);
      socket.off("batch:day_rejected", handleRejected);
      socket.off("batch:completed", handleCompleted);
    };
  }, [socket]);

  if (isLoading) return <PageLoader />;

  if (!program?.batch) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">
          {uiStrings?.batchProgramLabel ?? "Program"}
        </h2>
        <div
          className="rounded-2xl border px-8 py-16 flex flex-col items-center text-center gap-5"
          style={{
            borderColor: "var(--color-border, rgba(255,255,255,0.08))",
            background: "var(--color-bg-surface)",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-25"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>

          <div className="space-y-1.5">
            <p className="font-semibold text-base">
              {uiStrings?.batchNotAssignedMsg ?? "You're not enrolled in a batch yet."}
            </p>
            <p className="text-sm text-muted-foreground">
              {uiStrings?.batchContactMsg ?? "Contact your account manager to get assigned."}
            </p>
          </div>

          <Link
            href="/messages"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {uiStrings?.batchNoAssignedCta ?? "Message Support"}
          </Link>
        </div>
      </div>
    );
  }

  const startDate = new Date(program.batch.startsAt);

  // Calendar grid: Sunday = 0, pad start with empty cells
  const firstDayOfWeek = getDay(startOfMonth(calMonth));
  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {(program as any).programName ?? program.batch.name}
          </h2>
          {(program as any).programName && (
            <p className="text-muted-foreground text-sm mt-1">{program.batch.name}</p>
          )}
        </div>
        <button
          onClick={() => setShowBreakModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
          style={{
            borderColor: "var(--color-border, rgba(255,255,255,0.1))",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <Coffee size={15} className="opacity-60" />
          {uiStrings?.batchRequestBreakLabel ?? "Request Break"}
        </button>
      </div>

      {/* Today shortcut / Batch status notice */}
      {batchNotStarted ? (
        <div
          className="flex items-center gap-4 p-4 rounded-2xl"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
          }}
        >
          <CalendarDays size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
          <div>
            <p className="font-semibold text-sm">Batch starts on</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isValid(startDate) ? format(startDate, "dd MMM yyyy") : "—"}
            </p>
          </div>
        </div>
      ) : batchCompleted ? (
        <div
          className="flex items-center gap-4 p-4 rounded-2xl flex-wrap"
          style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.25)",
          }}
        >
          <CheckCircle2 size={20} style={{ color: "#22c55e", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: "#22c55e" }}>
              {uiStrings?.batchCompletedMsg ?? "Congratulations! You completed the full batch."}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalDays} days approved — your certificate is ready.
            </p>
          </div>
          <button
            onClick={() => downloadCertificate.mutate()}
            disabled={downloadCertificate.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
            style={{ background: "#22c55e", color: "#fff" }}
          >
            {downloadCertificate.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {uiStrings?.batchCertificateLabel ?? "Download Certificate"}
          </button>
        </div>
      ) : (
        <Link
          href={`/batch-program/${todayDay}`}
          className="flex items-center gap-4 p-4 rounded-2xl group transition-opacity hover:opacity-90"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
            borderTop: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
            borderRight: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
            borderBottom: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
            borderLeft: "3px solid var(--color-accent)",
          }}
        >
          {/* Day number badge */}
          <div
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-white text-[10px] font-bold uppercase tracking-wider leading-none">
              {uiStrings?.batchTodayLabel ?? "Today"}
            </span>
            <span className="text-white text-lg font-bold leading-tight">{todayDay}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {daysMap[String(todayDay)]?.title ?? `Day ${todayDay}`}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {daysMap[String(todayDay)]?.category && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
                >
                  {daysMap[String(todayDay)].category}
                </span>
              )}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: statusConfig[todayStatus]?.bg || "rgba(255,255,255,0.08)",
                  color: statusConfig[todayStatus]?.color || "inherit",
                }}
              >
                {statusConfig[todayStatus]?.label}
              </span>
            </div>
          </div>

          <ChevronRight
            size={18}
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
            className="opacity-70 group-hover:opacity-100 transition-opacity"
          />
        </Link>
      )}

      {/* Stats */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{
          borderColor: "var(--color-border, rgba(255,255,255,0.08))",
          background: "var(--color-bg-surface)",
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="opacity-50" />
            <span className="text-sm text-muted-foreground">
              Started {isValid(startDate) ? format(startDate, "dd MMM yyyy") : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: "var(--color-accent)" }} />
            <span className="text-sm font-semibold">
              Day {Math.min(daysElapsed, totalDays)} of {totalDays}
            </span>
          </div>
        </div>

        {/* Task progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              {stats?.approved ?? 0} {uiStrings?.batchDaysApprovedLabel ?? "days approved"}
            </span>
            <span className="text-xs font-semibold">
              {Math.round(((stats?.approved ?? 0) / totalDays) * 100)}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((stats?.approved ?? 0) / totalDays) * 100}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        </div>

        {/* Attendance bar */}
        {stats && daysElapsed > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserCheck size={12} />
                {uiStrings?.batchAttendanceRateLabel ?? "Attendance Rate"}
              </span>
              <span className="text-xs font-semibold">{stats.attendanceRate}%</span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.attendanceRate}%`, background: "#22c55e" }}
              />
            </div>
          </div>
        )}

        {/* Streak */}
        {daysElapsed > 0 && (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: submitStreak >= 7 ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${submitStreak >= 7 ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <Flame
              size={16}
              style={{ color: submitStreak >= 7 ? "#eab308" : "var(--color-accent)", flexShrink: 0 }}
            />
            <span className="text-xs text-muted-foreground flex-1">
              {uiStrings?.batchStreakLabel ?? "Current Streak"}
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: submitStreak >= 7 ? "#eab308" : "var(--color-accent)" }}
            >
              {submitStreak} {uiStrings?.batchStreakUnit ?? "days"}
            </span>
          </div>
        )}

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: `${stats?.approved ?? 0} ${uiStrings?.batchApprovedPillLabel ?? "Approved"}`,
              color: "#22c55e",
            },
            {
              label: `${stats?.pending ?? 0} ${uiStrings?.batchPendingPillLabel ?? "Pending"}`,
              color: "#a78bfa",
            },
            {
              label: `${stats?.rejected ?? 0} ${uiStrings?.batchNeedsRevisionPillLabel ?? "Needs Revision"}`,
              color: "#ef4444",
            },
            {
              label: `${stats?.inProgress ?? 0} ${uiStrings?.batchInProgressPillLabel ?? "In Progress"}`,
              color: "#f59e0b",
            },
            {
              label: `${stats?.presentCount ?? 0} ${uiStrings?.batchPresentLabel ?? "Present"}`,
              color: "#22c55e",
            },
            {
              label: `${stats?.breakCount ?? 0} ${uiStrings?.batchBreakLabel ?? "Break"}`,
              color: "#60a5fa",
            },
          ].map((s) => (
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

      {/* Break requests */}
      {breaks.length > 0 && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{
            borderColor: "var(--color-border, rgba(255,255,255,0.08))",
            background: "var(--color-bg-surface)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {uiStrings?.batchRequestBreakLabel ?? "Break Requests"}
          </p>
          {breaks.map((b: any) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 text-sm p-2.5 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-muted-foreground">
                Day {b.start_day} – {b.end_day}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background:
                    b.status === "approved"
                      ? "rgba(34,197,94,0.12)"
                      : b.status === "rejected"
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(167,139,250,0.12)",
                  color:
                    b.status === "approved"
                      ? "#22c55e"
                      : b.status === "rejected"
                        ? "#ef4444"
                        : "#a78bfa",
                }}
              >
                {b.status === "approved"
                  ? (uiStrings?.batchBreakApprovedLabel ?? "Approved")
                  : b.status === "rejected"
                    ? "Rejected"
                    : (uiStrings?.batchBreakPendingLabel ?? "Pending")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{
          borderColor: "var(--color-border, rgba(255,255,255,0.08))",
          background: "var(--color-bg-surface)",
        }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold">{format(calMonth, "MMMM yyyy")}</p>
          <button
            onClick={() => setCalMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-bold text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for first weekday offset */}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {calendarDays.map(({ date, dayNum, taskStatus, attendanceStatus }, i) => {
            const isToday = dayNum === todayDay;
            const inMonth = isSameMonth(date, calMonth);
            if (!inMonth) return null;

            if (dayNum === null) {
              return (
                <div
                  key={i}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <span className="text-[11px] text-muted-foreground opacity-30">
                    {format(date, "d")}
                  </span>
                </div>
              );
            }

            const taskColor =
              taskStatus === "approved"
                ? "#22c55e"
                : taskStatus === "pending_approval"
                  ? "#a78bfa"
                  : taskStatus === "rejected"
                    ? "#ef4444"
                    : taskStatus === "in_progress"
                      ? "#f59e0b"
                      : null;
            const attendanceColor =
              attendanceStatus === "present"
                ? "#22c55e"
                : attendanceStatus === "break"
                  ? "#60a5fa"
                  : attendanceStatus === "absent"
                    ? "#ef4444"
                    : null;

            return (
              <Link
                key={i}
                href={`/batch-program/${dayNum}`}
                className="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 relative"
                style={{
                  background: isToday
                    ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
                    : "rgba(255,255,255,0.03)",
                  outline: isToday ? "2px solid var(--color-accent)" : undefined,
                  outlineOffset: isToday ? "1px" : undefined,
                }}
              >
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isToday ? "var(--color-accent)" : "inherit" }}
                >
                  {format(date, "d")}
                </span>
                {/* Attendance dot (larger) */}
                {attendanceColor && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: attendanceColor }}
                  />
                )}
                {/* Task dot (smaller) */}
                {taskColor && (
                  <div
                    className="w-1 h-1 rounded-full opacity-70"
                    style={{ background: taskColor }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap gap-3 pt-2 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px] text-muted-foreground w-full opacity-60">
            Larger dot = Attendance · Smaller dot = Task
          </p>
          {[
            { color: "#22c55e", label: uiStrings?.batchPresentLabel ?? "Present" },
            { color: "#ef4444", label: uiStrings?.batchAbsentLabel ?? "Absent" },
            { color: "#60a5fa", label: uiStrings?.batchBreakLabel ?? "Break" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[11px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
          {[
            { color: "#22c55e", label: uiStrings?.batchStatusApproved ?? "Approved" },
            { color: "#a78bfa", label: uiStrings?.batchStatusPendingReview ?? "Pending" },
            { color: "#ef4444", label: uiStrings?.batchStatusNeedsRevision ?? "Rejected" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full opacity-70" style={{ background: l.color }} />
              <span className="text-[11px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day list */}
      <div>
        <h3 className="text-sm font-semibold mb-3 opacity-60 uppercase tracking-widest">
          {uiStrings?.batchAllDaysLabel ?? "All Days"}
        </h3>
        <div className="space-y-2">
          {Array.from({ length: totalDays }, (_, i) => {
            const dayNum = i + 1;
            const prog = progressMap[String(dayNum)];
            const dayContent = daysMap[String(dayNum)];
            const status = getStatusForDay(prog);
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            const isToday = dayNum === todayDay;
            const isFuture = dayNum > todayDay;
            const attStatus = getAttendanceForDay(
              attendanceMap,
              dayNum,
              (program as any)?.breaks ?? [],
              daysElapsed,
            );

            return (
              <Link
                key={dayNum}
                id={`day-row-${dayNum}`}
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
                    background: isToday
                      ? "var(--color-accent)"
                      : cfg.bg || "rgba(255,255,255,0.06)",
                    color: isToday ? "#fff" : cfg.color,
                  }}
                >
                  {dayNum}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {dayContent?.title ?? `Day ${dayNum}`}
                    {isToday && (
                      <span
                        className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--color-accent)", color: "#fff" }}
                      >
                        {uiStrings?.batchTodayLabel ?? "Today"}
                      </span>
                    )}
                    {dayContent?.category && (
                      <span
                        className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
                      >
                        {dayContent.category}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} style={{ color: cfg.color, flexShrink: 0 }} />
                      <span className="text-xs" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    {!isFuture && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              attStatus === "present"
                                ? "#22c55e"
                                : attStatus === "break"
                                  ? "#60a5fa"
                                  : attStatus === "absent"
                                    ? "#ef4444"
                                    : "rgba(255,255,255,0.15)",
                          }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {attStatus === "present"
                            ? (uiStrings?.batchPresentLabel ?? "Present")
                            : attStatus === "break"
                              ? (uiStrings?.batchBreakLabel ?? "Break")
                              : attStatus === "absent"
                                ? (uiStrings?.batchAbsentLabel ?? "Absent")
                                : (uiStrings?.batchNotMarkedLabel ?? "Not marked")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className="opacity-30 group-hover:opacity-70 flex-shrink-0 transition-opacity"
                />
              </Link>
            );
          })}
        </div>
      </div>

      {showBreakModal && (
        <BreakRequestModal
          totalDays={totalDays}
          batchStartsAt={program.batch.startsAt}
          onClose={() => setShowBreakModal(false)}
          uiStrings={uiStrings}
        />
      )}
    </div>
  );
}
