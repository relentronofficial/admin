"use client";

/**
 * E-books admin — three-tab CRUD (Books · Banners · Categories).
 *
 * Same monolith pattern as podcasts/page.tsx — shared Modal +
 * ModalActions primitives, same upload flow, same slug auto-gen.
 * PDF upload uses the R2 presigned-URL flow with progress bar.
 */

import React, { useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useEbookDashboard,
  useListEbookCategories,
  useCreateEbookCategory,
  useUpdateEbookCategory,
  useDeleteEbookCategory,
  useListEbooks,
  useCreateEbook,
  useUpdateEbook,
  useToggleEbookStatus,
  useDeleteEbook,
  useListEbookBanners,
  useCreateEbookBanner,
  useUpdateEbookBanner,
  useDeleteEbookBanner,
  useEbookAnalytics,
  useListEbookReviews,
  useUpdateEbookReviewStatus,
  useBulkImportEbooks,
  type EbookCategory,
  type Ebook,
  type EbookBanner,
  type EbookReview,
  type BulkImportRow,
  type BulkImportDryRunResult,
} from "@/lib/hooks/useEbooks";
import { useGetPresignedUrl } from "@/lib/hooks/useAdmin";
import { useListBatches } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import {
  BookOpen,
  Layers,
  Image as ImageIcon,
  Plus,
  X,
  Loader2,
  Edit2,
  Trash2,
  Power,
  Star,
  Upload,
  Search,
  FileText,
  Check,
} from "lucide-react";

const labelCls =
  "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const textareaCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm min-h-[90px]";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
        {label}
      </div>
      <div className="text-lg font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

type Tab = "books" | "banners" | "categories" | "reviews";

export default function EbooksPage() {
  const [tab, setTab] = useState<Tab>("books");
  const { data: stats } = useEbookDashboard();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <BookOpen className="text-[#dc2626]" size={24} /> E-Books
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Manage e-book library, banners, and categories for the mobile app.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
          <StatChip label="Books" value={stats?.totalBooks ?? "—"} />
          <StatChip label="Active" value={stats?.activeBooks ?? "—"} />
          <StatChip label="Inactive" value={stats?.inactiveBooks ?? "—"} />
          <StatChip label="Banners" value={stats?.banners ?? "—"} />
          <StatChip label="Bookmarks" value={stats?.bookmarks ?? "—"} />
          <StatChip label="Readers" value={stats?.activeReaders ?? "—"} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {(
            [
              { id: "books", label: "Books", icon: BookOpen },
              { id: "banners", label: "Banners", icon: ImageIcon },
              { id: "categories", label: "Categories", icon: Layers },
              { id: "reviews", label: "Reviews", icon: Star },
            ] as { id: Tab; label: string; icon: any }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors " +
                  (active
                    ? "border-[#dc2626] text-white"
                    : "border-transparent text-[#888] hover:text-white")
                }
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "books" && <BooksTab />}
        {tab === "banners" && <BannersTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "reviews" && <ReviewsTab />}
      </div>
    </DashboardLayout>
  );
}

// ────────────────────────────────────────────────────────────────
// Categories tab
// ────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data: rows, isLoading } = useListEbookCategories();
  const [editing, setEditing] = useState<EbookCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteEbookCategory();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this category? Books in it will keep working but lose the category label.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Category deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {rows?.length ?? 0} categor{(rows?.length ?? 0) === 1 ? "y" : "ies"}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Category
        </button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_120px_80px_120px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Name</span>
          <span>Slug</span>
          <span>Status</span>
          <span>Sort</span>
          <span className="text-right">Actions</span>
        </div>
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No categories yet.</div>
        )}
        {rows?.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_1fr_120px_80px_120px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center hover:bg-white/[0.02]"
          >
            <span className="text-[13px] text-white font-medium">{c.name}</span>
            <span className="text-[12px] text-[#888] font-mono">{c.slug}</span>
            <span
              className={
                "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold w-fit " +
                (c.status === "active"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-white/5 text-[#888]")
              }
            >
              {c.status}
            </span>
            <span className="text-[12px] text-[#888]">{c.sortOrder}</span>
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => setEditing(c)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <CategoryForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function CategoryForm({ initial, onClose }: { initial?: EbookCategory; onClose: () => void }) {
  const create = useCreateEbookCategory();
  const update = useUpdateEbookCategory();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const slugTouchedRef = useRef(isEdit);

  const submit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required.");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data: { name, slug, status, sortOrder } });
        toast.success("Category updated");
      } else {
        await create.mutateAsync({ name, slug, status, sortOrder });
        toast.success("Category created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Category" : "New Category"}>
      <label className={labelCls}>Name</label>
      <input
        className={inputCls}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouchedRef.current) setSlug(toSlug(e.target.value));
        }}
      />
      <div className="h-3" />
      <label className={labelCls}>Slug</label>
      <input
        className={inputCls}
        value={slug}
        onChange={(e) => {
          slugTouchedRef.current = true;
          setSlug(toSlug(e.target.value));
        }}
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={create.isPending || update.isPending} isEdit={isEdit} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// Banners tab
// ────────────────────────────────────────────────────────────────

function BannersTab() {
  const { data: rows, isLoading } = useListEbookBanners();
  const [editing, setEditing] = useState<EbookBanner | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteEbookBanner();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Banner deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">{rows?.length ?? 0} banners</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && (
          <div className="col-span-full p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="col-span-full p-8 text-center text-[#666] text-[12px]">
            No banners yet.
          </div>
        )}
        {rows?.map((b) => (
          <div
            key={b.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors"
          >
            {b.backgroundImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.backgroundImage} alt="" className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-[#252525] to-[#151515] flex items-center justify-center">
                <ImageIcon className="text-[#3a3a3a]" size={28} />
              </div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{b.title}</div>
                  {b.subtitle && (
                    <div className="text-[11px] text-[#888] line-clamp-2">{b.subtitle}</div>
                  )}
                </div>
                <span
                  className={
                    "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                    (b.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-white/5 text-[#888]")
                  }
                >
                  {b.status}
                </span>
              </div>
              {b.buttonText && (
                <div className="mt-2 text-[10px] text-[#a0a0a0]">
                  CTA: <span className="text-white">{b.buttonText}</span>
                </div>
              )}
              <div className="flex items-center gap-1 mt-3">
                <button
                  onClick={() => setEditing(b)}
                  className="flex items-center gap-1 text-[10px] text-[#a0a0a0] hover:text-white px-2 py-1"
                >
                  <Edit2 size={11} /> Edit
                </button>
                <button
                  onClick={() => onDelete(b.id)}
                  className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <BannerForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function BannerForm({ initial, onClose }: { initial?: EbookBanner; onClose: () => void }) {
  const create = useCreateEbookBanner();
  const update = useUpdateEbookBanner();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [backgroundImage, setBackgroundImage] = useState(initial?.backgroundImage ?? "");
  const [buttonText, setButtonText] = useState(initial?.buttonText ?? "");
  const [buttonLink, setButtonLink] = useState(initial?.buttonLink ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const bgUpload = useCoverUploader((url) => setBackgroundImage(url), "ebooks/banners");

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title required.");
      return;
    }
    const data = {
      title,
      subtitle: subtitle || null,
      backgroundImage: backgroundImage || null,
      buttonText: buttonText || null,
      buttonLink: buttonLink || null,
      status,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Banner updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Banner created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Banner" : "New Banner"} wide>
      <label className={labelCls}>Title</label>
      <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="h-3" />
      <label className={labelCls}>Subtitle</label>
      <textarea className={textareaCls} value={subtitle ?? ""} onChange={(e) => setSubtitle(e.target.value)} />
      <div className="mt-3">
        <label className={labelCls}>Background Image</label>
        {backgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundImage} alt="" className="w-full max-h-40 object-cover rounded mb-2" />
        )}
        {bgUpload.render}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Button Text</label>
          <input className={inputCls} value={buttonText ?? ""} onChange={(e) => setButtonText(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Button Link (URL)</label>
          <input className={inputCls} value={buttonLink ?? ""} onChange={(e) => setButtonLink(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={create.isPending || update.isPending} isEdit={isEdit} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// Books tab
// ────────────────────────────────────────────────────────────────

function BooksTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListEbooks({ page, limit: 25, search });
  const { data: categories } = useListEbookCategories();
  const [editing, setEditing] = useState<Ebook | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const toggleStatus = useToggleEbookStatus();
  const del = useDeleteEbook();

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const onToggle = async (id: string) => {
    try {
      await toggleStatus.mutateAsync(id);
    } catch {
      toast.error("Toggle failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this book? Members' bookmarks + reading progress will be removed too.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Book deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search books…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          onClick={() => setImporting(true)}
          className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Upload size={12} /> Import CSV
        </button>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Book
        </button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[3fr_1.5fr_1.5fr_100px_120px_80px_140px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Title</span>
          <span>Author</span>
          <span>Category</span>
          <span>Pages</span>
          <span>Status</span>
          <span>Featured</span>
          <span className="text-right">Actions</span>
        </div>
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No books yet.</div>
        )}
        {rows.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-[3fr_1.5fr_1.5fr_100px_120px_80px_140px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="text-[13px] text-white font-medium truncate">{b.title}</div>
              <div className="text-[10px] text-[#666] font-mono truncate">{b.slug}</div>
            </div>
            <span className="text-[12px] text-[#a0a0a0] truncate">{b.author ?? "—"}</span>
            <span className="text-[12px] text-[#a0a0a0] truncate">{b.category?.name ?? "—"}</span>
            <span className="text-[12px] text-[#888]">{b.totalPages}</span>
            <span
              className={
                "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold w-fit " +
                (b.status === "active"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-white/5 text-[#888]")
              }
            >
              {b.status}
            </span>
            <span>
              {b.isFeatured && (
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
              )}
            </span>
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => onToggle(b.id)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                title="Toggle status"
              >
                <Power size={13} />
              </button>
              <button
                onClick={() => setEditing(b)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(b.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {totalPages > 1 && (
          <div className="border-t border-[#2a2a2a] px-4 py-2 flex items-center justify-between">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
            >
              ← Prev
            </button>
            <span className="text-[10px] text-[#666]">
              Page {page} of {totalPages} · {total} total
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <BookForm
          initial={editing ?? undefined}
          categories={categories ?? []}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {importing && (
        <BulkImportModal onClose={() => setImporting(false)} />
      )}
    </>
  );
}

function BookForm({
  initial,
  categories,
  onClose,
}: {
  initial?: Ebook;
  categories: EbookCategory[];
  onClose: () => void;
}) {
  const create = useCreateEbook();
  const update = useUpdateEbook();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl ?? "");
  const [contentUrl, setContentUrl] = useState(initial?.contentUrl ?? "");
  const [totalPages, setTotalPages] = useState(initial?.totalPages ?? 0);
  const [readingTime, setReadingTime] = useState(initial?.readingTime ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [batchIds, setBatchIds] = useState<string[]>(initial?.batchIds ?? []);
  const [tab, setTab] = useState<"edit" | "analytics">("edit");
  const slugTouchedRef = useRef(isEdit);

  const coverUpload = useCoverUploader((url) => setCoverImage(url), "ebooks/covers");
  const pdfUpload = usePdfUploader((url) => setPdfUrl(url));

  // For the per-batch access chip picker.
  const { data: batchesData } = useListBatches();
  const batches = (batchesData as any)?.data ?? (batchesData as any) ?? [];

  const submit = async () => {
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug are required.");
      return;
    }
    if (!pdfUrl.trim() && !contentUrl.trim()) {
      toast.error("Either a PDF or a content URL is required.");
      return;
    }
    const data = {
      title,
      slug,
      description: description || null,
      author: author || null,
      categoryId: categoryId || null,
      coverImage: coverImage || null,
      pdfUrl: pdfUrl || null,
      contentUrl: contentUrl || null,
      totalPages,
      readingTime: readingTime || null,
      isFeatured,
      status,
      sortOrder,
      // null = available to all members, [id, ...] = restricted.
      batchIds: batchIds.length > 0 ? batchIds : null,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Book updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Book created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Book" : "New Book"} wide>
      {isEdit && (
        <div className="flex gap-1 mb-3 border-b border-[#2a2a2a]">
          {(["edit", "analytics"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest font-rajdhani border-b-2 -mb-px transition ${
                tab === t
                  ? "text-white border-[#dc2626]"
                  : "text-[#606060] border-transparent hover:text-[#a0a0a0]"
              }`}
            >
              {t === "edit" ? "Edit" : "Analytics"}
            </button>
          ))}
        </div>
      )}
      {isEdit && tab === "analytics" ? (
        <BookAnalyticsPanel bookId={initial!.id} onClose={onClose} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouchedRef.current) setSlug(toSlug(e.target.value));
            }}
          />
        </div>
        <div>
          <label className={labelCls}>Slug</label>
          <input
            className={inputCls}
            value={slug}
            onChange={(e) => {
              slugTouchedRef.current = true;
              setSlug(toSlug(e.target.value));
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Author</label>
          <input className={inputCls} value={author ?? ""} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select
            className={inputCls}
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Description</label>
        <textarea
          className={textareaCls}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Cover Image</label>
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" className="w-32 h-40 object-cover rounded mb-2" />
        )}
        {coverUpload.render}
      </div>
      <div className="mt-3">
        <label className={labelCls}>PDF File</label>
        {pdfUrl && (
          <div className="text-[11px] text-[#a0a0a0] mb-2 truncate flex items-center gap-1">
            <FileText size={12} className="text-green-400" />
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="hover:text-white truncate">
              {pdfUrl}
            </a>
          </div>
        )}
        {pdfUpload.render}
      </div>
      <div className="mt-3">
        <label className={labelCls}>Or Content URL (external link, e.g. Google Docs)</label>
        <input className={inputCls} value={contentUrl ?? ""} onChange={(e) => setContentUrl(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3 items-end">
        <div>
          <label className={labelCls}>Total Pages</label>
          <input
            type="number"
            className={inputCls}
            value={totalPages}
            onChange={(e) => setTotalPages(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={labelCls}>Reading Time (e.g. "45 min")</label>
          <input className={inputCls} value={readingTime ?? ""} onChange={(e) => setReadingTime(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 h-11 px-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="accent-[#dc2626]"
          />
          <span className="text-[12px] text-white">Featured</span>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>
          Batch Access{" "}
          <span className="text-[#666] normal-case font-normal">
            (leave empty = all members)
          </span>
        </label>
        {batches.length === 0 ? (
          <p className="text-[#666] text-xs">No batches found.</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {batches.map((b: any) => {
              const checked = batchIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setBatchIds((curr) =>
                      checked
                        ? curr.filter((id) => id !== b.id)
                        : [...curr, b.id],
                    )
                  }
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                    checked
                      ? "bg-[#dc2626]/10 border-[#dc2626]/40 text-white"
                      : "bg-[#1a1a1a] border-[#2a2a2a] text-[#a0a0a0] hover:border-[#444]"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                      checked
                        ? "bg-[#dc2626] border-[#dc2626]"
                        : "border-[#555]"
                    }`}
                  >
                    {checked && (
                      <span className="text-white text-[10px] font-bold leading-none">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{b.name}</span>
                  {!b.isActive && (
                    <span className="ml-auto text-[10px] text-[#666] uppercase tracking-wider">
                      Inactive
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={create.isPending || update.isPending} isEdit={isEdit} />
      </>
      )}
    </Modal>
  );
}

function BookAnalyticsPanel({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { data, isLoading, error } = useEbookAnalytics(bookId);

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-[#a0a0a0] gap-2">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-12 text-center text-sm text-[#a0a0a0]">
        Could not load analytics.
      </div>
    );
  }

  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Total opens", value: `${data.totalOpens}` },
    { label: "Completed", value: `${data.completedCount}` },
    {
      label: "Completion rate",
      value: `${Math.round(data.completionRate * 100)}%`,
    },
    { label: "Avg. page reached", value: `${data.avgPageReached}` },
    { label: "Total bookmarks", value: `${data.totalBookmarks}` },
    {
      label: "Active readers (30d)",
      value: `${data.activeReaders30d}`,
    },
    { label: "View count", value: `${data.viewCount}`, hint: "P1-6" },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-3 py-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] p-4"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani flex items-center gap-1">
              <span>{t.label}</span>
              {t.hint && (
                <span className="text-[#3a3a3a] normal-case font-normal">
                  · {t.hint}
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {t.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm hover:bg-[#222]"
        >
          Close
        </button>
      </div>
    </>
  );
}

// ── Bulk CSV import modal ─────────────────────────────────────────

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const bulk = useBulkImportEbooks();
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkImportDryRunResult | null>(null);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setParseError(null);
    setPreview(null);
    setRows([]);
    try {
      const text = await file.text();
      const parsed = parseCsvToRows(text);
      if (parsed.length === 0) {
        setParseError("No data rows found in the CSV.");
        return;
      }
      setRows(parsed);
    } catch (err: any) {
      setParseError(err?.message ?? "Could not parse CSV.");
    }
  };

  const runDryRun = async () => {
    if (rows.length === 0) return;
    try {
      const result = (await bulk.mutateAsync({
        rows,
        dryRun: true,
      })) as BulkImportDryRunResult;
      setPreview(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Preview failed");
    }
  };

  const commit = async () => {
    if (rows.length === 0) return;
    try {
      const result = await bulk.mutateAsync({ rows, dryRun: false });
      if ("createdCount" in result) {
        toast.success(
          `Imported ${result.createdCount} book${result.createdCount === 1 ? "" : "s"}` +
            (result.errorCount > 0 ? ` · ${result.errorCount} skipped` : ""),
        );
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Import failed");
    }
  };

  return (
    <Modal onClose={onClose} title="Bulk import books from CSV" wide>
      <p className="text-[12px] text-[#a0a0a0] mb-3 leading-relaxed">
        Upload a <code className="text-[#dc2626]">.csv</code> with these
        columns (case-insensitive):{" "}
        <code className="text-white">title, author, category, totalPages, pdfUrl, coverUrl</code>.{" "}
        The <b>title</b> column is required; everything else is optional.
        Slugs are auto-generated from titles. Duplicates (existing or
        within the CSV) are reported and skipped.
      </p>

      <div className="rounded-lg bg-[#1a1a1a] border border-dashed border-[#2a2a2a] p-6 text-center">
        <input
          id="bulk-csv-input"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <label
          htmlFor="bulk-csv-input"
          className="inline-flex items-center gap-2 cursor-pointer bg-[#2a2a2a] hover:bg-[#333] text-white px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest font-rajdhani"
        >
          <Upload size={14} /> Choose CSV
        </label>
        {filename && (
          <div className="mt-3 text-[12px] text-[#a0a0a0]">
            <FileText size={12} className="inline mr-1 -mt-0.5" />
            {filename} · {rows.length} row{rows.length === 1 ? "" : "s"} parsed
          </div>
        )}
        {parseError && (
          <div className="mt-3 text-[12px] text-red-400">{parseError}</div>
        )}
      </div>

      {rows.length > 0 && !preview && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={runDryRun}
            disabled={bulk.isPending}
            className="px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
          >
            {bulk.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Checking…
              </span>
            ) : (
              "Preview import"
            )}
          </button>
        </div>
      )}

      {preview && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-green-400 font-rajdhani">
                To create
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {preview.willCreate}
              </div>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 font-rajdhani">
                Skipped (errors)
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {preview.errors.length}
              </div>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-3 max-h-40 overflow-y-auto rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
              {preview.errors.map((e) => (
                <div
                  key={`${e.row}-${e.title}`}
                  className="px-3 py-2 text-[12px] text-[#d0d0d0] flex items-start gap-2"
                >
                  <span className="text-[#606060] font-mono">
                    #{e.row}
                  </span>
                  <span className="text-white flex-1 truncate">
                    {e.title}
                  </span>
                  <span className="text-red-400 text-right">
                    {e.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani"
            >
              Back
            </button>
            <button
              onClick={commit}
              disabled={bulk.isPending || preview.willCreate === 0}
              className="px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
            >
              {bulk.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Importing…
                </span>
              ) : (
                `Create ${preview.willCreate} book${preview.willCreate === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Minimal CSV parser — handles the common cases (quoted fields with
// commas/newlines, doubled-quote escapes, trimmed headers). Not a full
// RFC 4180 implementation; good enough for the admin CSV shape. Rows
// missing the `title` column are dropped.
function parseCsvToRows(text: string): BulkImportRow[] {
  const cells: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\r") {
      // ignore — handled by \n
    } else if (ch === "\n") {
      cur.push(field);
      cells.push(cur);
      cur = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    cells.push(cur);
  }
  if (cells.length === 0) return [];
  const header = cells[0].map((h) => h.trim().toLowerCase());
  const idxOf = (name: string) => header.indexOf(name);
  const iTitle = idxOf("title");
  const iAuthor = idxOf("author");
  const iCategory = idxOf("category");
  const iPages = idxOf("totalpages");
  const iPdf = idxOf("pdfurl");
  const iCover = idxOf("coverurl");
  if (iTitle === -1) {
    throw new Error("CSV must include a 'title' column.");
  }
  const out: BulkImportRow[] = [];
  for (let r = 1; r < cells.length; r++) {
    const row = cells[r];
    if (row.length === 1 && row[0].trim() === "") continue;
    const title = row[iTitle]?.trim();
    if (!title) continue;
    const pages = iPages !== -1 ? Number(row[iPages]?.trim() || 0) : 0;
    out.push({
      title,
      author: iAuthor !== -1 ? row[iAuthor]?.trim() || null : null,
      category: iCategory !== -1 ? row[iCategory]?.trim() || null : null,
      totalPages: Number.isFinite(pages) ? pages : 0,
      pdfUrl: iPdf !== -1 ? row[iPdf]?.trim() || null : null,
      coverUrl: iCover !== -1 ? row[iCover]?.trim() || null : null,
    });
  }
  return out;
}

// ── Reviews moderation tab ────────────────────────────────────────

function ReviewsTab() {
  const [status, setStatus] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const { data, isLoading, error } = useListEbookReviews({ status, limit: 50 });
  const update = useUpdateEbookReviewStatus();

  const rows = data?.data ?? [];

  const setStatusFor = async (
    id: string,
    next: "approved" | "rejected" | "pending",
  ) => {
    try {
      await update.mutateAsync({ id, status: next });
      toast.success(`Review marked ${next}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Update failed");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={
              "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-colors " +
              (status === s
                ? "bg-[#dc2626] text-white"
                : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] hover:text-white")
            }
          >
            {s}
          </button>
        ))}
        {data?.meta && (
          <span className="ml-auto text-[11px] text-[#606060]">
            {data.meta.total} total
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-[#a0a0a0] gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading reviews…</span>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-[#a0a0a0]">
          Could not load reviews.
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#606060]">
          No {status !== "all" ? status : ""} reviews.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: EbookReview) => (
            <ReviewCard
              key={r.id}
              review={r}
              busy={update.isPending}
              onApprove={() => setStatusFor(r.id, "approved")}
              onReject={() => setStatusFor(r.id, "rejected")}
              onReset={() => setStatusFor(r.id, "pending")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  busy,
  onApprove,
  onReject,
  onReset,
}: {
  review: EbookReview;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const author = [review.member?.firstName, review.member?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "Member";
  const statusColor =
    review.status === "approved"
      ? "text-green-400 bg-green-500/10 border-green-500/30"
      : review.status === "rejected"
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : "text-orange-400 bg-orange-500/10 border-orange-500/30";
  return (
    <div className="rounded-lg bg-[#141414] border border-[#2a2a2a] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] text-white">
            <span className="font-medium">{author}</span>
            <span className="text-[#606060]">·</span>
            <span className="text-[#a0a0a0] text-[12px] truncate">
              {review.book?.title ?? "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={13}
                  className={
                    n <= review.rating
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-[#333]"
                  }
                />
              ))}
            </div>
            <span
              className={
                "text-[10px] uppercase tracking-widest font-rajdhani font-bold px-2 py-0.5 rounded border " +
                statusColor
              }
            >
              {review.status}
            </span>
            <span className="text-[11px] text-[#606060] ml-auto">
              {new Date(review.updatedAt).toLocaleDateString()}
            </span>
          </div>
          {review.reviewText && (
            <p className="mt-2 text-[13px] text-[#d0d0d0] whitespace-pre-wrap leading-relaxed">
              {review.reviewText}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {review.status !== "approved" && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40"
              title="Approve"
            >
              <Check size={14} />
            </button>
          )}
          {review.status !== "rejected" && (
            <button
              onClick={onReject}
              disabled={busy}
              className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
              title="Reject"
            >
              <X size={14} />
            </button>
          )}
          {review.status !== "pending" && (
            <button
              onClick={onReset}
              disabled={busy}
              className="p-1.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] hover:text-white disabled:opacity-40"
              title="Reset to pending"
            >
              <Loader2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared modal + upload helpers (same pattern as podcasts) ─────

function Modal({
  onClose,
  title,
  children,
  wide,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-6 overflow-y-auto">
      <div
        className={
          "bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl w-full " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-[14px] font-bold uppercase tracking-widest font-rajdhani text-white">
            {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#a0a0a0]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  busy,
  isEdit,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  isEdit: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#2a2a2a]">
      <button
        onClick={onClose}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white disabled:opacity-40"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {isEdit ? "Save" : "Create"}
      </button>
    </div>
  );
}

function useCoverUploader(onSet: (url: string) => void, pathPrefix: string) {
  const [busy, setBusy] = useState(false);
  const presign = useGetPresignedUrl();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const { uploadUrl, publicUrl } = await presign.mutateAsync({
        filename: f.name,
        contentType: f.type,
        bucket: "site-assets",
        pathPrefix,
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type },
      });
      onSet(publicUrl);
      toast.success("Uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return {
    render: (
      <label className="flex items-center gap-2 cursor-pointer bg-[#1a1a1a] border border-dashed border-[#2a2a2a] hover:border-[#dc2626] rounded-lg px-4 py-3 text-[12px] text-[#a0a0a0]">
        {busy ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
        <span>{busy ? "Uploading…" : "Upload image (JPG/PNG/WebP)"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    ),
  };
}

function usePdfUploader(onSet: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const presign = useGetPresignedUrl();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const { uploadUrl, publicUrl } = await presign.mutateAsync({
        filename: f.name,
        contentType: "application/pdf",
        bucket: "site-assets",
        pathPrefix: "ebooks/pdfs",
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(f);
      });
      onSet(publicUrl);
      toast.success("PDF uploaded");
    } catch {
      toast.error("PDF upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return {
    render: (
      <label className="flex flex-col gap-2 cursor-pointer bg-[#1a1a1a] border border-dashed border-[#2a2a2a] hover:border-[#dc2626] rounded-lg px-4 py-3 text-[12px] text-[#a0a0a0]">
        <div className="flex items-center gap-2">
          {busy ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
          <span>{busy ? `Uploading… ${progress}%` : "Upload PDF"}</span>
        </div>
        {busy && (
          <div className="w-full bg-[#0a0a0a] h-1 rounded overflow-hidden">
            <div className="bg-[#dc2626] h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    ),
  };
}
