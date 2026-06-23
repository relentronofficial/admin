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
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { format, differenceInDays, isValid } from "date-fns";
import { cn } from "@/lib/utils";

const fmtDate = (d: any) => {
  if (!d) return "—";
  try { const dt = new Date(d); return isValid(dt) ? format(dt, "dd MMM yyyy") : "—"; } catch { return "—"; }
};

type Tab = "overview" | "program" | "progress";

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
      await upsert.mutateAsync({ batchId, dayNumber, title: title || undefined, notes: notes || undefined, resourceUrl: resourceUrl || undefined, tasks });
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
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left",
                        done ? "border-green-500/30 bg-green-500/08" : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#333]"
                      )}
                    >
                      {done ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" /> : <Circle size={14} className="text-[#444] flex-shrink-0" />}
                      <span className={cn("text-sm", done ? "text-green-300 line-through decoration-green-500/50" : "text-[#d0d0d0]")}>
                        {task.title}
                      </span>
                    </button>
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
  onClose,
  onCellClick,
}: {
  batchId: string;
  member: any;
  onClose: () => void;
  onCellClick: (member: any, dayNumber: number, progress: any, dayContent: any) => void;
}) {
  const { data: res, isLoading } = useGetMemberProgress(batchId, member.id);
  const progressArr: any[] = (res as any)?.data?.progress ?? [];
  const daysArr: any[] = (res as any)?.data?.days ?? [];

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
            <p className="text-[12px] text-[#606060] mt-0.5">{completedCount} / 90 days completed</p>
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
          <div className="flex-1 overflow-y-auto py-2">
            {Array.from({ length: 90 }, (_, i) => {
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

  // Modals
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [cellModal, setCellModal] = useState<{ member: any; dayNumber: number; progress: any; dayContent: any } | null>(null);
  const [timelineMember, setTimelineMember] = useState<any | null>(null);

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

  // Stats
  const stats = useMemo(() => {
    if (!batch) return null;
    const now = Date.now();
    const start = new Date(batch.startsAt).getTime();
    const daysElapsed = Math.min(90, Math.max(0, Math.floor((now - start) / 86_400_000)));
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
  }, [batch, members, progressMap, progressArr]);

  const DAYS = Array.from({ length: 90 }, (_, i) => i + 1);

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
            { id: "program", label: "Program (90 Days)", icon: BookOpen },
            { id: "progress", label: "Progress Grid", icon: Users },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id: tid, label, icon: Icon }) => (
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
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Members", value: stats.totalMembers, icon: Users, color: "#a0a0a0" },
                { label: "Days Elapsed", value: `${stats.daysElapsed} / 90`, icon: CalendarDays, color: "#a0a0a0" },
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
                    const pct = Math.round((m.completed / 90) * 100);
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
                            <span className="text-[11px] text-[#606060] flex-shrink-0">{m.completed}/90</span>
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
          </div>
        )}

        {/* ── Program Tab ── */}
        {activeTab === "program" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#606060]">
                {configuredDays.length} of 90 days configured
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
                    <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                      {day?.title ?? <span className="text-[#444] font-normal italic">Not configured</span>}
                    </p>
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
                  <p className="ml-auto text-[11px] text-[#444]">Click any cell to update progress</p>
                </div>

                {/* Scrollable grid */}
                <div className="overflow-x-auto">
                  <div style={{ minWidth: `${200 + 90 * 26}px` }}>
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
                    {members.map((member, mi) => {
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
              </div>
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
