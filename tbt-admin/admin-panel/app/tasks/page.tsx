"use client";

import { useState } from "react";
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
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTasks, useCreateTaskInitiative, useUpdateTask, useDeleteTask, TaskInitiativeInput } from "@/lib/hooks/useTasks";
import { useListPrograms } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const PROOF_TYPES = ["text", "image", "video", "link", "file"];

const emptyForm = (): Partial<TaskInitiativeInput> => ({
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

export default function TasksPage() {
  const [programFilter, setProgramFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TaskInitiativeInput>>(emptyForm());

  const { data: tasksData, isLoading } = useListTasks(programFilter ? { programId: programFilter } : undefined);
  const { data: programsData } = useListPrograms();
  const createTask = useCreateTaskInitiative();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const tasks: any[] = tasksData?.data || tasksData || [];
  const programs: any[] = (programsData as any)?.data || programsData || [];

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const set = (key: keyof TaskInitiativeInput, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditingTask(null);
    setForm({ ...emptyForm(), programId: programFilter || "" });
    setModalOpen(true);
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setForm({
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
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    if (!form.programId) { toast.error("Program is required"); return; }
    if (!form.dayNumber || form.dayNumber < 1) { toast.error("Day number must be at least 1"); return; }
    try {
      if (editingTask) {
        const { programId, ...updateData } = form;
        await updateTask.mutateAsync({ id: editingTask.id, data: updateData });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(form as TaskInitiativeInput);
        toast.success("Task created");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Task deleted");
      setDeletingId(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const isSaving = createTask.isPending || updateTask.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Tasks</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">Manage program task initiatives and daily actions.</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 shrink-0"
          >
            <Plus size={16} strokeWidth={3} />
            Add Task
          </button>
        </div>

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

        {/* Table */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#dc2626]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CheckSquare size={36} className="text-[#333]" />
              <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">No tasks found</p>
              <button onClick={openCreate} className="text-[#dc2626] text-[12px] font-bold font-rajdhani uppercase tracking-widest hover:underline">
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
                {filtered.map((task, i) => (
                  <tr key={task.id} className={cn("border-b border-[#1e1e1e] hover:bg-[#1f1f1f] transition-colors", i === filtered.length - 1 && "border-b-0")}>
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
                        <button
                          onClick={() => openEdit(task)}
                          className="p-1.5 rounded-lg text-[#666] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingId(task.id)}
                          className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-all"
                        >
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
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <CheckSquare size={18} className="text-[#dc2626]" />
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">
                  {editingTask ? "Edit Task" : "New Task"}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[#888] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Program */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Program *</label>
                <select
                  value={form.programId}
                  onChange={e => set("programId", e.target.value)}
                  disabled={!!editingTask}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm appearance-none disabled:opacity-50"
                >
                  <option value="">Select program…</option>
                  {programs.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Day Number */}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Day Number *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.dayNumber ?? ""}
                    onChange={e => set("dayNumber", parseInt(e.target.value) || 1)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                {/* Sort Order */}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Sort Order</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder ?? 0}
                    onChange={e => set("sortOrder", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input
                  value={form.title ?? ""}
                  onChange={e => set("title", e.target.value)}
                  placeholder="Task title…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={e => set("description", e.target.value)}
                  rows={3}
                  placeholder="What should members do…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Deliverables</label>
                <textarea
                  value={form.deliverables ?? ""}
                  onChange={e => set("deliverables", e.target.value)}
                  rows={2}
                  placeholder="What should they submit as proof…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
                />
              </div>

              {/* Content URL */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Content URL</label>
                <input
                  value={form.contentUrl ?? ""}
                  onChange={e => set("contentUrl", e.target.value)}
                  placeholder="https://…"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Base Points */}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Base Points</label>
                  <input
                    type="number"
                    min={0}
                    value={form.basePoints ?? 100}
                    onChange={e => set("basePoints", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                {/* Bonus Points */}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Bonus Points</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bonusPoints ?? 0}
                    onChange={e => set("bonusPoints", parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
                {/* Est. Minutes */}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Est. Minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={form.estimatedMinutes ?? 15}
                    onChange={e => set("estimatedMinutes", parseInt(e.target.value) || 15)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
                  />
                </div>
              </div>

              {/* Proof Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Proof Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROOF_TYPES.map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => set("proofType", pt)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-bold font-rajdhani uppercase tracking-wider border transition-all",
                        form.proofType === pt
                          ? "bg-[#dc2626]/10 border-[#dc2626] text-[#dc2626]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
                      )}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Milestone */}
              <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                <button
                  type="button"
                  onClick={() => set("isMilestone", !form.isMilestone)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    form.isMilestone ? "bg-yellow-500 border-yellow-500" : "border-[#444]"
                  )}
                >
                  {form.isMilestone && <Star size={11} className="text-black fill-black" />}
                </button>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Mark as Milestone</p>
                  {form.isMilestone && (
                    <input
                      value={form.milestoneLabel ?? ""}
                      onChange={e => set("milestoneLabel", e.target.value)}
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
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingTask ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Trash2 size={32} className="text-red-500 mx-auto" />
            <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest">Delete Task?</h3>
            <p className="text-[13px] text-[#888]">This will also remove all member submissions for this task. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
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
    </DashboardLayout>
  );
}
