"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Loader2, Trophy, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTiers, useCreateTier, useUpdateTier, useDeleteTier } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";

export default function TiersPage() {
  const { data, isLoading, refetch } = useListTiers();
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();

  const tiers = data?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ tierNumber: "", label: "", description: "", unlockConditionText: "", isActive: true });

  const openCreate = () => {
    setForm({ tierNumber: "", label: "", description: "", unlockConditionText: "", isActive: true });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (tier: any) => {
    setForm({ tierNumber: String(tier.tierNumber), label: tier.label || "", description: tier.description || "", unlockConditionText: tier.unlockConditionText || "", isActive: tier.isActive ?? true });
    setEditing(tier);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.tierNumber || !form.label) return toast.error("Tier number and label are required");
    try {
      const payload = { tierNumber: Number(form.tierNumber), label: form.label, description: form.description || null, unlockConditionText: form.unlockConditionText || null, isActive: form.isActive };
      if (editing) {
        await updateTier.mutateAsync({ id: editing.id, data: payload });
        toast.success("Tier updated");
      } else {
        await createTier.mutateAsync(payload);
        toast.success("Tier created");
      }
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save tier");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTier.mutateAsync(id);
      toast.success("Tier deleted");
      setDeleting(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tier");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Tiers</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage access tiers for content gating.</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
            <Plus size={15} /> Add Tier
          </button>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#dc2626]" />
            </div>
          ) : tiers.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Trophy size={36} className="mx-auto text-[#333]" />
              <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No tiers configured</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Tier #</th>
                  <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Label</th>
                  <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Description</th>
                  <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Unlock Condition</th>
                  <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Active</th>
                  <th className="px-6 py-4 w-[80px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {tiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="w-10 h-10 rounded-full bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center font-rajdhani font-bold text-[#dc2626] text-lg">
                        {tier.tierNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#f0f0f0] text-sm">{tier.label}</td>
                    <td className="px-6 py-4 text-[#606060] text-sm max-w-[180px] truncate">{tier.description || "—"}</td>
                    <td className="px-6 py-4 text-[#606060] text-sm">{tier.unlockConditionText || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani ${tier.isActive ? "bg-green-500/10 text-green-400" : "bg-[#222] text-[#444]"}`}>
                        {tier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(tier)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(tier.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                          <Trash2 size={14} />
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

      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editing ? "Edit Tier" : "New Tier"}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Tier Number *</label>
                  <input type="number" value={form.tierNumber} onChange={e => setForm(f => ({ ...f, tierNumber: e.target.value }))} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Label *</label>
                  <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Tier 8" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional description of this tier" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Unlock Condition Text</label>
                <textarea value={form.unlockConditionText} onChange={e => setForm(f => ({ ...f, unlockConditionText: e.target.value }))} rows={2} placeholder="e.g. Complete 5 challenges to unlock" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 h-11">
                <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Active</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? "bg-[#dc2626]" : "bg-[#333]"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSave} disabled={createTier.isPending || updateTier.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createTier.isPending || updateTier.isPending) && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Tier?</h3>
            <p className="text-[#606060] text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleting)} className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
