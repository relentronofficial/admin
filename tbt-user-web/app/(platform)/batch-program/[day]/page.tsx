"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ExternalLink,
  Save,
  Send,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Tag,
  Paperclip,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useMyBatchProgram,
  useSaveBatchDraft,
  useSubmitBatchDay,
  useMarkAttendance,
  useUploadTaskProof,
  type TaskSubmissionProof,
} from "@/lib/hooks/useBatchProgram";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useSocket } from "@/lib/socket/useSocket";

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const vid = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return vid ? `https://www.youtube.com/embed/${vid}` : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      const vid = u.pathname.split("/").filter(Boolean).pop();
      return vid ? `https://player.vimeo.com/video/${vid}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

type DayStatus = "not_started" | "in_progress" | "pending_approval" | "approved" | "rejected";
type AttendanceStatus = "present" | "absent" | "break" | "future" | "not_marked";

function StatusBadge({
  status,
  labels,
}: {
  status: DayStatus;
  labels: Record<DayStatus, { label: string; color: string; bg: string }>;
}) {
  const c = labels[status];
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

export default function BatchDayPage() {
  const { day } = useParams<{ day: string }>();
  const router = useRouter();
  const dayNumber = parseInt(day, 10);
  const { uiStrings } = useSiteConfig();

  const { data: program, isLoading } = useMyBatchProgram();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const saveDraft = useSaveBatchDraft();
  const submitDay = useSubmitBatchDay();
  const markAttendance = useMarkAttendance();
  const { upload: uploadProof } = useUploadTaskProof();

  const totalDays: number = (program as any)?.totalDays ?? 90;

  const statusLabels = useMemo(
    () => ({
      not_started: {
        label: uiStrings?.batchStatusNotStarted ?? "Not started",
        color: "#888",
        bg: "rgba(255,255,255,0.06)",
      },
      in_progress: {
        label: uiStrings?.batchStatusInProgress ?? "In progress",
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
      },
      pending_approval: {
        label: uiStrings?.batchStatusPendingReview ?? "Pending review",
        color: "#a78bfa",
        bg: "rgba(167,139,250,0.12)",
      },
      approved: {
        label: uiStrings?.batchStatusApprovedCheck ?? "Approved ✓",
        color: "#22c55e",
        bg: "rgba(34,197,94,0.12)",
      },
      rejected: {
        label: uiStrings?.batchStatusNeedsRevision ?? "Needs revision",
        color: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
      },
    }),
    [uiStrings],
  );

  const dayContent = useMemo(
    () => program?.days?.find((d: any) => d.dayNumber === dayNumber) ?? null,
    [program, dayNumber],
  );
  const progress = useMemo(
    () => program?.progress?.find((p: any) => p.dayNumber === dayNumber) ?? null,
    [program, dayNumber],
  );

  const attendance = useMemo(() => {
    const arr: any[] = (program as any)?.attendance ?? [];
    return arr.find((a: any) => Number(a.day_number) === dayNumber) ?? null;
  }, [program, dayNumber]);

  const breaks: any[] = (program as any)?.breaks ?? [];

  const status: DayStatus = (progress?.status ?? "not_started") as DayStatus;
  const isLocked = status === "approved";

  const daysElapsed = program?.batch
    ? Math.min(
        totalDays,
        Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(program.batch.startsAt).getTime()) / 86_400_000,
          ),
        ),
      )
    : 0;
  const isFutureDay = dayNumber > daysElapsed + 1;

  // Attendance status
  const onBreak = breaks.some(
    (b: any) =>
      b.status === "approved" &&
      Number(b.start_day) <= dayNumber &&
      Number(b.end_day) >= dayNumber,
  );
  const attStatus: AttendanceStatus = isFutureDay
    ? "future"
    : attendance
      ? (attendance.status as AttendanceStatus)
      : onBreak
        ? "break"
        : dayNumber <= daysElapsed
          ? "not_marked"
          : "future";

  const programTasksForDay = useMemo(() => {
    const all: any[] = (program as any)?.programTasks ?? [];
    return all.filter((t: any) => t.dayNumber === dayNumber)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [program, dayNumber]);

  const tasks: {
    id: string; title: string; order: number;
    description?: string | null; deliverables?: string | null; contentUrl?: string | null;
    proofType?: string; basePoints?: number; estimatedMinutes?: number; isMilestone?: boolean;
  }[] =
    programTasksForDay.length > 0
      ? programTasksForDay.map((t: any) => ({ ...t, order: t.sortOrder ?? 0 }))
      : Array.isArray(dayContent?.tasks)
        ? dayContent.tasks
        : [];

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [journalEntry, setJournalEntry] = useState("");
  const [dirty, setDirty] = useState(false);
  const [taskSubmissions, setTaskSubmissions] = useState<Record<string, TaskSubmissionProof>>({});
  const [uploadingTaskIds, setUploadingTaskIds] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (progress) {
      setCompletedTaskIds(progress.completedTaskIds ?? []);
      setJournalEntry(progress.journalEntry ?? "");
      setDirty(false);
    }
    // Seed task submission proofs from backend mySubmissions
    const mySubmissions: any[] = (program as any)?.mySubmissions ?? [];
    const seeded: Record<string, TaskSubmissionProof> = {};
    for (const sub of mySubmissions) {
      if (sub.taskId) {
        seeded[sub.taskId] = {
          value: sub.responseValue ?? undefined,
          url:   sub.proofUrl    ?? undefined,
          type:  sub.proofType   ?? "watch",
        };
      }
    }
    setTaskSubmissions(seeded);
  }, [progress?.dayNumber]);

  const handleFileSelect = async (taskId: string, file: File, proofType: string) => {
    if (!program?.batch?.id) return;
    setUploadingTaskIds((prev) => { const s = new Set(prev); s.add(taskId); return s; });
    try {
      const publicUrl = await uploadProof(file, program.batch.id, dayNumber);
      const next: Record<string, TaskSubmissionProof> = {
        ...taskSubmissions,
        [taskId]: { url: publicUrl, type: proofType },
      };
      setTaskSubmissions(next);
      await saveDraft.mutateAsync({ dayNumber, completedTaskIds, taskSubmissions: next });
    } catch {
      toast.error("Failed to upload proof");
    } finally {
      setUploadingTaskIds((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  // Real-time: update when admin approves or rejects this day
  useEffect(() => {
    if (!socket) return;
    const handleApproved = (payload: { dayNumber: number; xpAwarded: number }) => {
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
      toast.success(`Day ${payload.dayNumber} approved! +${payload.xpAwarded} XP`);
      if (payload.dayNumber === dayNumber) {
        router.replace("/batch-program");
      }
    };
    const handleRejected = (payload: { dayNumber: number; reviewNote: string }) => {
      queryClient.invalidateQueries({ queryKey: ["my-batch"] });
      toast.error(`Day ${payload.dayNumber} needs revision`);
    };
    socket.on("batch:day_approved", handleApproved);
    socket.on("batch:day_rejected", handleRejected);
    return () => {
      socket.off("batch:day_approved", handleApproved);
      socket.off("batch:day_rejected", handleRejected);
    };
  }, [socket]);

  const toggleTask = (id: string) => {
    if (isLocked) return;
    setCompletedTaskIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
    setDirty(true);
  };

  const handleJournalChange = (val: string) => {
    setJournalEntry(val);
    setDirty(true);
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft.mutateAsync({
        dayNumber,
        journalEntry: journalEntry || undefined,
        completedTaskIds,
        taskSubmissions: Object.keys(taskSubmissions).length > 0 ? taskSubmissions : undefined,
      });
      setDirty(false);
      toast.success(uiStrings?.batchProgressSaved ?? "Progress saved");
    } catch {
      toast.error(uiStrings?.batchProgressSaveError ?? "Failed to save progress");
    }
  };

  const handleSubmit = async () => {
    if (dirty) await handleSaveDraft();
    try {
      await submitDay.mutateAsync(dayNumber);
      toast.success(uiStrings?.batchSubmitSuccess ?? "Submitted for review!");
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to submit");
    }
  };

  const handleMarkPresent = async () => {
    try {
      await markAttendance.mutateAsync({ dayNumber });
      toast.success(uiStrings?.batchMarkPresentLabel ?? "Marked present");
    } catch {
      toast.error("Failed to mark attendance");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  if (!program?.batch) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        {uiStrings?.batchNotAssignedNote ?? "You are not currently assigned to a batch."}
      </div>
    );
  }

  const canEdit = !isLocked && !isFutureDay && status !== "pending_approval";
  const canMarkPresent =
    !isFutureDay && attStatus !== "present" && attStatus !== "break";
  const programName = (program as any).programName ?? program.batch.name;
  const embedUrl = dayContent?.resourceUrl ? getEmbedUrl(dayContent.resourceUrl) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Back + nav */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/batch-program")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={16} />
          {programName}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/batch-program/${dayNumber - 1}`)}
            disabled={dayNumber <= 1}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm px-2 text-muted-foreground">
            {dayNumber} / {totalDays}
          </span>
          <button
            onClick={() => router.push(`/batch-program/${dayNumber + 1}`)}
            disabled={dayNumber >= totalDays}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Prominent revision callout — shown before everything when day is rejected */}
      {status === "rejected" && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "color-mix(in srgb, #f59e0b 12%, transparent)",
            border: "1px solid #f59e0b",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>
              {uiStrings?.batchRevisionLabel ?? "Revision Requested"}
            </p>
          </div>
          <p className="text-sm mt-2 italic" style={{ color: "#f0f0f0" }}>
            {progress?.reviewNote?.trim()
              ? progress.reviewNote
              : "This day was sent back for revision. Please update and resubmit."}
          </p>
        </div>
      )}

      {/* Day header */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{
          borderColor: "var(--color-border, rgba(255,255,255,0.08))",
          background: "var(--color-bg-surface)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Day {dayNumber}
              </p>
              {dayContent?.category && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
                >
                  <Tag size={9} />
                  {dayContent.category}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug">
              {dayContent?.title ?? `Day ${dayNumber}`}
            </h2>
          </div>
          <StatusBadge status={status} labels={statusLabels} />
        </div>

        {/* Attendance status */}
        <div
          className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  attStatus === "present"
                    ? "#22c55e"
                    : attStatus === "break"
                      ? "#60a5fa"
                      : attStatus === "not_marked"
                        ? "#ef4444"
                        : "rgba(255,255,255,0.15)",
              }}
            />
            <span className="text-sm">
              {attStatus === "present"
                ? (uiStrings?.batchPresentLabel ?? "Present")
                : attStatus === "break"
                  ? (uiStrings?.batchBreakLabel ?? "Break")
                  : attStatus === "absent"
                    ? (uiStrings?.batchAbsentLabel ?? "Absent")
                    : attStatus === "not_marked"
                      ? (uiStrings?.batchNotMarkedLabel ?? "Not marked")
                      : "—"}
            </span>
          </div>
          {canMarkPresent && (
            <button
              onClick={handleMarkPresent}
              disabled={markAttendance.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
            >
              {markAttendance.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <UserCheck size={12} />
              )}
              {uiStrings?.batchMarkPresentLabel ?? "Mark Present"}
            </button>
          )}
        </div>

        {/* Status notes */}
        {isFutureDay && (
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Clock size={14} className="opacity-40" />
            <p className="text-sm text-muted-foreground">
              {uiStrings?.batchFutureNote ??
                "This day hasn't started yet. You can view but not submit."}
            </p>
          </div>
        )}
        {status === "pending_approval" && (
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl"
            style={{
              background: "rgba(167,139,250,0.08)",
              border: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <AlertCircle size={14} style={{ color: "#a78bfa" }} />
            <p className="text-sm" style={{ color: "#a78bfa" }}>
              {uiStrings?.batchPendingNote ??
                "Submitted for review — waiting for account manager approval"}
            </p>
          </div>
        )}
        {status === "approved" && (
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
            <p className="text-sm" style={{ color: "#22c55e" }}>
              {uiStrings?.batchApprovedNote ?? "Day approved by your account manager"}
            </p>
          </div>
        )}
        {dayContent?.resourceUrl && (
          embedUrl ? (
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={embedUrl}
                className="w-full h-full"
                style={{ border: 0 }}
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
                title="Resource video"
              />
            </div>
          ) : (
            <a
              href={dayContent.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-xl transition-colors"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              <ExternalLink size={14} />
              {uiStrings?.batchOpenResourceLabel ?? "Open Resource"}
            </a>
          )
        )}
        {dayContent?.notes && (
          <div
            className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pt-1 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            {dayContent.notes}
          </div>
        )}
      </div>

      {/* Tasks checklist */}
      {tasks.length > 0 && (
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{
            borderColor: "var(--color-border, rgba(255,255,255,0.08))",
            background: "var(--color-bg-surface)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {uiStrings?.batchChecklistLabel ?? "Checklist"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {completedTaskIds.length}/{tasks.length} {uiStrings?.batchDoneLabel ?? "done"}
            </span>
          </div>
          <div className="space-y-3">
            {tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((task) => {
              const done = completedTaskIds.includes(task.id);
              const proof = taskSubmissions[task.id];
              const isUploading = uploadingTaskIds.has(task.id);
              const proofType = task.proofType ?? "watch";
              const needsFileUpload = proofType === "image" || proofType === "file";
              const needsUrlInput   = proofType === "link"  || proofType === "video";
              const needsTextInput  = proofType === "text";
              const needsNoProof    = proofType === "watch";

              return (
                <div key={task.id} className="space-y-2">
                  <input
                    type="file"
                    accept={proofType === "image" ? "image/*" : "image/*,application/pdf,.zip"}
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[task.id] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(task.id, file, proofType);
                      e.target.value = "";
                    }}
                  />

                  {/* Task row — checkbox + title + meta */}
                  <div
                    onClick={() => canEdit && toggleTask(task.id)}
                    role="checkbox"
                    aria-checked={done}
                    className="w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: done
                        ? "rgba(34,197,94,0.3)"
                        : "var(--color-border, rgba(255,255,255,0.08))",
                      background: done ? "rgba(34,197,94,0.06)" : "transparent",
                      cursor: canEdit ? "pointer" : "default",
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
                      ) : (
                        <Circle size={18} className="opacity-30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block ${done ? "line-through opacity-60" : ""}`}>
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-[12px] opacity-50 mt-0.5 block">{task.description}</span>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {(task.basePoints ?? 0) > 0 && (
                          <span className="text-[11px] font-bold" style={{ color: "var(--color-accent)" }}>
                            +{task.basePoints} pts
                          </span>
                        )}
                        {(task.estimatedMinutes ?? 0) > 0 && (
                          <span className="text-[11px] opacity-40 flex items-center gap-1">
                            <Clock size={10} />
                            {task.estimatedMinutes}m
                          </span>
                        )}
                        {!needsNoProof && (
                          <span className="text-[10px] uppercase tracking-wider opacity-35 font-bold">
                            {proofType}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* File upload icon for image/file types */}
                    {canEdit && done && needsFileUpload && (
                      <div className="shrink-0">
                        {isUploading ? (
                          <Loader2 size={14} className="animate-spin opacity-40" />
                        ) : !proof?.url ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRefs.current[task.id]?.click(); }}
                            className="p-1 rounded transition-colors"
                            style={{ color: "#606060" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-accent)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#606060"; }}
                            title={uiStrings?.batchAttachProofLabel ?? "Attach proof"}
                          >
                            <Paperclip size={14} />
                          </button>
                        ) : (
                          <a
                            href={proof.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
                          >
                            <ExternalLink size={9} />
                            {uiStrings?.batchProofLabel ?? "Proof"}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Learning resource link */}
                  {task.contentUrl && (
                    <a
                      href={task.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg transition-colors"
                      style={{
                        background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                        color: "var(--color-accent)",
                      }}
                    >
                      <ExternalLink size={12} />
                      {uiStrings?.batchLearningResourceLabel ?? "Learning Resource"}
                    </a>
                  )}

                  {/* Deliverables hint */}
                  {task.deliverables && (
                    <div
                      className="px-3 py-2 rounded-lg text-[12px] leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }}
                    >
                      <span className="font-bold uppercase tracking-widest text-[10px] opacity-60 block mb-0.5">
                        {uiStrings?.batchDeliverablesLabel ?? "What to submit"}
                      </span>
                      {task.deliverables}
                    </div>
                  )}

                  {/* Text proof input */}
                  {canEdit && done && needsTextInput && (
                    <textarea
                      value={proof?.value ?? ""}
                      onChange={(e) => {
                        const next = { ...taskSubmissions, [task.id]: { value: e.target.value, type: proofType } };
                        setTaskSubmissions(next);
                        setDirty(true);
                      }}
                      rows={3}
                      placeholder={uiStrings?.batchTextProofPlaceholder ?? "Describe your proof or paste your response here…"}
                      className="w-full rounded-xl px-4 py-2.5 text-sm resize-none outline-none transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
                        color: "inherit",
                      }}
                    />
                  )}

                  {/* URL proof input */}
                  {canEdit && done && needsUrlInput && (
                    <input
                      type="url"
                      value={proof?.url ?? ""}
                      onChange={(e) => {
                        const next = { ...taskSubmissions, [task.id]: { url: e.target.value, type: proofType } };
                        setTaskSubmissions(next);
                        setDirty(true);
                      }}
                      placeholder={proofType === "video"
                        ? (uiStrings?.batchVideoUrlPlaceholder ?? "Paste your video URL…")
                        : (uiStrings?.batchLinkUrlPlaceholder  ?? "Paste your link URL…")}
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
                        color: "inherit",
                      }}
                    />
                  )}

                  {/* Submitted proof display (read-only when locked or pending) */}
                  {!canEdit && proof && (
                    <div className="px-3 py-2 rounded-lg text-[12px]" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="font-bold uppercase tracking-widest text-[10px] opacity-40 block mb-0.5">
                        {uiStrings?.batchSubmittedProofLabel ?? "Submitted proof"}
                      </span>
                      {proof.value && <p className="opacity-70 leading-relaxed">{proof.value}</p>}
                      {proof.url && (
                        <a href={proof.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 font-bold mt-1"
                          style={{ color: "var(--color-accent)" }}>
                          <ExternalLink size={11} />
                          {uiStrings?.batchViewProofLabel ?? "View proof"}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{
          borderColor: "var(--color-border, rgba(255,255,255,0.08))",
          background: "var(--color-bg-surface)",
        }}
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {uiStrings?.batchJournalLabel ?? "Daily Journal"}
          </h3>
        </div>
        <textarea
          value={journalEntry}
          onChange={(e) => handleJournalChange(e.target.value)}
          disabled={!canEdit}
          rows={6}
          placeholder={
            canEdit
              ? (uiStrings?.batchJournalPlaceholder ??
                "What did you do today? What did you learn? Any challenges?")
              : ""
          }
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
            color: "inherit",
            opacity: !canEdit ? 0.7 : 1,
          }}
        />
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saveDraft.isPending || !dirty}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
            style={{
              borderColor: "var(--color-border, rgba(255,255,255,0.12))",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {saveDraft.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {uiStrings?.batchSaveDraftLabel ?? "Save Draft"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitDay.isPending || saveDraft.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--color-accent)" }}
          >
            {submitDay.isPending || saveDraft.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {uiStrings?.batchSubmitLabel ?? "Submit for Review"}
          </button>
        </div>
      )}
    </div>
  );
}
