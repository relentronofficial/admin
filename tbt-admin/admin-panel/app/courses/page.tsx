"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Pencil, X, Loader2, BookOpen, Search, Film,
  Eye, EyeOff, AlertCircle, GripVertical, Save, Image as ImageIcon, Upload,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListVodCourses, useCreateVodCourse, useUpdateVodCourse, useDeleteVodCourse,
  useListCourseEpisodes, useCreateCourseEpisode, useUpdateCourseEpisode,
  useDeleteCourseEpisode, useReorderCourseEpisodes,
} from "@/lib/hooks/useTbt";
import { useUploadImage, useCreateBunnyVideo } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const EMPTY_COURSE = { title: "", slug: "", description: "", thumbnailUrl: "", requiredTier: "1", isActive: true };
const EMPTY_EP = { title: "", videoUrl: "", bunnyVideoId: "", thumbnailUrl: "", durationSeconds: "", isVisible: true };

// ── Single-file upload button ─────────────────────────────────────────
function FileUploadBtn({
  label, value, accept, pathPrefix, onUploaded, uploading, setUploading, uploadKey,
}: {
  label: string; value: string; accept: string; pathPrefix: string;
  onUploaded: (url: string) => void; uploading: string | null;
  setUploading: (k: string | null) => void; uploadKey: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const isUploading = uploading === uploadKey;

  const handleFile = async (file: File) => {
    try {
      setUploading(uploadKey);
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix });
      onUploaded(publicUrl);
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
      <div className="flex items-center gap-2">
        {value && accept.startsWith("image") && (
          <img src={value} alt="" className="w-14 h-10 rounded object-cover border border-[#333] shrink-0" />
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}
          className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50">
          {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {isUploading ? "Uploading..." : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[#555] font-mono truncate max-w-[140px]">{value.split("/").pop()}</span>
            <button type="button" onClick={() => onUploaded("")} className="text-[#444] hover:text-red-400 shrink-0"><X size={12} /></button>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVodCourses({ search });
  const createCourse = useCreateVodCourse();
  const updateCourse = useUpdateVodCourse();
  const deleteCourse = useDeleteVodCourse();

  const courses: any[] = (data as any)?.data || [];
  const total = (data as any)?.meta?.total || 0;

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<any>(EMPTY_COURSE);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseUploading, setCourseUploading] = useState<string | null>(null);

  const setCourseField = (k: string, v: any) => setCourseForm((f: any) => ({ ...f, [k]: v }));

  const openCreateCourse = () => { setCourseForm(EMPTY_COURSE); setEditingCourse(null); setShowCourseForm(true); };
  const openEditCourse = (c: any) => {
    setCourseForm({ title: c.title, slug: c.slug, description: c.description || "", thumbnailUrl: c.thumbnailUrl || "", requiredTier: String(c.requiredTier ?? 1), isActive: c.isActive ?? true });
    setEditingCourse(c); setShowCourseForm(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return toast.error("Title is required");
    const slug = courseForm.slug.trim() || toSlug(courseForm.title);
    const payload = { ...courseForm, slug, requiredTier: Number(courseForm.requiredTier) || 1 };
    try {
      if (editingCourse) { await updateCourse.mutateAsync({ id: editingCourse.id, data: payload }); toast.success("Course updated"); }
      else { await createCourse.mutateAsync(payload); toast.success("Course created"); }
      setShowCourseForm(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleDeleteCourse = async (id: string) => {
    try { await deleteCourse.mutateAsync(id); toast.success("Course deleted"); setDeletingCourse(null); if (selectedCourse?.id === id) setSelectedCourse(null); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Courses</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">VOD course library with episodes.</p>
            </div>
          </div>
          <button onClick={openCreateCourse}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
            <Plus size={15} /> New Course
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#dc2626]"><BookOpen size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Total Courses</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{total}</p>
            </div>
          </div>
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-blue-400"><Film size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Showing</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{courses.length}</p>
            </div>
          </div>
        </div>

        {/* Course list + episode panel */}
        <div className={`grid gap-6 ${selectedCourse ? "grid-cols-[1fr_400px]" : "grid-cols-1"}`}>
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50">
              <div className="relative w-full md:w-72">
                <input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#dc2626] transition-all text-[#f0f0f0] placeholder:text-[#444]" />
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
            ) : courses.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <BookOpen size={36} className="mx-auto text-[#333]" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No courses found</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {courses.map((c: any) => (
                  <div key={c.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group cursor-pointer
                      ${selectedCourse?.id === c.id ? "bg-[#dc2626]/5 border-l-2 border-[#dc2626]" : "border-l-2 border-transparent"}`}
                    onClick={() => setSelectedCourse(selectedCourse?.id === c.id ? null : c)}>
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded border border-[#333] shrink-0" />
                    ) : (
                      <div className="w-14 h-10 rounded border border-[#333] bg-[#1a1a1a] flex items-center justify-center shrink-0">
                        <ImageIcon size={14} className="text-[#444]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#f0f0f0] text-sm truncate group-hover:text-[#dc2626] transition-colors">{c.title}</p>
                        {!c.isActive && <span className="text-[10px] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded font-bold uppercase shrink-0">Inactive</span>}
                        {c.requiredTier > 1 && <span className="text-[10px] text-[#606060] bg-[#1a1a1a] border border-[#333] px-2 py-0.5 rounded font-rajdhani font-bold shrink-0">Tier {c.requiredTier}</span>}
                      </div>
                      <p className="text-[11px] text-[#444] font-mono">/{c.slug}</p>
                      <p className="text-[11px] text-[#555]">{c._count?.courseEpisodes ?? 0} episode{c._count?.courseEpisodes !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={e => { e.stopPropagation(); openEditCourse(c); }} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setDeletingCourse(c.id); }} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCourse && (
            <EpisodesPanel
              course={selectedCourse}
              onClose={() => setSelectedCourse(null)}
            />
          )}
        </div>
      </div>

      {/* Course form modal */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingCourse ? "Edit Course" : "New Course"}</h3>
              <button onClick={() => setShowCourseForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={courseForm.title}
                  onChange={e => { setCourseField("title", e.target.value); if (!editingCourse) setCourseField("slug", toSlug(e.target.value)); }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Slug (auto-generated)</label>
                <input value={courseForm.slug} onChange={e => setCourseField("slug", e.target.value)} placeholder="my-course"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={courseForm.description} onChange={e => setCourseField("description", e.target.value)} rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>

              {/* Thumbnail upload */}
              <FileUploadBtn
                label="Thumbnail"
                value={courseForm.thumbnailUrl}
                accept="image/png,image/jpeg,image/webp"
                pathPrefix="courses/thumbnails"
                uploadKey="courseThumbnail"
                uploading={courseUploading}
                setUploading={setCourseUploading}
                onUploaded={url => setCourseField("thumbnailUrl", url)}
              />

              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Required Tier</label>
                <input type="number" min="1" value={courseForm.requiredTier} onChange={e => setCourseField("requiredTier", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCourseField("isActive", !courseForm.isActive)}
                  className={`w-10 h-5 rounded-full relative transition-all ${courseForm.isActive ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${courseForm.isActive ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani">Active</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowCourseForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest">Cancel</button>
              <button onClick={handleSaveCourse} disabled={createCourse.isPending || updateCourse.isPending || !!courseUploading}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-60">
                {(createCourse.isPending || updateCourse.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete course confirm */}
      {deletingCourse && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Course?</h3>
            <p className="text-[#606060] text-xs mb-6">All episodes will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingCourse(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleDeleteCourse(deletingCourse)} disabled={deleteCourse.isPending}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
                {deleteCourse.isPending && <Loader2 size={13} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ── Episodes Panel ────────────────────────────────────────────────────
function EpisodesPanel({ course, onClose }: { course: any; onClose: () => void }) {
  const { data, isLoading } = useListCourseEpisodes(course.id);
  const createEp = useCreateCourseEpisode(course.id);
  const updateEp = useUpdateCourseEpisode(course.id);
  const deleteEp = useDeleteCourseEpisode(course.id);
  const reorderEp = useReorderCourseEpisodes(course.id);

  const serverEps: any[] = (data as any)?.data || [];
  const [localEps, setLocalEps] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { setLocalEps(serverEps); setIsDirty(false); }, [data]);

  const [showForm, setShowForm] = useState(false);
  const [editingEp, setEditingEp] = useState<any>(null);
  const [epForm, setEpForm] = useState<any>(EMPTY_EP);
  const [deletingEp, setDeletingEp] = useState<string | null>(null);
  const [epUploading, setEpUploading] = useState<string | null>(null);

  const setEpField = (k: string, v: any) => setEpForm((f: any) => ({ ...f, [k]: v }));

  // DnD
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localEps];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalEps(next);
    setIsDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  const handleSaveOrder = async () => {
    try { await reorderEp.mutateAsync(localEps.map((ep: any) => ep.id)); setIsDirty(false); toast.success("Order saved"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  // Duration auto-detect from video file
  const detectDuration = (file: File): Promise<number> =>
    new Promise(resolve => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(video.duration)); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });

  const openCreate = () => { setEpForm(EMPTY_EP); setEditingEp(null); setShowForm(true); };
  const openEdit = (ep: any) => {
    setEpForm({ title: ep.title, videoUrl: ep.videoUrl, bunnyVideoId: ep.bunnyVideoId || "", thumbnailUrl: ep.thumbnailUrl || "", durationSeconds: String(ep.durationSeconds || ""), isVisible: ep.isVisible });
    setEditingEp(ep); setShowForm(true);
  };

  const handleSaveEp = async () => {
    if (!epForm.title.trim() || !epForm.videoUrl.trim()) return toast.error("Title and video are required");
    const normalizedVideoUrl = epForm.videoUrl
      ? epForm.videoUrl.replace(/https?:\/\/player\.mediadelivery\.net\/play\/(\d+)\/([\w-]+)/, 'https://iframe.mediadelivery.net/embed/$1/$2')
      : epForm.videoUrl;
    const payload = { ...epForm, videoUrl: normalizedVideoUrl, durationSeconds: Number(epForm.durationSeconds) || 0, bunnyVideoId: epForm.bunnyVideoId || undefined };
    try {
      if (editingEp) { await updateEp.mutateAsync({ id: editingEp.id, data: payload }); toast.success("Episode updated"); }
      else { await createEp.mutateAsync(payload); toast.success("Episode created"); }
      setShowForm(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleDeleteEp = async (id: string) => {
    try { await deleteEp.mutateAsync(id); toast.success("Episode deleted"); setDeletingEp(null); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const uploadImage = useUploadImage();
  const createBunnyVideo = useCreateBunnyVideo();
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleVideoUpload = async (file: File) => {
    try {
      setEpUploading("video");
      setUploadProgress(0);
      // auto-detect duration from local file before upload
      const secs = await detectDuration(file);
      if (secs > 0) setEpField("durationSeconds", String(secs));

      // Create video entry in Bunny Stream — get TUS credentials
      const { videoId, tusUploadUrl, tusHeaders, embedUrl } = await createBunnyVideo.mutateAsync({
        title: epForm.title || file.name,
      });

      // Upload directly to Bunny Stream via TUS — no backend proxy
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: tusUploadUrl,
          headers: {
            AuthorizationSignature: tusHeaders.AuthorizationSignature,
            AuthorizationExpire: String(tusHeaders.AuthorizationExpire),
            VideoId: tusHeaders.VideoId,
            LibraryId: tusHeaders.LibraryId,
          },
          chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000],
          metadata: { filetype: file.type, title: epForm.title || file.name },
          onProgress(bytesUploaded: number, bytesTotal: number) {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess() { resolve(); },
          onError(err: any) { reject(err); },
        });
        upload.start();
      });

      setEpField("videoUrl", embedUrl);
      setEpField("bunnyVideoId", videoId);
      toast.success("Video uploaded to Bunny Stream");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setEpUploading(null);
      setUploadProgress(0);
    }
  };

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const handleThumbUpload = async (file: File) => {
    try {
      setEpUploading("thumb");
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: "course-videos/episode-thumbs" });
      setEpField("thumbnailUrl", publicUrl);
      toast.success("Thumbnail uploaded");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setEpUploading(null); }
  };

  const fmtDuration = (secs: number) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: "78vh" }}>
      {/* Panel header */}
      <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Episodes</p>
          <p className="text-sm font-bold text-[#f0f0f0] truncate">{course.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button onClick={handleSaveOrder} disabled={reorderEp.isPending}
              className="flex items-center gap-1 bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#dc2626] px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:bg-[#dc2626]/30 transition-all">
              {reorderEp.isPending ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />} Save Order
            </button>
          )}
          <button onClick={openCreate}
            className="flex items-center gap-1 bg-[#dc2626] text-white px-3 py-1.5 rounded font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700 transition-all">
            <Plus size={12} /> Add
          </button>
          <button onClick={onClose} className="text-[#606060] hover:text-white p-1 transition-colors"><X size={16} /></button>
        </div>
      </div>

      {/* Episode list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>
        ) : localEps.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Film size={28} className="mx-auto text-[#333]" />
            <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-xs">No episodes yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {localEps.map((ep: any, i: number) => (
              <div key={ep.id} draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={e => onDrop(e, i)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-3 px-4 py-3 select-none transition-all group
                  ${dragOver === i ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-white/[0.02]"}
                  ${dragIdx.current === i ? "opacity-30" : ""}`}>
                <GripVertical size={13} className="text-[#333] cursor-grab shrink-0" />
                <span className="text-[10px] text-[#444] font-mono w-4 shrink-0">{i + 1}</span>
                {ep.thumbnailUrl && (
                  <img src={ep.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded border border-[#333] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#f0f0f0] truncate">{ep.title}</p>
                  <p className="text-[10px] text-[#555]">{fmtDuration(ep.durationSeconds)}</p>
                </div>
                {!ep.isVisible && <EyeOff size={11} className="text-[#555] shrink-0" />}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={() => openEdit(ep)} className="p-1 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={12} /></button>
                  <button onClick={() => setDeletingEp(ep.id)} className="p-1 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline episode form */}
      {showForm && (
        <div className="border-t border-[#2a2a2a] p-4 bg-[#141414] space-y-3 shrink-0 overflow-y-auto max-h-[55vh]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">{editingEp ? "Edit Episode" : "New Episode"}</p>
            <button onClick={() => setShowForm(false)} className="text-[#444] hover:text-white transition-colors"><X size={14} /></button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase tracking-widest mb-1 font-rajdhani">Title *</label>
            <input value={epForm.title} onChange={e => setEpField("title", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>

          {/* Video upload */}
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase tracking-widest mb-1 font-rajdhani">Video *</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => videoInputRef.current?.click()} disabled={epUploading === "video"}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50">
                {epUploading === "video" ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {epUploading === "video"
                  ? uploadProgress > 0 ? `${uploadProgress}%` : "Preparing..."
                  : "Upload to Bunny"}
              </button>
              {epForm.videoUrl && (
                <span className={`text-[10px] font-mono truncate max-w-[160px] ${epForm.videoUrl.includes("iframe.mediadelivery.net") ? "text-green-500" : "text-[#555]"}`}>
                  {epForm.videoUrl.includes("iframe.mediadelivery.net") ? "Bunny Stream" : epForm.videoUrl.split("/").pop()}
                </span>
              )}
            </div>
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/mov" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }} />
          </div>

          {/* Thumbnail upload */}
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase tracking-widest mb-1 font-rajdhani">Thumbnail <span className="text-[#444] normal-case tracking-normal">(optional)</span></label>
            <div className="flex items-center gap-2">
              {epForm.thumbnailUrl && <img src={epForm.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded border border-[#333]" />}
              <button type="button" onClick={() => thumbInputRef.current?.click()} disabled={epUploading === "thumb"}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50">
                {epUploading === "thumb" ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                {epUploading === "thumb" ? "Uploading..." : epForm.thumbnailUrl ? "Replace" : "Upload"}
              </button>
            </div>
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f); e.target.value = ""; }} />
          </div>

          {/* Duration — auto-filled on video upload, manual override */}
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase tracking-widest mb-1 font-rajdhani">
              Duration (seconds) <span className="text-[#444] normal-case tracking-normal">— auto-detected on upload</span>
            </label>
            <input type="number" min="0" value={epForm.durationSeconds} onChange={e => setEpField("durationSeconds", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>

          {/* Visible */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEpField("isVisible", !epForm.isVisible)}
              className={`w-8 h-4 rounded-full relative transition-all ${epForm.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${epForm.isVisible ? "right-0.5" : "left-0.5"}`} />
            </button>
            <span className="text-[11px] text-[#a0a0a0] font-rajdhani flex items-center gap-1">
              {epForm.isVisible ? <Eye size={11} /> : <EyeOff size={11} />} {epForm.isVisible ? "Visible" : "Hidden"}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[11px] uppercase tracking-widest border border-[#2a2a2a] rounded transition-all">Cancel</button>
            <button onClick={handleSaveEp} disabled={createEp.isPending || updateEp.isPending || !!epUploading}
              className="flex-1 py-2 bg-[#dc2626] hover:bg-red-700 text-white font-rajdhani font-bold text-[11px] uppercase tracking-widest rounded flex items-center justify-center gap-1 disabled:opacity-60">
              {(createEp.isPending || updateEp.isPending) && <Loader2 size={11} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}

      {/* Delete ep confirm */}
      {deletingEp && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-xs rounded-xl p-6 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-3" size={28} />
            <p className="font-rajdhani font-bold uppercase text-[#f0f0f0] mb-4">Delete this episode?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingEp(null)} className="flex-1 py-2 bg-[#1a1a1a] border border-[#333] rounded text-[#a0a0a0] font-rajdhani font-bold text-[11px] uppercase">Cancel</button>
              <button onClick={() => handleDeleteEp(deletingEp)} disabled={deleteEp.isPending}
                className="flex-1 py-2 bg-[#dc2626] rounded text-white font-rajdhani font-bold text-[11px] uppercase flex items-center justify-center gap-1 disabled:opacity-60">
                {deleteEp.isPending && <Loader2 size={11} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
