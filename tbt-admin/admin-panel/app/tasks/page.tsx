"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CheckSquare,
  Star,
  Clock,
  Zap,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Calendar,
  ListChecks,
  Save,
  GripVertical,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTasks, useCreateTaskInitiative, useUpdateTask, useDeleteTask, TaskInitiativeInput } from "@/lib/hooks/useTasks";
import {
  useListPrograms,
  useCreateProgram,
  useUpdateProgram,
  useDeleteProgram,
  useListBatches,
  useListBatchDays,
  useUpsertBatchDay,
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const PROOF_TYPES = ["text", "image", "video", "link", "file"];

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

type Tab = "tasks" | "programs" | "batch-checklist";

type ChecklistTask = { id: string; title: string; order: number };

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<Tab>("tasks");

  // ── Task state ────────────────────────────────────────────────────────────────
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

  // ── Batch checklist state ─────────────────────────────────────────────────────
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [dayTaskDrafts, setDayTaskDrafts] = useState<Record<number, ChecklistTask[]>>({});
  const [dirtyDays, setDirtyDays] = useState<Set<number>>(new Set());
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<number, string>>({});
  const batchDaysKey = useRef(0);

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  const { data: tasksData, isLoading: tasksLoading } = useListTasks(programFilter ? { programId: programFilter } : undefined);
  const { data: programsData, isLoading: programsLoading } = useListPrograms();
  const { data: batchesData } = useListBatches();
  const { data: batchDaysData, isLoading: batchDaysLoading } = useListBatchDays(selectedBatchId);

  const createTask = useCreateTaskInitiative();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();
  const upsertDay = useUpsertBatchDay();

  const tasks: any[] = tasksData?.data || tasksData || [];
  const programs: any[] = (programsData as any)?.data || programsData || [];
  const batches: any[] = (batchesData as any)?.data || batchesData || [];
  const batchDays: any[] = (batchDaysData as any)?.data || batchDaysData || [];

  const filteredTasks = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase())
  );

  // Seed local drafts when batch days load / batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    const drafts: Record<number, ChecklistTask[]> = {};
    batchDays.forEach((day: any) => {
      drafts[day.dayNumber] = Array.isArray(day.tasks)
        ? day.tasks.map((t: any) => ({ id: t.id, title: t.title, order: t.order ?? 0 }))
        : [];
    });
    setDayTaskDrafts(drafts);
    setDirtyDays(new Set());
    setNewTaskInputs({});
    setExpandedDays(new Set());
    batchDaysKey.current += 1;
  }, [batchDaysData, selectedBatchId]);

  // ── Task handlers ─────────────────────────────────────────────────────────────
  const setTask = (key: keyof TaskInitiativeInput, value: any) =>
    setTaskForm(f => ({ ...f, [key]: value }));

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ ...emptyTaskForm(), programId: programFilter || "" });
    setTaskModalOpen(true);
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setTaskForm({
      programId: task.programId || "",
      stepId: task.stepId || "",
      dayNumber: task.dayNumber,
      title: task.title,
      description: task.description || "",
      deliverables: task.deliverables || "",
      contentUrl: task.contentUrl || "",
      basePoints: task.basePoints,
      proofType: task.proofType,
      estimatedMinutes: task.estimatedMinutes,
      isMilestone: task.isMilestone,
      milestoneLabel: task.milestoneLabel || "",
      bonusPoints: task.bonusPoints,
      sortOrder: task.sortOrder,
    });
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = async () => {
    if (!taskForm.title?.trim()) { toast.error("Title is required"); return; }
    if (!taskForm.programId) { toast.error("Program is required"); return; }
    if (!taskForm.dayNumber || taskForm.dayNumber < 1) { toast.error("Day number must be at least 1"); return; }
    try {
      if (editingTask) {
        const { programId, ...updateData } = taskForm;
        await updateTask.mutateAsync({ id: editingTask.id, data: updateData });
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
  const setProgram = (key: string, value: any) =>
    setProgramForm(f => ({ ...f, [key]: value }));

  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm(emptyProgramForm());
    setProgramModalOpen(true);
  };

  const openEditProgram = (prog: any) => {
    setEditingProgram(prog);
    setProgramForm({
      name: prog.name || "",
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

  // ── Batch checklist handlers ──────────────────────────────────────────────────
  const toggleDayExpand = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  };

  const addChecklistTask = (dayNumber: number) => {
    const title = (newTaskInputs[dayNumber] || "").trim();
    if (!title) return;
    const current = dayTaskDrafts[dayNumber] || [];
    const newTask: ChecklistTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title,
      order: current.length,
    };
    const updated = [...current, newTask];
    setDayTaskDrafts(prev => ({ ...prev, [dayNumber]: updated }));
    setDirtyDays(prev => new Set(prev).add(dayNumber));
    setNewTaskInputs(prev => ({ ...prev, [dayNumber]: "" }));
  };

  const removeChecklistTask = (dayNumber: number, taskId: string) => {
    const updated = (dayTaskDrafts[dayNumber] || [])
      .filter(t => t.id !== taskId)
      .map((t, i) => ({ ...t, order: i }));
    setDayTaskDrafts(prev => ({ ...prev, [dayNumber]: updated }));
    setDirtyDays(prev => new Set(prev).add(dayNumber));
  };

  const editChecklistTaskTitle = (dayNumber: number, taskId: string, title: string) => {
    const updated = (dayTaskDrafts[dayNumber] || []).map(t =>
      t.id === taskId ? { ...t, title } : t
    );
    setDayTaskDrafts(prev => ({ ...prev, [dayNumber]: updated }));
    setDirtyDays(prev => new Set(prev).add(dayNumber));
  };

  const saveDayTasks = async (dayNumber: number) => {
    setSavingDay(dayNumber);
    try {
      await upsertDay.mutateAsync({
        batchId: selectedBatchId,
        dayNumber,
        tasks: (dayTaskDrafts[dayNumber] || []).map((t, i) => ({ ...t, order: i })),
      });
      toast.success(`Day ${dayNumber} tasks saved`);
      setDirtyDays(prev => {
        const next = new Set(prev);
        next.delete(dayNumber);
        return next;
      });
    } catch {
      toast.error(`Failed to save Day ${dayNumber}`);
    } finally {
      setSavingDay(null);
    }
  };

  const isSavingTask = createTask.isPending || updateTask.isPending;
  const isSavingProgram = createProgram.isPending || updateProgram.isPending;
  const selectedBatch = batches.find((b: any) => b.id === selectedBatchId);

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Tasks</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">Manage programs, task initiatives, and per-day checklists.</p>
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
          {(["tasks", "programs", "batch-checklist"] as Tab[]).map((tab) => (
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
              {tab === "tasks" && <CheckSquare size={14} />}
              {tab === "programs" && <BookOpen size={14} />}
              {tab === "batch-checklist" && <ListChecks size={14} />}
              {tab === "tasks" ? "Tasks" : tab === "programs" ? "Programs" : "Batch Checklist"}
            </button>
          ))}
        </div>

        {/* ── TASKS TAB ─────────────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <>
            {/* Filters */}
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
                  {programs.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
            </div>

            {programs.length === 0 && !programsLoading && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center gap-3">
                <BookOpen size={18} className="text-[#dc2626] shrink-0" />
                <p className="text-[13px] text-[#888]">
                  No programs exist yet. Switch to the <button onClick={() => setActiveTab("programs")} className="text-[#dc2626] font-bold underline">Programs</button> tab to create one before adding tasks.
                </p>
              </div>
            )}

            {/* Tasks Table */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-[#dc2626]" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <CheckSquare size={36} className="text-[#333]" />
                  <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No tasks found</p>
                  <button onClick={openCreateTask} className="text-[#dc2626] text-[12px] font-bold font-rajdhani uppercase tracking-widest hover:underline">
                    + Add your first task
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#222]">
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Day</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Title</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Program</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Proof</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Points</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Est.</th>
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Milestone</th>
                      <th className="px-5 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, i) => (
                      <tr key={task.id} className={cn("border-b border-[#1e1e1e] hover:bg-[#1f1f1f] transition-colors", i === filteredTasks.length - 1 && "border-b-0")}>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#dc2626]/10 text-[#dc2626] text-[12px] font-bold font-rajdhani">
                            {task.dayNumber}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] text-[#f0f0f0] font-medium">{task.title}</p>
                          {task.description && <p className="text-[11px] text-[#666] mt-0.5 line-clamp-1">{task.description}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12px] text-[#a0a0a0]">{task.program?.name || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] text-[#a0a0a0] uppercase tracking-wider font-rajdhani font-bold">
                            {task.proofType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <Zap size={12} className="text-yellow-500" />
                            <span className="text-[13px] text-[#f0f0f0] font-medium">{task.basePoints}</span>
                            {task.bonusPoints > 0 && <span className="text-[11px] text-green-400">+{task.bonusPoints}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-[12px] text-[#888]">
                            <Clock size={11} />
                            {task.estimatedMinutes}m
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {task.isMilestone ? (
                            <div className="flex items-center gap-1">
                              <Star size={13} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-[11px] text-yellow-400 font-bold font-rajdhani uppercase">{task.milestoneLabel || "Milestone"}</span>
                            </div>
                          ) : <span className="text-[#444] text-[12px]">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => openEditTask(task)} className="p-1.5 rounded-lg text-[#666] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeletingTaskId(task.id)} className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all">
                              <Trash2 size={13} />
                            </button>
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
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[#dc2626]" />
              </div>
            ) : programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <BookOpen size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No programs yet</p>
                <button onClick={openCreateProgram} className="text-[#dc2626] text-[12px] font-bold font-rajdhani uppercase tracking-widest hover:underline">
                  + Create your first program
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222]">
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Program</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Duration</th>
                    <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#666] font-bold font-rajdhani">Tasks</th>
                    <th className="px-5 py-4" />
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
                          <div className="flex items-center gap-1.5 text-[13px] text-[#a0a0a0]">
                            <Calendar size={13} className="text-[#666]" />
                            {prog.durationDays ?? 90} days
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => { setActiveTab("tasks"); setProgramFilter(prog.id); }}
                            className="text-[12px] text-[#dc2626] font-bold font-rajdhani uppercase tracking-widest hover:underline"
                          >
                            {taskCount} task{taskCount !== 1 ? "s" : ""}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => openEditProgram(prog)} className="p-1.5 rounded-lg text-[#666] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeletingProgramId(prog.id)} className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all">
                              <Trash2 size={13} />
                            </button>
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
            {/* Batch selector */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative">
                <select
                  value={selectedBatchId}
                  onChange={e => { setSelectedBatchId(e.target.value); }}
                  className="bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer min-w-[220px]"
                >
                  <option value="">Select a batch…</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              {selectedBatch && (
                <span className="text-[12px] text-[#666] font-rajdhani font-bold uppercase tracking-widest">
                  {batchDays.length} days loaded
                </span>
              )}
              {dirtyDays.size > 0 && (
                <span className="ml-auto text-[12px] text-yellow-500 font-bold font-rajdhani uppercase tracking-widest">
                  {dirtyDays.size} day{dirtyDays.size !== 1 ? "s" : ""} with unsaved changes
                </span>
              )}
            </div>

            {!selectedBatchId ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-20 gap-3">
                <ListChecks size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">Select a batch to manage its daily checklists</p>
                <p className="text-[12px] text-[#444]">These are the per-day tasks members check off in the user app</p>
              </div>
            ) : batchDaysLoading ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[#dc2626]" />
              </div>
            ) : batchDays.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
                <Calendar size={36} className="text-[#333]" />
                <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No days configured for this batch yet</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden divide-y divide-[#1e1e1e]">
                {batchDays
                  .slice()
                  .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
                  .map((day: any) => {
                    const dayTasks = dayTaskDrafts[day.dayNumber] || [];
                    const isExpanded = expandedDays.has(day.dayNumber);
                    const isDirty = dirtyDays.has(day.dayNumber);
                    const isSaving = savingDay === day.dayNumber;

                    return (
                      <div key={day.dayNumber}>
                        {/* Day row header */}
                        <button
                          onClick={() => toggleDayExpand(day.dayNumber)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#1f1f1f] transition-colors text-left"
                        >
                          <span className={cn(
                            "transition-transform duration-150",
                            isExpanded ? "rotate-90" : "rotate-0"
                          )}>
                            <ChevronRight size={15} className="text-[#555]" />
                          </span>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#dc2626]/10 text-[#dc2626] text-[12px] font-bold font-rajdhani shrink-0">
                            {day.dayNumber}
                          </span>
                          <span className="flex-1 text-[13px] text-[#f0f0f0] font-medium">
                            {day.title || `Day ${day.dayNumber}`}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            {isDirty && (
                              <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" title="Unsaved changes" />
                            )}
                            <span className="text-[12px] text-[#666] font-rajdhani font-bold uppercase tracking-wider">
                              {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>

                        {/* Expanded day tasks */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 bg-[#141414] border-t border-[#1e1e1e]">
                            {/* Task list */}
                            <div className="space-y-2 mb-3">
                              {dayTasks.length === 0 ? (
                                <p className="text-[12px] text-[#555] py-2 text-center font-rajdhani uppercase tracking-wider">
                                  No tasks yet — add one below
                                </p>
                              ) : (
                                dayTasks.map((task, idx) => (
                                  <div key={task.id} className="flex items-center gap-2 group">
                                    <GripVertical size={14} className="text-[#333] shrink-0" />
                                    <span className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-[#666] font-bold font-rajdhani flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <input
                                      value={task.title}
                                      onChange={e => editChecklistTaskTitle(day.dayNumber, task.id, e.target.value)}
                                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-sm text-white outline-none focus:border-[#dc2626] transition-all"
                                    />
                                    <button
                                      onClick={() => removeChecklistTask(day.dayNumber, task.id)}
                                      className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add task input */}
                            <div className="flex gap-2">
                              <input
                                value={newTaskInputs[day.dayNumber] || ""}
                                onChange={e => setNewTaskInputs(prev => ({ ...prev, [day.dayNumber]: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") addChecklistTask(day.dayNumber); }}
                                placeholder="Add a task… (Enter to add)"
                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-sm text-white outline-none focus:border-[#dc2626] transition-all placeholder:text-[#444]"
                              />
                              <button
                                onClick={() => addChecklistTask(day.dayNumber)}
                                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#555] text-[12px] font-bold font-rajdhani uppercase tracking-wider transition-all"
                              >
                                <Plus size={13} />
                                Add
                              </button>
                            </div>

                            {/* Save button */}
                            {isDirty && (
                              <div className="flex justify-end mt-3">
                                <button
                                  onClick={() => saveDayTasks(day.dayNumber)}
                                  disabled={isSaving}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] text-white text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                  Save Day {day.dayNumber}
                                </button>
                              </div>
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
      </div>

      {/* ── Task Create / Edit Modal ─────────────────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <CheckSquare size={18} className="text-[#dc2626]" />
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">
                  {editingTask ? "Edit Task" : "New Task"}
                </h3>
              </div>
              <button onClick={() => setTaskModalOpen(false)} className="text-[#888] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Program */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Program *</label>
                <select
                  value={taskForm.programId}
                  onChange={e => setTask("programId", e.target.value)}
                  disabled={!!editingTask}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm appearance-none disabled:opacity-50"
                >
                  <option value="">Select program…</option>
                  {programs.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {programs.length === 0 && (
                  <p className="text-[11px] text-[#dc2626] mt-1">No programs found. Create a program first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Day Number *</label>
                  <input
                    type="number"
                    min={1}
                    value={taskForm.dayNumber ?? ""}
                    onChange={e => setTask("dayNumber", parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Sort Order</label>
                  <input
                    type="number"
                    min={0}
                    value={taskForm.sortOrder ?? 0}
                    onChange={e => setTask("sortOrder", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input
                  value={taskForm.title ?? ""}
                  onChange={e => setTask("title", e.target.value)}
                  placeholder="Task title…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea
                  value={taskForm.description ?? ""}
                  onChange={e => setTask("description", e.target.value)}
                  rows={3}
                  placeholder="What should members do…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Deliverables</label>
                <textarea
                  value={taskForm.deliverables ?? ""}
                  onChange={e => setTask("deliverables", e.target.value)}
                  rows={2}
                  placeholder="What should they submit as proof…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Content URL</label>
                <input
                  value={taskForm.contentUrl ?? ""}
                  onChange={e => setTask("contentUrl", e.target.value)}
                  placeholder="https://…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Base Points</label>
                  <input
                    type="number"
                    min={0}
                    value={taskForm.basePoints ?? 100}
                    onChange={e => setTask("basePoints", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Bonus Points</label>
                  <input
                    type="number"
                    min={0}
                    value={taskForm.bonusPoints ?? 0}
                    onChange={e => setTask("bonusPoints", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Est. Minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={taskForm.estimatedMinutes ?? 15}
                    onChange={e => setTask("estimatedMinutes", parseInt(e.target.value) || 15)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Proof Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROOF_TYPES.map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setTask("proofType", pt)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-bold font-rajdhani uppercase tracking-wider border transition-all",
                        taskForm.proofType === pt
                          ? "bg-[#dc2626]/10 border-[#dc2626] text-[#dc2626]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
                      )}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                <button
                  type="button"
                  onClick={() => setTask("isMilestone", !taskForm.isMilestone)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    taskForm.isMilestone ? "bg-yellow-500 border-yellow-500" : "border-[#444]"
                  )}
                >
                  {taskForm.isMilestone && <Star size={11} className="text-black fill-black" />}
                </button>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Mark as Milestone</p>
                  {taskForm.isMilestone && (
                    <input
                      value={taskForm.milestoneLabel ?? ""}
                      onChange={e => setTask("milestoneLabel", e.target.value)}
                      placeholder="Milestone label (e.g. Week 1 Complete)"
                      className="mt-2 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTaskSubmit}
                disabled={isSavingTask}
                className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isSavingTask ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingTask ? "Save Changes" : "Create Task"}
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
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">
                  {editingProgram ? "Edit Program" : "New Program"}
                </h3>
              </div>
              <button onClick={() => setProgramModalOpen(false)} className="text-[#888] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-7 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Program Name *</label>
                <input
                  value={programForm.name}
                  onChange={e => setProgram("name", e.target.value)}
                  placeholder="e.g. 90-Day Business Challenge"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea
                  value={programForm.description}
                  onChange={e => setProgram("description", e.target.value)}
                  rows={3}
                  placeholder="What is this program about…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Duration (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={programForm.durationDays}
                  onChange={e => setProgram("durationDays", parseInt(e.target.value) || 90)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>
            </div>

            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProgramModalOpen(false)}
                className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProgramSubmit}
                disabled={isSavingProgram}
                className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isSavingProgram ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingProgram ? "Save Changes" : "Create Program"}
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
            <p className="text-[13px] text-[#888]">This will also remove all member submissions for this task. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTaskId(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">
                Cancel
              </button>
              <button
                onClick={() => handleTaskDelete(deletingTaskId)}
                disabled={deleteTask.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteTask.isPending && <Loader2 size={13} className="animate-spin" />}
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
            <p className="text-[13px] text-[#888]">Deleting a program will also delete all its tasks. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingProgramId(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">
                Cancel
              </button>
              <button
                onClick={() => handleProgramDelete(deletingProgramId)}
                disabled={deleteProgram.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
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
