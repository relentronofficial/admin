"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Loader2, Award, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListDisplayBadges, useCreateDisplayBadge, useUpdateDisplayBadge, useDeleteDisplayBadge } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";

export default function DisplayBadgesPage() {
  const { data, isLoading, refetch } = useListDisplayBadges();
  const createBadge = useCreateDisplayBadge();
  const updateBadge = useUpdateDisplayBadge();
  const deleteBadge = useDeleteDisplayBadge();

  const badges = data?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", color: "#ffffff", bgColor: "#111111", isActive: true });

  const openCreate = () => {
    setForm({ label: "", color: "#ffffff", bgColor: "#111111", isActive: true });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (badge: any) => {
    setForm({ label: badge.label, color: badge.color || "#ffffff", bgColor: badge.bgColor || "#111111", isActive: badge.isActive ?? true });
    setEditing(badge);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.label) return toast.error("Label is required");
    try {
      const payload = { label: form.label, color: form.color, bgColor: form.bgColor, isActive: form.isActive };
      if (editing) {
        await updateBadge.mutateAsync({ id: editing.id, data: payload });
        toast.success("Badge updated");
      } else {
        await createBadge.mutateAsync(payload);
        toast.success("Badge created");
      }
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save badge");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBadge.mutateAsync(id);
      toast.success("Badge deleted");
      setDeleting(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete badge");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Display Badges</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Profile badges shown on member profiles.</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
            <Plus size={15} /> Add Badge
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#dc2626]" />
          </div>
        ) : badges.length === 0 ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-20 space-y-3">
            <Award size={36} className="mx-auto text-[#333]" />
            <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No badges created</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {badges.map((badge: any) => (
              <div key={badge.id} className={`bg-[#181818] border rounded-xl p-5 flex flex-col items-center gap-3 group relative ${badge.isActive ? "border-[#2a2a2a]" : "border-[#222] opacity-50"}`}>
                {!badge.isActive && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Inactive</span>
                )}
                <div
                  className="px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
                  style={{ color: badge.color, backgroundColor: badge.bgColor }}
                >
                  {badge.label}
                </div>
                <p className="text-[10px] text-[#555] uppercase tracking-widest text-center">
                  Text: {badge.color}<br />BG: {badge.bgColor}
                </p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(badge)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleting(badge.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editing ? "Edit Badge" : "New Badge"}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Label</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. BIG" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Text Color</label>
                  <div className="flex gap-2 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                    <span className="text-sm text-[#888] font-mono">{form.color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Background</label>
                  <div className="flex gap-2 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                    <input type="color" value={form.bgColor} onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                    <span className="text-sm text-[#888] font-mono">{form.bgColor}</span>
                  </div>
                </div>
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
              <div className="flex justify-center pt-2">
                <div className="px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase" style={{ color: form.color, backgroundColor: form.bgColor }}>
                  {form.label || "Preview"}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSave} disabled={createBadge.isPending || updateBadge.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createBadge.isPending || updateBadge.isPending) && <Loader2 size={14} className="animate-spin" />}
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
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Badge?</h3>
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
