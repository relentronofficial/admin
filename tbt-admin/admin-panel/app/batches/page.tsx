"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Users,
  Calendar,
  Search,
  X,
  Loader2,
  UserMinus,
  UserPlus,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  BarChart2,
  Copy,
  CheckCheck,
  Archive,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListBatches,
  useGetBatch,
  useCreateBatch,
  useUpdateBatch,
  useDeleteBatch,
  useListPrograms,
  useCloneBatch,
  useMarkBatchComplete,
  useArchiveBatch,
} from "@/lib/hooks/useTbt";
import { useListMembers, useUpdateMember } from "@/lib/hooks/useMembers";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";

const fmtDate = (d: any) => {
  if (!d) return "—";
  try { const dt = new Date(d); return isValid(dt) ? format(dt, "dd MMM yyyy") : "—"; } catch { return "—"; }
};

type BatchForm = {
  name: string;
  description: string;
  programId: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  xpPerDay: number;
};

const emptyForm: BatchForm = {
  name: "",
  description: "",
  programId: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  xpPerDay: 50,
};

const BATCH_STATUS_TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
] as const;

function batchStatusBadge(status: string) {
  if (status === "completed") return { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "rgba(59,130,246,0.25)", label: "Completed" };
  if (status === "archived")  return { bg: "rgba(255,255,255,0.05)", color: "#606060", border: "rgba(255,255,255,0.10)", label: "Archived" };
  return { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.25)", label: "Active" };
}

export default function BatchesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const { data: batchesRes, isLoading } = useListBatches();
  const allBatches: any[] = (batchesRes as any)?.data || [];
  const batches = statusFilter
    ? allBatches.filter((b: any) => (b.status ?? "active") === statusFilter)
    : allBatches;

  const { data: programsRes } = useListPrograms();
  const programs: any[] = (programsRes as any)?.data || [];

  const batchNameMap: Record<string, string> = useMemo(
    () => Object.fromEntries(batches.map((b: any) => [b.id, b.name])),
    [batches],
  );

  // Tab counts derived from allBatches — no extra API calls
  const tabCounts = useMemo(() => ({
    "": allBatches.length,
    "active": allBatches.filter((b: any) => (b.status ?? "active") === "active").length,
    "completed": allBatches.filter((b: any) => b.status === "completed").length,
    "archived": allBatches.filter((b: any) => b.status === "archived").length,
  }), [allBatches]);

  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const deleteBatch = useDeleteBatch();
  const cloneBatch = useCloneBatch();
  const markComplete = useMarkBatchComplete();
  const archiveBatch = useArchiveBatch();
  const updateMember = useUpdateMember();

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<any | null>(null);
  const [managingBatch, setManagingBatch] = useState<any | null>(null);
  const [cloningBatch, setCloningBatch] = useState<any | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneStartsAt, setCloneStartsAt] = useState("");

  // Form state
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [formErr, setFormErr] = useState("");

  // Member management
  const [memberSearch, setMemberSearch] = useState("");
  const { data: batchDetail, isLoading: loadingDetail, isFetching: isFetchingDetail, refetch: refetchDetail } = useGetBatch(managingBatch?.id || "");
  const batchMembers: any[] = (batchDetail as any)?.data?.members || [];

  // Force a fresh fetch every time the manage-members modal opens to bypass stale cache
  useEffect(() => {
    if (managingBatch?.id) {
      refetchDetail();
    }
  }, [managingBatch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: searchRes } = useListMembers({ page: 1, limit: 20, search: memberSearch, status: "" });
  const searchResults: any[] = searchRes?.data || [];
  // Exclude members already in this batch
  const assignableMembers = searchResults.filter(
    (m: any) => !batchMembers.some((bm: any) => bm.id === m.id)
  );

  // Sync form when opening edit modal
  useEffect(() => {
    if (editingBatch) {
      setForm({
        name: editingBatch.name || "",
        description: editingBatch.description || "",
        programId: editingBatch.programId || "",
        startsAt: editingBatch.startsAt ? new Date(editingBatch.startsAt).toISOString().split("T")[0] : "",
        endsAt: editingBatch.endsAt ? new Date(editingBatch.endsAt).toISOString().split("T")[0] : "",
        isActive: editingBatch.isActive ?? true,
        xpPerDay: editingBatch.xpPerDay ?? 50,
      });
      setFormErr("");
    }
  }, [editingBatch]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormErr("");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setFormErr("Batch name is required"); return; }
    if (!form.startsAt) { setFormErr("Start date is required"); return; }
    try {
      await createBatch.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        programId: form.programId || undefined,
        startsAt: form.startsAt,
        endsAt: form.endsAt || undefined,
        isActive: form.isActive,
        xpPerDay: form.xpPerDay,
      });
      toast.success("Batch created");
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create batch");
    }
  };

  const handleEdit = async () => {
    if (!form.name.trim()) { setFormErr("Batch name is required"); return; }
    if (!form.startsAt) { setFormErr("Start date is required"); return; }
    try {
      await updateBatch.mutateAsync({
        id: editingBatch.id,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        programId: form.programId || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt || undefined,
        isActive: form.isActive,
        xpPerDay: form.xpPerDay,
      });
      toast.success("Batch updated");
      setEditingBatch(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update batch");
    }
  };

  const handleDelete = async () => {
    if (!deletingBatch) return;
    try {
      await deleteBatch.mutateAsync(deletingBatch.id);
      toast.success("Batch deleted");
      setDeletingBatch(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete batch");
    }
  };

  const openClone = (batch: any) => {
    setCloningBatch(batch);
    setCloneName(`Copy of ${batch.name}`);
    setCloneStartsAt("");
  };

  const handleClone = async () => {
    if (!cloneName.trim()) { toast.error("Batch name is required"); return; }
    if (!cloneStartsAt) { toast.error("Start date is required"); return; }
    try {
      const result: any = await cloneBatch.mutateAsync({ id: cloningBatch.id, name: cloneName.trim(), startsAt: cloneStartsAt });
      toast.success(`Batch cloned — ${result?.name ?? cloneName}`);
      setCloningBatch(null);
      if (result?.id) router.push(`/batches/${result.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to clone batch");
    }
  };

  const handleMarkComplete = async (batch: any) => {
    if (!window.confirm(`Mark "${batch.name}" as completed? This will set isActive = false.`)) return;
    try {
      await markComplete.mutateAsync(batch.id);
      toast.success("Batch marked as completed");
    } catch {
      toast.error("Failed to mark batch complete");
    }
  };

  const handleArchive = async (batch: any) => {
    if (!window.confirm(`Archive "${batch.name}"? It will be hidden from the default list.`)) return;
    try {
      await archiveBatch.mutateAsync(batch.id);
      toast.success("Batch archived");
    } catch {
      toast.error("Failed to archive batch");
    }
  };

  const handleAssignMember = async (member: any) => {
    if (member.batchId && member.batchId !== managingBatch.id) {
      const oldName = batchNameMap[member.batchId] ?? "another batch";
      const ok = window.confirm(
        `This will move ${member.firstName} from "${oldName}" to "${managingBatch.name}". Continue?`,
      );
      if (!ok) return;
    }
    try {
      await updateMember.mutateAsync({ id: member.id, data: { batchId: managingBatch.id } });
      toast.success(`${member.firstName} added to batch`);
      refetchDetail();
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch', managingBatch.id] });
    } catch {
      toast.error("Failed to assign member");
    }
  };

  const handleRemoveMember = async (member: any) => {
    try {
      await updateMember.mutateAsync({ id: member.id, data: { batchId: "" } });
      toast.success(`${member.firstName} removed from batch`);
      refetchDetail();
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch', managingBatch.id] });
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all";
  const labelCls = "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";

  const BatchFormBody = () => (
    <div className="space-y-5">
      {formErr && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{formErr}</p>
      )}
      <div>
        <label className={labelCls}>Batch Name <span className="text-[#dc2626]">*</span></label>
        <input
          value={form.name}
          onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setFormErr(""); }}
          placeholder="e.g. Batch 25, Cohort June 2025"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Optional notes about this batch..."
          rows={2}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-[#dc2626] transition-all resize-none"
        />
      </div>
      <div>
        <label className={labelCls}>Program <span className="text-[#666]">(optional)</span></label>
        <select
          value={form.programId}
          onChange={(e) => setForm(f => ({ ...f, programId: e.target.value }))}
          className={cn(inputCls, "cursor-pointer")}
        >
          <option value="">No program linked</option>
          {programs.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Start Date <span className="text-[#dc2626]">*</span></label>
          <input
            type="date"
            value={form.startsAt}
            onChange={(e) => { setForm(f => ({ ...f, startsAt: e.target.value })); setFormErr(""); }}
            className={cn(inputCls, "color-scheme-dark")}
          />
        </div>
        <div>
          <label className={labelCls}>End Date <span className="text-[#666]">(optional)</span></label>
          <input
            type="date"
            value={form.endsAt}
            onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))}
            className={cn(inputCls, "color-scheme-dark")}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>XP Per Day <span className="text-[#666]">(awarded on approval)</span></label>
        <input
          type="number"
          min={0}
          max={500}
          value={form.xpPerDay}
          onChange={(e) => setForm(f => ({ ...f, xpPerDay: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) }))}
          className={inputCls}
        />
      </div>
      <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 h-11">
        <span className="text-sm text-[#a0a0a0]">Active batch</span>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
          className="flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: form.isActive ? "#22c55e" : "#888" }}
        >
          {form.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          {form.isActive ? "Active" : "Inactive"}
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={20} className="text-[#dc2626]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide leading-tight">
                Batches
              </h1>
              <p className="text-[12px] text-[#505050] mt-0.5">
                {isLoading ? "Loading…" : `${allBatches.length} total · ${tabCounts["active"]} active`}
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
          >
            <Plus size={16} />
            New Batch
          </button>
        </div>

        {/* ── Status Filter Tabs ── */}
        <div className="flex items-center gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1 w-fit">
          {BATCH_STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all",
                statusFilter === tab.key
                  ? "bg-[#dc2626] text-white shadow-sm"
                  : "text-[#505050] hover:text-[#a0a0a0] hover:bg-[#181818]",
              )}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center leading-none",
                  statusFilter === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-[#1e1e1e] text-[#484848]"
                )}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Batch Grid ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#dc2626]" />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#1e1e1e] flex items-center justify-center mb-5">
              <GraduationCap size={26} className="text-[#333]" />
            </div>
            <p className="text-[15px] font-semibold text-[#484848] mb-1.5">
              {statusFilter ? `No ${statusFilter} batches` : "No batches yet"}
            </p>
            <p className="text-[12px] text-[#363636] mb-6">
              {statusFilter ? "Try a different filter or create a new batch." : "Create your first cohort to get started."}
            </p>
            {!statusFilter && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
              >
                <Plus size={15} /> New Batch
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {batches.map((batch: any) => {
              const badge = batchStatusBadge(batch.status ?? "active");
              const memberCount = batch._count?.members ?? 0;
              const xp = batch.xpPerDay ?? 50;
              return (
                <div
                  key={batch.id}
                  className="bg-[#141414] border border-[#1e1e1e] rounded-xl flex flex-col overflow-hidden transition-all duration-200 hover:border-[#2a2a2a] hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 group"
                >
                  {/* Colored status accent bar */}
                  <div className="h-[3px] w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${badge.color}60 0%, ${badge.color}18 100%)` }} />

                  {/* ── Card Body ── */}
                  <div className="p-5 flex-1 flex flex-col gap-3.5">

                    {/* Status badge row */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border flex-shrink-0"
                        style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.color }} />
                        {badge.label}
                      </span>
                      {batch.isActive === false && (batch.status ?? "active") === "active" && (
                        <span className="text-[10px] text-[#484848] font-medium">Inactive</span>
                      )}
                    </div>

                    {/* Name + description */}
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-bold text-[#f0f0f0] leading-tight font-rajdhani truncate">
                        {batch.name}
                      </h3>
                      {batch.description && (
                        <p className="text-[12px] text-[#565656] mt-1.5 line-clamp-2 leading-relaxed">
                          {batch.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Stats Row ── */}
                  <div className="border-t border-[#1c1c1c] px-5 py-3 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-[12px] text-[#585858]">
                      <Calendar size={13} className="text-[#404040] flex-shrink-0" />
                      <span>
                        {fmtDate(batch.startsAt)}
                        {batch.endsAt && (
                          <span className="text-[#3a3a3a]"> → {fmtDate(batch.endsAt)}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[#585858]">
                      <Users size={13} className="text-[#404040] flex-shrink-0" />
                      <span>
                        <span className="text-[#888] font-semibold">{memberCount}</span>
                        {" "}member{memberCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#585858] ml-auto">
                      <Zap size={12} className="text-[#404040] flex-shrink-0" />
                      <span><span className="text-[#888] font-semibold">{xp}</span> XP/day</span>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="border-t border-[#1c1c1c] px-4 py-3 space-y-2.5">
                    {/* Primary CTA */}
                    <button
                      onClick={() => router.push(`/batches/${batch.id}`)}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-[12px] font-bold bg-[#dc2626]/10 hover:bg-[#dc2626]/20 text-[#dc2626] transition-all border border-[#dc2626]/20 hover:border-[#dc2626]/40 tracking-wide uppercase"
                    >
                      <BarChart2 size={14} />
                      View Program
                    </button>

                    {/* Secondary icon actions */}
                    <div className="flex items-center justify-between">
                      {/* Utility actions */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setManagingBatch(batch)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#1e1e1e] text-[#424242] hover:text-[#a0a0a0] transition-all"
                          title="Manage members"
                        >
                          <Users size={15} />
                        </button>
                        <button
                          onClick={() => openClone(batch)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#1e1e1e] text-[#424242] hover:text-[#a0a0a0] transition-all"
                          title="Clone batch"
                        >
                          <Copy size={15} />
                        </button>
                        {(batch.status ?? "active") === "active" && (
                          <button
                            onClick={() => handleMarkComplete(batch)}
                            disabled={markComplete.isPending}
                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-blue-900/20 text-[#424242] hover:text-blue-400 transition-all disabled:opacity-40"
                            title="Mark complete"
                          >
                            <CheckCheck size={15} />
                          </button>
                        )}
                        {(batch.status ?? "active") !== "archived" && (
                          <button
                            onClick={() => handleArchive(batch)}
                            disabled={archiveBatch.isPending}
                            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#1e1e1e] text-[#424242] hover:text-[#a0a0a0] transition-all disabled:opacity-40"
                            title="Archive batch"
                          >
                            <Archive size={15} />
                          </button>
                        )}
                      </div>
                      {/* Edit / Delete */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setEditingBatch(batch)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#1e1e1e] text-[#424242] hover:text-[#f0f0f0] transition-all"
                          title="Edit batch"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingBatch(batch)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-900/20 text-[#424242] hover:text-red-400 transition-all"
                          title="Delete batch"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Batch Modal ── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f]">
              <h2 className="text-[16px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Create Batch</h2>
              <button onClick={() => setCreateOpen(false)} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <BatchFormBody />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f]">
              <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 text-[#888] hover:text-white text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createBatch.isPending}
                className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
              >
                {createBatch.isPending && <Loader2 size={14} className="animate-spin" />}
                Create Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Batch Modal ── */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f]">
              <h2 className="text-[16px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Edit Batch</h2>
              <button onClick={() => setEditingBatch(null)} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <BatchFormBody />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f]">
              <button onClick={() => setEditingBatch(null)} className="px-5 py-2.5 text-[#888] hover:text-white text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={updateBatch.isPending}
                className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
              >
                {updateBatch.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#f0f0f0]">Delete Batch</h2>
                <p className="text-[12px] text-[#606060] mt-0.5">This will unassign all members from the batch.</p>
              </div>
            </div>
            <p className="text-sm text-[#a0a0a0]">
              Delete <span className="text-white font-semibold">{deletingBatch.name}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeletingBatch(null)} className="px-4 py-2 text-[#888] hover:text-white text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBatch.isPending}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                {deleteBatch.isPending && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Members Modal ── */}
      {managingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f] flex-shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">
                  {managingBatch.name}
                </h2>
                <p className="text-[12px] text-[#606060] mt-0.5">
                  {isFetchingDetail ? "…" : `${batchMembers.length} member${batchMembers.length !== 1 ? "s" : ""}`} · Starts {fmtDate(managingBatch.startsAt)}
                </p>
              </div>
              <button onClick={() => { setManagingBatch(null); setMemberSearch(""); }} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Current Members */}
              <div className="p-6 space-y-3">
                <p className={labelCls}>Current Members ({isFetchingDetail ? "…" : batchMembers.length})</p>
                {loadingDetail || isFetchingDetail ? (
                  <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#dc2626]" /></div>
                ) : batchMembers.length === 0 ? (
                  <div className="text-center py-8 text-[#606060] text-sm">
                    No members assigned yet. Search below to add members.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {batchMembers.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-[#dc2626]">
                          {m.profilePhotoUrl
                            ? <img src={m.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                            : (m.firstName?.[0] || "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                            {m.firstName} {m.lastName}
                          </p>
                          <p className="text-[11px] text-[#606060] truncate">{m.memberId} · {m.phone}</p>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                          style={m.status === "active"
                            ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                            : { background: "rgba(255,255,255,0.06)", color: "#606060" }}
                        >
                          {m.status}
                        </span>
                        <button
                          onClick={() => handleRemoveMember(m)}
                          disabled={updateMember.isPending}
                          className="p-1.5 rounded-lg hover:bg-red-900/20 text-[#606060] hover:text-red-400 transition-all flex-shrink-0"
                          title="Remove from batch"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-6 border-t border-[#1f1f1f]" />

              {/* Search & Add Members */}
              <div className="p-6 space-y-3">
                <p className={labelCls}>Add Members</p>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name, phone, or member ID..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all"
                  />
                  {memberSearch && (
                    <button onClick={() => setMemberSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {memberSearch.trim() && (
                  assignableMembers.length === 0 ? (
                    <p className="text-sm text-[#606060] text-center py-4">No members found or all matching members are already in this batch.</p>
                  ) : (
                    <div className="space-y-2">
                      {assignableMembers.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-[#dc2626]">
                            {m.profilePhotoUrl
                              ? <img src={m.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                              : (m.firstName?.[0] || "?").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                              {m.firstName} {m.lastName}
                            </p>
                            <p className="text-[11px] text-[#606060] truncate">{m.memberId} · {m.phone}</p>
                          </div>
                          {m.batchId && m.batchId !== managingBatch?.id && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                              title={`Currently in: ${batchNameMap[m.batchId] ?? "another batch"}`}
                            >
                              {batchNameMap[m.batchId] ?? "Another batch"}
                            </span>
                          )}
                          <button
                            onClick={() => handleAssignMember(m)}
                            disabled={updateMember.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626]/10 hover:bg-[#dc2626] text-[#dc2626] hover:text-white text-[12px] font-bold transition-all flex-shrink-0 disabled:opacity-50"
                          >
                            <UserPlus size={13} />
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#1f1f1f] flex-shrink-0">
              <span className="text-[12px] text-[#606060] flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#22c55e]" />
                Changes saved automatically
              </span>
              <button
                onClick={() => { setManagingBatch(null); setMemberSearch(""); }}
                className="px-4 py-2 bg-[#1f1f1f] hover:bg-[#262626] text-[#a0a0a0] hover:text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone Batch Modal ── */}
      {cloningBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f1f1f]">
              <div>
                <h2 className="text-[16px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Clone Batch</h2>
                <p className="text-[12px] text-[#606060] mt-0.5">Copies all {(cloningBatch as any)._count?.members !== undefined ? "" : "day "}content from <span className="text-[#a0a0a0]">{cloningBatch.name}</span></p>
              </div>
              <button onClick={() => setCloningBatch(null)} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelCls}>New Batch Name <span className="text-[#dc2626]">*</span></label>
                <input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Copy of Batch 25"
                />
              </div>
              <div>
                <label className={labelCls}>Start Date <span className="text-[#dc2626]">*</span></label>
                <input
                  type="date"
                  value={cloneStartsAt}
                  onChange={(e) => setCloneStartsAt(e.target.value)}
                  className={cn(inputCls, "color-scheme-dark")}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f]">
              <button onClick={() => setCloningBatch(null)} className="px-5 py-2.5 text-[#888] hover:text-white text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={cloneBatch.isPending}
                className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
              >
                {cloneBatch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                Clone Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
