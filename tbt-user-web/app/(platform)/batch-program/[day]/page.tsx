"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  Save,
  Send,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useMyBatchProgram, useSaveBatchDraft, useSubmitBatchDay } from "@/lib/hooks/useBatchProgram";

type DayStatus = "not_started" | "in_progress" | "pending_approval" | "approved" | "rejected";

function StatusBadge({ status }: { status: DayStatus }) {
  const cfg: Record<DayStatus, { label: string; color: string; bg: string }> = {
    not_started:      { label: "Not started",     color: "#888",    bg: "rgba(255,255,255,0.06)" },
    in_progress:      { label: "In progress",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    pending_approval: { label: "Pending review",   color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    approved:         { label: "Approved ✓",       color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    rejected:         { label: "Needs revision",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const c = cfg[status];
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

export default function BatchDayPage() {
  const { day } = useParams<{ day: string }>();
  const router = useRouter();
  const dayNumber = parseInt(day, 10);

  const { data: program, isLoading } = useMyBatchProgram();
  const saveDraft = useSaveBatchDraft();
  const submitDay = useSubmitBatchDay();

  // Find day content + progress
  const dayContent = useMemo(() =>
    program?.days?.find((d: any) => d.dayNumber === dayNumber) ?? null,
    [program, dayNumber]
  );
  const progress = useMemo(() =>
    program?.progress?.find((p: any) => p.dayNumber === dayNumber) ?? null,
    [program, dayNumber]
  );

  const status: DayStatus = (progress?.status ?? "not_started") as DayStatus;
  const isLocked = status === "approved";
  const tasks: { id: string; title: string; order: number }[] =
    Array.isArray(dayContent?.tasks) ? dayContent.tasks : [];

  // Local form state
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [journalEntry, setJournalEntry] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync from server on load
  useEffect(() => {
    if (progress) {
      setCompletedTaskIds(progress.completedTaskIds ?? []);
      setJournalEntry(progress.journalEntry ?? "");
      setDirty(false);
    }
  }, [progress?.dayNumber]);

  const toggleTask = (id: string) => {
    if (isLocked) return;
    setCompletedTaskIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    setDirty(true);
  };

  const handleJournalChange = (val: string) => {
    setJournalEntry(val);
    setDirty(true);
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft.mutateAsync({ dayNumber, journalEntry: journalEntry || undefined, completedTaskIds });
      setDirty(false);
      toast.success("Progress saved");
    } catch {
      toast.error("Failed to save progress");
    }
  };

  const handleSubmit = async () => {
    if (dirty) {
      await handleSaveDraft();
    }
    try {
      await submitDay.mutateAsync(dayNumber);
      toast.success("Submitted for review!");
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to submit");
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
        You are not currently assigned to a batch.
      </div>
    );
  }

  const canEdit = !isLocked && status !== "pending_approval";
  const canSubmit = !isLocked && status !== "pending_approval";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Back + nav */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/batch-program")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={16} />
          90-Day Program
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/batch-program/${dayNumber - 1}`)}
            disabled={dayNumber <= 1}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm px-2 text-muted-foreground">{dayNumber} / 90</span>
          <button
            onClick={() => router.push(`/batch-program/${dayNumber + 1}`)}
            disabled={dayNumber >= 90}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Day header */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Day {dayNumber}</p>
            <h2 className="text-xl font-bold leading-snug">
              {dayContent?.title ?? `Day ${dayNumber}`}
            </h2>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Rejection note */}
        {status === "rejected" && progress?.reviewNote && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <XCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
            <div>
              <p className="text-xs font-bold" style={{ color: "#ef4444" }}>Revision requested</p>
              <p className="text-sm mt-0.5">{progress.reviewNote}</p>
            </div>
          </div>
        )}

        {/* Pending note */}
        {status === "pending_approval" && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <AlertCircle size={14} style={{ color: "#a78bfa" }} />
            <p className="text-sm" style={{ color: "#a78bfa" }}>Submitted for review — waiting for account manager approval</p>
          </div>
        )}

        {/* Approved note */}
        {status === "approved" && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
            <p className="text-sm" style={{ color: "#22c55e" }}>Day approved by your account manager</p>
          </div>
        )}

        {/* Resource link */}
        {dayContent?.resourceUrl && (
          <a
            href={dayContent.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-xl transition-colors"
            style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", color: "var(--color-accent)" }}
          >
            <ExternalLink size={14} />
            Open Resource
          </a>
        )}

        {/* Notes */}
        {dayContent?.notes && (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {dayContent.notes}
          </div>
        )}
      </div>

      {/* Tasks checklist */}
      {tasks.length > 0 && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Checklist</h3>
            <span className="text-xs text-muted-foreground">{completedTaskIds.length}/{tasks.length} done</span>
          </div>
          <div className="space-y-2">
            {tasks.sort((a, b) => a.order - b.order).map(task => {
              const done = completedTaskIds.includes(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  disabled={!canEdit}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: done ? "rgba(34,197,94,0.3)" : "var(--color-border, rgba(255,255,255,0.08))",
                    background: done ? "rgba(34,197,94,0.06)" : "transparent",
                    cursor: canEdit ? "pointer" : "default",
                  }}
                >
                  {done
                    ? <CheckCircle2 size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
                    : <Circle size={18} className="opacity-30 flex-shrink-0" />}
                  <span className={`text-sm ${done ? "line-through opacity-60" : ""}`}>{task.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))", background: "var(--color-bg-surface)" }}>
        <div className="flex items-center gap-2">
          <FileText size={14} className="opacity-50" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Daily Journal</h3>
        </div>
        <textarea
          value={journalEntry}
          onChange={e => handleJournalChange(e.target.value)}
          disabled={!canEdit}
          rows={6}
          placeholder={canEdit ? "What did you do today? What did you learn? Any challenges?" : ""}
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
            {saveDraft.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitDay.isPending || saveDraft.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--color-accent)" }}
          >
            {(submitDay.isPending || saveDraft.isPending)
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />}
            Submit for Review
          </button>
        </div>
      )}
    </div>
  );
}
