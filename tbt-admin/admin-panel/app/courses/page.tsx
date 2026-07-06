"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Pencil, X, Loader2, BookOpen, Search, Film,
  Eye, EyeOff, AlertCircle, GripVertical, Save, Image as ImageIcon, Upload,
  Lock, BarChart2, Users, ShieldCheck, Trophy, CreditCard, Download, Filter,
  CheckCircle2, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListVodCourses, useCreateVodCourse, useUpdateVodCourse, useDeleteVodCourse,
  useListCourseEpisodes, useCreateCourseEpisode, useUpdateCourseEpisode,
  useDeleteCourseEpisode, useReorderCourseEpisodes, useListTiers,
  useListCourseAccess, useGrantCourseAccess, useRevokeCourseAccess,
  useListCoursePayments, useApproveCoursePayment,
  useCourseAnalyticsAdmin, useCourseLeaderboardAdmin, useAtRiskMembers,
  useListCourseBadges, useCreateCourseBadge, useUpdateCourseBadge,
  useDeleteCourseBadge, useAwardCourseBadge,
} from "@/lib/hooks/useTbt";
import { useUploadImage, useCreateBunnyVideo } from "@/lib/hooks/useAdmin";
import { useListMembers } from "@/lib/hooks/useMembers";
import apiClient from "@/lib/api/apiClient";
import { toast } from "react-hot-toast";
import { getAdminSocket } from "@/lib/socket/client";

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const EMPTY_COURSE = {
  title: "", slug: "", description: "", thumbnailUrl: "",
  requiredTier: "1", isActive: true,
  price: "", accessDurationDays: "", maxEnrollments: "",
  xpPerEpisode: "10", passingScorePercent: "70",
  paymentLinkUrl: "",
  upsellCourseIds: [] as string[],
  crossSellCourseIds: [] as string[],
};
const uid = () => Math.random().toString(36).slice(2, 10);
const secsToTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const timeToSecs = (t: string) => {
  const [m, s] = t.split(":").map(Number);
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
};
const EMPTY_OPTION = () => ({ id: uid(), text: "", correct: false });
const EMPTY_QUESTION = () => ({ id: uid(), question: "", options: [EMPTY_OPTION(), EMPTY_OPTION()] });
const EMPTY_CUE = () => ({ id: uid(), atSeconds: 60, atTime: "1:00", questions: [EMPTY_QUESTION()] });

const EMPTY_EP = {
  title: "", videoUrl: "", bunnyVideoId: "", thumbnailUrl: "",
  durationSeconds: "", isVisible: true,
  quizUnlockPercent: "80", drmEnabled: false, bunnyDrmToken: "",
  quizData: null as any,
};

// ── File upload button ─────────────────────────────────────────────────
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
      <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
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
            <span className="text-[10px] text-[#888] font-mono truncate max-w-[140px]">{value.split("/").pop()}</span>
            <button type="button" onClick={() => onUploaded("")} className="text-[#777] hover:text-red-400 shrink-0"><X size={12} /></button>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function CoursesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVodCourses({ search });
  const { data: tiersData } = useListTiers();
  const tiers: any[] = (tiersData as any)?.data || [];
  const createCourse = useCreateVodCourse();
  const updateCourse = useUpdateVodCourse();
  const deleteCourse = useDeleteVodCourse();

  const courses: any[] = (data as any)?.data || [];
  const total = (data as any)?.meta?.total || 0;

  // Pending access-request count — drives the badge on the Payments toggle
  const { data: pendingCountData } = useListCoursePayments({ status: "pending", limit: 1 });
  const pendingPaymentsTotal: number = (pendingCountData as any)?.meta?.total ?? 0;

  const [viewMode, setViewMode] = useState<"courses" | "payments">("courses");
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<any>(EMPTY_COURSE);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseUploading, setCourseUploading] = useState<string | null>(null);

  // Deep-link from notification: ?open=<courseId> → auto-select that course
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("open");
    if (id) {
      setAutoOpenId(id);
      window.history.replaceState({}, "", "/courses");
    }
  }, []);
  useEffect(() => {
    if (!autoOpenId || courses.length === 0) return;
    const course = courses.find((c: any) => c.id === autoOpenId);
    if (course) {
      setViewMode("courses");
      setSelectedCourse(course);
      setAutoOpenId(null);
    }
  }, [autoOpenId, courses]);

  const setCourseField = (k: string, v: any) => setCourseForm((f: any) => ({ ...f, [k]: v }));

  const openCreateCourse = () => { setCourseForm(EMPTY_COURSE); setEditingCourse(null); setShowCourseForm(true); };
  const openEditCourse = (c: any) => {
    setCourseForm({
      title: c.title, slug: c.slug, description: c.description || "",
      thumbnailUrl: c.thumbnailUrl || "", requiredTier: String(c.requiredTier ?? 1),
      isActive: c.isActive ?? true,
      price: c.price != null ? String(c.price) : "",
      accessDurationDays: c.accessDurationDays != null ? String(c.accessDurationDays) : "",
      maxEnrollments: c.maxEnrollments != null ? String(c.maxEnrollments) : "",
      xpPerEpisode: String(c.xpPerEpisode ?? 10),
      passingScorePercent: String(c.passingScorePercent ?? 70),
      upsellCourseIds: c.upsellCourseIds ?? [],
      crossSellCourseIds: c.crossSellCourseIds ?? [],
      paymentLinkUrl: c.paymentLinkUrl || "",
    });
    setEditingCourse(c); setShowCourseForm(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return toast.error("Title is required");
    const slug = courseForm.slug.trim() || toSlug(courseForm.title);
    const payload: any = {
      ...courseForm, slug, requiredTier: Number(courseForm.requiredTier) || 1,
      xpPerEpisode: Number(courseForm.xpPerEpisode) || 10,
      passingScorePercent: Number(courseForm.passingScorePercent) || 70,
    };
    payload.price = courseForm.price !== "" ? Number(courseForm.price) : null;
    payload.accessDurationDays = courseForm.accessDurationDays !== "" ? Number(courseForm.accessDurationDays) : null;
    payload.maxEnrollments = courseForm.maxEnrollments !== "" ? Number(courseForm.maxEnrollments) : null;
    payload.paymentLinkUrl = courseForm.paymentLinkUrl.trim() || null;
    payload.upsellCourseIds = courseForm.upsellCourseIds;
    payload.crossSellCourseIds = courseForm.crossSellCourseIds;
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

  // Real-time: new course access request from member
  useEffect(() => {
    let mounted = true;
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on('admin:course_access_request', (data: { courseId: string; courseTitle: string }) => {
        toast.success(`New access request for ${data.courseTitle}`);
        qc.invalidateQueries({ queryKey: ['course-payments'] });
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off('admin:course_access_request'));
    };
  }, [qc]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Courses</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">VOD course library with episodes.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
              <button onClick={() => setViewMode("courses")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all ${viewMode === "courses" ? "bg-[#dc2626] text-white" : "text-[#888] hover:text-[#f0f0f0]"}`}>
                <BookOpen size={12} /> Courses
              </button>
              <button onClick={() => setViewMode("payments")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all ${viewMode === "payments" ? "bg-[#dc2626] text-white" : "text-[#888] hover:text-[#f0f0f0]"}`}>
                <CreditCard size={12} /> Payments
                {pendingPaymentsTotal > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold bg-yellow-500 text-black">
                    {pendingPaymentsTotal}
                  </span>
                )}
              </button>
            </div>
            {viewMode === "courses" && (
              <button onClick={openCreateCourse}
                className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
                <Plus size={15} /> New Course
              </button>
            )}
          </div>
        </div>

        {viewMode === "payments" && <PaymentsDashboard courses={courses} />}

        {/* Stats + Course list (courses view only) */}
        {viewMode === "courses" && <>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#dc2626]"><BookOpen size={20} /></div>
            <div>
              <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider font-rajdhani">Total Courses</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{total}</p>
            </div>
          </div>
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-blue-400"><Film size={20} /></div>
            <div>
              <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider font-rajdhani">Showing</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{courses.length}</p>
            </div>
          </div>
        </div>

        {/* Course list + detail panel */}
        <div className={`grid gap-6 ${selectedCourse ? "grid-cols-[1fr_440px]" : "grid-cols-1"}`}>
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50">
              <div className="relative w-full md:w-72">
                <input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#dc2626] transition-all text-[#f0f0f0] placeholder:text-[#777]" />
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
            ) : courses.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <BookOpen size={36} className="mx-auto text-[#666]" />
                <p className="text-[#888] font-rajdhani font-bold uppercase tracking-widest text-sm">No courses found</p>
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
                        <ImageIcon size={14} className="text-[#777]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#f0f0f0] text-sm truncate group-hover:text-[#dc2626] transition-colors">{c.title}</p>
                        {!c.isActive && <span className="text-[10px] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded font-bold uppercase shrink-0">Inactive</span>}
                        {c.price > 0 && <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded font-bold shrink-0">₹{c.price}</span>}
                      </div>
                      <p className="text-[11px] text-[#777] font-mono">/{c.slug}</p>
                      <p className="text-[11px] text-[#888]">{c._count?.courseEpisodes ?? 0} episodes · {c.xpPerEpisode ?? 10} XP/ep</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={e => { e.stopPropagation(); openEditCourse(c); }} className="p-1.5 text-[#777] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setDeletingCourse(c.id); }} className="p-1.5 text-[#777] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCourse && (
            <CourseDetailPanel
              course={selectedCourse}
              onClose={() => setSelectedCourse(null)}
            />
          )}
        </div>
        </>}
      </div>

      {/* Course form modal */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingCourse ? "Edit Course" : "New Course"}</h3>
              <button onClick={() => setShowCourseForm(false)} className="text-[#888] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Basic fields */}
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={courseForm.title}
                  onChange={e => { setCourseField("title", e.target.value); if (!editingCourse) setCourseField("slug", toSlug(e.target.value)); }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Slug</label>
                <input value={courseForm.slug} onChange={e => setCourseField("slug", e.target.value)} placeholder="my-course"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={courseForm.description} onChange={e => setCourseField("description", e.target.value)} rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>
              <FileUploadBtn label="Thumbnail" value={courseForm.thumbnailUrl} accept="image/png,image/jpeg,image/webp"
                pathPrefix="courses/thumbnails" uploadKey="courseThumbnail"
                uploading={courseUploading} setUploading={setCourseUploading}
                onUploaded={url => setCourseField("thumbnailUrl", url)} />
              <div>
                <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Required Tier</label>
                <select value={courseForm.requiredTier} onChange={e => setCourseField("requiredTier", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                  <option value="">— Any tier —</option>
                  {tiers.map((t: any) => (
                    <option key={t.tierNumber} value={t.tierNumber}>Tier {t.tierNumber} — {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Pricing & access */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani mb-3">Pricing & Access</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Price (₹)</label>
                    <input type="number" min="0" value={courseForm.price} onChange={e => setCourseField("price", e.target.value)} placeholder="0"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Access Days</label>
                    <input type="number" min="0" value={courseForm.accessDurationDays} onChange={e => setCourseField("accessDurationDays", e.target.value)} placeholder="∞ lifetime"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Max Enrollments</label>
                    <input type="number" min="0" value={courseForm.maxEnrollments} onChange={e => setCourseField("maxEnrollments", e.target.value)} placeholder="Unlimited"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                </div>
              </div>

              {/* Gamification */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani mb-3">Gamification</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">XP / Episode</label>
                    <input type="number" min="0" value={courseForm.xpPerEpisode} onChange={e => setCourseField("xpPerEpisode", e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Pass Score %</label>
                    <input type="number" min="0" max="100" value={courseForm.passingScorePercent} onChange={e => setCourseField("passingScorePercent", e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani mb-3">Payment</p>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">External Payment URL</label>
                  <input value={courseForm.paymentLinkUrl} onChange={e => setCourseField("paymentLinkUrl", e.target.value)} placeholder="https://tamilbusinesstribe.com/pay/..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm" />
                  <p className="text-[10px] text-[#555] mt-1 font-rajdhani">Members will be redirected here when they click "Buy Now". Leave blank to use the default site.</p>
                </div>
              </div>

              {/* Upsell / Cross-sell */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani mb-3">Upsell / Cross-sell</p>
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Upsell — suggest instead</label>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 bg-[#141414] border border-[#222] rounded p-2">
                    {courses.filter((c: any) => c.id !== editingCourse?.id).map((c: any) => {
                      const sel = courseForm.upsellCourseIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={sel} className="accent-[#dc2626]"
                            onChange={() => setCourseField("upsellCourseIds", sel ? courseForm.upsellCourseIds.filter((id: string) => id !== c.id) : [...courseForm.upsellCourseIds, c.id])} />
                          <span className="text-[11px] text-[#a0a0a0] truncate">{c.title}</span>
                        </label>
                      );
                    })}
                    {courses.filter((c: any) => c.id !== editingCourse?.id).length === 0 && <p className="text-[10px] text-[#555]">No other courses</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Cross-sell — suggest additionally</label>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 bg-[#141414] border border-[#222] rounded p-2">
                    {courses.filter((c: any) => c.id !== editingCourse?.id).map((c: any) => {
                      const sel = courseForm.crossSellCourseIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={sel} className="accent-[#dc2626]"
                            onChange={() => setCourseField("crossSellCourseIds", sel ? courseForm.crossSellCourseIds.filter((id: string) => id !== c.id) : [...courseForm.crossSellCourseIds, c.id])} />
                          <span className="text-[11px] text-[#a0a0a0] truncate">{c.title}</span>
                        </label>
                      );
                    })}
                    {courses.filter((c: any) => c.id !== editingCourse?.id).length === 0 && <p className="text-[10px] text-[#555]">No other courses</p>}
                  </div>
                </div>
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
              <button onClick={() => setShowCourseForm(false)} className="px-6 py-2 text-[#888] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest">Cancel</button>
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
            <p className="text-[#888] text-xs mb-6">All episodes will be removed.</p>
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

// ── Tabbed course detail panel ─────────────────────────────────────────
type DetailTab = "episodes" | "access" | "analytics" | "badges" | "leaderboard";

function CourseDetailPanel({ course, onClose }: { course: any; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("episodes");

  const tabs: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
    { key: "episodes", label: "Episodes", icon: <Film size={12} /> },
    { key: "access", label: "Access", icon: <ShieldCheck size={12} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart2 size={12} /> },
    { key: "leaderboard", label: "Top XP", icon: <Trophy size={12} /> },
    { key: "badges", label: "Badges", icon: <Users size={12} /> },
  ];

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: "82vh" }}>
      <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider font-rajdhani">Course</p>
          <p className="text-sm font-bold text-[#f0f0f0] truncate">{course.title}</p>
        </div>
        <button onClick={onClose} className="text-[#888] hover:text-white p-1 transition-colors shrink-0"><X size={16} /></button>
      </div>
      <div className="flex border-b border-[#2a2a2a] shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all border-b-2 ${activeTab === t.key ? "border-[#dc2626] text-[#dc2626] bg-[#dc2626]/5" : "border-transparent text-[#888] hover:text-[#f0f0f0]"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "episodes" && <EpisodesTab course={course} />}
        {activeTab === "access" && <AccessTab course={course} />}
        {activeTab === "analytics" && <AnalyticsTab course={course} />}
        {activeTab === "leaderboard" && <LeaderboardTab course={course} />}
        {activeTab === "badges" && <BadgesTab course={course} />}
      </div>
    </div>
  );
}

// ── Episodes tab (original EpisodesPanel content) ─────────────────────
function EpisodesTab({ course }: { course: any }) {
  const { data, isLoading } = useListCourseEpisodes(course.id);
  const createEp = useCreateCourseEpisode(course.id);
  const updateEp = useUpdateCourseEpisode(course.id);
  const deleteEp = useDeleteCourseEpisode(course.id);
  const reorderEp = useReorderCourseEpisodes(course.id);

  const serverEps: any[] = (data as any)?.data || [];
  const [localEps, setLocalEps] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEp, setEditingEp] = useState<any>(null);
  const [epForm, setEpForm] = useState<any>(EMPTY_EP);
  const [deletingEp, setDeletingEp] = useState<string | null>(null);
  const [epUploading, setEpUploading] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => { setLocalEps(serverEps); setIsDirty(false); }, [data]);

  const setEpField = (k: string, v: any) => setEpForm((f: any) => ({ ...f, [k]: v }));

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localEps];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalEps(next); setIsDirty(true); dragIdx.current = null; setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };
  const handleSaveOrder = async () => {
    try { await reorderEp.mutateAsync(localEps.map((ep: any) => ep.id)); setIsDirty(false); toast.success("Order saved"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

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
    // Normalise stored cues: add atTime display field
    const rawCues = ep.quizData?.cues ?? [];
    const cues = rawCues.map((c: any) => ({ ...c, atTime: secsToTime(c.atSeconds ?? 0) }));
    setEpForm({
      title: ep.title, videoUrl: ep.videoUrl, bunnyVideoId: ep.bunnyVideoId || "",
      thumbnailUrl: ep.thumbnailUrl || "", durationSeconds: String(ep.durationSeconds || ""),
      isVisible: ep.isVisible,
      quizUnlockPercent: String(ep.quizUnlockPercent ?? 80),
      drmEnabled: ep.drmEnabled ?? false,
      bunnyDrmToken: ep.bunnyDrmToken || "",
      quizData: ep.quizData
        ? { questions: ep.quizData.questions ?? [], cues }
        : null,
    });
    setEditingEp(ep); setShowForm(true);
  };

  const uploadImage = useUploadImage();
  const createBunnyVideo = useCreateBunnyVideo();
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleVideoUpload = async (file: File) => {
    try {
      setEpUploading("video"); setUploadProgress(0);
      const secs = await detectDuration(file);
      if (secs > 0) setEpField("durationSeconds", String(secs));
      const { videoId, tusUploadUrl, tusHeaders, embedUrl } = await createBunnyVideo.mutateAsync({ title: epForm.title || file.name });
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: tusUploadUrl,
          headers: { AuthorizationSignature: tusHeaders.AuthorizationSignature, AuthorizationExpire: String(tusHeaders.AuthorizationExpire), VideoId: tusHeaders.VideoId, LibraryId: tusHeaders.LibraryId },
          chunkSize: 5 * 1024 * 1024, retryDelays: [0, 3000, 5000, 10000],
          metadata: { filetype: file.type, title: epForm.title || file.name },
          onProgress(b: number, t: number) { setUploadProgress(Math.round((b / t) * 100)); },
          onSuccess() { resolve(); }, onError(err: any) { reject(err); },
        });
        upload.start();
      });
      setEpField("videoUrl", embedUrl); setEpField("bunnyVideoId", videoId);
      toast.success("Video uploaded to Bunny Stream");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setEpUploading(null); setUploadProgress(0); }
  };

  const handleThumbUpload = async (file: File) => {
    try {
      setEpUploading("thumb");
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: "course-videos/episode-thumbs" });
      setEpField("thumbnailUrl", publicUrl); toast.success("Thumbnail uploaded");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setEpUploading(null); }
  };

  const handleSaveEp = async () => {
    if (!epForm.title.trim() || !epForm.videoUrl.trim()) return toast.error("Title and video are required");
    const normalizedVideoUrl = epForm.videoUrl.replace(/https?:\/\/player\.mediadelivery\.net\/play\/(\d+)\/([\w-]+)/, 'https://iframe.mediadelivery.net/embed/$1/$2');
    // Serialise quizData: strip atTime display field from cues, drop empty questions/options
    let quizData: any = null;
    if (epForm.quizData) {
      const questions = (epForm.quizData.questions ?? []).filter((q: any) => q.question.trim());
      const cues = (epForm.quizData.cues ?? [])
        .map((c: any) => ({
          id: c.id,
          atSeconds: timeToSecs(c.atTime ?? "") || c.atSeconds || 0,
          questions: (c.questions ?? []).filter((q: any) => q.question.trim()),
        }))
        .filter((c: any) => c.questions.length > 0);
      if (questions.length > 0 || cues.length > 0) quizData = { questions, cues };
    }
    const payload = {
      ...epForm, videoUrl: normalizedVideoUrl,
      durationSeconds: Number(epForm.durationSeconds) || 0,
      bunnyVideoId: epForm.bunnyVideoId || undefined,
      quizUnlockPercent: Number(epForm.quizUnlockPercent) || 80,
      drmEnabled: epForm.drmEnabled,
      bunnyDrmToken: epForm.bunnyDrmToken || undefined,
      quizData,
    };
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

  const fmtDuration = (secs: number) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Episode list header */}
      <div className="p-3 border-b border-[#222] flex items-center justify-between shrink-0 bg-[#1a1a1a]/30">
        {isDirty && (
          <button onClick={handleSaveOrder} disabled={reorderEp.isPending}
            className="flex items-center gap-1 bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#dc2626] px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:bg-[#dc2626]/30">
            {reorderEp.isPending ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />} Save Order
          </button>
        )}
        <div className="flex-1" />
        <button onClick={openCreate}
          className="flex items-center gap-1 bg-[#dc2626] text-white px-3 py-1.5 rounded font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700">
          <Plus size={12} /> Add Episode
        </button>
      </div>

      {/* Episode list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>
        ) : localEps.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Film size={28} className="mx-auto text-[#666]" />
            <p className="text-[#888] font-rajdhani font-bold uppercase tracking-widest text-xs">No episodes yet</p>
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
                <GripVertical size={13} className="text-[#666] cursor-grab shrink-0" />
                <span className="text-[10px] text-[#777] font-mono w-4 shrink-0">{i + 1}</span>
                {ep.thumbnailUrl && (
                  <img src={ep.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded border border-[#333] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#f0f0f0] truncate">{ep.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-[#888]">{fmtDuration(ep.durationSeconds)}</p>
                    {ep.quizData?.questions?.length > 0 && <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 rounded font-bold uppercase">Quiz</span>}
                    {ep.quizData?.cues?.length > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 rounded font-bold uppercase">Cues: {ep.quizData.cues.length}</span>}
                    {ep.drmEnabled && <Lock size={9} className="text-[#888]" />}
                  </div>
                </div>
                {!ep.isVisible && <EyeOff size={11} className="text-[#888] shrink-0" />}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={() => openEdit(ep)} className="p-1 text-[#777] hover:text-green-400 rounded"><Pencil size={12} /></button>
                  <button onClick={() => setDeletingEp(ep.id)} className="p-1 text-[#777] hover:text-red-400 rounded"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Episode form */}
      {showForm && (
        <div className="border-t border-[#2a2a2a] p-4 bg-[#141414] space-y-3 shrink-0 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">{editingEp ? "Edit Episode" : "New Episode"}</p>
            <button onClick={() => setShowForm(false)} className="text-[#777] hover:text-white"><X size={14} /></button>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Title *</label>
            <input value={epForm.title} onChange={e => setEpField("title", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          {/* Video */}
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Video *</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => videoInputRef.current?.click()} disabled={epUploading === "video"}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] disabled:opacity-50">
                {epUploading === "video" ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {epUploading === "video" ? (uploadProgress > 0 ? `${uploadProgress}%` : "Preparing...") : "Upload to Bunny"}
              </button>
              {epForm.videoUrl && (
                <span className={`text-[10px] font-mono truncate max-w-[160px] ${epForm.videoUrl.includes("iframe.mediadelivery.net") ? "text-green-500" : "text-[#888]"}`}>
                  {epForm.videoUrl.includes("iframe.mediadelivery.net") ? "Bunny Stream" : epForm.videoUrl.split("/").pop()}
                </span>
              )}
            </div>
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/mov" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }} />
          </div>
          {/* Thumbnail */}
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Thumbnail <span className="text-[#777] normal-case tracking-normal">(optional)</span></label>
            <div className="flex items-center gap-2">
              {epForm.thumbnailUrl && <img src={epForm.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded border border-[#333]" />}
              <button type="button" onClick={() => thumbInputRef.current?.click()} disabled={epUploading === "thumb"}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] disabled:opacity-50">
                {epUploading === "thumb" ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                {epUploading === "thumb" ? "Uploading..." : epForm.thumbnailUrl ? "Replace" : "Upload"}
              </button>
            </div>
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f); e.target.value = ""; }} />
          </div>
          {/* Duration */}
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Duration (seconds)</label>
            <input type="number" min="0" value={epForm.durationSeconds} onChange={e => setEpField("durationSeconds", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          {/* Quiz unlock % */}
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Quiz Unlock at % watched</label>
            <input type="number" min="0" max="100" value={epForm.quizUnlockPercent} onChange={e => setEpField("quizUnlockPercent", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          {/* DRM */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEpField("drmEnabled", !epForm.drmEnabled)}
              className={`w-8 h-4 rounded-full relative transition-all ${epForm.drmEnabled ? "bg-[#dc2626]" : "bg-[#333]"}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${epForm.drmEnabled ? "right-0.5" : "left-0.5"}`} />
            </button>
            <span className="text-[11px] text-[#a0a0a0] font-rajdhani flex items-center gap-1"><Lock size={10} /> DRM Protected</span>
          </div>
          {epForm.drmEnabled && (
            <div>
              <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Bunny DRM Token</label>
              <input value={epForm.bunnyDrmToken} onChange={e => setEpField("bunnyDrmToken", e.target.value)} placeholder="token..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs font-mono" />
            </div>
          )}
          {/* ── Quiz Editor ──────────────────────────────────────────── */}
          <div className="border-t border-[#2a2a2a] pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">Quiz</p>
              {!epForm.quizData && (
                <button type="button"
                  onClick={() => setEpField("quizData", { questions: [EMPTY_QUESTION()], cues: [] })}
                  className="text-[10px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest">
                  + Enable Quiz
                </button>
              )}
              {epForm.quizData && (
                <button type="button" onClick={() => setEpField("quizData", null)}
                  className="text-[10px] text-[#888] hover:text-red-400 font-rajdhani">Remove All</button>
              )}
            </div>

            {epForm.quizData && (() => {
              const qd = epForm.quizData;
              const setQd = (fn: (prev: any) => any) => setEpField("quizData", fn(qd));

              // ── End-of-lesson questions ──
              const renderQuestions = (questions: any[], onChange: (qs: any[]) => void, label: string) => (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">{label}</p>
                  {questions.map((q: any, qi: number) => (
                    <div key={q.id} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 space-y-2">
                      <div className="flex items-start gap-1.5">
                        <input value={q.question}
                          onChange={e => onChange(questions.map((x: any, i: number) => i === qi ? { ...x, question: e.target.value } : x))}
                          placeholder={`Q${qi + 1}: Enter question…`}
                          className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded h-7 px-2 text-white outline-none focus:border-[#dc2626] text-[11px]" />
                        <button type="button" onClick={() => onChange(questions.filter((_: any, i: number) => i !== qi))}
                          className="text-[#666] hover:text-red-400 p-0.5 shrink-0"><X size={11} /></button>
                      </div>
                      {q.options.map((opt: any, oi: number) => (
                        <div key={opt.id} className="flex items-center gap-1.5 pl-2">
                          <button type="button"
                            onClick={() => onChange(questions.map((x: any, i: number) => i === qi ? {
                              ...x, options: x.options.map((o: any, j: number) => ({ ...o, correct: j === oi }))
                            } : x))}
                            className={`w-3.5 h-3.5 rounded-full border shrink-0 transition-colors ${opt.correct ? "bg-green-500 border-green-500" : "border-[#555] hover:border-green-400"}`} />
                          <input value={opt.text}
                            onChange={e => onChange(questions.map((x: any, i: number) => i === qi ? {
                              ...x, options: x.options.map((o: any, j: number) => j === oi ? { ...o, text: e.target.value } : o)
                            } : x))}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded h-6 px-2 text-white outline-none focus:border-[#dc2626] text-[11px]" />
                          {q.options.length > 2 && (
                            <button type="button" onClick={() => onChange(questions.map((x: any, i: number) => i === qi ? {
                              ...x, options: x.options.filter((_: any, j: number) => j !== oi)
                            } : x))} className="text-[#666] hover:text-red-400"><X size={9} /></button>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2 pl-2">
                        <button type="button"
                          onClick={() => onChange(questions.map((x: any, i: number) => i === qi ? { ...x, options: [...x.options, EMPTY_OPTION()] } : x))}
                          className="text-[9px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest">+ Option</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => onChange([...questions, EMPTY_QUESTION()])}
                    className="text-[10px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest">+ Question</button>
                </div>
              );

              return (
                <div className="space-y-4">
                  {renderQuestions(
                    qd.questions ?? [],
                    qs => setQd((prev: any) => ({ ...prev, questions: qs })),
                    "End-of-Lesson Quiz"
                  )}

                  {/* ── Mid-video cues ── */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">Mid-Video Quizzes</p>
                    {(qd.cues ?? []).map((cue: any, ci: number) => (
                      <div key={cue.id} className="bg-[#111] border border-[#333] rounded-lg p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#888] font-rajdhani uppercase">At</span>
                          <input value={cue.atTime ?? secsToTime(cue.atSeconds ?? 0)}
                            onChange={e => setQd((prev: any) => ({ ...prev, cues: prev.cues.map((c: any, i: number) => i === ci ? { ...c, atTime: e.target.value } : c) }))}
                            placeholder="M:SS"
                            className="w-16 bg-[#141414] border border-[#2a2a2a] rounded h-6 px-2 text-white outline-none focus:border-[#dc2626] text-[11px] font-mono" />
                          <span className="text-[9px] text-[#555] font-rajdhani">mm:ss into video</span>
                          <button type="button"
                            onClick={() => setQd((prev: any) => ({ ...prev, cues: prev.cues.filter((_: any, i: number) => i !== ci) }))}
                            className="ml-auto text-[#666] hover:text-red-400"><X size={11} /></button>
                        </div>
                        {renderQuestions(
                          cue.questions ?? [],
                          qs => setQd((prev: any) => ({ ...prev, cues: prev.cues.map((c: any, i: number) => i === ci ? { ...c, questions: qs } : c) })),
                          `Cue ${ci + 1} Questions`
                        )}
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setQd((prev: any) => ({ ...prev, cues: [...(prev.cues ?? []), EMPTY_CUE()] }))}
                      className="text-[10px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest">+ Mid-Video Quiz</button>
                  </div>
                </div>
              );
            })()}
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
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-[#888] hover:text-white font-rajdhani font-bold text-[11px] uppercase tracking-widest border border-[#2a2a2a] rounded">Cancel</button>
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

// ── Access tab ─────────────────────────────────────────────────────────
function AccessTab({ course }: { course: any }) {
  const { data, isLoading } = useListCourseAccess(course.id);
  const grantAccess = useGrantCourseAccess(course.id);
  const revokeAccess = useRevokeCourseAccess(course.id);
  const approvePayment = useApproveCoursePayment(course.id);
  const { data: pendingPaymentsData } = useListCoursePayments({ courseId: course.id, status: "pending", limit: 50 });
  const { data: membersData } = useListMembers({ limit: 200, status: "active" });

  const accesses: any[] = (data as any)?.data || [];
  const pendingPayments: any[] = (pendingPaymentsData as any)?.data || [];
  const members: any[] = (membersData as any)?.data || [];

  const EMPTY_GRANT = { memberId: "", accessType: "lifetime", expiresAt: "", amount: "", method: "manual", reference: "", notes: "" };
  const [grantForm, setGrantForm] = useState<any>(EMPTY_GRANT);
  const [showGrant, setShowGrant] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const setField = (k: string, v: any) => setGrantForm((f: any) => ({ ...f, [k]: v }));

  const filteredMembers = memberSearch
    ? members.filter((m: any) => `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase()))
    : [];

  const handleGrant = async () => {
    if (!grantForm.memberId) return toast.error("Select a member");
    const payload: any = { ...grantForm };
    if (!payload.amount) delete payload.amount;
    if (!payload.expiresAt) delete payload.expiresAt;
    try {
      await grantAccess.mutateAsync(payload);
      toast.success("Access granted");
      setGrantForm(EMPTY_GRANT); setShowGrant(false); setMemberSearch("");
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleRevoke = async (accessId: string) => {
    try { await revokeAccess.mutateAsync(accessId); toast.success("Access revoked"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleApprove = async (paymentId: string) => {
    try { await approvePayment.mutateAsync(paymentId); toast.success("Access approved & granted"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">Access Grants</p>
        <button onClick={() => setShowGrant(!showGrant)}
          className="flex items-center gap-1 bg-[#dc2626] text-white px-3 py-1.5 rounded font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700">
          <Plus size={11} /> Grant
        </button>
      </div>

      {showGrant && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 space-y-3">
          <p className="text-[10px] font-bold text-[#dc2626] uppercase tracking-widest font-rajdhani">Grant Access</p>
          {/* Member search */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Member *</label>
            <input value={memberSearch} onChange={e => { setMemberSearch(e.target.value); setField("memberId", ""); }}
              placeholder="Search by name or email..."
              className="w-full bg-[#141414] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
            {filteredMembers.length > 0 && !grantForm.memberId && (
              <div className="absolute top-full left-0 right-0 z-50 bg-[#1a1a1a] border border-[#333] rounded-b-lg shadow-xl max-h-40 overflow-y-auto">
                {filteredMembers.slice(0, 8).map((m: any) => (
                  <button key={m.id} type="button"
                    onClick={() => { setField("memberId", m.id); setMemberSearch(`${m.firstName} ${m.lastName} (${m.email})`); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#f0f0f0] hover:bg-[#dc2626]/10 transition-colors">
                    <span className="font-medium">{m.firstName} {m.lastName}</span> <span className="text-[#888]">{m.email}</span>
                  </button>
                ))}
              </div>
            )}
            {grantForm.memberId && <p className="text-[9px] text-green-400 mt-1 font-rajdhani">✓ Member selected</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Access Type</label>
              <select value={grantForm.accessType} onChange={e => setField("accessType", e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded h-9 px-2 text-white outline-none focus:border-[#dc2626] text-xs appearance-none">
                <option value="lifetime">Lifetime</option>
                <option value="duration">Duration</option>
              </select>
            </div>
            {grantForm.accessType === "duration" && (
              <div>
                <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Expires</label>
                <input type="date" value={grantForm.expiresAt} onChange={e => setField("expiresAt", e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded h-9 px-2 text-white outline-none focus:border-[#dc2626] text-xs" />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Amount (₹)</label>
              <input type="number" min="0" value={grantForm.amount} onChange={e => setField("amount", e.target.value)} placeholder="0"
                className="w-full bg-[#141414] border border-[#333] rounded h-9 px-2 text-white outline-none focus:border-[#dc2626] text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Method</label>
              <select value={grantForm.method} onChange={e => setField("method", e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded h-9 px-2 text-white outline-none focus:border-[#dc2626] text-xs appearance-none">
                <option value="manual">Manual</option>
                <option value="razorpay">Razorpay</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="free">Free</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Reference / Notes</label>
            <input value={grantForm.notes} onChange={e => setField("notes", e.target.value)} placeholder="Transaction ID, notes..."
              className="w-full bg-[#141414] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowGrant(false); setMemberSearch(""); }} className="flex-1 py-1.5 text-[#888] hover:text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest border border-[#333] rounded">Cancel</button>
            <button onClick={handleGrant} disabled={grantAccess.isPending}
              className="flex-1 py-1.5 bg-[#dc2626] hover:bg-red-700 text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest rounded flex items-center justify-center gap-1 disabled:opacity-60">
              {grantAccess.isPending && <Loader2 size={10} className="animate-spin" />} Grant Access
            </button>
          </div>
        </div>
      )}

      {/* Pending payment requests — require admin approval */}
      {pendingPayments.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest font-rajdhani">Pending Payments ({pendingPayments.length})</p>
          {pendingPayments.map((p: any) => (
            <div key={p.id} className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#f0f0f0] truncate">{p.member?.firstName} {p.member?.lastName}</p>
                <p className="text-[10px] text-[#888] truncate">{p.member?.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-400/20 text-amber-400">Pending</span>
                  <span className="text-[9px] text-[#777]">₹{Number(p.amount).toLocaleString()}</span>
                  <span className="text-[9px] text-[#555]">{fmt(p.createdAt)}</span>
                </div>
              </div>
              <button onClick={() => handleApprove(p.id)} disabled={approvePayment.isPending}
                className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-[10px] font-rajdhani font-bold uppercase tracking-widest px-3 py-1.5 rounded disabled:opacity-60 flex items-center gap-1">
                {approvePayment.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#dc2626]" /></div>
      ) : accesses.length === 0 ? (
        <div className="text-center py-10">
          <Users size={24} className="mx-auto text-[#666] mb-2" />
          <p className="text-[#888] font-rajdhani text-xs uppercase font-bold tracking-widest">No access grants yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accesses.map((a: any) => (
            <div key={a.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#f0f0f0] truncate">{a.member?.firstName} {a.member?.lastName}</p>
                <p className="text-[10px] text-[#888] truncate">{a.member?.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${a.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {a.isActive ? "Active" : "Revoked"}
                  </span>
                  <span className="text-[9px] text-[#777]">{a.accessType}</span>
                  {a.expiresAt && <span className="text-[9px] text-[#888]">exp {fmt(a.expiresAt)}</span>}
                </div>
              </div>
              {a.isActive && (
                <button onClick={() => handleRevoke(a.id)} disabled={revokeAccess.isPending}
                  className="text-[10px] text-[#888] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest shrink-0 transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Badges tab ─────────────────────────────────────────────────────────
function BadgesTab({ course }: { course: any }) {
  const { data, isLoading } = useListCourseBadges(course.id);
  const createBadge = useCreateCourseBadge(course.id);
  const updateBadge = useUpdateCourseBadge(course.id);
  const deleteBadge = useDeleteCourseBadge(course.id);
  const awardBadge = useAwardCourseBadge(course.id);
  const { data: membersData } = useListMembers({ limit: 200, status: "active" });

  const badges: any[] = (data as any)?.data || [];
  const members: any[] = (membersData as any)?.data || [];

  const EMPTY_BADGE = { label: "", slug: "", iconUrl: "", criteria: "{}" };
  const [showForm, setShowForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null);
  const [badgeForm, setBadgeForm] = useState<any>(EMPTY_BADGE);
  const [awardModal, setAwardModal] = useState<string | null>(null);
  const [awardMemberId, setAwardMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const setField = (k: string, v: any) => setBadgeForm((f: any) => ({ ...f, [k]: v }));

  const filteredMembers = memberSearch
    ? members.filter((m: any) => `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase()))
    : [];

  const handleSaveBadge = async () => {
    if (!badgeForm.label.trim()) return toast.error("Label required");
    let criteria = {};
    try { criteria = JSON.parse(badgeForm.criteria); } catch { /* use empty */ }
    const payload = { ...badgeForm, criteria };
    try {
      if (editingBadge) { await updateBadge.mutateAsync({ badgeId: editingBadge.id, data: payload }); toast.success("Badge updated"); }
      else { await createBadge.mutateAsync(payload); toast.success("Badge created"); }
      setShowForm(false); setEditingBadge(null); setBadgeForm(EMPTY_BADGE);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    try { await deleteBadge.mutateAsync(badgeId); toast.success("Badge deleted"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleAward = async () => {
    if (!awardModal || !awardMemberId) return toast.error("Select a member");
    try {
      await awardBadge.mutateAsync({ badgeId: awardModal, memberId: awardMemberId });
      toast.success("Badge awarded");
      setAwardModal(null); setAwardMemberId(""); setMemberSearch("");
    } catch (e: any) { toast.error(e.message || "Already awarded or failed"); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">Course Badges</p>
        <button onClick={() => { setBadgeForm(EMPTY_BADGE); setEditingBadge(null); setShowForm(true); }}
          className="flex items-center gap-1 bg-[#dc2626] text-white px-3 py-1.5 rounded font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700">
          <Plus size={11} /> New Badge
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 space-y-3">
          <p className="text-[10px] font-bold text-[#dc2626] uppercase tracking-widest font-rajdhani">{editingBadge ? "Edit Badge" : "Create Badge"}</p>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Label *</label>
            <input value={badgeForm.label}
              onChange={e => { setField("label", e.target.value); if (!editingBadge) setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }}
              className="w-full bg-[#141414] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Slug</label>
            <input value={badgeForm.slug} onChange={e => setField("slug", e.target.value)}
              className="w-full bg-[#141414] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Icon URL</label>
            <input value={badgeForm.iconUrl} onChange={e => setField("iconUrl", e.target.value)} placeholder="https://..."
              className="w-full bg-[#141414] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Criteria (JSON)</label>
            <textarea value={badgeForm.criteria} onChange={e => setField("criteria", e.target.value)} rows={3}
              className="w-full bg-[#141414] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-[#dc2626] text-xs font-mono resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditingBadge(null); }}
              className="flex-1 py-1.5 text-[#888] hover:text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest border border-[#333] rounded">Cancel</button>
            <button onClick={handleSaveBadge} disabled={createBadge.isPending || updateBadge.isPending}
              className="flex-1 py-1.5 bg-[#dc2626] hover:bg-red-700 text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest rounded flex items-center justify-center gap-1 disabled:opacity-60">
              {(createBadge.isPending || updateBadge.isPending) && <Loader2 size={10} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}

      {awardModal && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-xs rounded-xl p-6 space-y-4 shadow-2xl">
            <p className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] text-sm">Award Badge</p>
            <div className="relative">
              <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1 font-rajdhani">Member *</label>
              <input value={memberSearch} onChange={e => { setMemberSearch(e.target.value); setAwardMemberId(""); }}
                placeholder="Search member..." className="w-full bg-[#1a1a1a] border border-[#333] rounded h-9 px-3 text-white outline-none focus:border-[#dc2626] text-xs" />
              {filteredMembers.length > 0 && !awardMemberId && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[#1a1a1a] border border-[#333] rounded-b shadow-xl max-h-32 overflow-y-auto">
                  {filteredMembers.slice(0, 5).map((m: any) => (
                    <button key={m.id} type="button" onClick={() => { setAwardMemberId(m.id); setMemberSearch(`${m.firstName} ${m.lastName}`); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#f0f0f0] hover:bg-[#dc2626]/10 transition-colors">
                      {m.firstName} {m.lastName} <span className="text-[#888]">{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {awardMemberId && <p className="text-[9px] text-green-400 mt-1">✓ Member selected</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAwardModal(null); setAwardMemberId(""); setMemberSearch(""); }}
                className="flex-1 py-2 text-[#888] hover:text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest border border-[#333] rounded">Cancel</button>
              <button onClick={handleAward} disabled={awardBadge.isPending || !awardMemberId}
                className="flex-1 py-2 bg-[#dc2626] hover:bg-red-700 text-white font-rajdhani font-bold text-[10px] uppercase tracking-widest rounded flex items-center justify-center gap-1 disabled:opacity-60">
                {awardBadge.isPending && <Loader2 size={10} className="animate-spin" />} Award
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#dc2626]" /></div>
      ) : badges.length === 0 ? (
        <div className="text-center py-10">
          <Trophy size={24} className="mx-auto text-[#666] mb-2" />
          <p className="text-[#888] font-rajdhani text-xs uppercase font-bold tracking-widest">No badges yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {badges.map((b: any) => (
            <div key={b.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 flex items-center gap-3">
              {b.iconUrl ? (
                <img src={b.iconUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#dc2626]/20 flex items-center justify-center shrink-0">
                  <Trophy size={14} className="text-[#dc2626]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#f0f0f0] truncate">{b.label}</p>
                <p className="text-[10px] text-[#888] font-mono">{b.slug}</p>
                {b._count && <p className="text-[9px] text-[#777]">{b._count.members} awarded</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setAwardModal(b.id)}
                  className="px-2 py-1 text-[9px] font-bold uppercase font-rajdhani bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-all">Award</button>
                <button onClick={() => { setBadgeForm({ label: b.label, slug: b.slug, iconUrl: b.iconUrl || "", criteria: JSON.stringify(b.criteria ?? {}, null, 2) }); setEditingBadge(b); setShowForm(true); }}
                  className="p-1 text-[#777] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={12} /></button>
                <button onClick={() => handleDeleteBadge(b.id)}
                  className="p-1 text-[#777] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payments dashboard (global view) ──────────────────────────────────
function PaymentsDashboard({ courses }: { courses: any[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [courseIdFilter, setCourseIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useListCoursePayments({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(courseIdFilter ? { courseId: courseIdFilter } : {}),
    page,
    limit: 20,
  });

  const payments: any[] = (data as any)?.data || [];
  const total = (data as any)?.meta?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const totalRevenue = payments
    .filter((p: any) => p.status === "completed")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const handleApprove = async (payment: any) => {
    try {
      setApprovingId(payment.id);
      await apiClient.post(`/api/courses/${payment.course?.id}/payments/${payment.id}/approve`);
      toast.success("Payment approved & access granted");
      qc.invalidateQueries({ queryKey: ["course-payments"] });
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setApprovingId(null);
    }
  };

  const handleExportCsv = () => {
    if (!payments.length) return;
    const headers = ["Member", "Email", "Course", "Amount (INR)", "Method", "Status", "Date"];
    const rows = payments.map((p: any) => [
      `${p.member?.firstName ?? ""} ${p.member?.lastName ?? ""}`.trim(),
      p.member?.email ?? "",
      p.course?.title ?? "",
      p.amount ?? 0,
      p.method ?? "",
      p.status ?? "",
      p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course-payments-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const statusBadgeClass = (status: string) => {
    if (status === "completed") return "bg-green-500/20 text-green-400";
    if (status === "pending") return "bg-amber-500/20 text-amber-400";
    if (status === "refunded") return "bg-blue-500/20 text-blue-400";
    return "bg-[#333] text-[#888]";
  };

  return (
    <div className="space-y-4">
      {/* Revenue stat + export */}
      <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
        <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-green-400"><CreditCard size={20} /></div>
        <div>
          <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider font-rajdhani">Revenue (this page)</p>
          <p className="text-2xl font-bold text-[#f0f0f0] font-rajdhani">₹{totalRevenue.toLocaleString("en-IN")}</p>
        </div>
        <div className="ml-auto">
          <button onClick={handleExportCsv} disabled={!payments.length}
            className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] hover:text-[#f0f0f0] transition-all disabled:opacity-50">
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {/* Filter row */}
        <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-[#888]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">Filters</span>
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#141414] border border-[#333] rounded-md h-8 px-3 text-[12px] text-[#f0f0f0] outline-none focus:border-[#dc2626] appearance-none transition-all">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={courseIdFilter} onChange={e => { setCourseIdFilter(e.target.value); setPage(1); }}
            className="bg-[#141414] border border-[#333] rounded-md h-8 px-3 text-[12px] text-[#f0f0f0] outline-none focus:border-[#dc2626] appearance-none transition-all max-w-[220px]">
            <option value="">All Courses</option>
            {courses.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-[#777] font-rajdhani">{total} total</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[#dc2626]" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CreditCard size={32} className="mx-auto text-[#666]" />
            <p className="text-[#888] font-rajdhani font-bold uppercase tracking-widest text-sm">No payments found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {["Member", "Course", "Amount", "Method", "Status", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[#666] font-rajdhani whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-[#f0f0f0] whitespace-nowrap">{p.member?.firstName} {p.member?.lastName}</p>
                        <p className="text-[10px] text-[#888]">{p.member?.email}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-[12px] text-[#a0a0a0] truncate">{p.course?.title}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[13px] font-bold text-[#f0f0f0]">₹{Number(p.amount || 0).toLocaleString("en-IN")}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[11px] text-[#888] uppercase font-rajdhani">{p.method || "—"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-rajdhani ${statusBadgeClass(p.status)}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[11px] text-[#888]">{fmtDate(p.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "pending" && (
                          <button onClick={() => handleApprove(p)} disabled={approvingId === p.id}
                            className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-rajdhani font-bold uppercase tracking-widest px-3 py-1.5 rounded disabled:opacity-60 flex items-center gap-1 transition-all whitespace-nowrap">
                            {approvingId === p.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
                <p className="text-[11px] text-[#777] font-rajdhani">Page {page} of {totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="p-1.5 text-[#888] hover:text-white disabled:opacity-40 transition-colors"><ChevronLeft size={14} /></button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="p-1.5 text-[#888] hover:text-white disabled:opacity-40 transition-colors"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Analytics tab ──────────────────────────────────────────────────────
function AnalyticsTab({ course }: { course: any }) {
  const { data, isLoading } = useCourseAnalyticsAdmin(course.id);
  const { data: accessData } = useListCourseAccess(course.id);
  const { data: atRiskData } = useAtRiskMembers({ limit: 200 });

  const analytics: any = (data as any)?.data;
  const accessGrants: any[] = (accessData as any)?.data || [];
  const atRiskMembers: any[] = (atRiskData as any)?.data || [];

  const enrolledMemberIds = new Set(accessGrants.map((a: any) => a.memberId));
  const atRiskEnrolled = atRiskMembers.filter((m: any) => enrolledMemberIds.has(m.id));

  const fmtAgo = (d: string | null) => {
    if (!d) return "Never";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>;
  if (!analytics) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Enrollments", value: analytics.totalEnrollments },
          { label: "Completed", value: analytics.completedEnrollments },
          { label: "Completion %", value: `${analytics.completionRate}%` },
          { label: "Revenue", value: analytics.totalRevenue > 0 ? `₹${analytics.totalRevenue.toLocaleString()}` : "—" },
          { label: "XP Awarded", value: analytics.totalXpAwarded?.toLocaleString() ?? 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
            <p className="text-[10px] text-[#888] uppercase font-bold tracking-wider font-rajdhani">{stat.label}</p>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Episode quiz attempts */}
      {analytics.episodes?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest font-rajdhani mb-2">Episode Quiz Attempts</p>
          <div className="space-y-1.5">
            {analytics.episodes.map((ep: any) => (
              <div key={ep.id} className="flex items-center justify-between bg-[#1a1a1a] border border-[#222] rounded px-3 py-2">
                <p className="text-[11px] text-[#f0f0f0] truncate flex-1">{ep.order + 1}. {ep.title}</p>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Trophy size={10} className="text-yellow-400" />
                  <span className="text-[10px] text-[#888]">{ep.quizAttempts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9.4 At-risk enrolled members */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={12} className="text-amber-400" />
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-rajdhani">
            At-Risk Enrolled ({atRiskEnrolled.length})
          </p>
        </div>
        {atRiskEnrolled.length === 0 ? (
          <p className="text-[11px] text-[#555] font-rajdhani text-center py-3">No at-risk members enrolled in this course.</p>
        ) : (
          <div className="space-y-1.5">
            {atRiskEnrolled.map((m: any) => (
              <div key={m.id} className="bg-amber-500/5 border border-amber-500/15 rounded px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#f0f0f0] truncate">{m.firstName} {m.lastName}</p>
                  <p className="text-[10px] text-[#888] truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  <div>
                    <p className="text-[9px] text-[#666] uppercase font-rajdhani">Health</p>
                    <p className={`text-[11px] font-bold font-rajdhani ${(m.healthScore ?? 0) < 30 ? "text-red-400" : "text-amber-400"}`}>{m.healthScore ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#666] uppercase font-rajdhani">Last seen</p>
                    <p className="text-[10px] text-[#888]">{fmtAgo(m.lastActiveAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard tab (9.3) ──────────────────────────────────────────────
function LeaderboardTab({ course }: { course: any }) {
  const { data, isLoading } = useCourseLeaderboardAdmin(course.id, 20);
  const rows: any[] = (data as any)?.data || [];

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-amber-600";
    return "text-[#555]";
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">Top XP Earners</p>
        <span className="text-[10px] text-[#555] font-rajdhani">Top {rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Trophy size={28} className="mx-auto text-[#666]" />
          <p className="text-[#888] font-rajdhani font-bold uppercase tracking-widest text-xs">No XP data yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row: any) => (
            <div key={row.memberId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                ${row.rank <= 3 ? "bg-yellow-500/5 border-yellow-500/15" : "bg-[#1a1a1a] border-[#222]"}`}>
              <span className={`text-[13px] font-bold font-rajdhani w-5 text-center shrink-0 ${medalColor(row.rank)}`}>
                {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : `#${row.rank}`}
              </span>
              {row.member?.profilePhotoUrl ? (
                <img src={row.member.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#333] shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0">
                  <Users size={12} className="text-[#666]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#f0f0f0] truncate">
                  {row.member?.firstName} {row.member?.lastName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#666] uppercase font-rajdhani">XP</p>
                <p className="text-[13px] font-bold text-[#dc2626] font-rajdhani">{(row.totalXp ?? 0).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
