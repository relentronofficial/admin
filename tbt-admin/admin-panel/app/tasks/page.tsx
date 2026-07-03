"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, Pencil, Trash2, X, Loader2, CheckSquare, Star, Clock, Zap, Search,
  ChevronDown, ChevronRight, BookOpen, Calendar, ListChecks, Save, GripVertical,
  ClipboardList, Check, Eye, Link, FileText, RefreshCw, Filter,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListTasks, useCreateTaskInitiative, useUpdateTask, useDeleteTask, TaskInitiativeInput,
  useListBatchTasks, useCreateBatchTask, useUpdateBatchTask, useDeleteBatchTask,
  useReorderBatchTasks, useMigrateJsonTasks, useGetBatchSubmissions, useReviewTaskSubmission,
  useGetAllBatchTasks,
} from "@/lib/hooks/useTasks";
import {
  useListPrograms, useCreateProgram, useUpdateProgram, useDeleteProgram,
  useListBatches, useListBatchDays,
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const PROOF_TYPES = ["watch", "text", "image", "video", "link", "file"];

const STATUS_COLORS: Record<string, string> = {
  pending:  "text-yellow-400 bg-yellow-400/10",
  approved: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
  resubmission_required: "text-orange-400 bg-orange-400/10",
};

const emptyTaskForm = (): Partial<TaskInitiativeInput> => ({
  programId: "",
  stepId: "",
  dayNumber: 1,
  title: "",
  description: "",
  deliverables: "",
  contentUrl: "",
  basePoints: 100,
  proofType: "text",
  estimatedMinutes: 15,
  isMilestone: false,
  milestoneLabel: "",
  bonusPoints: 0,
  sortOrder: 0,
});

const emptyProgramForm = () => ({
  name: "",
  description: "",
  durationDays: 90,
});

const emptyInlineTaskForm = () => ({
  title: "",
  description: "",
  deliverables: "",
  contentUrl: "",
  basePoints: 50,
  proofType: "text",
  estimatedMinutes: 15,
  isMilestone: false,
  milestoneLabel: "",
  bonusPoints: 0,
  sortOrder: 0,
});

type Tab = "tasks" | "programs" | "batch-checklist" | "submissions" | "overview";

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<Tab>("tasks");

  // ── Task Initiative state ─────────────────────────────────────────────────────
  const [programFilter, setProgramFilter] = useState("");
  const [search, setSearch] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<TaskInitiativeInput>>(emptyTaskForm());

  // ── Program state ─────────────────────────────────────────────────────────────
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState(emptyProgramForm());

  // ── Batch Checklist state ─────────────────────────────────────────────────────
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [inlineModal, setInlineModal] = useState<{ dayNumber: number; task?: any } | null>(null);
  const [inlineForm, setInlineForm] = useState<ReturnType<typeof emptyInlineTaskForm>>(emptyInlineTaskForm());
  const [deletingInlineTask, setDeletingInlineTask] = useState<{ batchId: string; taskId: string } | null>(null);
  // drag-to-reorder per day: localMap stores reordered tasks for dirty days
  const [localTasksMap, setLocalTasksMap] = useState<Record<number, any[]>>({});
  const [dirtyDayOrders, setDirtyDayOrders] = useState<Set<number>>(new Set());
  const dragFrom = useRef<{ dayNumber: number; idx: number } | null>(null);
  const [dragOverMap, setDragOverMap] = useState<Record<number, number>>({});

  // ── Submissions state ─────────────────────────────────────────────────────────
  const [subBatchId, setSubBatchId] = useState("");
  const [subDayFilter, setSubDayFilter] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("");
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ subId: string; feedback: string } | null>(null);

  // ── Overview state ────────────────────────────────────────────────────────────
  const [overviewBatchId, setOverviewBatchId] = useState("");

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  const { data: tasksData, isLoading: tasksLoading } = useListTasks(programFilter ? { programId: programFilter } : undefined);
  const { data: programsData, isLoading: programsLoading } = useListPrograms();
  const { data: batchesData } = useListBatches();
  const { data: batchDaysData, isLoading: batchDaysLoading } = useListBatchDays(selectedBatchId);
  const { data: batchTasksData, isLoading: batchTasksLoading } = useListBatchTasks(selectedBatchId);

  const { data: submissionsData, isLoading: submissionsLoading } = useGetBatchSubmissions(
    subBatchId,
    {
      dayNumber: subDayFilter ? Number(subDayFilter) : undefined,
      status:    subStatusFilter || undefined,
    },
  );
  const { data: overviewTasksData, isLoading: overviewLoading } = useGetAllBatchTasks(overviewBatchId);

  const createTask    = useCreateTaskInitiative();
  const updateTask    = useUpdateTask();
  const deleteTask    = useDeleteTask();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();

  const createInlineTask   = useCreateBatchTask();
  const updateInlineTask   = useUpdateBatchTask();
  const deleteInlineTask   = useDeleteBatchTask();
  const reorderInlineTasks = useReorderBatchTasks();
  const migrateJson        = useMigrateJsonTasks();
  const reviewSubmission   = useReviewTaskSubmission();

  const tasks: any[]    = tasksData?.data || tasksData || [];
  const programs: any[] = (programsData as any)?.data || programsData || [];
  const batches: any[]  = (batchesData as any)?.data  || batchesData  || [];
  const batchDays: any[] = (batchDaysData as any)?.data || batchDaysData || [];
  const allBatchTasks: any[] = batchTasksData ?? [];
  const submissions: any[] = (submissionsData as any)?.data ?? submissionsData ?? [];
  const overviewTasks: any[] = overviewTasksData ?? [];

  const filteredTasks = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase())
  );

  // Reset local reorder state when batch changes or server data refreshes
  useEffect(() => {
    setLocalTasksMap({});
    setDirtyDayOrders(new Set());
  }, [selectedBatchId, batchTasksData]);

  // ── Helpers ────────────────────────────────────────────────────────────────────
  function tasksForDay(dayNumber: number) {
    if (dirtyDayOrders.has(dayNumber)) {
      return localTasksMap[dayNumber] ?? [];
    }
    return allBatchTasks
      .filter((t: any) => t.dayNumber === dayNumber)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  }

  // ── Task Initiative handlers ──────────────────────────────────────────────────
  const setTaskField = (key: keyof TaskInitiativeInput, value: any) =>
    setTaskForm(f => ({ ...f, [key]: value }));

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ ...emptyTaskForm(), programId: programFilter || "" });
    setTaskModalOpen(true);
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setTaskForm({
      programId:        task.programId  || "",
      stepId:           task.stepId     || "",
      dayNumber:        task.dayNumber,
      title:            task.title,
      description:      task.description  || "",
      deliverables:     task.deliverables || "",
      contentUrl:       task.contentUrl   || "",
      basePoints:       task.basePoints,
      proofType:        task.proofType,
      estimatedMinutes: task.estimatedMinutes,
      isMilestone:      task.isMilestone,
      milestoneLabel:   task.milestoneLabel || "",
      bonusPoints:      task.bonusPoints,
      sortOrder:        task.sortOrder,
    });
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = async () => {
    if (!taskForm.title?.trim()) { toast.error("Title is required"); return; }
    if (!taskForm.programId)     { toast.error("Program is required"); return; }
    if (!taskForm.dayNumber || taskForm.dayNumber < 1) { toast.error("Day must be ≥ 1"); return; }
    try {
      if (editingTask) {
        const { programId, ...rest } = taskForm;
        await updateTask.mutateAsync({ id: editingTask.id, data: rest });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(taskForm as TaskInitiativeInput);
        toast.success("Task created");
      }
      setTaskModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save task");
    }
  };

  const handleTaskDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Task deleted");
      setDeletingTaskId(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  // ── Program handlers ──────────────────────────────────────────────────────────
  const setProgramField = (key: string, value: any) =>
    setProgramForm(f => ({ ...f, [key]: value }));

  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm(emptyProgramForm());
    setProgramModalOpen(true);
  };

  const openEditProgram = (prog: any) => {
    setEditingProgram(prog);
    setProgramForm({
      name:        prog.name        || "",
      description: prog.description || "",
      durationDays: prog.durationDays ?? 90,
    });
    setProgramModalOpen(true);
  };

  const handleProgramSubmit = async () => {
    if (!programForm.name.trim()) { toast.error("Program name is required"); return; }
    try {
      if (editingProgram) {
        await updateProgram.mutateAsync({ id: editingProgram.id, data: programForm });
        toast.success("Program updated");
      } else {
        await createProgram.mutateAsync(programForm);
        toast.success("Program created");
      }
      setProgramModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save program");
    }
  };

  const handleProgramDelete = async (id: string) => {
    try {
      await deleteProgram.mutateAsync(id);
      toast.success("Program deleted");
      setDeletingProgramId(null);
    } catch {
      toast.error("Failed to delete program");
    }
  };

  // ── Batch Checklist handlers ──────────────────────────────────────────────────
  function toggleDayExpand(dayNumber: number) {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber); else next.add(dayNumber);
      return next;
    });
  }

  function openAddInlineTask(dayNumber: number) {
    setInlineForm({ ...emptyInlineTaskForm(), sortOrder: tasksForDay(dayNumber).length });
    setInlineModal({ dayNumber });
  }

  function openEditInlineTask(dayNumber: number, task: any) {
    setInlineForm({
      title:            task.title,
      description:      task.description      || "",
      deliverables:     task.deliverables     || "",
      contentUrl:       task.contentUrl       || "",
      basePoints:       task.basePoints       ?? 50,
      proofType:        task.proofType        || "text",
      estimatedMinutes: task.estimatedMinutes ?? 15,
      isMilestone:      task.isMilestone      ?? false,
      milestoneLabel:   task.milestoneLabel   || "",
      bonusPoints:      task.bonusPoints      ?? 0,
      sortOrder:        task.sortOrder        ?? 0,
    });
    setInlineModal({ dayNumber, task });
  }

  const handleInlineTaskSubmit = async () => {
    if (!inlineForm.title.trim()) { toast.error("Title is required"); return; }
    if (!inlineModal) return;
    try {
      if (inlineModal.task) {
        await updateInlineTask.mutateAsync({
          batchId: selectedBatchId,
          taskId:  inlineModal.task.id,
          data:    inlineForm,
        });
        toast.success("Task updated");
      } else {
        await createInlineTask.mutateAsync({
          batchId: selectedBatchId,
          data: { ...inlineForm, dayNumber: inlineModal.dayNumber },
        });
        toast.success("Task added");
      }
      setInlineModal(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save task");
    }
  };

  const handleInlineTaskDelete = async () => {
    if (!deletingInlineTask) return;
    try {
      await deleteInlineTask.mutateAsync(deletingInlineTask);
      toast.success("Task deleted");
      setDeletingInlineTask(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  // DnD reorder
  function onDragStart(dayNumber: number, idx: number) {
    dragFrom.current = { dayNumber, idx };
  }

  function onDragOverItem(dayNumber: number, idx: number) {
    setDragOverMap(m => ({ ...m, [dayNumber]: idx }));
  }

  function onDropItem(dayNumber: number, dropIdx: number) {
    const from = dragFrom.current;
    if (!from || from.dayNumber !== dayNumber || from.idx === dropIdx) {
      setDragOverMap(m => { const n = { ...m }; delete n[dayNumber]; return n; });
      dragFrom.current = null;
      return;
    }
    const current = [...tasksForDay(dayNumber)];
    const [moved] = current.splice(from.idx, 1);
    current.splice(dropIdx, 0, moved);
    setLocalTasksMap(m => ({ ...m, [dayNumber]: current }));
    setDirtyDayOrders(s => new Set(s).add(dayNumber));
    setDragOverMap(m => { const n = { ...m }; delete n[dayNumber]; return n; });
    dragFrom.current = null;
  }

  const handleSaveOrder = async (dayNumber: number) => {
    const ordered = localTasksMap[dayNumber] ?? [];
    try {
      await reorderInlineTasks.mutateAsync({
        batchId: selectedBatchId,
        ids: ordered.map((t: any) => t.id),
      });
      toast.success(`Day ${dayNumber} order saved`);
      setDirtyDayOrders(s => { const n = new Set(s); n.delete(dayNumber); return n; });
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleMigrateJson = async () => {
    if (!selectedBatchId) return;
    try {
      const res: any = await migrateJson.mutateAsync(selectedBatchId);
      toast.success(`Migrated ${res?.created ?? 0} tasks from JSON`);
    } catch (err: any) {
      toast.error(err.message || "Migration failed");
    }
  };

  // ── Submission handlers ───────────────────────────────────────────────────────
  const handleApprove = async (subId: string) => {
    try {
      await reviewSubmission.mutateAsync({ subId, action: "approve" });
      toast.success("Submission approved");
      setExpandedSubId(null);
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    try {
      await reviewSubmission.mutateAsync({
        subId:    rejectModal.subId,
        action:   "reject",
        feedback: rejectModal.feedback || undefined,
      });
      toast.success("Submission rejected");
      setRejectModal(null);
      setExpandedSubId(null);
    } catch {
      toast.error("Failed to reject");
    }
  };

  const isSavingTask    = createTask.isPending    || updateTask.isPending;
  const isSavingProgram = createProgram.isPending || updateProgram.isPending;
  const isSavingInline  = createInlineTask.isPending || updateInlineTask.isPending;
  const selectedBatch   = batches.find((b: any) => b.id === selectedBatchId);

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Tasks</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">Manage programs, task initiatives, per-day checklists and submission reviews.</p>
            </div>
          </div>
          {activeTab === "tasks" && (
            <button
              onClick={openCreateTask}
              className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 shrink-0"
            >
              <Plus size={16} strokeWidth={3} />
              Add Task
            </button>
          )}
          {activeTab === "programs" && (
            <button
              onClick={openCreateProgram}
              className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 shrink-0"
            >
              <Plus size={16} strokeWidth={3} />
              Add Program
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#2a2a2a]">
          {(["tasks", "programs", "batch-checklist", "submissions", "overview"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-[12px] font-bold font-rajdhani uppercase tracking-widest border-b-2 -mb-px transition-all",
                activeTab === tab
                  ? "text-[#dc2626] border-[#dc2626]"
                  : "text-[#666] border-transparent hover:text-[#a0a0a0]"
              )}
            >
              {tab === "tasks"           && <CheckSquare size={14} />}
              {tab === "programs"        && <BookOpen size={14} />}
              {tab === "batch-checklist" && <ListChecks size={14} />}
              {tab === "submissions"     && <ClipboardList size={14} />}
              {tab === "overview"        && <Eye size={14} />}
              {tab === "tasks"           ? "Tasks"
               : tab === "programs"        ? "Programs"
               : tab === "batch-checklist" ? "Batch Checklist"
               : tab === "submissions"     ? "Submissions"
               :                             "Overview"}
            </button>
          ))}
        </div>

        {/* ── TASKS TAB ─────────────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-4 text-sm text-white outline-none focus:border-[#dc2626] transition-all"
                />
              </div>
              <div className="relative">
                <select
                  value={programFilter}
                  onChange={e => setProgramFilter(e.target.value)}
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
                >
                  <option value="">All Programs</option>
                  {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
            </div>

            {programs.length === 0 && !programsLoading && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center gap-3">
                <BookOpen size={18} className="text-[#dc2626] shrink-0" />
                <p className="text-[13px] text-[#888]">
                  No programs yet. Switch to{" "}
                  <button onClick={() => setActiveTab("programs")} className="text-[#dc2626] font-bold underline">Programs</button>{" "}
                  to create one before adding tasks.
                </p>
              </div>
            )}

            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <CheckSquare size={36} className="text-[#333]" />
                  <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No tasks found</p>
                  <button onClick={openCreateTask} className="text-[#dc2626] text-[12px] font-bold font-rajdhani uppercase tracking-widest hover:underline">+ Add your first task</button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#222]">
                      {["Day", "Title", "Program", "Proof", "Points", "Est.", "Milestone", ""].map(h => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, i) => (
                      <tr key={task.id} className={cn("border-b border-[#1e1e1e] hover:bg-[#1f1f1f] transition-colors", i === filteredTasks.length - 1 && "border-b-0")}>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#dc2626]/10 text-[#dc2626] text-[12px] font-bold font-rajdhani">{task.dayNumber}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] text-[#f0f0f0] font-medium">{task.title}</p>
                          {task.description && <p className="text-[11px] text-[#666] mt-0.5 line-clamp-1">{task.description}</p>}
                        </td>
                        <td className="px-5 py-3.5"><span className="text-[12px] text-[#a0a0a0]">{task.program?.name || "—"}</span></td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] text-[#a0a0a0] uppercase tracking-wider font-rajdhani font-bold">{task.proofType}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <Zap size={12} className="text-yellow-500" />
                            <span className="text-[13px] text-[#f0f0f0] font-medium">{task.basePoints}</span>
                            {task.bonusPoints > 0 && <span className="text-[11px] text-green-400">+{task.bonusPoints}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><div className="flex items-center gap-1 text-[12px] text-[#888]"><Clock size={11} />{task.estimatedMinutes}m</div></td>
                        <td className="px-5 py-3.5">
                          {task.isMilestone ? (
                            <div className="flex items-center gap-1"><Star size={13} className="text-yellow-400 fill-yellow-400" /><span className="text-[11px] text-yellow-400 font-bold font-rajdhani uppercase">{task.milestoneLabel || "Milestone"}</span></div>
                          ) : <span className="text-[#444] text-[12px]">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => openEditTask(task)} className="p-1.5 rounded-lg text-[#666] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all"><Pencil size={13} /></button>
                            <button onClick={() => setDeletingTaskId(task.id)} className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── PROGRAMS TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "programs" && (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
            {programsLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
            ) : programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <BookOpen size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No programs yet</p>
                <button onClick={openCreateProgram} className="text-[#dc2626] text-[12px] font-bold font-rajdhani uppercase tracking-widest hover:underline">+ Create your first program</button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222]">
                    {["Program", "Duration", "Tasks", ""].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {programs.map((prog, i) => {
                    const taskCount: number = (prog as any)._count?.tasks ?? 0;
                    return (
                      <tr key={prog.id} className={cn("border-b border-[#1e1e1e] hover:bg-[#1f1f1f] transition-colors", i === programs.length - 1 && "border-b-0")}>
                        <td className="px-5 py-4">
                          <p className="text-[14px] text-[#f0f0f0] font-semibold">{prog.name}</p>
                          {prog.description && <p className="text-[12px] text-[#666] mt-0.5 line-clamp-2">{prog.description}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-[13px] text-[#a0a0a0]"><Calendar size={13} className="text-[#666]" />{prog.durationDays ?? 90} days</div>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => { setActiveTab("tasks"); setProgramFilter(prog.id); }} className="text-[12px] text-[#dc2626] font-bold font-rajdhani uppercase tracking-widest hover:underline">
                            {taskCount} task{taskCount !== 1 ? "s" : ""}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => openEditProgram(prog)} className="p-1.5 rounded-lg text-[#666] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all"><Pencil size={13} /></button>
                            <button onClick={() => setDeletingProgramId(prog.id)} className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── BATCH CHECKLIST TAB ───────────────────────────────────────────────── */}
        {activeTab === "batch-checklist" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative">
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer min-w-[220px]"
                >
                  <option value="">Select a batch…</option>
                  {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              {selectedBatch && (
                <span className="text-[12px] text-[#666] font-rajdhani font-bold uppercase tracking-widest">
                  {batchDays.length} days · {allBatchTasks.length} tasks
                </span>
              )}
              {selectedBatchId && (
                <button
                  onClick={handleMigrateJson}
                  disabled={migrateJson.isPending}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-[#181818] text-[#888] hover:text-white hover:border-[#444] text-[12px] font-bold font-rajdhani uppercase tracking-wider transition-all disabled:opacity-50"
                  title="Convert legacy JSON tasks in batch days to structured task rows"
                >
                  {migrateJson.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Migrate JSON Tasks
                </button>
              )}
            </div>

            {!selectedBatchId ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-20 gap-3">
                <ListChecks size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">Select a batch to manage its daily tasks</p>
              </div>
            ) : batchDaysLoading || batchTasksLoading ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[#dc2626]" />
              </div>
            ) : batchDays.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
                <Calendar size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No days configured for this batch</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden divide-y divide-[#1e1e1e]">
                {batchDays
                  .slice()
                  .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
                  .map((day: any) => {
                    const dayTasks   = tasksForDay(day.dayNumber);
                    const isExpanded = expandedDays.has(day.dayNumber);
                    const isDirty    = dirtyDayOrders.has(day.dayNumber);

                    return (
                      <div key={day.dayNumber}>
                        <button
                          onClick={() => toggleDayExpand(day.dayNumber)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#1f1f1f] transition-colors text-left"
                        >
                          <span className={cn("transition-transform duration-150", isExpanded ? "rotate-90" : "rotate-0")}>
                            <ChevronRight size={15} className="text-[#555]" />
                          </span>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#dc2626]/10 text-[#dc2626] text-[12px] font-bold font-rajdhani shrink-0">
                            {day.dayNumber}
                          </span>
                          <span className="flex-1 text-[13px] text-[#f0f0f0] font-medium">{day.title || `Day ${day.dayNumber}`}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            {isDirty && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved order" />}
                            <span className="text-[12px] text-[#666] font-rajdhani font-bold uppercase tracking-wider">
                              {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 bg-[#141414] border-t border-[#1e1e1e]">
                            <div className="space-y-1.5 mb-3">
                              {dayTasks.length === 0 ? (
                                <p className="text-[12px] text-[#555] py-2 text-center font-rajdhani uppercase tracking-wider">No tasks yet</p>
                              ) : (
                                dayTasks.map((task: any, idx: number) => (
                                  <div
                                    key={task.id}
                                    className={cn(
                                      "flex items-center gap-2 group rounded-lg px-2 py-1.5 transition-colors",
                                      dragOverMap[day.dayNumber] === idx ? "bg-[#dc2626]/10" : "hover:bg-[#1a1a1a]"
                                    )}
                                    draggable
                                    onDragStart={() => onDragStart(day.dayNumber, idx)}
                                    onDragOver={e => { e.preventDefault(); onDragOverItem(day.dayNumber, idx); }}
                                    onDrop={() => onDropItem(day.dayNumber, idx)}
                                    onDragEnd={() => setDragOverMap(m => { const n = { ...m }; delete n[day.dayNumber]; return n; })}
                                  >
                                    <GripVertical size={14} className="text-[#333] shrink-0 cursor-grab" />
                                    <span className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-[#666] font-bold font-rajdhani flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] text-[#f0f0f0] font-medium truncate">{task.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-[#666] uppercase font-rajdhani font-bold">{task.proofType}</span>
                                        <span className="text-[10px] text-yellow-500 font-bold">{task.basePoints}pts</span>
                                        {task.isMilestone && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button
                                        onClick={() => openEditInlineTask(day.dayNumber, task)}
                                        className="p-1 rounded text-[#666] hover:text-white hover:bg-[#2a2a2a] transition-all"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => setDeletingInlineTask({ batchId: selectedBatchId, taskId: task.id })}
                                        className="p-1 rounded text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => openAddInlineTask(day.dayNumber)}
                                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#555] text-[12px] font-bold font-rajdhani uppercase tracking-wider transition-all"
                              >
                                <Plus size={13} />
                                Add Task
                              </button>
                              {isDirty && (
                                <button
                                  onClick={() => handleSaveOrder(day.dayNumber)}
                                  disabled={reorderInlineTasks.isPending}
                                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#dc2626] text-white text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                  {reorderInlineTasks.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Save Order
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {/* ── SUBMISSIONS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "submissions" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <select
                  value={subBatchId}
                  onChange={e => { setSubBatchId(e.target.value); setSubDayFilter(""); setExpandedSubId(null); }}
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="">Select batch…</option>
                  {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
                <input
                  type="number"
                  min={1}
                  value={subDayFilter}
                  onChange={e => setSubDayFilter(e.target.value)}
                  placeholder="Day #"
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-4 text-sm text-white outline-none focus:border-[#dc2626] w-24"
                />
              </div>
              <div className="relative">
                <select
                  value={subStatusFilter}
                  onChange={e => setSubStatusFilter(e.target.value)}
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              {submissions.length > 0 && (
                <span className="text-[12px] text-[#666] font-rajdhani font-bold uppercase tracking-widest ml-auto">
                  {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {!subBatchId ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-20 gap-3">
                <ClipboardList size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">Select a batch to view task submissions</p>
              </div>
            ) : submissionsLoading ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[#dc2626]" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
                <ClipboardList size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No submissions found</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden divide-y divide-[#1e1e1e]">
                {submissions.map((sub: any) => {
                  const isExpanded = expandedSubId === sub.id;
                  const statusCls  = STATUS_COLORS[sub.status] ?? "text-[#888] bg-[#888]/10";

                  return (
                    <div key={sub.id}>
                      <button
                        onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1f1f1f] transition-colors text-left"
                      >
                        <span className={cn("transition-transform duration-150", isExpanded ? "rotate-90" : "rotate-0")}>
                          <ChevronRight size={14} className="text-[#555]" />
                        </span>
                        <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                          <div>
                            <p className="text-[13px] text-[#f0f0f0] font-medium truncate">{sub.memberName || sub.member?.name || "—"}</p>
                            <p className="text-[11px] text-[#666]">{sub.memberPhone || sub.member?.phone || ""}</p>
                          </div>
                          <div>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#dc2626]/10 text-[#dc2626] text-[12px] font-bold font-rajdhani">
                              {sub.dayNumber}
                            </span>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#a0a0a0] truncate">{sub.taskTitle || sub.task?.title || "—"}</p>
                            <p className="text-[10px] text-[#555] uppercase font-rajdhani font-bold">{sub.proofType || sub.task?.proofType || ""}</p>
                          </div>
                          <div>
                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold font-rajdhani uppercase tracking-wider", statusCls)}>
                              {sub.status}
                            </span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-8 pb-5 pt-2 bg-[#141414] border-t border-[#1e1e1e]">
                          {/* Proof display */}
                          <div className="mb-4 space-y-2">
                            <p className="text-[11px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">Proof</p>
                            {sub.responseValue && (
                              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                  <FileText size={14} className="text-[#666] mt-0.5 shrink-0" />
                                  <p className="text-[13px] text-[#d0d0d0] leading-relaxed whitespace-pre-wrap">{sub.responseValue}</p>
                                </div>
                              </div>
                            )}
                            {sub.proofUrl && (
                              <a
                                href={sub.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[12px] text-[#3b82f6] hover:text-blue-300 hover:border-blue-800 transition-all w-fit"
                              >
                                <Link size={13} />
                                View proof file / link
                              </a>
                            )}
                            {!sub.responseValue && !sub.proofUrl && (
                              <p className="text-[12px] text-[#555] italic">No proof submitted</p>
                            )}
                          </div>

                          {/* Task deliverables (reference for review) */}
                          {(sub.deliverables || sub.task?.deliverables) && (
                            <div className="mb-4 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                              <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest font-rajdhani mb-1">Expected deliverables</p>
                              <p className="text-[12px] text-[#888]">{sub.deliverables || sub.task?.deliverables}</p>
                            </div>
                          )}

                          {/* Feedback (if rejected) */}
                          {sub.feedback && (
                            <div className="mb-4 p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                              <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest font-rajdhani mb-1">Admin feedback</p>
                              <p className="text-[12px] text-red-300">{sub.feedback}</p>
                            </div>
                          )}

                          {/* Actions */}
                          {sub.status === "pending" && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApprove(sub.id)}
                                disabled={reviewSubmission.isPending}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-green-700 transition-all disabled:opacity-50"
                              >
                                {reviewSubmission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectModal({ subId: sub.id, feedback: "" })}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-red-400 text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-900/20 hover:border-red-800 transition-all"
                              >
                                <X size={13} />
                                Reject
                              </button>
                            </div>
                          )}
                          {sub.status !== "pending" && (
                            <p className="text-[12px] text-[#555] font-rajdhani font-bold uppercase tracking-wider">
                              {sub.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                              {sub.reviewedAt ? ` · ${new Date(sub.reviewedAt).toLocaleDateString()}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Batch selector */}
            <div className="flex items-center gap-4">
              <div className="relative w-72">
                <select
                  value={overviewBatchId}
                  onChange={e => setOverviewBatchId(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
                >
                  <option value="">Select a batch…</option>
                  {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] pointer-events-none" />
              </div>
              {overviewBatchId && (
                <span className="text-[12px] text-[#606060]">
                  {overviewLoading ? "Loading…" : `${overviewTasks.length} task${overviewTasks.length !== 1 ? "s" : ""}`}
                </span>
              )}
            </div>

            {!overviewBatchId ? (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
                <Eye size={36} className="text-[#444] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">Select a batch to see all its tasks (program + batch-specific) in one view.</p>
              </div>
            ) : overviewLoading ? (
              <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#dc2626]" /></div>
            ) : overviewTasks.length === 0 ? (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
                <ListChecks size={36} className="text-[#444] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No tasks found for this batch.</p>
              </div>
            ) : (
              (() => {
                const dayGroups: Record<number, any[]> = {};
                overviewTasks.forEach((t: any) => {
                  const d = t.dayNumber ?? 0;
                  if (!dayGroups[d]) dayGroups[d] = [];
                  dayGroups[d].push(t);
                });
                return (
                  <div className="space-y-4">
                    {Object.keys(dayGroups).sort((a, b) => Number(a) - Number(b)).map(day => (
                      <div key={day} className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
                        <div className="px-5 py-3 bg-[#1a1a1a] border-b border-[#1f1f1f] flex items-center gap-3">
                          <Calendar size={14} className="text-[#dc2626]" />
                          <span className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">
                            Day {day}
                          </span>
                          <span className="text-[11px] text-[#606060]">{dayGroups[Number(day)].length} task{dayGroups[Number(day)].length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="divide-y divide-[#1f1f1f]">
                          {dayGroups[Number(day)].map((t: any) => (
                            <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0"
                                style={t.source === "batch"
                                  ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                                  : { background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}
                              >
                                {t.source === "batch" ? "Batch" : "Program"}
                              </span>
                              <span className="flex-1 text-[13px] text-[#f0f0f0] min-w-0 truncate">{t.title}</span>
                              <span className="text-[11px] text-[#606060] flex-shrink-0">{t.proofType}</span>
                              <span className="text-[11px] text-[#dc2626] font-bold flex-shrink-0">{t.basePoints} XP</span>
                              {t.isMilestone && <Star size={12} className="text-yellow-500 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </>
        )}
      </div>

      {/* ── Task Initiative Create / Edit Modal ──────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <CheckSquare size={18} className="text-[#dc2626]" />
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">{editingTask ? "Edit Task" : "New Task"}</h3>
              </div>
              <button onClick={() => setTaskModalOpen(false)} className="text-[#888] hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Program *</label>
                <select
                  value={taskForm.programId}
                  onChange={e => setTaskField("programId", e.target.value)}
                  disabled={!!editingTask}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm appearance-none disabled:opacity-50"
                >
                  <option value="">Select program…</option>
                  {programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Day Number *</label>
                  <input type="number" min={1} value={taskForm.dayNumber ?? ""} onChange={e => setTaskField("dayNumber", parseInt(e.target.value) || 1)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Sort Order</label>
                  <input type="number" min={0} value={taskForm.sortOrder ?? 0} onChange={e => setTaskField("sortOrder", parseInt(e.target.value) || 0)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={taskForm.title ?? ""} onChange={e => setTaskField("title", e.target.value)} placeholder="Task title…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={taskForm.description ?? ""} onChange={e => setTaskField("description", e.target.value)} rows={3} placeholder="What should members do…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Deliverables</label>
                <textarea value={taskForm.deliverables ?? ""} onChange={e => setTaskField("deliverables", e.target.value)} rows={2} placeholder="What to submit as proof…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Content URL</label>
                <input value={taskForm.contentUrl ?? ""} onChange={e => setTaskField("contentUrl", e.target.value)} placeholder="https://…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Base Points</label>
                  <input type="number" min={0} value={taskForm.basePoints ?? 100} onChange={e => setTaskField("basePoints", parseInt(e.target.value) || 0)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Bonus Points</label>
                  <input type="number" min={0} value={taskForm.bonusPoints ?? 0} onChange={e => setTaskField("bonusPoints", parseInt(e.target.value) || 0)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Est. Minutes</label>
                  <input type="number" min={1} value={taskForm.estimatedMinutes ?? 15} onChange={e => setTaskField("estimatedMinutes", parseInt(e.target.value) || 15)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Proof Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROOF_TYPES.map(pt => (
                    <button key={pt} type="button" onClick={() => setTaskField("proofType", pt)}
                      className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold font-rajdhani uppercase tracking-wider border transition-all",
                        taskForm.proofType === pt ? "bg-[#dc2626]/10 border-[#dc2626] text-[#dc2626]" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
                      )}>{pt}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                <button type="button" onClick={() => setTaskField("isMilestone", !taskForm.isMilestone)}
                  className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0", taskForm.isMilestone ? "bg-yellow-500 border-yellow-500" : "border-[#444]")}>
                  {taskForm.isMilestone && <Star size={11} className="text-black fill-black" />}
                </button>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Mark as Milestone</p>
                  {taskForm.isMilestone && (
                    <input value={taskForm.milestoneLabel ?? ""} onChange={e => setTaskField("milestoneLabel", e.target.value)} placeholder="Milestone label…" className="mt-2 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  )}
                </div>
              </div>
            </div>
            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setTaskModalOpen(false)} className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={handleTaskSubmit} disabled={isSavingTask} className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                {isSavingTask && <Loader2 size={14} className="animate-spin" />}
                {editingTask ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Batch Task Modal ───────────────────────────────────────────────── */}
      {inlineModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <ListChecks size={18} className="text-[#dc2626]" />
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">
                  {inlineModal.task ? "Edit Task" : `Add Task — Day ${inlineModal.dayNumber}`}
                </h3>
              </div>
              <button onClick={() => setInlineModal(null)} className="text-[#888] hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={inlineForm.title} onChange={e => setInlineForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={inlineForm.description} onChange={e => setInlineForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What should members do…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Deliverables</label>
                <textarea value={inlineForm.deliverables} onChange={e => setInlineForm(f => ({ ...f, deliverables: e.target.value }))} rows={2} placeholder="What to submit…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Content URL</label>
                <input value={inlineForm.contentUrl} onChange={e => setInlineForm(f => ({ ...f, contentUrl: e.target.value }))} placeholder="https://…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Base Points</label>
                  <input type="number" min={0} value={inlineForm.basePoints} onChange={e => setInlineForm(f => ({ ...f, basePoints: parseInt(e.target.value) || 0 }))} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Est. Minutes</label>
                  <input type="number" min={1} value={inlineForm.estimatedMinutes} onChange={e => setInlineForm(f => ({ ...f, estimatedMinutes: parseInt(e.target.value) || 15 }))} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Proof Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROOF_TYPES.map(pt => (
                    <button key={pt} type="button" onClick={() => setInlineForm(f => ({ ...f, proofType: pt }))}
                      className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold font-rajdhani uppercase tracking-wider border transition-all",
                        inlineForm.proofType === pt ? "bg-[#dc2626]/10 border-[#dc2626] text-[#dc2626]" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
                      )}>{pt}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                <button type="button" onClick={() => setInlineForm(f => ({ ...f, isMilestone: !f.isMilestone }))}
                  className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0", inlineForm.isMilestone ? "bg-yellow-500 border-yellow-500" : "border-[#444]")}>
                  {inlineForm.isMilestone && <Star size={11} className="text-black fill-black" />}
                </button>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Milestone</p>
                  {inlineForm.isMilestone && (
                    <input value={inlineForm.milestoneLabel} onChange={e => setInlineForm(f => ({ ...f, milestoneLabel: e.target.value }))} placeholder="Label…"
                      className="mt-2 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  )}
                </div>
                {inlineForm.isMilestone && (
                  <div className="shrink-0">
                    <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-1 font-rajdhani">Bonus Pts</label>
                    <input type="number" min={0} value={inlineForm.bonusPoints} onChange={e => setInlineForm(f => ({ ...f, bonusPoints: parseInt(e.target.value) || 0 }))}
                      className="w-24 bg-[#141414] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                )}
              </div>
            </div>
            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setInlineModal(null)} className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={handleInlineTaskSubmit} disabled={isSavingInline} className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                {isSavingInline && <Loader2 size={14} className="animate-spin" />}
                {inlineModal.task ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Program Create / Edit Modal ──────────────────────────────────────────── */}
      {programModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-[#dc2626]" />
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">{editingProgram ? "Edit Program" : "New Program"}</h3>
              </div>
              <button onClick={() => setProgramModalOpen(false)} className="text-[#888] hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Program Name *</label>
                <input value={programForm.name} onChange={e => setProgramField("name", e.target.value)} placeholder="e.g. 90-Day Business Challenge" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={programForm.description} onChange={e => setProgramField("description", e.target.value)} rows={3} placeholder="What is this program about…" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Duration (days)</label>
                <input type="number" min={1} max={365} value={programForm.durationDays} onChange={e => setProgramField("durationDays", parseInt(e.target.value) || 90)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm" />
              </div>
            </div>
            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setProgramModalOpen(false)} className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={handleProgramSubmit} disabled={isSavingProgram} className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                {isSavingProgram && <Loader2 size={14} className="animate-spin" />}
                {editingProgram ? "Save Changes" : "Create Program"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Submission Modal ───────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest text-red-400">Reject Submission</h3>
              <button onClick={() => setRejectModal(null)} className="text-[#888] hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Feedback (optional)</label>
                <textarea
                  value={rejectModal.feedback}
                  onChange={e => setRejectModal(m => m ? { ...m, feedback: e.target.value } : m)}
                  rows={4}
                  placeholder="Explain what needs to be revised…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={handleRejectSubmit} disabled={reviewSubmission.isPending} className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                {reviewSubmission.isPending && <Loader2 size={14} className="animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Delete Confirm ───────────────────────────────────────────────────── */}
      {deletingTaskId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Trash2 size={32} className="text-red-500 mx-auto" />
            <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">Delete Task?</h3>
            <p className="text-[13px] text-[#888]">This will remove all member submissions for this task. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTaskId(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={() => handleTaskDelete(deletingTaskId)} disabled={deleteTask.isPending} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteTask.isPending && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Task Delete Confirm ────────────────────────────────────────────── */}
      {deletingInlineTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Trash2 size={32} className="text-red-500 mx-auto" />
            <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">Delete Task?</h3>
            <p className="text-[13px] text-[#888]">Member submissions for this task will also be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingInlineTask(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={handleInlineTaskDelete} disabled={deleteInlineTask.isPending} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteInlineTask.isPending && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Program Delete Confirm ────────────────────────────────────────────────── */}
      {deletingProgramId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Trash2 size={32} className="text-red-500 mx-auto" />
            <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">Delete Program?</h3>
            <p className="text-[13px] text-[#888]">All tasks in this program will also be deleted. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingProgramId(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={() => handleProgramDelete(deletingProgramId)} disabled={deleteProgram.isPending} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteProgram.isPending && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
