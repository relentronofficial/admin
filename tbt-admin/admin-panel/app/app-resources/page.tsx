"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, X, Loader2, FileText, AlertCircle, Eye, EyeOff, Search, Save, GripVertical } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListAppResources, useCreateAppResource, useUpdateAppResource, useDeleteAppResource,
  useGetResourcesPageConfig, useUpdateResourcesPageConfig, useReorderAppResources, useListBatches,
} from "@/lib/hooks/useTbt";
import { useGetPresignedUrl } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const FILE_TYPES = ["image", "pdf", "doc", "xlsx", "ppt", "video", "audio", "archive", "other"];

const EMPTY_FORM = {
  title: "", author: "", date: "", fileUrl: "", previewUrl: "",
  fileType: "pdf", fileTypeIconUrl: "", fileCount: "1",
  isVisible: true, previewLabel: "Preview", downloadLabel: "Download",
  batchIds: [] as string[],
};

const detectFileType = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xlsx";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
};

const fileTypeColor = (t: string) => {
  if (t === "pdf") return "text-red-400 bg-red-400/10 border-red-400/20";
  if (t === "image") return "text-pink-400 bg-pink-400/10 border-pink-400/20";
  if (t === "video") return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  if (t === "xlsx") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (t === "doc") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (t === "ppt") return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  if (t === "audio") return "text-teal-400 bg-teal-400/10 border-teal-400/20";
  if (t === "archive") return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  return "text-purple-400 bg-purple-400/10 border-purple-400/20";
};

const labelCls = "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";

export default function AppResourcesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useListAppResources(search);
  const createResource = useCreateAppResource();
  const updateResource = useUpdateAppResource();
  const deleteResource = useDeleteAppResource();
  const reorderResources = useReorderAppResources();
  const getPresignedUrl = useGetPresignedUrl();

  const { data: batchesData } = useListBatches();
  const batches: any[] = (batchesData as any)?.data || [];

  const { data: pageConfigData } = useGetResourcesPageConfig();
  const updatePageConfig = useUpdateResourcesPageConfig();
  const pageConfig = (pageConfigData as any)?.data;
  const [pageConfigForm, setPageConfigForm] = useState({ pageTitle: "Resources", searchPlaceholder: "Search resources...", totalLabel: "resources", defaultView: "list" });
  useEffect(() => {
    if (pageConfig) setPageConfigForm({ pageTitle: pageConfig.pageTitle || "Resources", searchPlaceholder: pageConfig.searchPlaceholder || "Search resources...", totalLabel: pageConfig.totalLabel || "resources", defaultView: pageConfig.defaultView || "list" });
  }, [pageConfig]);

  const handleSavePageConfig = async () => {
    try { await updatePageConfig.mutateAsync(pageConfigForm); toast.success("Page config saved"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const resources = (data as any)?.data || [];

  // ── DnD reorder ───────────────────────────────────────────────────────
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => { setLocalItems(resources); setIsDirty(false); }, [data]);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localItems];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalItems(next);
    setIsDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  const handleSaveOrder = async () => {
    try {
      await reorderResources.mutateAsync(localItems.map((r: any) => r.id));
      setIsDirty(false);
      toast.success("Order saved");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── File uploads ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [fileProgress, setFileProgress] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState<number | null>(null);

  const uploadWithProgress = (url: string, file: File, onProgress: (pct: number) => void): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });

  const uploadToStorage = async (file: File, pathPrefix: string, onProgress?: (pct: number) => void): Promise<string> => {
    const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      pathPrefix,
    });
    if (onProgress) {
      await uploadWithProgress(uploadUrl, file, onProgress);
    } else {
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    }
    return publicUrl;
  };

  const handleMainFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setFileProgress(0);
    try {
      const url = await uploadToStorage(file, "resources/files", (pct) => setFileProgress(pct));
      setForm((f: any) => ({ ...f, fileUrl: url, fileType: detectFileType(file.name) }));
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingFile(false); setFileProgress(null); e.target.value = ""; }
  };

  const handlePreviewFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPreview(true);
    setPreviewProgress(0);
    try {
      const url = await uploadToStorage(file, "resources/previews", (pct) => setPreviewProgress(pct));
      setForm((f: any) => ({ ...f, previewUrl: url }));
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingPreview(false); setPreviewProgress(null); e.target.value = ""; }
  };

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const url = await uploadToStorage(file, "resources/icons");
      setForm((f: any) => ({ ...f, fileTypeIconUrl: url }));
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingIcon(false); e.target.value = ""; }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); };

  const openEdit = (r: any) => {
    setForm({
      title: r.title || "", author: r.author || "",
      date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
      fileUrl: r.fileUrl || "", previewUrl: r.previewUrl || "",
      fileType: r.fileType || "pdf", fileTypeIconUrl: r.fileTypeIconUrl || "",
      fileCount: String(r.fileCount ?? 1), isVisible: r.isVisible ?? true,
      previewLabel: r.previewLabel || "Preview", downloadLabel: r.downloadLabel || "Download",
      batchIds: (r.visibility as any)?.batchIds || [],
    });
    setEditing(r);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.fileUrl) return toast.error("Title and file are required");
    try {
      const payload: any = {
        title: form.title, author: form.author || null, date: form.date || null,
        fileUrl: form.fileUrl, previewUrl: form.previewUrl || null,
        fileType: form.fileType, fileTypeIconUrl: form.fileTypeIconUrl || null,
        fileCount: Number(form.fileCount) || 1, isVisible: form.isVisible,
        previewLabel: form.previewLabel || "Preview", downloadLabel: form.downloadLabel || "Download",
        batchIds: form.batchIds || [],
      };
      if (editing) { await updateResource.mutateAsync({ id: editing.id, data: payload }); toast.success("Resource updated"); }
      else { await createResource.mutateAsync(payload); toast.success("Resource created"); }
      setShowForm(false); refetch();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteResource.mutateAsync(id); toast.success("Resource deleted"); setDeleting(null); refetch(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleToggleVisible = async (r: any) => {
    try { await updateResource.mutateAsync({ id: r.id, data: { isVisible: !r.isVisible } }); refetch(); }
    catch { toast.error("Failed to update visibility"); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Resource Library</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">Manage downloadable content for TBT members.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <button onClick={handleSaveOrder} disabled={reorderResources.isPending} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] text-[#a0a0a0] hover:text-white px-4 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase transition-all">
                {reorderResources.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Order
              </button>
            )}
            <button onClick={openCreate} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
              <Plus size={15} /> Add Resource
            </button>
          </div>
        </div>

        {/* Page Config */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
            <p className="text-[10px] text-[#888] uppercase font-bold tracking-widest font-rajdhani">Page Config</p>
            <button onClick={handleSavePageConfig} disabled={updatePageConfig.isPending} className="flex items-center gap-2 bg-[#dc2626] text-white px-4 py-1.5 rounded-md font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700 transition-all">
              {updatePageConfig.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[{ key: "pageTitle", label: "Page Title", placeholder: "Resources" }, { key: "searchPlaceholder", label: "Search Placeholder", placeholder: "Search resources..." }, { key: "totalLabel", label: "Total Count Label", placeholder: "resources" }, { key: "defaultView", label: "Default View", placeholder: "list" }].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input value={(pageConfigForm as any)[key]} onChange={e => setPageConfigForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Resource List */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50">
            <div className="relative w-full md:w-[360px]">
              <input type="text" placeholder="SEARCH RESOURCES..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#dc2626] transition-all text-[#f0f0f0] placeholder:text-[#777]" />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
          ) : localItems.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <FileText size={36} className="mx-auto text-[#666]" />
              <p className="text-[#888] font-rajdhani font-bold uppercase tracking-widest text-sm">No resources found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <th className="px-3 py-4 w-8" />
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#888] font-bold font-rajdhani">Resource</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#888] font-bold font-rajdhani">Type</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#888] font-bold font-rajdhani">Author</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#888] font-bold font-rajdhani">Date</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#888] font-bold font-rajdhani">Access</th>
                  <th className="px-4 py-4 w-[110px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {localItems.map((r: any, idx) => (
                  <tr
                    key={r.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDrop={e => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    className={`transition-colors ${!r.isVisible ? "opacity-50" : ""} ${dragOver === idx ? "bg-[#dc2626]/5" : "hover:bg-white/[0.02]"}`}
                  >
                    <td className="px-3 py-4">
                      <GripVertical size={14} className="text-[#666] cursor-grab active:cursor-grabbing" />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#f0f0f0] text-sm">{r.title}</p>
                      <p className="text-[11px] text-[#777] mt-0.5">{r.fileCount} file{r.fileCount > 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${fileTypeColor(r.fileType)}`}>
                        {r.fileType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#888] text-sm">{r.author || "—"}</td>
                    <td className="px-4 py-4 text-[#888] text-sm">{r.date ? format(new Date(r.date), "dd MMM yyyy") : "—"}</td>
                    <td className="px-4 py-4">
                      {(() => {
                        const bIds = (r.visibility as any)?.batchIds;
                        if (!bIds || bIds.length === 0) return <span className="text-[10px] text-[#666] font-rajdhani uppercase tracking-wider">All</span>;
                        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border text-amber-400 bg-amber-400/10 border-amber-400/20">{bIds.length} batch{bIds.length > 1 ? "es" : ""}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleToggleVisible(r)} className={`p-1.5 rounded transition-all ${r.isVisible ? "text-green-400 hover:bg-green-400/10" : "text-[#777] hover:text-white hover:bg-[#2a2a2a]"}`}>
                          {r.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => openEdit(r)} className="p-1.5 text-[#777] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={14} /></button>
                        <button onClick={() => setDeleting(r.id)} className="p-1.5 text-[#777] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── FORM MODAL ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editing ? "Edit Resource" : "New Resource"}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#888] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

              <div>
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Author</label>
                  <input value={form.author} onChange={e => setForm((f: any) => ({ ...f, author: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Main file upload — any file type */}
              <div>
                <label className={labelCls}>File * <span className="text-[#666] normal-case font-normal">(image, PDF, video, doc, archive — any type)</span></label>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleMainFileChange} />
                {form.fileUrl ? (
                  <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4">
                    <span className="text-[12px] text-[#a0a0a0] flex-1 truncate">{form.fileUrl.split("/").pop()}</span>
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, fileUrl: "" }))} className="text-[#777] hover:text-red-400 shrink-0"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="w-full bg-[#1a1a1a] border border-dashed border-[#333] hover:border-[#dc2626] rounded-lg h-11 px-4 text-[12px] text-[#888] hover:text-white transition-all flex items-center justify-center gap-2">
                      {uploadingFile
                        ? <><Loader2 size={14} className="animate-spin" /> {fileProgress !== null ? `${fileProgress}%` : "Preparing…"}</>
                        : <><Plus size={14} /> Upload File</>}
                    </button>
                    {uploadingFile && fileProgress !== null && (
                      <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div className="h-full bg-[#dc2626] transition-all duration-150" style={{ width: `${fileProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview file upload */}
              <div>
                <label className={labelCls}>Preview File <span className="text-[#666] normal-case font-normal">(optional — lighter version for in-browser view)</span></label>
                <input ref={previewInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={handlePreviewFileChange} />
                {form.previewUrl ? (
                  <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4">
                    <span className="text-[12px] text-[#a0a0a0] flex-1 truncate">{form.previewUrl.split("/").pop()}</span>
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, previewUrl: "" }))} className="text-[#777] hover:text-red-400 shrink-0"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button type="button" onClick={() => previewInputRef.current?.click()} disabled={uploadingPreview} className="w-full bg-[#1a1a1a] border border-dashed border-[#333] hover:border-[#dc2626] rounded-lg h-11 px-4 text-[12px] text-[#888] hover:text-white transition-all flex items-center justify-center gap-2">
                      {uploadingPreview
                        ? <><Loader2 size={14} className="animate-spin" /> {previewProgress !== null ? `${previewProgress}%` : "Preparing…"}</>
                        : <><Plus size={14} /> Upload Preview File</>}
                    </button>
                    {uploadingPreview && previewProgress !== null && (
                      <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div className="h-full bg-[#dc2626] transition-all duration-150" style={{ width: `${previewProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* File Type + File Count */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>File Type</label>
                  <select value={form.fileType} onChange={e => setForm((f: any) => ({ ...f, fileType: e.target.value }))} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                    {FILE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>File Count</label>
                  <input type="number" min={1} value={form.fileCount} onChange={e => setForm((f: any) => ({ ...f, fileCount: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Icon upload */}
              <div>
                <label className={labelCls}>File Type Icon <span className="text-[#666] normal-case font-normal">(optional custom icon image)</span></label>
                <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={handleIconFileChange} />
                {form.fileTypeIconUrl ? (
                  <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4">
                    <img src={form.fileTypeIconUrl} alt="" className="w-6 h-6 object-contain rounded shrink-0" />
                    <span className="text-[12px] text-[#a0a0a0] flex-1 truncate">{form.fileTypeIconUrl.split("/").pop()}</span>
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, fileTypeIconUrl: "" }))} className="text-[#777] hover:text-red-400 shrink-0"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon} className="w-full bg-[#1a1a1a] border border-dashed border-[#333] hover:border-[#dc2626] rounded-lg h-11 px-4 text-[12px] text-[#888] hover:text-white transition-all flex items-center justify-center gap-2">
                    {uploadingIcon ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Plus size={14} /> Upload Icon Image</>}
                  </button>
                )}
              </div>

              {/* Batch Access Restriction */}
              <div>
                <label className={labelCls}>Batch Access <span className="text-[#666] normal-case font-normal">(leave empty = all members)</span></label>
                {batches.length === 0 ? (
                  <p className="text-[#666] text-xs">No batches found.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {batches.map((b: any) => {
                      const checked = form.batchIds?.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            const curr: string[] = form.batchIds || [];
                            setForm((f: any) => ({
                              ...f,
                              batchIds: checked ? curr.filter((id: string) => id !== b.id) : [...curr, b.id],
                            }));
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${checked ? "bg-[#dc2626]/10 border-[#dc2626]/40 text-white" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#a0a0a0] hover:border-[#444]"}`}
                        >
                          <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${checked ? "bg-[#dc2626] border-[#dc2626]" : "border-[#555]"}`}>
                            {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                          </span>
                          <span className="font-medium">{b.name}</span>
                          {!b.isActive && <span className="ml-auto text-[10px] text-[#666] uppercase tracking-wider">Inactive</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Visible toggle */}
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 h-11">
                <span className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">Visible</span>
                <button type="button" onClick={() => setForm((f: any) => ({ ...f, isVisible: !f.isVisible }))} className={`relative w-11 h-6 rounded-full transition-colors ${form.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.isVisible ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Labels */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Preview Label</label>
                  <input value={form.previewLabel} onChange={e => setForm((f: any) => ({ ...f, previewLabel: e.target.value }))} placeholder="Preview" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Download Label</label>
                  <input value={form.downloadLabel} onChange={e => setForm((f: any) => ({ ...f, downloadLabel: e.target.value }))} placeholder="Download" className={inputCls} />
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#888] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSave} disabled={createResource.isPending || updateResource.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createResource.isPending || updateResource.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Resource?</h3>
            <p className="text-[#888] text-sm mb-6">This action cannot be undone.</p>
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
