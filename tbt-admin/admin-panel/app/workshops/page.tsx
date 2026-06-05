"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Pencil, X, Loader2, Clapperboard, AlertCircle, Search, Users, ChevronRight, Upload, CheckCircle2, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListWorkshops, useCreateWorkshop, useUpdateWorkshop, useDeleteWorkshop, useListBatches } from "@/lib/hooks/useTbt";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

const DELIVERY_MODES = ["online", "offline", "hybrid"];

const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const EMPTY_FORM = {
  title: "",
  slug: "",
  description: "",
  thumbnailUrl: "",
  deliveryMode: "online",
  requiredTier: "",
  batchId: "",
  isActive: true,
};

function ThumbnailUpload({
  value,
  onUploaded,
  uploading,
  setUploading,
}: {
  value: string;
  onUploaded: (url: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Images only");
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: "workshops/thumbnails" });
      onUploaded(publicUrl);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Thumbnail</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative w-20 h-12 rounded overflow-hidden border border-[#333] shrink-0">
            <img src={value} alt="thumb" className="w-full h-full object-cover" />
            <button
              onClick={() => onUploaded("")}
              className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white hover:bg-red-600 transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="w-20 h-12 rounded border border-dashed border-[#333] flex items-center justify-center text-[#444] shrink-0">
            <Clapperboard size={16} />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#dc2626] text-[#a0a0a0] hover:text-white px-4 py-2 rounded-lg text-[11px] font-bold font-rajdhani uppercase tracking-widest transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

const modeColor = (m: string) => {
  if (m === "online") return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  if (m === "offline") return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  if (m === "hybrid") return "text-purple-400 bg-purple-400/10 border-purple-400/20";
  return "text-[#606060] bg-[#1a1a1a] border-[#333]";
};

export default function WorkshopsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useListWorkshops({ search });
  const { data: batchesData } = useListBatches();
  const createWorkshop = useCreateWorkshop();
  const updateWorkshop = useUpdateWorkshop();
  const deleteWorkshop = useDeleteWorkshop();

  const workshops = (data as any)?.data || [];
  const total = (data as any)?.meta?.total || 0;
  const batches: any[] = (batchesData as any)?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setSlugManual(false);
    setShowForm(true);
  };

  const openEdit = (w: any) => {
    setForm({
      title: w.title || "",
      slug: w.slug || "",
      description: w.description || "",
      thumbnailUrl: w.thumbnailUrl || "",
      deliveryMode: w.deliveryMode || "online",
      requiredTier: w.requiredTier != null ? String(w.requiredTier) : "",
      batchId: w.batchId || "",
      isActive: w.isActive ?? true,
    });
    setEditing(w);
    setSlugManual(true);
    setShowForm(true);
  };

  const handleTitleChange = (v: string) => {
    setForm((f: any) => ({
      ...f,
      title: v,
      ...(slugManual ? {} : { slug: toSlug(v) }),
    }));
  };

  const handleSlugChange = (v: string) => {
    setSlugManual(true);
    setForm((f: any) => ({ ...f, slug: v }));
  };

  const handleSave = async () => {
    if (!form.title || !form.slug) return toast.error("Title and slug are required");
    try {
      const payload: any = {
        title: form.title,
        slug: form.slug,
        description: form.description || null,
        thumbnailUrl: form.thumbnailUrl || null,
        deliveryMode: form.deliveryMode,
        isActive: form.isActive,
      };
      if (form.requiredTier) payload.requiredTier = Number(form.requiredTier);
      if (form.batchId) payload.batchId = form.batchId;

      if (editing) {
        await updateWorkshop.mutateAsync({ id: editing.id, data: payload });
        toast.success("Workshop updated");
      } else {
        await createWorkshop.mutateAsync(payload);
        toast.success("Workshop created");
      }
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save workshop");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkshop.mutateAsync(id);
      toast.success("Workshop deleted");
      setDeleting(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete workshop");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Workshops</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage TBT cohort workshops with challenges, live calls &amp; assignments.</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all shrink-0"
          >
            <Plus size={15} /> New Workshop
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#dc2626]"><Clapperboard size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Total Workshops</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{total}</p>
            </div>
          </div>
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-blue-400"><Users size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Showing</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{workshops.length}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50">
            <div className="relative w-full md:w-[360px]">
              <input
                type="text"
                placeholder="SEARCH WORKSHOPS..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#dc2626] transition-all text-[#f0f0f0] placeholder:text-[#444]"
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            </div>
          </div>

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_120px] gap-4 px-6 py-2 border-b border-[#2a2a2a] bg-[#141414]">
            {["Title", "Batch", "Mode", "Tier", "Active", "Enrolled", ""].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#444] uppercase tracking-widest font-rajdhani">{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#dc2626]" />
            </div>
          ) : workshops.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Clapperboard size={36} className="mx-auto text-[#333]" />
              <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No workshops found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {workshops.map((w: any) => (
                <div key={w.id} className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_80px_80px_120px] gap-4 items-center px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                  {/* Title + thumbnail */}
                  <div className="flex items-center gap-3 min-w-0 w-full">
                    {w.thumbnailUrl ? (
                      <img src={w.thumbnailUrl} alt="" className="w-10 h-7 rounded object-cover shrink-0 border border-[#333]" />
                    ) : (
                      <div className="w-10 h-7 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
                        <Clapperboard size={12} className="text-[#333]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-[#f0f0f0] text-sm group-hover:text-[#dc2626] transition-colors truncate">{w.title}</p>
                      <p className="text-[10px] text-[#444] font-mono truncate">/{w.slug}</p>
                    </div>
                  </div>

                  {/* Batch */}
                  <div className="w-full md:w-auto">
                    {w.batch ? (
                      <span className="text-[11px] text-[#a0a0a0] font-rajdhani">{w.batch.name}</span>
                    ) : (
                      <span className="text-[11px] text-[#444]">—</span>
                    )}
                  </div>

                  {/* Mode */}
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${modeColor(w.deliveryMode)}`}>
                      {w.deliveryMode}
                    </span>
                  </div>

                  {/* Tier */}
                  <div>
                    {w.requiredTier != null ? (
                      <span className="text-[11px] text-[#a0a0a0] font-rajdhani font-bold">Tier {w.requiredTier}</span>
                    ) : (
                      <span className="text-[11px] text-[#444]">—</span>
                    )}
                  </div>

                  {/* Active */}
                  <div>
                    {w.isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 font-rajdhani uppercase">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#444] font-rajdhani uppercase">
                        <XCircle size={12} /> Off
                      </span>
                    )}
                  </div>

                  {/* Enrollments */}
                  <div className="flex items-center gap-1 text-[11px] text-[#555]">
                    <Users size={10} />
                    <span>{w._count?.enrollments ?? 0}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/workshops/${w.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded text-[11px] font-bold text-[#a0a0a0] hover:text-white hover:border-[#555] font-rajdhani uppercase tracking-widest transition-all"
                    >
                      Manage <ChevronRight size={12} />
                    </button>
                    <button onClick={() => openEdit(w)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(w.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a] shrink-0">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editing ? "Edit Workshop" : "New Workshop"}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Slug *</label>
                <input
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="my-workshop"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none"
                />
              </div>

              {/* Thumbnail */}
              <ThumbnailUpload
                value={form.thumbnailUrl}
                onUploaded={url => setForm((f: any) => ({ ...f, thumbnailUrl: url }))}
                uploading={thumbUploading}
                setUploading={setThumbUploading}
              />

              {/* Delivery Mode + Tier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Delivery Mode</label>
                  <select
                    value={form.deliveryMode}
                    onChange={e => setForm((f: any) => ({ ...f, deliveryMode: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none"
                  >
                    {DELIVERY_MODES.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Required Tier</label>
                  <input
                    type="number"
                    value={form.requiredTier}
                    onChange={e => setForm((f: any) => ({ ...f, requiredTier: e.target.value }))}
                    placeholder="e.g. 1"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm"
                  />
                </div>
              </div>

              {/* Batch dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Batch</label>
                <select
                  value={form.batchId}
                  onChange={e => setForm((f: any) => ({ ...f, batchId: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none"
                >
                  <option value="">— No batch —</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, isActive: !f.isActive }))}
                  className={`w-10 h-5 rounded-full relative transition-all ${form.isActive ? "bg-[#dc2626]" : "bg-[#333]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.isActive ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani">Active</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button
                onClick={handleSave}
                disabled={createWorkshop.isPending || updateWorkshop.isPending || thumbUploading}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {(createWorkshop.isPending || updateWorkshop.isPending) && <Loader2 size={14} className="animate-spin" />}
                Save
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
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Workshop?</h3>
            <p className="text-[#606060] text-sm mb-6">All challenges, episodes, and enrollments will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button
                onClick={() => handleDelete(deleting)}
                disabled={deleteWorkshop.isPending}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleteWorkshop.isPending && <Loader2 size={13} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
