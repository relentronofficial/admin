"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  BarChart2,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Link,
  NotebookPen,
  AlertCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Bell,
  ExternalLink,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetBatch,
  useListBatchDays,
  useUpsertBatchDay,
  useGetBatchProgress,
  useGetMemberProgress,
  useUpsertMemberProgress,
  useApproveBatchDay,
  useRejectBatchDay,
  useGetBatchPending,
  useGetBatchBreaks,
  useApproveBreak,
  useRejectBreak,
  useBulkApproveBatchDays,
  useUpsertMemberBatchSettings,
  useBatchDayAnalytics,
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { format, differenceInDays, isValid } from "date-fns";
import { cn } from "@/lib/utils";

const fmtDate = (d: any) => {
  if (!d) return "—";
  try { const dt = new Date(d); return isValid(dt) ? format(dt, "dd MMM yyyy") : "—"; } catch { return "—"; }
};

const dayToDate = (batchStartsAt: string, dayNumber: number) => {
  const d = new Date(batchStartsAt);
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

type Tab = "overview" | "program" | "progress" | "pending" | "breaks";

// ─── Day Edit Modal ────────────────────────────────────────────────────────────

type TaskItem = { id: string; title: string; order: number };

function DayEditModal({
  batchId,
  dayNumber,
  existing,
  onClose,
}: {
  batchId: string;
  dayNumber: number;
  existing: any;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [resourceUrl, setResourceUrl] = useState(existing?.resourceUrl ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [tasks, setTasks] = useState<TaskItem[]>(
    Array.isArray(existing?.tasks) ? existing.tasks : []
  );
  const [newTask, setNewTask] = useState("");
  const upsert = useUpsertBatchDay();

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(t => [...t, { id: crypto.randomUUID(), title: newTask.trim(), order: t.length }]);
    setNewTask("");
  };

  const removeTask = (id: string) => setTasks(t => t.filter(x => x.id !== id));

  const save = async () => {
    try {
      await upsert.mutateAsync({ batchId, dayNumber, title: title || undefined, notes: notes || undefined, resourceUrl: resourceUrl || undefined, category: category || undefined, tasks });
      toast.success(`Day ${dayNumber} saved`);
      onClose();
    } catch {
      toast.error("Failed to save day");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f] flex-shrink-0">
          <h2 className="text-[16px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">
            Day {dayNumber} — Configure
          </h2>
          <button onClick={onClose} className="text-[#606060] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1.5">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Day ${dayNumber} title…`}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1.5">Category</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Marketing, Health, Mindset…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1.5">
              <Link size={11} className="inline mr-1" />Resource URL
            </label>
            <input
              value={resourceUrl}
              onChange={e => setResourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1.5">
              <FileText size={11} className="inline mr-1" />Notes / Description
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="What should members do on this day…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-2">
              Checklist Tasks
            </label>
            <div className="space-y-2 mb-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="text-[#444] flex-shrink-0" />
                  <span className="text-sm text-[#d0d0d0] flex-1">{task.title}</span>
                  <button onClick={() => removeTask(task.id)} className="text-[#444] hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Add a task…"
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
              />
              <button
                onClick={addTask}
                className="flex items-center gap-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-[#a0a0a0] px-3 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#a0a0a0] hover:text-white transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={upsert.isPending}
            className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {upsert.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Day
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cell Modal (progress + approve/reject) ────────────────────────────────────

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  not_started:      { label: "Not started",     color: "#606060", bg: "#1f1f1f" },
  in_progress:      { label: "In progress",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  pending_approval: { label: "Pending review",   color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  approved:         { label: "Approved",         color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  rejected:         { label: "Needs revision",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

function CellModal({
  batchId,
  member,
  dayNumber,
  progress,
  dayContent,
  onClose,
}: {
  batchId: string;
  member: any;
  dayNumber: number;
  progress: any;
  dayContent: any;
  onClose: () => void;
}) {
  const [journalEntry, setJournalEntry] = useState(progress?.journalEntry ?? "");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(progress?.completedTaskIds ?? []);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const upsert = useUpsertMemberProgress();
  const approve = useApproveBatchDay();
  const reject = useRejectBatchDay();

  const tasks: TaskItem[] = Array.isArray(dayContent?.tasks) ? dayContent.tasks : [];
  const status: string = progress?.status ?? "not_started";
  const taskProofs: Record<string, string> | null = progress?.taskProofs ?? null;
  const statusCfg = STATUS_COLORS[status] ?? STATUS_COLORS.not_started;
  const isPending = status === "pending_approval";

  const toggleTask = (id: string) =>
    setCompletedTaskIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const save = async () => {
    try {
      await upsert.mutateAsync({ batchId, memberId: member.id, dayNumber, journalEntry: journalEntry || undefined, completedTaskIds });
      toast.success("Progress saved");
      onClose();
    } catch {
      toast.error("Failed to save progress");
    }
  };

  const handleApprove = async () => {
    try {
      await approve.mutateAsync({ batchId, memberId: member.id, dayNumber });
      toast.success("Day approved");
      onClose();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { toast.error("Please add a review note"); return; }
    try {
      await reject.mutateAsync({ batchId, memberId: member.id, dayNumber, reviewNote: rejectNote.trim() });
      toast.success("Sent back for revision");
      onClose();
    } catch {
      toast.error("Failed to reject");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-[15px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Day {dayNumber}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-[12px] text-[#606060]">
              {member.firstName} {member.lastName}
              {dayContent?.title && <span className="ml-2">— {dayContent.title}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Pending approval — approve/reject actions */}
          {isPending && (
            <div className="rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/08 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} style={{ color: "#a78bfa" }} />
                <p className="text-[13px] font-semibold" style={{ color: "#a78bfa" }}>Submitted for review</p>
              </div>
              {!showRejectForm ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={approve.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: "#22c55e" }}
                  >
                    {approve.isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                  >
                    <ThumbsDown size={14} />
                    Request Revision
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    rows={3}
                    placeholder="Explain what needs to be revised…"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#dc2626] resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRejectForm(false)} className="flex-1 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors">Cancel</button>
                    <button
                      onClick={handleReject}
                      disabled={reject.isPending}
                      className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                      style={{ background: "#ef4444" }}
                    >
                      {reject.isPending ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                      Send Revision
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejection note (if previously rejected) */}
          {status === "rejected" && progress?.reviewNote && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/08 p-3 flex items-start gap-2">
              <XCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="text-[11px] font-bold text-red-400 mb-0.5">Revision note</p>
                <p className="text-sm text-[#d0d0d0]">{progress.reviewNote}</p>
              </div>
            </div>
          )}

          {/* Checklist tasks */}
          {tasks.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-2">
                Tasks ({completedTaskIds.length}/{tasks.length})
              </p>
              <div className="space-y-1.5">
                {tasks.map(task => {
                  const done = completedTaskIds.includes(task.id);
                  const proof: string | undefined = taskProofs?.[task.id];
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      role="checkbox"
                      aria-checked={done}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left cursor-pointer",
                        done ? "border-green-500/30 bg-green-500/08" : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#333]"
                      )}
                    >
                      {done ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" /> : <Circle size={14} className="text-[#444] flex-shrink-0" />}
                      <span className={cn("text-sm flex-1", done ? "text-green-300 line-through decoration-green-500/50" : "text-[#d0d0d0]")}>
                        {task.title}
                      </span>
                      {proof && (
                        <a
                          href={proof}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 text-[11px] underline text-[#60a5fa] hover:text-blue-300 transition-colors"
                        >
                          View Proof
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Journal */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1.5">
              <NotebookPen size={11} className="inline mr-1" />Journal / Notes
            </label>
            <textarea
              value={journalEntry}
              onChange={e => setJournalEntry(e.target.value)}
              rows={4}
              placeholder="Member notes or progress details…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#a0a0a0] hover:text-white transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={upsert.isPending}
            className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {upsert.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Member Timeline Drawer ────────────────────────────────────────────────────

function MemberTimelineDrawer({
  batchId,
  member,
  totalDays,
  onClose,
  onCellClick,
}: {
  batchId: string;
  member: any;
  totalDays: number;
  onClose: () => void;
  onCellClick: (member: any, dayNumber: number, progress: any, dayContent: any) => void;
}) {
  const { data: res, isLoading } = useGetMemberProgress(batchId, member.id);
  const progressArr: any[] = (res as any)?.data?.progress ?? [];
  const daysArr: any[] = (res as any)?.data?.days ?? [];
  const extendedDays: number = (res as any)?.data?.extendedDays ?? 0;
  const effectiveTotalDays = totalDays + extendedDays;

  const [editingExtend, setEditingExtend] = useState(false);
  const [extendInput, setExtendInput] = useState(0);
  const [extendNotes, setExtendNotes] = useState("");
  const upsertSettings = useUpsertMemberBatchSettings();

  const progressMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const p of progressArr) m[p.dayNumber] = p;
    return m;
  }, [progressArr]);

  const daysMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const d of daysArr) m[d.dayNumber] = d;
    return m;
  }, [daysArr]);

  const completedCount = progressArr.filter(p => p.isCompleted).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border-l border-[#1f1f1f] w-full max-w-sm flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1f1f1f] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">
              {member.firstName} {member.lastName}
            </h2>
            <p className="text-[12px] text-[#606060] mt-0.5">{completedCount} / {effectiveTotalDays} days completed{extendedDays > 0 && ` (+${extendedDays} extended)`}</p>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#dc2626]" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-2">
              {Array.from({ length: effectiveTotalDays }, (_, i) => {
                const dayNum = i + 1;
                const prog = progressMap[dayNum];
                const dayContent = daysMap[dayNum];
                return (
                  <button
                    key={dayNum}
                    onClick={() => onCellClick(member, dayNum, prog, dayContent)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#1a1a1a] transition-colors text-left border-b border-[#111] group"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{
                        background: prog?.status === "approved" ? "#22c55e" : prog?.status === "pending_approval" ? "#a78bfa" : prog?.status === "rejected" ? "#ef4444" : prog?.status === "in_progress" ? "rgba(245,158,11,0.25)" : "#1f1f1f",
                        color: ["approved","pending_approval","rejected"].includes(prog?.status) ? "#fff" : prog?.status === "in_progress" ? "#f59e0b" : "#606060",
                      }}
                    >
                      {dayNum}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#d0d0d0] truncate">
                        {dayContent?.title ?? `Day ${dayNum}`}
                      </p>
                      {prog?.journalEntry && (
                        <p className="text-[11px] text-[#606060] truncate mt-0.5">{prog.journalEntry}</p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0"
                      style={{
                        background: prog?.status === "approved" ? "rgba(34,197,94,0.15)" : prog?.status === "pending_approval" ? "rgba(167,139,250,0.15)" : prog?.status === "rejected" ? "rgba(239,68,68,0.15)" : prog?.status === "in_progress" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                        color: prog?.status === "approved" ? "#22c55e" : prog?.status === "pending_approval" ? "#a78bfa" : prog?.status === "rejected" ? "#ef4444" : prog?.status === "in_progress" ? "#f59e0b" : "#444",
                      }}
                    >
                      {prog?.status === "approved" ? "Approved" : prog?.status === "pending_approval" ? "Pending" : prog?.status === "rejected" ? "Rejected" : prog?.status === "in_progress" ? "Draft" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Extend Days */}
            <div className="border-t border-[#1f1f1f] px-5 py-4 flex-shrink-0">
              {!editingExtend ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Extended Days</p>
                    <p className="text-[13px] text-[#f0f0f0] mt-0.5">
                      {extendedDays > 0 ? `+${extendedDays} days` : "None"}
                      <span className="text-[11px] text-[#606060] ml-1.5">(Total: {effectiveTotalDays})</span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setExtendInput(extendedDays); setExtendNotes(""); setEditingExtend(true); }}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] transition-all"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Extended Days</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-[#606060] block mb-1">Grace Days</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={extendInput}
                        onChange={e => setExtendInput(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-[#606060] block mb-1">Note</label>
                      <input
                        value={extendNotes}
                        onChange={e => setExtendNotes(e.target.value)}
                        placeholder="Optional…"
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingExtend(false)}
                      className="flex-1 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={upsertSettings.isPending}
                      onClick={async () => {
                        try {
                          await upsertSettings.mutateAsync({ batchId, memberId: member.id, extendedDays: extendInput, notes: extendNotes || undefined });
                          toast.success(`Extended by ${extendInput} days`);
                          setEditingExtend(false);
                        } catch {
                          toast.error("Failed to update");
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold text-white bg-[#dc2626] hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                      {upsertSettings.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Batch data
  const { data: batchRes, isLoading: batchLoading } = useGetBatch(id);
  const batch: any = (batchRes as any)?.data;

  // Program days
  const { data: daysRes } = useListBatchDays(id);
  const configuredDays: any[] = (daysRes as any)?.data ?? [];

  // Progress grid
  const { data: progressRes, isLoading: progressLoading } = useGetBatchProgress(id);
  const progressData: any = (progressRes as any)?.data ?? {};
  const members: any[] = progressData.members ?? [];
  const progressArr: any[] = progressData.progress ?? [];

  // Pending approvals
  const { data: pendingRes, isLoading: pendingLoading } = useGetBatchPending(id);
  const pendingRecords: any[] = (pendingRes as any)?.data ?? [];
  const approveDay = useApproveBatchDay();
  const rejectDay = useRejectBatchDay();
  const bulkApprove = useBulkApproveBatchDays();
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());

  // Day analytics
  const { data: dayAnalyticsRes } = useBatchDayAnalytics(id);
  const dayAnalytics: any[] = ((dayAnalyticsRes as any)?.data ?? []).filter((r: any) => r.total > 0);

  // Break requests
  const { data: breaksRes, isLoading: breaksLoading } = useGetBatchBreaks(id);
  const breakRecords: any[] = (breaksRes as any)?.data ?? [];
  const approveBreak = useApproveBreak();
  const rejectBreak = useRejectBreak();
  const [breakRejectId, setBreakRejectId] = useState<string | null>(null);
  const [breakRejectNote, setBreakRejectNote] = useState("");

  // Modals
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [cellModal, setCellModal] = useState<{ member: any; dayNumber: number; progress: any; dayContent: any } | null>(null);
  const [timelineMember, setTimelineMember] = useState<any | null>(null);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [pendingRejectNote, setPendingRejectNote] = useState("");
  const [progressFilter, setProgressFilter] = useState<"all" | "behind" | "pending_today">("all");
  const [progressView, setProgressView] = useState<"days" | "weeks">("days");

  const configuredDaysMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const d of configuredDays) m[d.dayNumber] = d;
    return m;
  }, [configuredDays]);

  const progressMap = useMemo(() => {
    const m: Record<string, Record<number, any>> = {};
    for (const p of progressArr) {
      if (!m[p.memberId]) m[p.memberId] = {};
      m[p.memberId][p.dayNumber] = p;
    }
    return m;
  }, [progressArr]);

  const totalDays: number = (batch as any)?.program?.durationDays ?? 90;

  // Stats
  const stats = useMemo(() => {
    if (!batch) return null;
    const now = Date.now();
    const start = new Date(batch.startsAt).getTime();
    const daysElapsed = Math.min(totalDays, Math.max(0, Math.floor((now - start) / 86_400_000)));
    const totalMembers = members.length;

    const memberStats = members.map(m => {
      const completed = Object.values(progressMap[m.id] ?? {}).filter((p: any) => p.isCompleted).length;
      const onTrack = completed >= Math.max(0, daysElapsed - 2);
      return { ...m, completed, onTrack };
    });

    const onTrackCount = memberStats.filter(m => m.onTrack).length;
    const behindCount = totalMembers - onTrackCount;
    const totalPossible = totalMembers * Math.max(1, daysElapsed);
    const totalCompleted = progressArr.filter(p => p.isCompleted).length;
    const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    return { daysElapsed, totalMembers, onTrackCount, behindCount, completionRate, memberStats };
  }, [batch, members, progressMap, progressArr, totalDays]);

  const DAYS = Array.from({ length: totalDays }, (_, i) => i + 1);

  const daysElapsed = useMemo(() => {
    if (!batch) return 0;
    const now = Date.now();
    const start = new Date(batch.startsAt).getTime();
    return Math.min(totalDays, Math.max(0, Math.floor((now - start) / 86_400_000)));
  }, [batch, totalDays]);

  const filteredMembers = useMemo(() => {
    if (progressFilter === "behind") {
      return members.filter(m => {
        const approved = Object.values(progressMap[m.id] ?? {}).filter((p: any) => p.status === "approved").length;
        return approved < Math.max(0, daysElapsed - 2);
      });
    }
    if (progressFilter === "pending_today") {
      return members.filter(m => (progressMap[m.id] ?? {})[daysElapsed]?.status === "pending_approval");
    }
    return members;
  }, [members, progressMap, progressFilter, daysElapsed]);

  const weeks = useMemo(
    () => Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => ({
      label: `W${i + 1}`,
      days: Array.from({ length: 7 }, (_, j) => i * 7 + j + 1).filter(d => d <= totalDays),
    })),
    [totalDays],
  );

  const weekCellColor = (memberProgress: Record<number, any>, days: number[]) => {
    const statuses = days.map(d => memberProgress[d]?.status).filter(Boolean);
    if (statuses.some(s => s === "rejected")) return "#ef4444";
    if (statuses.some(s => s === "pending_approval" || s === "in_progress")) return "#f59e0b";
    if (statuses.some(s => s === "approved")) return "#22c55e";
    return "#1f1f1f";
  };

  const atRisk = useMemo(() => {
    if (daysElapsed < 5) return [];
    return members
      .map(m => {
        const approved = Object.values(progressMap[m.id] ?? {}).filter((p: any) => p.status === "approved").length;
        const behind = daysElapsed - approved;
        return { ...m, approved, behind };
      })
      .filter(m => m.behind >= 5)
      .sort((a: any, b: any) => b.behind - a.behind);
  }, [members, progressMap, daysElapsed]);

  if (batchLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-[#dc2626]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout>
        <div className="text-center py-32 text-[#606060]">Batch not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/batches")}
            className="p-2 rounded-lg hover:bg-[#1f1f1f] text-[#606060] hover:text-[#f0f0f0] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <GraduationCap size={20} className="text-[#dc2626] flex-shrink-0" />
              <h1 className="text-[22px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide truncate">
                {batch.name}
              </h1>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider"
                style={batch.isActive
                  ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                  : { background: "rgba(255,255,255,0.06)", color: "#606060" }}
              >
                {batch.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-[13px] text-[#606060] mt-0.5 ml-7">
              Started {fmtDate(batch.startsAt)} · {batch._count?.members ?? members.length} members
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#141414] border border-[#1f1f1f] rounded-xl p-1 w-fit">
          {([
            { id: "overview", label: "Overview", icon: BarChart2 },
            { id: "program", label: `Program (${totalDays} Days)`, icon: BookOpen },
            { id: "progress", label: "Progress Grid", icon: Users },
            { id: "pending", label: "Pending", icon: Bell, badge: pendingRecords.length },
            { id: "breaks", label: "Breaks", icon: Clock, badge: breakRecords.filter((b: any) => b.status === 'pending').length },
          ] as { id: Tab; label: string; icon: any; badge?: number }[]).map(({ id: tid, label, icon: Icon, badge }) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all",
                activeTab === tid
                  ? "bg-[#dc2626] text-white"
                  : "text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]"
              )}
            >
              <Icon size={14} />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                  style={{ background: activeTab === tid ? "rgba(255,255,255,0.25)" : "#dc2626", color: "#fff" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Members", value: stats.totalMembers, icon: Users, color: "#a0a0a0" },
                { label: "Days Elapsed", value: `${stats.daysElapsed} / ${totalDays}`, icon: CalendarDays, color: "#a0a0a0" },
                { label: "On Track", value: stats.onTrackCount, icon: TrendingUp, color: "#22c55e" },
                { label: "Behind", value: stats.behindCount, icon: TrendingDown, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <s.icon size={15} style={{ color: s.color }} />
                    <p className="text-[11px] font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#606060" }}>{s.label}</p>
                  </div>
                  <p className="text-[28px] font-bold text-[#f0f0f0] leading-none">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Completion rate bar */}
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#606060]">Overall Completion Rate</p>
                <p className="text-[22px] font-bold text-[#f0f0f0]">{stats.completionRate}%</p>
              </div>
              <div className="h-3 bg-[#1f1f1f] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.completionRate}%`, background: "#dc2626" }}
                />
              </div>
              <p className="text-[12px] text-[#606060] mt-2">
                Based on {stats.daysElapsed} elapsed days × {stats.totalMembers} members
              </p>
            </div>

            {/* Member breakdown */}
            {stats.memberStats.length > 0 && (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1f1f1f]">
                  <p className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">Member Progress</p>
                </div>
                <div className="divide-y divide-[#1f1f1f]">
                  {stats.memberStats.map((m: any) => {
                    const pct = Math.round((m.completed / totalDays) * 100);
                    return (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-xs font-bold text-[#dc2626] flex-shrink-0">
                          {m.firstName?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#f0f0f0] font-medium truncate">{m.firstName} {m.lastName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: m.onTrack ? "#22c55e" : "#ef4444" }}
                              />
                            </div>
                            <span className="text-[11px] text-[#606060] flex-shrink-0">{m.completed}/{totalDays}</span>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0",
                          m.onTrack ? "bg-green-500/12 text-green-400" : "bg-red-500/12 text-red-400"
                        )}>
                          {m.onTrack ? "On Track" : "Behind"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day-by-Day Completion chart */}
            {dayAnalytics.length > 0 && (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1f1f1f]">
                  <p className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">Day-by-Day Completion</p>
                </div>
                <div className="p-5 space-y-2.5 max-h-80 overflow-y-auto">
                  {dayAnalytics.map((row: any) => {
                    const color = row.approvalRate >= 70 ? "#22c55e" : row.approvalRate >= 40 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={row.dayNumber} className="flex items-center gap-3">
                        <span className="text-[11px] text-[#606060] w-9 flex-shrink-0 font-rajdhani font-bold">
                          D{row.dayNumber}
                        </span>
                        <div className="flex-1 h-2 bg-[#1f1f1f] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${row.approvalRate}%`, background: color }}
                          />
                        </div>
                        <span className="text-[11px] font-bold w-8 text-right flex-shrink-0" style={{ color }}>
                          {row.approvalRate}%
                        </span>
                        <span className="text-[10px] text-[#444] w-14 flex-shrink-0">
                          {row.approved}/{row.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* At Risk Members */}
            {daysElapsed >= 5 && (
              atRisk.length === 0 ? (
                <div
                  className="flex items-center gap-3 px-5 py-4 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  <p className="text-[13px] text-green-400 font-semibold">All members are on track</p>
                </div>
              ) : (
                <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-5 py-4 border-b"
                    style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
                  >
                    <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
                    <p className="text-[13px] font-bold text-red-400 font-rajdhani uppercase tracking-wide">
                      At Risk — {atRisk.length} member{atRisk.length !== 1 ? "s" : ""} behind by 5+ days
                    </p>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {atRisk.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-xs font-bold text-[#dc2626] flex-shrink-0">
                          {m.firstName?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                            {m.firstName} {m.lastName}
                          </p>
                          <p className="text-[11px] text-[#606060] mt-0.5">
                            Day {m.approved} of {daysElapsed} — <span className="text-red-400 font-semibold">{m.behind} days behind</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setTimelineMember(m)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                          style={{ background: "#1f1f1f", color: "#a0a0a0" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f0f0f0"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#a0a0a0"; }}
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ── Program Tab ── */}
        {activeTab === "program" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#606060]">
                {configuredDays.length} of {totalDays} days configured
              </p>
            </div>
            {DAYS.map(dayNum => {
              const day = configuredDaysMap[dayNum];
              const tasks: TaskItem[] = Array.isArray(day?.tasks) ? day.tasks : [];
              return (
                <div
                  key={dayNum}
                  className="bg-[#141414] border border-[#1f1f1f] rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#2a2a2a] transition-all group"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{ background: day ? "#dc2626" : "#1f1f1f", color: day ? "#fff" : "#606060" }}
                  >
                    {dayNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                        {day?.title ?? <span className="text-[#444] font-normal italic">Not configured</span>}
                      </p>
                      {day?.category && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                          {day.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {tasks.length > 0 && (
                        <span className="text-[11px] text-[#606060] flex items-center gap-1">
                          <CheckCircle2 size={10} /> {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {day?.resourceUrl && (
                        <span className="text-[11px] text-[#606060] flex items-center gap-1">
                          <Link size={10} /> Resource
                        </span>
                      )}
                      {day?.notes && (
                        <span className="text-[11px] text-[#606060] flex items-center gap-1">
                          <FileText size={10} /> Notes
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingDay(dayNum)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] transition-all opacity-0 group-hover:opacity-100"
                  >
                    {day ? "Edit" : "Configure"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Progress Tab ── */}
        {activeTab === "progress" && (
          <div>
            {progressLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-[#dc2626]" />
              </div>
            ) : members.length === 0 ? (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
                <Users size={40} className="text-[#444] mx-auto mb-4" />
                <p className="text-[#606060] text-sm">No members in this batch yet.</p>
              </div>
            ) : (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
                {/* Filter toolbar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1f1f1f] flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Filter</span>
                  {(["all", "behind", "pending_today"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setProgressFilter(f)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={progressFilter === f
                        ? { background: "#dc2626", color: "#fff" }
                        : { background: "#1f1f1f", color: "#888" }}
                    >
                      {f === "all" ? "All" : f === "behind" ? "Behind" : "Pending Today"}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">View</span>
                    {(["days", "weeks"] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setProgressView(v)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize"
                        style={progressView === v
                          ? { background: "#1f1f1f", color: "#f0f0f0", border: "1px solid #333" }
                          : { background: "transparent", color: "#606060", border: "1px solid transparent" }}
                      >
                        {v === "days" ? "Days" : "Weeks"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1f1f1f] flex-wrap">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mr-2">Legend</p>
                  {[
                    { color: "#22c55e", label: "Approved" },
                    { color: "#a78bfa", label: "Pending" },
                    { color: "#ef4444", label: "Rejected" },
                    { color: "#f59e0b", label: "In Progress" },
                    { color: "#1f1f1f", label: "Not started" },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm border border-[#333]" style={{ background: l.color }} />
                      <span className="text-[11px] text-[#606060]">{l.label}</span>
                    </div>
                  ))}
                  <p className="ml-auto text-[11px] text-[#444]">
                    {filteredMembers.length} of {members.length} member{members.length !== 1 ? "s" : ""}
                    {progressView === "days" ? " · Click any cell to update" : ""}
                  </p>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="py-12 text-center text-[#606060] text-sm">No members match this filter.</div>
                ) : progressView === "days" ? (
                  /* ── Days grid ── */
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: `${200 + totalDays * 26}px` }}>
                      {/* Day header row */}
                      <div className="flex sticky top-0 z-10 bg-[#141414] border-b border-[#1f1f1f]">
                        <div className="w-[200px] flex-shrink-0 px-4 py-2.5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Member</span>
                        </div>
                        {DAYS.map(d => (
                          <div
                            key={d}
                            className="flex-shrink-0 text-center text-[10px] text-[#444] py-2.5 font-rajdhani font-bold"
                            style={{ width: 26 }}
                          >
                            {d % 5 === 0 || d === 1 ? d : ""}
                          </div>
                        ))}
                      </div>

                      {/* Member rows */}
                      {filteredMembers.map(member => {
                        const memberProgress = progressMap[member.id] ?? {};
                        return (
                          <div
                            key={member.id}
                            className="flex items-center border-b border-[#111] hover:bg-[#181818] transition-colors"
                          >
                            <button
                              className="w-[200px] flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 text-left hover:text-[#f0f0f0] transition-colors"
                              onClick={() => setTimelineMember(member)}
                            >
                              <div className="w-6 h-6 rounded-full bg-[#1f1f1f] flex items-center justify-center text-[10px] font-bold text-[#dc2626] flex-shrink-0">
                                {member.firstName?.[0]?.toUpperCase()}
                              </div>
                              <span className="text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0] truncate transition-colors">
                                {member.firstName} {member.lastName}
                              </span>
                            </button>
                            {DAYS.map(dayNum => {
                              const prog = memberProgress[dayNum];
                              const s = prog?.status;
                              const bg = s === "approved" ? "#22c55e"
                                : s === "pending_approval" ? "#a78bfa"
                                : s === "rejected" ? "#ef4444"
                                : s === "in_progress" ? "#f59e0b"
                                : "#1f1f1f";
                              return (
                                <div
                                  key={dayNum}
                                  className="flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 26, padding: 2 }}
                                >
                                  <button
                                    onClick={() => setCellModal({ member, dayNumber: dayNum, progress: prog, dayContent: configuredDaysMap[dayNum] })}
                                    className="w-full h-5 rounded-sm transition-all hover:scale-110 hover:opacity-80"
                                    style={{ background: bg }}
                                    title={`Day ${dayNum} — ${prog?.isCompleted ? "Completed" : prog?.journalEntry ? "In Progress" : "Not started"}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ── Weeks grid ── */
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: `${200 + weeks.length * 52}px` }}>
                      {/* Week header row */}
                      <div className="flex sticky top-0 z-10 bg-[#141414] border-b border-[#1f1f1f]">
                        <div className="w-[200px] flex-shrink-0 px-4 py-2.5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Member</span>
                        </div>
                        {weeks.map(w => (
                          <div
                            key={w.label}
                            className="flex-shrink-0 text-center text-[10px] text-[#444] py-2.5 font-rajdhani font-bold"
                            style={{ width: 52 }}
                          >
                            {w.label}
                          </div>
                        ))}
                      </div>

                      {/* Member rows */}
                      {filteredMembers.map(member => {
                        const memberProgress = progressMap[member.id] ?? {};
                        return (
                          <div
                            key={member.id}
                            className="flex items-center border-b border-[#111] hover:bg-[#181818] transition-colors"
                          >
                            <button
                              className="w-[200px] flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 text-left hover:text-[#f0f0f0] transition-colors"
                              onClick={() => setTimelineMember(member)}
                            >
                              <div className="w-6 h-6 rounded-full bg-[#1f1f1f] flex items-center justify-center text-[10px] font-bold text-[#dc2626] flex-shrink-0">
                                {member.firstName?.[0]?.toUpperCase()}
                              </div>
                              <span className="text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0] truncate transition-colors">
                                {member.firstName} {member.lastName}
                              </span>
                            </button>
                            {weeks.map(w => {
                              const bg = weekCellColor(memberProgress, w.days);
                              const daysInWeek = w.days.length;
                              const approvedInWeek = w.days.filter(d => memberProgress[d]?.status === "approved").length;
                              return (
                                <div
                                  key={w.label}
                                  className="flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 52, padding: 4 }}
                                >
                                  <div
                                    className="w-full h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all"
                                    style={{ background: bg, color: bg === "#1f1f1f" ? "#444" : "#fff" }}
                                    title={`${w.label}: ${approvedInWeek}/${daysInWeek} approved`}
                                  >
                                    {approvedInWeek}/{daysInWeek}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Pending Tab ── */}
        {activeTab === "pending" && (
          <div className="space-y-3">
            {pendingLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-[#dc2626]" />
              </div>
            ) : pendingRecords.length === 0 ? (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
                <CheckCircle2 size={36} className="text-green-500/40 mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No submissions pending review.</p>
              </div>
            ) : (
              <>
                {/* Select All row */}
                <div className="flex items-center gap-3 px-1 pb-1">
                  <input
                    type="checkbox"
                    checked={selectedPendingIds.size === pendingRecords.length}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedPendingIds(new Set(pendingRecords.map((r: any) => `${r.memberId}:${r.dayNumber}`)));
                      } else {
                        setSelectedPendingIds(new Set());
                      }
                    }}
                    className="w-4 h-4 accent-[#dc2626] cursor-pointer"
                  />
                  <span className="text-[12px] text-[#606060]">
                    {selectedPendingIds.size > 0
                      ? `${selectedPendingIds.size} of ${pendingRecords.length} selected`
                      : `Select all (${pendingRecords.length})`}
                  </span>
                </div>

                {pendingRecords.map((rec: any) => {
                  const selKey = `${rec.memberId}:${rec.dayNumber}`;
                  const isSelected = selectedPendingIds.has(selKey);
                  const isRejecting = pendingRejectId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className="bg-[#141414] rounded-xl p-5 space-y-3 transition-all"
                      style={{ border: isSelected ? "1px solid #dc2626" : "1px solid rgba(167,139,250,0.25)" }}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              const next = new Set(selectedPendingIds);
                              if (e.target.checked) next.add(selKey); else next.delete(selKey);
                              setSelectedPendingIds(next);
                            }}
                            className="w-4 h-4 accent-[#dc2626] cursor-pointer flex-shrink-0"
                          />
                          <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-xs font-bold text-[#dc2626] flex-shrink-0">
                            {rec.member?.firstName?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#f0f0f0]">
                              {rec.member?.firstName} {rec.member?.lastName}
                            </p>
                            <p className="text-[11px] text-[#606060]">{rec.member?.memberId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                            Day {rec.dayNumber}
                          </span>
                          {rec.submittedAt && (
                            <span className="text-[11px] text-[#606060]">
                              {format(new Date(rec.submittedAt), "dd MMM, HH:mm")}
                            </span>
                          )}
                        </div>
                      </div>

                      {rec.journalEntry && (
                        <p className="text-[13px] text-[#a0a0a0] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 line-clamp-3">
                          {rec.journalEntry}
                        </p>
                      )}

                      {/* Per-task submissions */}
                      {Array.isArray(rec.taskSubmissions) && rec.taskSubmissions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#555] font-rajdhani">Task Proofs</p>
                          {rec.taskSubmissions.map((sub: any) => (
                            <div key={sub.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold text-[#d0d0d0] flex-1 min-w-0 truncate">{sub.taskTitle ?? "Task"}</p>
                                <span className="text-[10px] uppercase font-bold font-rajdhani text-[#555] shrink-0">{sub.proofType}</span>
                              </div>
                              {sub.responseValue && (
                                <p className="text-[12px] text-[#888] leading-relaxed line-clamp-2">{sub.responseValue}</p>
                              )}
                              {sub.proofUrl && (
                                <a href={sub.proofUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-[11px] font-bold text-[#3b82f6] hover:text-blue-300 transition-colors">
                                  <ExternalLink size={10} />
                                  View proof
                                </a>
                              )}
                              {sub.deliverables && (
                                <p className="text-[10px] text-[#555] italic">{sub.deliverables}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {!isRejecting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await approveDay.mutateAsync({ batchId: id, memberId: rec.memberId, dayNumber: rec.dayNumber });
                                setSelectedPendingIds(prev => { const n = new Set(prev); n.delete(selKey); return n; });
                                toast.success(`Day ${rec.dayNumber} approved`);
                              } catch { toast.error("Failed to approve"); }
                            }}
                            disabled={approveDay.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                            style={{ background: "#22c55e" }}
                          >
                            {approveDay.isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                            Approve
                          </button>
                          <button
                            onClick={() => { setPendingRejectId(rec.id); setPendingRejectNote(""); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                          >
                            <ThumbsDown size={14} /> Request Revision
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={pendingRejectNote}
                            onChange={e => setPendingRejectNote(e.target.value)}
                            rows={2}
                            placeholder="Explain what needs to be revised…"
                            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#dc2626] resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setPendingRejectId(null)} className="flex-1 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]">
                              Cancel
                            </button>
                            <button
                              disabled={rejectDay.isPending}
                              onClick={async () => {
                                if (!pendingRejectNote.trim()) { toast.error("Add a review note"); return; }
                                try {
                                  await rejectDay.mutateAsync({ batchId: id, memberId: rec.memberId, dayNumber: rec.dayNumber, reviewNote: pendingRejectNote.trim() });
                                  setSelectedPendingIds(prev => { const n = new Set(prev); n.delete(selKey); return n; });
                                  toast.success("Sent back for revision");
                                  setPendingRejectId(null);
                                } catch { toast.error("Failed to reject"); }
                              }}
                              className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                              style={{ background: "#ef4444" }}
                            >
                              {rejectDay.isPending ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                              Send Revision
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Sticky bulk action bar */}
                {selectedPendingIds.size > 0 && (
                  <div
                    className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl px-5 py-3 shadow-2xl z-10"
                    style={{ background: "#181818", border: "1px solid #dc2626" }}
                  >
                    <span className="text-sm font-semibold text-[#f0f0f0]">
                      {selectedPendingIds.size} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPendingIds(new Set())}
                        className="px-4 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]"
                      >
                        Clear
                      </button>
                      <button
                        disabled={bulkApprove.isPending}
                        onClick={async () => {
                          const items = Array.from(selectedPendingIds).map(key => {
                            const [memberId, dayNumber] = key.split(":");
                            return { memberId, dayNumber: parseInt(dayNumber, 10) };
                          });
                          try {
                            const res: any = await bulkApprove.mutateAsync({ batchId: id, items });
                            setSelectedPendingIds(new Set());
                            toast.success(`${res?.approved ?? items.length} days approved`);
                          } catch { toast.error("Bulk approve failed"); }
                        }}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                        style={{ background: "#22c55e" }}
                      >
                        {bulkApprove.isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                        Approve {selectedPendingIds.size}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Breaks Tab ── */}
        {activeTab === "breaks" && (
          <div className="space-y-3">
            {breaksLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-[#dc2626]" />
              </div>
            ) : breakRecords.length === 0 ? (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
                <CheckCircle2 size={36} className="text-green-500/40 mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No break requests.</p>
              </div>
            ) : (
              breakRecords.map((rec: any) => {
                const isRejecting = breakRejectId === rec.id;
                return (
                  <div key={rec.id} className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-xs font-bold text-[#dc2626] flex-shrink-0">
                          {rec.first_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#f0f0f0]">
                            {rec.first_name} {rec.last_name}
                          </p>
                          <p className="text-[11px] text-[#606060]">{rec.member_code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                            Days {rec.start_day}–{rec.end_day}
                          </span>
                          <p className="text-[10px] text-[#606060] mt-1 px-1">
                            {dayToDate(batch.startsAt, rec.start_day)} – {dayToDate(batch.startsAt, rec.end_day)}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            background: rec.status === 'approved' ? "rgba(34,197,94,0.15)" : rec.status === 'rejected' ? "rgba(239,68,68,0.15)" : "rgba(167,139,250,0.15)",
                            color: rec.status === 'approved' ? "#22c55e" : rec.status === 'rejected' ? "#ef4444" : "#a78bfa",
                          }}>
                          {rec.status}
                        </span>
                      </div>
                    </div>
                    {rec.reason && (
                      <p className="text-[13px] text-[#a0a0a0] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
                        {rec.reason}
                      </p>
                    )}
                    {rec.status === 'pending' && (
                      !isRejecting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await approveBreak.mutateAsync({ batchId: id, reqId: rec.id });
                                toast.success("Break approved");
                              } catch { toast.error("Failed to approve break"); }
                            }}
                            disabled={approveBreak.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                            style={{ background: "#22c55e" }}
                          >
                            {approveBreak.isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                            Approve Break
                          </button>
                          <button
                            onClick={() => { setBreakRejectId(rec.id); setBreakRejectNote(""); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                          >
                            <ThumbsDown size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={breakRejectNote}
                            onChange={e => setBreakRejectNote(e.target.value)}
                            rows={2}
                            placeholder="Reason for rejecting…"
                            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#dc2626] resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setBreakRejectId(null)} className="flex-1 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]">
                              Cancel
                            </button>
                            <button
                              disabled={rejectBreak.isPending}
                              onClick={async () => {
                                try {
                                  await rejectBreak.mutateAsync({ batchId: id, reqId: rec.id, adminNote: breakRejectNote || undefined });
                                  toast.success("Break rejected");
                                  setBreakRejectId(null);
                                } catch { toast.error("Failed to reject break"); }
                              }}
                              className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                              style={{ background: "#ef4444" }}
                            >
                              {rejectBreak.isPending ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                              Confirm Reject
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Day Edit Modal ── */}
      {editingDay !== null && (
        <DayEditModal
          batchId={id}
          dayNumber={editingDay}
          existing={configuredDaysMap[editingDay]}
          onClose={() => setEditingDay(null)}
        />
      )}

      {/* ── Cell Modal ── */}
      {cellModal && (
        <CellModal
          batchId={id}
          member={cellModal.member}
          dayNumber={cellModal.dayNumber}
          progress={cellModal.progress}
          dayContent={cellModal.dayContent}
          onClose={() => setCellModal(null)}
        />
      )}

      {/* ── Member Timeline Drawer ── */}
      {timelineMember && (
        <MemberTimelineDrawer
          batchId={id}
          member={timelineMember}
          totalDays={totalDays}
          onClose={() => setTimelineMember(null)}
          onCellClick={(m, d, p, dc) => {
            setTimelineMember(null);
            setCellModal({ member: m, dayNumber: d, progress: p, dayContent: dc });
          }}
        />
      )}
    </DashboardLayout>
  );
}
