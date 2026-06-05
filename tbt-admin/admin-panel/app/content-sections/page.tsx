"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Pencil, X, Loader2, Layers, AlertCircle, Eye, EyeOff,
  ChevronRight, Film, GripVertical, Save, Image as ImageIcon, Link2, Tag,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListContentSections, useCreateContentSection, useUpdateContentSection,
  useDeleteContentSection, useReorderContentSections,
  useContentSectionItems, useCreateContentItem, useUpdateContentItem,
  useDeleteContentItem, useReorderContentItems,
  useListVodCourses, useListWorkshops,
} from "@/lib/hooks/useTbt";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

const CONTENT_TYPES = ["series", "standalone", "podcast"];

const EMPTY_SECTION = { title: "", slug: "", requiredTier: "", lockBadgeText: "", isVisible: true };
const LINK_TYPES = ["workshop", "course", "external", "none"] as const;
type LinkType = typeof LINK_TYPES[number];

const EMPTY_ITEM = {
  title: "", thumbnailUrl: "", requiredTier: "", lockBadgeText: "",
  contentType: "series", categoryTag: "", playUrl: "", isVisible: true,
  courseId: "", workshopId: "", linkType: "none" as LinkType,
};

// ── Slug generator ────────────────────────────────────────────────────
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ── Thumbnail upload button ───────────────────────────────────────────
function ThumbnailUpload({ value, onUploaded }: { value: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    try {
      setUploading(true);
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: "content-items/thumbnails" });
      onUploaded(publicUrl);
      toast.success("Thumbnail uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Thumbnail</label>
      <div className="flex items-center gap-3">
        <div className="w-16 h-12 rounded-lg border border-[#333] bg-[#141414] flex items-center justify-center overflow-hidden shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-[#444]" />}
        </div>
        <div className="space-y-1.5">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50">
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onUploaded("")} className="flex items-center gap-1 text-[10px] text-[#444] hover:text-red-400 transition-colors">
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function ContentSectionsPage() {
  // ── Sections ──────────────────────────────────────────────────────
  const { data: sectionsData, isLoading } = useListContentSections();
  const serverSections: any[] = (sectionsData as any)?.data || [];
  const [localSections, setLocalSections] = useState<any[]>([]);
  const [sectionsDirty, setSectionsDirty] = useState(false);

  useEffect(() => { setLocalSections(serverSections); setSectionsDirty(false); }, [sectionsData]);

  const createSection = useCreateContentSection();
  const updateSection = useUpdateContentSection();
  const deleteSection = useDeleteContentSection();
  const reorderSections = useReorderContentSections();

  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [deletingSection, setDeletingSection] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState<any>(EMPTY_SECTION);

  // Section DnD
  const secDragIdx = useRef<number | null>(null);
  const [secDragOver, setSecDragOver] = useState<number | null>(null);

  const onSecDragStart = (i: number) => { secDragIdx.current = i; };
  const onSecDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setSecDragOver(i); };
  const onSecDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = secDragIdx.current;
    if (from === null || from === dropIdx) { setSecDragOver(null); return; }
    const next = [...localSections];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalSections(next);
    setSectionsDirty(true);
    secDragIdx.current = null;
    setSecDragOver(null);
  };
  const onSecDragEnd = () => { secDragIdx.current = null; setSecDragOver(null); };

  const handleSaveSectionOrder = async () => {
    try {
      await reorderSections.mutateAsync(localSections.map((s: any) => s.id));
      setSectionsDirty(false);
      toast.success("Section order saved");
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const openCreateSection = () => { setSectionForm(EMPTY_SECTION); setEditingSection(null); setShowSectionForm(true); };
  const openEditSection = (s: any) => {
    setSectionForm({ title: s.title, slug: s.slug, requiredTier: String(s.requiredTier ?? ""), lockBadgeText: s.lockBadgeText || "", isVisible: s.isVisible ?? true });
    setEditingSection(s); setShowSectionForm(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.title.trim()) return toast.error("Title is required");
    const slug = sectionForm.slug.trim() || toSlug(sectionForm.title);
    try {
      const payload: any = { title: sectionForm.title.trim(), slug, isVisible: sectionForm.isVisible, lockBadgeText: sectionForm.lockBadgeText || null };
      if (sectionForm.requiredTier) payload.requiredTier = Number(sectionForm.requiredTier);
      if (editingSection) { await updateSection.mutateAsync({ id: editingSection.id, data: payload }); toast.success("Section updated"); }
      else { await createSection.mutateAsync(payload); toast.success("Section created"); }
      setShowSectionForm(false);
    } catch (e: any) { toast.error(e.message || "Failed to save section"); }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      await deleteSection.mutateAsync(id);
      toast.success("Section deleted");
      setDeletingSection(null);
      if (selectedSection?.id === id) setSelectedSection(null);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  // ── Items ─────────────────────────────────────────────────────────
  const { data: itemsData, isLoading: itemsLoading } = useContentSectionItems(selectedSection?.id || "");
  const serverItems: any[] = (itemsData as any)?.data || [];
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [itemsDirty, setItemsDirty] = useState(false);

  useEffect(() => { setLocalItems(serverItems); setItemsDirty(false); }, [itemsData]);

  const createItem = useCreateContentItem(selectedSection?.id || "");
  const updateItem = useUpdateContentItem(selectedSection?.id || "");
  const deleteItem = useDeleteContentItem(selectedSection?.id || "");
  const reorderItems = useReorderContentItems(selectedSection?.id || "");

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<any>(EMPTY_ITEM);

  // Courses and workshops for dropdowns
  const { data: coursesData } = useListVodCourses({ limit: 200 });
  const courses: any[] = (coursesData as any)?.data || [];
  const { data: workshopsData } = useListWorkshops({ limit: 200 });
  const workshops: any[] = (workshopsData as any)?.data || [];

  // Item DnD
  const itemDragIdx = useRef<number | null>(null);
  const [itemDragOver, setItemDragOver] = useState<number | null>(null);

  const onItemDragStart = (i: number) => { itemDragIdx.current = i; };
  const onItemDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setItemDragOver(i); };
  const onItemDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = itemDragIdx.current;
    if (from === null || from === dropIdx) { setItemDragOver(null); return; }
    const next = [...localItems];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalItems(next);
    setItemsDirty(true);
    itemDragIdx.current = null;
    setItemDragOver(null);
  };
  const onItemDragEnd = () => { itemDragIdx.current = null; setItemDragOver(null); };

  const handleSaveItemOrder = async () => {
    try {
      await reorderItems.mutateAsync(localItems.map((it: any) => it.id));
      setItemsDirty(false);
      toast.success("Item order saved");
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const openCreateItem = () => { setItemForm(EMPTY_ITEM); setEditingItem(null); setShowItemForm(true); };
  const openEditItem = (item: any) => {
    const linkType: LinkType = item.workshopId ? "workshop" : item.courseId ? "course" : item.playUrl ? "external" : "none";
    setItemForm({
      title: item.title || "", thumbnailUrl: item.thumbnailUrl || "",
      requiredTier: String(item.requiredTier ?? ""), lockBadgeText: item.lockBadgeText || "",
      contentType: item.contentType || "series", categoryTag: item.categoryTag || "",
      playUrl: item.playUrl || "", isVisible: item.isVisible ?? true,
      courseId: item.courseId || "", workshopId: item.workshopId || "", linkType,
    });
    setEditingItem(item); setShowItemForm(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.title.trim() || !selectedSection) return toast.error("Title is required");
    if (itemForm.linkType === "workshop" && !itemForm.workshopId) return toast.error("Select a workshop");
    if (itemForm.linkType === "course" && !itemForm.courseId) return toast.error("Select a course");
    try {
      const payload: any = {
        title: itemForm.title.trim(),
        thumbnailUrl: itemForm.thumbnailUrl || null,
        contentType: itemForm.contentType,
        categoryTag: itemForm.categoryTag || null,
        lockBadgeText: itemForm.lockBadgeText || null,
        isVisible: itemForm.isVisible,
        workshopId: itemForm.linkType === "workshop" ? (itemForm.workshopId || null) : null,
        courseId: itemForm.linkType === "course" ? (itemForm.courseId || null) : null,
        playUrl: itemForm.linkType === "external" ? (itemForm.playUrl || null) : null,
      };
      if (itemForm.requiredTier) payload.requiredTier = Number(itemForm.requiredTier);
      if (editingItem) { await updateItem.mutateAsync({ id: editingItem.id, data: payload }); toast.success("Item updated"); }
      else { await createItem.mutateAsync(payload); toast.success("Item created"); }
      setShowItemForm(false);
    } catch (e: any) { toast.error(e.message || "Failed to save item"); }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast.success("Item deleted");
      setDeletingItem(null);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const setItemField = (k: string, v: any) => setItemForm((f: any) => ({ ...f, [k]: v }));
  const setSectionField = (k: string, v: any) => setSectionForm((f: any) => ({ ...f, [k]: v }));

  // ── Render ────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Content Sections</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage home feed sections and their content items.</p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[320px_1fr] gap-4" style={{ minHeight: "65vh" }}>

          {/* ── Left: Sections ── */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-rajdhani font-bold text-[12px] uppercase tracking-widest text-[#a0a0a0]">Sections</span>
                {sectionsDirty && (
                  <button onClick={handleSaveSectionOrder} disabled={reorderSections.isPending}
                    className="flex items-center gap-1 bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#dc2626] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:bg-[#dc2626]/30 transition-all">
                    {reorderSections.isPending ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />} Save
                  </button>
                )}
              </div>
              <button onClick={openCreateSection}
                className="flex items-center gap-1.5 bg-[#dc2626] text-white px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:bg-red-700 transition-all">
                <Plus size={12} /> Add
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center flex-1 py-10"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>
            ) : localSections.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Layers size={28} className="text-[#333]" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-xs">No sections yet</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-[#222]">
                {localSections.map((s: any, i: number) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => onSecDragStart(i)}
                    onDragOver={e => onSecDragOver(e, i)}
                    onDrop={e => onSecDrop(e, i)}
                    onDragEnd={onSecDragEnd}
                    onClick={() => setSelectedSection(s)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-2 transition-all cursor-pointer select-none
                      ${secDragOver === i ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-white/[0.03]"}
                      ${secDragIdx.current === i ? "opacity-30" : ""}
                      ${selectedSection?.id === s.id ? "border-l-2 border-[#dc2626] bg-[#dc2626]/5" : "border-l-2 border-transparent"}`}
                  >
                    <GripVertical size={13} className="text-[#333] cursor-grab shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[12px] truncate ${selectedSection?.id === s.id ? "text-[#dc2626]" : "text-[#f0f0f0]"}`}>{s.title}</p>
                      <p className="text-[10px] text-[#444] truncate font-mono">/{s.slug}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!s.isVisible && <EyeOff size={11} className="text-[#444]" />}
                      {s.requiredTier > 0 && <span className="text-[9px] text-[#606060] bg-[#1a1a1a] border border-[#333] px-1 py-0.5 rounded font-bold font-rajdhani">T{s.requiredTier}</span>}
                      <button onClick={e => { e.stopPropagation(); openEditSection(s); }} className="p-1 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); setDeletingSection(s.id); }} className="p-1 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={11} /></button>
                    </div>
                    <ChevronRight size={12} className={selectedSection?.id === s.id ? "text-[#dc2626]" : "text-[#333]"} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Items ── */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
            {!selectedSection ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <Layers size={36} className="text-[#2a2a2a]" />
                <p className="text-[#444] font-rajdhani font-bold uppercase tracking-widest text-sm">Select a section</p>
                <p className="text-[#333] text-xs">Click any section on the left to manage its items.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a] shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div>
                      <p className="font-rajdhani font-bold text-[13px] text-[#f0f0f0] truncate">{selectedSection.title}</p>
                      <p className="text-[10px] text-[#444] font-mono">/{selectedSection.slug}</p>
                    </div>
                    {itemsDirty && (
                      <button onClick={handleSaveItemOrder} disabled={reorderItems.isPending}
                        className="flex items-center gap-1 bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#dc2626] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:bg-[#dc2626]/30 transition-all ml-2">
                        {reorderItems.isPending ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />} Save Order
                      </button>
                    )}
                  </div>
                  <button onClick={openCreateItem}
                    className="flex items-center gap-1.5 bg-[#dc2626] text-white px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:bg-red-700 transition-all shrink-0">
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                {itemsLoading ? (
                  <div className="flex items-center justify-center flex-1 py-10"><Loader2 size={24} className="animate-spin text-[#dc2626]" /></div>
                ) : localItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                    <Film size={28} className="text-[#333]" />
                    <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-xs">No items in this section</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-[#222]">
                    {localItems.map((item: any, i: number) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => onItemDragStart(i)}
                        onDragOver={e => onItemDragOver(e, i)}
                        onDrop={e => onItemDrop(e, i)}
                        onDragEnd={onItemDragEnd}
                        className={`flex items-center gap-3 px-4 py-3 transition-all select-none
                          ${itemDragOver === i ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-white/[0.02]"}
                          ${itemDragIdx.current === i ? "opacity-30" : ""}
                          ${!item.isVisible ? "opacity-50" : ""}`}
                      >
                        <GripVertical size={14} className="text-[#333] cursor-grab shrink-0" />
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-14 h-10 rounded object-cover bg-[#1a1a1a] border border-[#333] shrink-0" />
                        ) : (
                          <div className="w-14 h-10 rounded bg-[#1a1a1a] border border-[#333] flex items-center justify-center shrink-0">
                            <Film size={14} className="text-[#333]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] text-[#f0f0f0] truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-[#dc2626] uppercase font-rajdhani font-bold">{item.contentType}</span>
                            {item.categoryTag && <span className="text-[10px] text-[#606060] flex items-center gap-0.5"><Tag size={9} />{item.categoryTag}</span>}
                            {item.requiredTier > 0 && <span className="text-[10px] text-[#606060] bg-[#1a1a1a] border border-[#333] px-1.5 py-0.5 rounded font-rajdhani font-bold">T{item.requiredTier}</span>}
                            {item.workshopId && <span className="text-[10px] text-purple-400 flex items-center gap-0.5"><Link2 size={9} />Workshop</span>}
                            {item.courseId && <span className="text-[10px] text-blue-400 flex items-center gap-0.5"><Link2 size={9} />Course</span>}
                            {!item.workshopId && !item.courseId && item.playUrl && <span className="text-[10px] text-yellow-400 flex items-center gap-0.5"><Link2 size={9} />External</span>}
                            {!item.isVisible && <EyeOff size={10} className="text-[#444]" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openEditItem(item)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={13} /></button>
                          <button onClick={() => setDeletingItem(item.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Section Form Modal ── */}
      {showSectionForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingSection ? "Edit Section" : "New Section"}</h3>
              <button onClick={() => setShowSectionForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={sectionForm.title}
                  onChange={e => { setSectionField("title", e.target.value); if (!editingSection) setSectionField("slug", toSlug(e.target.value)); }}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Slug (auto-generated)</label>
                <input value={sectionForm.slug} onChange={e => setSectionField("slug", e.target.value)} placeholder="my-section"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Required Tier</label>
                  <input type="number" min="0" value={sectionForm.requiredTier} onChange={e => setSectionField("requiredTier", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Lock Badge Text</label>
                  <input value={sectionForm.lockBadgeText} onChange={e => setSectionField("lockBadgeText", e.target.value)} placeholder="UNLOCK"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSectionField("isVisible", !sectionForm.isVisible)}
                  className={`w-10 h-5 rounded-full relative transition-all ${sectionForm.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${sectionForm.isVisible ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani flex items-center gap-1.5">
                  {sectionForm.isVisible ? <Eye size={13} /> : <EyeOff size={13} />} {sectionForm.isVisible ? "Visible" : "Hidden"}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowSectionForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveSection} disabled={createSection.isPending || updateSection.isPending}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-60">
                {(createSection.isPending || updateSection.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Form Modal ── */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingItem ? "Edit Item" : "New Item"}</h3>
              <button onClick={() => setShowItemForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Title *</label>
                <input value={itemForm.title} onChange={e => setItemField("title", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>

              {/* Thumbnail upload */}
              <ThumbnailUpload value={itemForm.thumbnailUrl} onUploaded={url => setItemField("thumbnailUrl", url)} />

              {/* Content Type + Category Tag */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Content Type</label>
                  <select value={itemForm.contentType} onChange={e => setItemField("contentType", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none cursor-pointer">
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Category Tag</label>
                  <input value={itemForm.categoryTag} onChange={e => setItemField("categoryTag", e.target.value)} placeholder="Finance, Tech..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
              </div>

              {/* Required Tier + Lock Badge */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Required Tier</label>
                  <input type="number" min="0" value={itemForm.requiredTier} onChange={e => setItemField("requiredTier", e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Lock Badge Text</label>
                  <input value={itemForm.lockBadgeText} onChange={e => setItemField("lockBadgeText", e.target.value)} placeholder="UNLOCK"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                </div>
              </div>

              {/* Link Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Link Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["workshop", "course", "external", "none"] as LinkType[]).map(t => (
                    <button key={t} type="button"
                      onClick={() => {
                        setItemField("linkType", t);
                        if (t !== "workshop") setItemField("workshopId", "");
                        if (t !== "course") setItemField("courseId", "");
                        if (t !== "external") setItemField("playUrl", "");
                      }}
                      className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani border transition-all
                        ${itemForm.linkType === t
                          ? "bg-[#dc2626]/20 border-[#dc2626] text-[#dc2626]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#606060] hover:border-[#444]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workshop dropdown */}
              {itemForm.linkType === "workshop" && (
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Workshop *</label>
                  <select value={itemForm.workshopId}
                    onChange={e => {
                      const ws = workshops.find((w: any) => w.id === e.target.value);
                      setItemField("workshopId", e.target.value);
                      if (ws) {
                        if (!itemForm.title) setItemField("title", ws.title);
                        if (!itemForm.thumbnailUrl && ws.thumbnailUrl) setItemField("thumbnailUrl", ws.thumbnailUrl);
                      }
                    }}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none cursor-pointer">
                    <option value="">— Select workshop —</option>
                    {workshops.map((w: any) => <option key={w.id} value={w.id}>{w.title}</option>)}
                  </select>
                </div>
              )}

              {/* Course dropdown */}
              {itemForm.linkType === "course" && (
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Course *</label>
                  <select value={itemForm.courseId}
                    onChange={e => {
                      const c = courses.find((c: any) => c.id === e.target.value);
                      setItemField("courseId", e.target.value);
                      if (c) {
                        if (!itemForm.title) setItemField("title", c.title);
                        if (!itemForm.thumbnailUrl && c.thumbnailUrl) setItemField("thumbnailUrl", c.thumbnailUrl);
                      }
                    }}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none cursor-pointer">
                    <option value="">— Select course —</option>
                    {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              {/* External URL */}
              {itemForm.linkType === "external" && (
                <div>
                  <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">External URL *</label>
                  <input value={itemForm.playUrl} onChange={e => setItemField("playUrl", e.target.value)} placeholder="https://..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono" />
                </div>
              )}

              {/* Visible toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setItemField("isVisible", !itemForm.isVisible)}
                  className={`w-10 h-5 rounded-full relative transition-all ${itemForm.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${itemForm.isVisible ? "right-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-[12px] text-[#a0a0a0] font-rajdhani flex items-center gap-1.5">
                  {itemForm.isVisible ? <Eye size={13} /> : <EyeOff size={13} />} {itemForm.isVisible ? "Visible" : "Hidden"}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowItemForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveItem} disabled={createItem.isPending || updateItem.isPending}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-60">
                {(createItem.isPending || updateItem.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {(deletingSection || deletingItem) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              Delete {deletingSection ? "Section" : "Item"}?
            </h3>
            <p className="text-[#606060] text-xs mb-6">
              {deletingSection ? "All items in this section will also be deleted." : "This action cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setDeletingSection(null); setDeletingItem(null); }}
                className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">
                Cancel
              </button>
              <button
                onClick={() => { if (deletingSection) handleDeleteSection(deletingSection); else if (deletingItem) handleDeleteItem(deletingItem); }}
                disabled={deleteSection.isPending || deleteItem.isPending}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
                {(deleteSection.isPending || deleteItem.isPending) && <Loader2 size={13} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
