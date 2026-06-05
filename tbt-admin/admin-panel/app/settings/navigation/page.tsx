"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, X, Loader2, GripVertical, Eye, EyeOff, AlertCircle, Navigation, Save } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListNavItems, useCreateNavItem, useUpdateNavItem, useDeleteNavItem, useReorderNavItems } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";

const EMPTY = { label: "", href: "", isVisible: true };

export default function NavigationPage() {
  const { data, isLoading } = useListNavItems();
  const createItem = useCreateNavItem();
  const updateItem = useUpdateNavItem();
  const deleteItem = useDeleteNavItem();
  const reorderItems = useReorderNavItems();

  const serverItems: any[] = (data as any)?.data || [];

  // Local copy for optimistic drag reorder
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalItems(serverItems);
    setIsDirty(false);
  }, [data]);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // ── Drag handlers ───────────────────────────────────────────────────

  const onDragStart = (i: number) => { dragIndex.current = i; };

  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOver(i);
  };

  const onDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) { setDragOver(null); return; }
    const next = [...localItems];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setLocalItems(next);
    setIsDirty(true);
    dragIndex.current = null;
    setDragOver(null);
  };

  const onDragEnd = () => { dragIndex.current = null; setDragOver(null); };

  const handleSaveOrder = async () => {
    try {
      await reorderItems.mutateAsync(localItems.map((item: any) => item.id));
      setIsDirty(false);
      toast.success("Order saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save order");
    }
  };

  // ── Form handlers ────────────────────────────────────────────────────

  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (item: any) => {
    setForm({ label: item.label, href: item.href, isVisible: item.isVisible });
    setEditing(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.href.trim()) return toast.error("Label and URL are required");
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, data: form });
        toast.success("Nav item updated");
      } else {
        await createItem.mutateAsync(form);
        toast.success("Nav item created");
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast.success("Nav item deleted");
      setDeleting(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const toggleVisible = async (item: any) => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { isVisible: !item.isVisible } });
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Navigation</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage navbar items — drag to reorder.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleSaveOrder}
                disabled={reorderItems.isPending}
                className="flex items-center gap-2 bg-[#222] border border-[#dc2626] text-[#dc2626] px-4 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-[#dc2626] hover:text-white transition-all"
              >
                {reorderItems.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Order
              </button>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all"
            >
              <Plus size={15} /> Add Item
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#606060]">
              <Navigation size={14} />
              <span className="text-[11px] font-bold uppercase tracking-widest font-rajdhani">{localItems.length} items</span>
            </div>
            {isDirty && (
              <span className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani animate-pulse">
                Unsaved order
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#dc2626]" />
            </div>
          ) : localItems.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Navigation size={36} className="mx-auto text-[#333]" />
              <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No nav items yet</p>
              <p className="text-[#444] text-xs">Click "Add Item" to create the first nav link.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {localItems.map((item: any, i: number) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={e => onDragOver(e, i)}
                  onDrop={e => onDrop(e, i)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-4 px-5 py-3.5 group transition-all select-none
                    ${dragOver === i ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-white/[0.02]"}
                    ${dragIndex.current === i ? "opacity-40" : "opacity-100"}`}
                >
                  <GripVertical size={16} className="text-[#444] cursor-grab active:cursor-grabbing group-hover:text-[#666] transition-colors shrink-0" />
                  <span className="text-[11px] text-[#444] font-mono w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#f0f0f0]">{item.label}</p>
                    <p className="text-[11px] text-[#444] font-mono truncate">{item.href}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleVisible(item)}
                      className={`p-1.5 rounded transition-all ${item.isVisible ? "text-blue-400 hover:bg-blue-400/10" : "text-[#444] hover:text-[#888]"}`}
                      title={item.isVisible ? "Visible" : "Hidden"}
                    >
                      {item.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(item.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">
                {editing ? "Edit Nav Item" : "New Nav Item"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: "label", label: "Label *", placeholder: "Home", mono: false },
                { key: "href", label: "URL / Path *", placeholder: "/home", mono: true },
              ].map(({ key, label, placeholder, mono }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
                  <input
                    value={form[key]}
                    onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm ${mono ? "font-mono" : ""}`}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, isVisible: !f.isVisible }))}
                  className={`w-10 h-5 rounded-full relative transition-all ${form.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.isVisible ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani">Visible</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createItem.isPending || updateItem.isPending}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-60"
              >
                {(createItem.isPending || updateItem.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Nav Item?</h3>
            <p className="text-[#606060] text-xs mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleting)}
                disabled={deleteItem.isPending}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleteItem.isPending && <Loader2 size={13} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
