"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, X, Loader2, ShoppingBag, AlertCircle, Eye, EyeOff, ExternalLink, Save, GripVertical } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useGetProductsPageConfig, useUpdateProductsPageConfig, useReorderProducts,
} from "@/lib/hooks/useTbt";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

const CTA_TYPES = ["primary", "secondary"];
const EMPTY_CTA = { label: "", url: "", type: "primary", openInNewTab: true };
const EMPTY_FORM = { title: "", description: "", thumbnailUrl: "", order: "", isVisible: true, ctas: [{ ...EMPTY_CTA }] };

const labelCls = "block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";

export default function ProductsPage() {
  const { data, isLoading, refetch } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const reorderProducts = useReorderProducts();
  const uploadImage = useUploadImage();

  // ── Page Config ───────────────────────────────────────────────────────
  const { data: pageConfigData } = useGetProductsPageConfig();
  const updatePageConfig = useUpdateProductsPageConfig();
  const pageConfig = (pageConfigData as any)?.data;
  const [pageConfigForm, setPageConfigForm] = useState({
    pageTitle: "Journey with A&H",
    pageBg: "linear-gradient(135deg, #00c4cc 0%, #a855f7 100%)",
  });
  useEffect(() => {
    if (pageConfig) setPageConfigForm({
      pageTitle: pageConfig.pageTitle || "Journey with A&H",
      pageBg: pageConfig.pageBg || "linear-gradient(135deg, #00c4cc 0%, #a855f7 100%)",
    });
  }, [pageConfig]);

  const handleSavePageConfig = async () => {
    try { await updatePageConfig.mutateAsync(pageConfigForm); toast.success("Page config saved"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const products = (data as any)?.data || [];

  // ── DnD reorder ───────────────────────────────────────────────────────
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => { setLocalItems(products); setIsDirty(false); }, [data]);

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
      await reorderProducts.mutateAsync(localItems.map((p: any) => p.id));
      setIsDirty(false);
      toast.success("Order saved");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Thumbnail upload ──────────────────────────────────────────────────
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const handleThumbChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: "products/thumbnails" });
      setForm((f: any) => ({ ...f, thumbnailUrl: publicUrl }));
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingThumb(false); e.target.value = ""; }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, order: String(products.length), ctas: [{ ...EMPTY_CTA }] });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setForm({
      title: p.title,
      description: p.description || "",
      thumbnailUrl: p.thumbnailUrl || "",
      order: String(p.order ?? ""),
      isVisible: p.isVisible ?? true,
      ctas: p.ctas?.length
        ? p.ctas.map((c: any) => ({ label: c.label, url: c.url, type: c.type || "primary", openInNewTab: c.openInNewTab ?? true }))
        : [{ ...EMPTY_CTA }],
    });
    setEditing(p);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) return toast.error("Title is required");
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        thumbnailUrl: form.thumbnailUrl || null,
        order: Number(form.order) || 0,
        isVisible: form.isVisible,
        ctas: form.ctas.filter((c: any) => c.label && c.url),
      };
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, data: payload });
        toast.success("Product updated");
      } else {
        await createProduct.mutateAsync(payload);
        toast.success("Product created");
      }
      setShowForm(false);
      refetch();
    } catch (err: any) { toast.error(err.message || "Failed to save product"); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteProduct.mutateAsync(id); toast.success("Product deleted"); setDeleting(null); refetch(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleToggleVisible = async (p: any) => {
    try { await updateProduct.mutateAsync({ id: p.id, data: { isVisible: !p.isVisible } }); refetch(); }
    catch { toast.error("Failed to update visibility"); }
  };

  const updateCta = (i: number, field: string, value: any) =>
    setForm((f: any) => ({ ...f, ctas: f.ctas.map((c: any, idx: number) => idx === i ? { ...c, [field]: value } : c) }));
  const addCta = () => setForm((f: any) => ({ ...f, ctas: [...f.ctas, { ...EMPTY_CTA }] }));
  const removeCta = (i: number) => setForm((f: any) => ({ ...f, ctas: f.ctas.filter((_: any, idx: number) => idx !== i) }));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Products</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage TBT product offerings shown to members.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <button onClick={handleSaveOrder} disabled={reorderProducts.isPending} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] text-[#a0a0a0] hover:text-white px-4 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase transition-all">
                {reorderProducts.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Order
              </button>
            )}
            <button onClick={openCreate} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
              <Plus size={15} /> Add Product
            </button>
          </div>
        </div>

        {/* Page Config */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
            <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani">Page Config</p>
            <button onClick={handleSavePageConfig} disabled={updatePageConfig.isPending} className="flex items-center gap-2 bg-[#dc2626] text-white px-4 py-1.5 rounded-md font-rajdhani font-bold text-[11px] tracking-widest uppercase hover:bg-red-700 transition-all">
              {updatePageConfig.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Page Title</label>
              <input value={pageConfigForm.pageTitle} onChange={e => setPageConfigForm(f => ({ ...f, pageTitle: e.target.value }))} placeholder="Journey with A&H" className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
            </div>
            <div>
              <label className={labelCls}>Page Background <span className="text-[#333] normal-case font-normal">(CSS gradient or color)</span></label>
              <input value={pageConfigForm.pageBg} onChange={e => setPageConfigForm(f => ({ ...f, pageBg: e.target.value }))} placeholder="linear-gradient(...)" className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm font-mono text-xs" />
            </div>
          </div>
          {/* Preview swatch */}
          <div className="h-8 rounded-lg" style={{ background: pageConfigForm.pageBg }} />
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
        ) : localItems.length === 0 ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-20 space-y-3">
            <ShoppingBag size={36} className="mx-auto text-[#333]" />
            <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No products configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localItems.map((p: any, idx) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                className={`bg-[#181818] border rounded-xl overflow-hidden group transition-all cursor-grab active:cursor-grabbing ${!p.isVisible ? "border-[#222] opacity-60" : "border-[#2a2a2a]"} ${dragOver === idx ? "ring-1 ring-[#dc2626]/40" : ""}`}
              >
                <div className="relative">
                  {p.thumbnailUrl ? (
                    <div className="h-36 overflow-hidden">
                      <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="h-20 bg-[#141414] flex items-center justify-center">
                      <ShoppingBag size={24} className="text-[#2a2a2a]" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <GripVertical size={16} className="text-white/40" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-[#f0f0f0] text-sm leading-snug">{p.title}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleToggleVisible(p)} className={`p-1.5 rounded transition-all ${p.isVisible ? "text-green-400 hover:bg-green-400/10" : "text-[#444] hover:text-white hover:bg-[#2a2a2a]"}`}>
                        {p.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={14} /></button>
                      <button onClick={() => setDeleting(p.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {p.description && <p className="text-[#606060] text-xs leading-relaxed mb-3 line-clamp-2">{p.description}</p>}
                  {p.ctas?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {p.ctas.map((cta: any, i: number) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-bold text-[#a0a0a0] font-rajdhani uppercase tracking-wider">
                          {cta.label} {cta.openInNewTab && <ExternalLink size={9} />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FORM MODAL ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editing ? "Edit Product" : "New Product"}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

              <div>
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>

              {/* Thumbnail upload */}
              <div>
                <label className={labelCls}>Thumbnail</label>
                <input ref={thumbInputRef} type="file" className="hidden" accept="image/*" onChange={handleThumbChange} />
                {form.thumbnailUrl ? (
                  <div className="relative">
                    <img src={form.thumbnailUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-[#2a2a2a]" />
                    <button type="button" onClick={() => setForm((f: any) => ({ ...f, thumbnailUrl: "" }))} className="absolute top-2 right-2 p-1 bg-black/60 rounded text-white hover:text-red-400 transition-all"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => thumbInputRef.current?.click()} disabled={uploadingThumb} className="w-full bg-[#1a1a1a] border border-dashed border-[#333] hover:border-[#dc2626] rounded-lg h-11 px-4 text-[12px] text-[#606060] hover:text-white transition-all flex items-center justify-center gap-2">
                    {uploadingThumb ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Plus size={14} /> Upload Thumbnail</>}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 h-11">
                <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Visible</span>
                <button type="button" onClick={() => setForm((f: any) => ({ ...f, isVisible: !f.isVisible }))} className={`relative w-11 h-6 rounded-full transition-colors ${form.isVisible ? "bg-[#dc2626]" : "bg-[#333]"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.isVisible ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* CTAs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={labelCls} style={{ marginBottom: 0 }}>CTAs</label>
                  <button type="button" onClick={addCta} className="flex items-center gap-1 text-[11px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest">
                    <Plus size={12} /> Add CTA
                  </button>
                </div>
                <div className="space-y-3">
                  {form.ctas.map((cta: any, i: number) => (
                    <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#444] uppercase font-rajdhani font-bold tracking-widest">CTA {i + 1}</span>
                        {form.ctas.length > 1 && (
                          <button type="button" onClick={() => removeCta(i)} className="text-[#444] hover:text-red-400"><X size={12} /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={cta.label} onChange={e => updateCta(i, "label", e.target.value)} placeholder="Label" className="bg-[#111] border border-[#2a2a2a] rounded h-9 px-3 text-white text-xs outline-none focus:border-[#dc2626] transition-all" />
                        <select value={cta.type} onChange={e => updateCta(i, "type", e.target.value)} className="bg-[#111] border border-[#2a2a2a] rounded h-9 px-2 text-white text-xs outline-none focus:border-[#dc2626] transition-all appearance-none">
                          {CTA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <input value={cta.url} onChange={e => updateCta(i, "url", e.target.value)} placeholder="https://..." className="w-full bg-[#111] border border-[#2a2a2a] rounded h-9 px-3 text-white text-xs outline-none focus:border-[#dc2626] transition-all" />
                      <label className="flex items-center gap-2 text-[11px] text-[#606060] cursor-pointer select-none">
                        <input type="checkbox" checked={cta.openInNewTab} onChange={e => updateCta(i, "openInNewTab", e.target.checked)} className="accent-[#dc2626]" />
                        Open in new tab
                      </label>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createProduct.isPending || updateProduct.isPending) && <Loader2 size={14} className="animate-spin" />} Save
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
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Product?</h3>
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
