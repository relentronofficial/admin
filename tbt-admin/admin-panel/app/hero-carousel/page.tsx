"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, X, Loader2, Tv2, AlertCircle, GripVertical, Eye, EyeOff, Save, Film, Image as ImageIcon, Volume2, VolumeX, Link2, Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListHeroSlides, useCreateHeroSlide, useUpdateHeroSlide, useDeleteHeroSlide, useReorderHeroSlides, useListWorkshops, useListVodCourses, useListProducts, useListAppResources } from "@/lib/hooks/useTbt";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

type LinkType = "course" | "workshop" | "products" | "resources" | "custom";

const LINK_TYPE_OPTIONS: { value: LinkType; label: string }[] = [
  { value: "course", label: "Course" },
  { value: "workshop", label: "Workshop" },
  { value: "products", label: "Products Page" },
  { value: "resources", label: "Resources Page" },
  { value: "custom", label: "Custom URL" },
];

function detectLinkType(ctaUrl: string): { linkType: LinkType; linkedId: string } {
  if (ctaUrl?.startsWith("/learning/")) return { linkType: "course", linkedId: ctaUrl.replace("/learning/", "") };
  if (ctaUrl?.startsWith("/workshop/")) return { linkType: "workshop", linkedId: ctaUrl.replace("/workshop/", "") };
  if (ctaUrl === "/Products") return { linkType: "products", linkedId: "" };
  if (ctaUrl === "/Resources") return { linkType: "resources", linkedId: "" };
  return { linkType: "custom", linkedId: "" };
}

function resolveCtaUrl(linkType: LinkType, linkedId: string, customUrl: string): { ctaUrl: string; ctaType: string } {
  if (linkType === "course") return { ctaUrl: `/learning/${linkedId}`, ctaType: "internal" };
  if (linkType === "workshop") return { ctaUrl: `/workshop/${linkedId}`, ctaType: "internal" };
  if (linkType === "products") return { ctaUrl: "/Products", ctaType: "internal" };
  if (linkType === "resources") return { ctaUrl: "/Resources", ctaType: "internal" };
  return { ctaUrl: customUrl, ctaType: "internal" };
}

const EMPTY_FORM = {
  title: "",
  description: "",
  bgVideoUrl: "",
  bgImageUrl: "",
  bgMuteDefault: true,
  ctaLabel: "",
  linkType: "custom" as LinkType,
  linkedId: "",
  ctaUrl: "",
  badgeText: "",
  isActive: true,
};

// ── File Upload Button ────────────────────────────────────────────────

interface UploadBtnProps {
  label: string;
  value: string;
  accept: string;
  icon: React.ReactNode;
  uploadKey: string;
  pathPrefix: string;
  uploading: string | null;
  setUploading: (k: string | null) => void;
  onUploaded: (k: string, url: string) => void;
}

function UploadBtn({ label, value, accept, icon, uploadKey, pathPrefix, uploading, setUploading, onUploaded }: UploadBtnProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const isUploading = uploading === uploadKey;

  const handleFile = async (file: File) => {
    try {
      setUploading(uploadKey);
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix });
      onUploaded(uploadKey, publicUrl);
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50"
        >
          {isUploading ? <Loader2 size={12} className="animate-spin" /> : icon}
          {isUploading ? "Uploading..." : "Upload"}
        </button>
        {value && (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="flex-1 text-[11px] text-[#606060] font-mono truncate">{value.split("/").pop()}</span>
            <button type="button" onClick={() => onUploaded(uploadKey, "")} className="text-[#444] hover:text-red-400 transition-colors shrink-0">
              <X size={13} />
            </button>
          </div>
        )}
        {!value && <span className="text-[11px] text-[#444]">No file</span>}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function HeroCarouselPage() {
  const { data, isLoading } = useListHeroSlides();
  const createSlide = useCreateHeroSlide();
  const updateSlide = useUpdateHeroSlide();
  const deleteSlide = useDeleteHeroSlide();
  const reorderSlides = useReorderHeroSlides();

  const { data: coursesData } = useListVodCourses({ limit: 200 });
  const { data: workshopsData } = useListWorkshops({ limit: 200 });
  const { data: productsData } = useListProducts();
  const { data: resourcesData } = useListAppResources();

  const courses: any[] = (coursesData as any)?.data || [];
  const workshops: any[] = (workshopsData as any)?.data || [];
  const products: any[] = (productsData as any)?.data || [];
  const resources: any[] = (resourcesData as any)?.data || [];

  const [itemSearch, setItemSearch] = useState("");

  const serverSlides: any[] = (data as any)?.data || [];

  const [localSlides, setLocalSlides] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalSlides(serverSlides);
    setIsDirty(false);
  }, [data]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragStart = (i: number) => { dragIndex.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) { setDragOver(null); return; }
    const next = [...localSlides];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setLocalSlides(next);
    setIsDirty(true);
    dragIndex.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragIndex.current = null; setDragOver(null); };

  const handleSaveOrder = async () => {
    try {
      await reorderSlides.mutateAsync(localSlides.map((s: any) => s.id));
      setIsDirty(false);
      toast.success("Order saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save order");
    }
  };

  const setField = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setItemSearch("");
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (slide: any) => {
    const { linkType, linkedId } = detectLinkType(slide.ctaUrl || "");
    setForm({
      title: slide.title || "",
      description: slide.description || "",
      bgVideoUrl: slide.bgVideoUrl || "",
      bgImageUrl: slide.bgImageUrl || "",
      bgMuteDefault: slide.bgMuteDefault ?? true,
      ctaLabel: slide.ctaLabel || "",
      linkType,
      linkedId,
      ctaUrl: linkType === "custom" ? (slide.ctaUrl || "") : "",
      badgeText: slide.badgeText || "",
      isActive: slide.isActive ?? true,
    });
    setItemSearch("");
    setEditing(slide);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if ((form.linkType === "course" || form.linkType === "workshop") && !form.linkedId)
      return toast.error("Please select a " + form.linkType);
    try {
      const { ctaUrl, ctaType } = resolveCtaUrl(form.linkType, form.linkedId, form.ctaUrl);
      const payload = {
        title: form.title,
        description: form.description || null,
        bgVideoUrl: form.bgVideoUrl || null,
        bgImageUrl: form.bgImageUrl || null,
        bgMuteDefault: form.bgMuteDefault,
        ctaLabel: form.ctaLabel || "",
        ctaUrl,
        ctaType,
        badgeText: form.badgeText || null,
        isActive: form.isActive,
      };
      if (editing) {
        await updateSlide.mutateAsync({ id: editing.id, data: payload });
        toast.success("Slide updated");
      } else {
        await createSlide.mutateAsync(payload);
        toast.success("Slide created");
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save slide");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSlide.mutateAsync(id);
      toast.success("Slide deleted");
      setDeleting(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete slide");
    }
  };

  const handleToggleActive = async (slide: any) => {
    try {
      await updateSlide.mutateAsync({ id: slide.id, data: { isActive: !slide.isActive } });
    } catch {
      toast.error("Failed to toggle active");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Hero Carousel</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage hero slides — drag to reorder.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleSaveOrder}
                disabled={reorderSlides.isPending}
                className="flex items-center gap-2 bg-[#222] border border-[#dc2626] text-[#dc2626] px-4 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-[#dc2626] hover:text-white transition-all"
              >
                {reorderSlides.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Order
              </button>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all"
            >
              <Plus size={15} /> Add Slide
            </button>
          </div>
        </div>

        {/* Slides list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#dc2626]" />
          </div>
        ) : localSlides.length === 0 ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-20 space-y-3">
            <Tv2 size={36} className="mx-auto text-[#333]" />
            <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No hero slides configured</p>
            <p className="text-[#444] text-xs">Click "Add Slide" to create the first slide.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {isDirty && (
              <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani animate-pulse text-right">
                Unsaved order — click Save Order to persist
              </p>
            )}
            {localSlides.map((slide: any, i: number) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={e => onDrop(e, i)}
                onDragEnd={onDragEnd}
                className={`bg-[#181818] border rounded-xl overflow-hidden transition-all select-none
                  ${dragOver === i ? "border-[#dc2626] bg-[#dc2626]/5" : slide.isActive ? "border-[#2a2a2a]" : "border-[#222] opacity-60"}
                  ${dragIndex.current === i ? "opacity-30" : ""}`}
              >
                {/* Background image strip */}
                {slide.bgImageUrl && (
                  <div className="h-16 w-full overflow-hidden relative">
                    <img src={slide.bgImageUrl} alt="" className="w-full h-full object-cover opacity-30" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#181818] via-transparent to-transparent" />
                  </div>
                )}

                <div className="flex items-center gap-4 p-4">
                  <GripVertical size={16} className="text-[#444] cursor-grab active:cursor-grabbing shrink-0" />

                  {/* Order badge */}
                  <div className="w-7 h-7 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center font-rajdhani font-bold text-[#606060] text-xs shrink-0">
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#f0f0f0] text-sm truncate">{slide.title}</p>
                      {slide.badgeText && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#dc2626]/20 text-[#dc2626] uppercase tracking-widest shrink-0">{slide.badgeText}</span>
                      )}
                    </div>
                    {slide.description && (
                      <p className="text-[11px] text-[#555] truncate mt-0.5">{slide.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#444]">
                      {slide.ctaLabel && <span className="text-[#606060]">CTA: <span className="text-[#888]">{slide.ctaLabel}</span></span>}
                      {slide.bgVideoUrl && <span className="text-blue-400 flex items-center gap-1"><Film size={10} /> Video</span>}
                      {slide.bgImageUrl && <span className="text-green-400 flex items-center gap-1"><ImageIcon size={10} /> Image</span>}
                      <span className={`uppercase font-bold ${slide.ctaType === "external" ? "text-yellow-500" : "text-[#555]"}`}>{slide.ctaType}</span>
                      {slide.bgMuteDefault ? <VolumeX size={10} className="text-[#444]" /> : <Volume2 size={10} className="text-blue-400" />}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleToggleActive(slide)}
                      className={`p-1.5 rounded transition-all ${slide.isActive ? "text-green-400 hover:bg-green-400/10" : "text-[#444] hover:text-white"}`}
                      title={slide.isActive ? "Active" : "Hidden"}>
                      {slide.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button onClick={() => openEdit(slide)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleting(slide.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">
                {editing ? "Edit Slide" : "New Slide"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="The TBT Experience"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Description</label>
                <textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={3} placeholder="Short description shown on the slide..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>

              {/* Background Video */}
              <UploadBtn
                label="Background Video (.mp4)"
                value={form.bgVideoUrl}
                accept="video/mp4,video/webm"
                icon={<Film size={12} />}
                uploadKey="bgVideoUrl"
                pathPrefix="hero/video"
                uploading={uploadingField}
                setUploading={setUploadingField}
                onUploaded={setField}
              />

              {/* Background Image */}
              <UploadBtn
                label="Background Image (fallback)"
                value={form.bgImageUrl}
                accept="image/png,image/jpeg,image/webp"
                icon={<ImageIcon size={12} />}
                uploadKey="bgImageUrl"
                pathPrefix="hero/image"
                uploading={uploadingField}
                setUploading={setUploadingField}
                onUploaded={setField}
              />

              {/* Mute by Default toggle */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setField("bgMuteDefault", !form.bgMuteDefault)}
                  className={`w-10 h-5 rounded-full relative transition-all ${form.bgMuteDefault ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.bgMuteDefault ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani flex items-center gap-1.5">
                  {form.bgMuteDefault ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  {form.bgMuteDefault ? "Mute by Default" : "Unmuted by Default"}
                </span>
              </div>

              {/* CTA */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">CTA Label</label>
                <input value={form.ctaLabel} onChange={e => setField("ctaLabel", e.target.value)} placeholder="Get Started"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>

              {/* Link Target */}
              <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-3 bg-[#111]">
                <div className="flex items-center gap-2 mb-1">
                  <Link2 size={12} className="text-[#dc2626]" />
                  <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Button Link Target</span>
                </div>

                {/* Link type selector */}
                <div className="grid grid-cols-5 gap-1.5">
                  {LINK_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setField("linkType", opt.value); setField("linkedId", ""); setItemSearch(""); }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani transition-all ${
                        form.linkType === opt.value
                          ? "bg-[#dc2626] text-white"
                          : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#606060] hover:text-white hover:border-[#444]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Course picker */}
                {form.linkType === "course" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        placeholder="Search courses..."
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 pl-8 pr-3 text-white outline-none focus:border-[#dc2626] transition-all text-xs"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {courses
                        .filter(c => !itemSearch || c.title?.toLowerCase().includes(itemSearch.toLowerCase()))
                        .map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setField("linkedId", c.id); setItemSearch(""); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                              form.linkedId === c.id
                                ? "bg-[#dc2626]/20 border border-[#dc2626]/40 text-white"
                                : "bg-[#1a1a1a] border border-[#222] text-[#a0a0a0] hover:text-white hover:border-[#333]"
                            }`}
                          >
                            {c.title}
                          </button>
                        ))}
                      {courses.length === 0 && <p className="text-[11px] text-[#444] text-center py-2">No courses found</p>}
                    </div>
                    {form.linkedId && (
                      <p className="text-[10px] text-[#dc2626] font-mono">→ /learning/{form.linkedId}</p>
                    )}
                  </div>
                )}

                {/* Workshop picker */}
                {form.linkType === "workshop" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                      <input
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        placeholder="Search workshops..."
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 pl-8 pr-3 text-white outline-none focus:border-[#dc2626] transition-all text-xs"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {workshops
                        .filter(w => !itemSearch || w.title?.toLowerCase().includes(itemSearch.toLowerCase()))
                        .map((w: any) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => { setField("linkedId", w.slug); setItemSearch(""); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                              form.linkedId === w.slug
                                ? "bg-[#dc2626]/20 border border-[#dc2626]/40 text-white"
                                : "bg-[#1a1a1a] border border-[#222] text-[#a0a0a0] hover:text-white hover:border-[#333]"
                            }`}
                          >
                            {w.title}
                          </button>
                        ))}
                      {workshops.length === 0 && <p className="text-[11px] text-[#444] text-center py-2">No workshops found</p>}
                    </div>
                    {form.linkedId && (
                      <p className="text-[10px] text-[#dc2626] font-mono">→ /workshop/{form.linkedId}</p>
                    )}
                  </div>
                )}

                {/* Products / Resources — no picker needed */}
                {form.linkType === "products" && (
                  <p className="text-[11px] text-[#606060] font-mono">→ /Products</p>
                )}
                {form.linkType === "resources" && (
                  <p className="text-[11px] text-[#606060] font-mono">→ /Resources</p>
                )}

                {/* Custom URL */}
                {form.linkType === "custom" && (
                  <input value={form.ctaUrl} onChange={e => setField("ctaUrl", e.target.value)} placeholder="/your/custom/path"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] transition-all text-xs font-mono" />
                )}
              </div>

              {/* Badge Text */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Badge Text <span className="text-[#444] normal-case tracking-normal">(optional)</span></label>
                <input value={form.badgeText} onChange={e => setField("badgeText", e.target.value)} placeholder="NEW"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setField("isActive", !form.isActive)}
                  className={`w-10 h-5 rounded-full relative transition-all ${form.isActive ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.isActive ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani">Active</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={createSlide.isPending || updateSlide.isPending || !!uploadingField}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-60">
                {(createSlide.isPending || updateSlide.isPending) && <Loader2 size={14} className="animate-spin" />}
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
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Slide?</h3>
            <p className="text-[#606060] text-xs mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleting)} disabled={deleteSlide.isPending}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
                {deleteSlide.isPending && <Loader2 size={13} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
