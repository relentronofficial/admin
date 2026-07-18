"use client";

/**
 * Podcasts admin — three-tab CRUD (Categories · Series · Episodes).
 *
 * Design goals:
 *   * Single-page monolith like the rest of the admin (workshops,
 *     courses) — no route splits per resource.
 *   * Modal-driven create/edit — the list stays visible so admins
 *     don't lose context.
 *   * Audio + cover uploads via the shared R2 presigned-URL flow
 *     (same as workshops/courses).
 */

import React, { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  usePodcastDashboard,
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListSeries,
  useCreateSeries,
  useUpdateSeries,
  useDeleteSeries,
  useListEpisodes,
  useCreateEpisode,
  useUpdateEpisode,
  useToggleEpisodeStatus,
  useDeleteEpisode,
  type PodcastCategory,
  type PodcastSeries,
  type PodcastEpisode,
} from "@/lib/hooks/usePodcasts";
import { useGetPresignedUrl } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";
import {
  Headphones,
  Layers,
  Radio,
  Plus,
  X,
  Loader2,
  Edit2,
  Trash2,
  Power,
  Star,
  Upload,
  Search,
} from "lucide-react";
import { format } from "date-fns";

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

type Tab = "episodes" | "series" | "categories";

export default function PodcastsPage() {
  const [tab, setTab] = useState<Tab>("episodes");
  const { data: stats } = usePodcastDashboard();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <Headphones className="text-[#dc2626]" size={24} /> Podcasts
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Manage podcast episodes, series, and categories for the mobile app.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
          <StatChip label="Episodes" value={stats?.totalEpisodes ?? "—"} />
          <StatChip label="Active" value={stats?.activeEpisodes ?? "—"} />
          <StatChip label="Inactive" value={stats?.inactiveEpisodes ?? "—"} />
          <StatChip label="Series" value={stats?.series ?? "—"} />
          <StatChip label="Categories" value={stats?.categories ?? "—"} />
          <StatChip label="Total Listens" value={stats?.totalListens ?? "—"} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {(
            [
              { id: "episodes", label: "Episodes", icon: Radio },
              { id: "series", label: "Series", icon: Layers },
              { id: "categories", label: "Categories", icon: Star },
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

        {tab === "episodes" && <EpisodesTab />}
        {tab === "series" && <SeriesTab />}
        {tab === "categories" && <CategoriesTab />}
      </div>
    </DashboardLayout>
  );
}

// ────────────────────────────────────────────────────────────────
// Categories tab
// ────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data: rows, isLoading } = useListCategories();
  const [editing, setEditing] = useState<PodcastCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteCategory();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this category? Episodes in it will keep playing but lose the category label.")) return;
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

function CategoryForm({ initial, onClose }: { initial?: PodcastCategory; onClose: () => void }) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const slugTouchedRef = useRef(isEdit); // in edit mode never auto-overwrite

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
// Series tab
// ────────────────────────────────────────────────────────────────

function SeriesTab() {
  const { data: rows, isLoading } = useListSeries();
  const [editing, setEditing] = useState<PodcastSeries | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteSeries();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this series? Episodes in it will keep playing but lose the series link.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Series deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">{rows?.length ?? 0} series</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Series
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {isLoading && (
          <div className="col-span-full p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="col-span-full p-8 text-center text-[#666] text-[12px]">No series yet.</div>
        )}
        {rows?.map((s) => (
          <div
            key={s.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors"
          >
            {s.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.coverImage} alt="" className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-[#252525] to-[#151515] flex items-center justify-center">
                <Layers className="text-[#3a3a3a]" size={28} />
              </div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{s.title}</div>
                  <div className="text-[11px] text-[#888] font-mono truncate">{s.slug}</div>
                </div>
                <span
                  className={
                    "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                    (s.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-white/5 text-[#888]")
                  }
                >
                  {s.status}
                </span>
              </div>
              {s.description && (
                <p className="text-[11px] text-[#a0a0a0] mt-2 line-clamp-2">{s.description}</p>
              )}
              <div className="flex items-center gap-1 mt-3">
                <button
                  onClick={() => setEditing(s)}
                  className="flex items-center gap-1 text-[10px] text-[#a0a0a0] hover:text-white px-2 py-1"
                >
                  <Edit2 size={11} /> Edit
                </button>
                <button
                  onClick={() => onDelete(s.id)}
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
        <SeriesForm
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

function SeriesForm({ initial, onClose }: { initial?: PodcastSeries; onClose: () => void }) {
  const create = useCreateSeries();
  const update = useUpdateSeries();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const slugTouchedRef = useRef(isEdit);

  const upload = useCoverUploader((url) => setCoverImage(url));

  const submit = async () => {
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug required.");
      return;
    }
    const data = {
      title,
      slug,
      description: description || null,
      coverImage: coverImage || null,
      status,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Series updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Series created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Series" : "New Series"} wide>
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
          <img src={coverImage} alt="" className="w-full max-h-40 object-cover rounded mb-2" />
        )}
        {upload.render}
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
// Episodes tab
// ────────────────────────────────────────────────────────────────

function EpisodesTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListEpisodes({ page, limit: 25, search });
  const { data: categories } = useListCategories();
  const { data: series } = useListSeries();
  const [editing, setEditing] = useState<PodcastEpisode | null>(null);
  const [creating, setCreating] = useState(false);
  const toggleStatus = useToggleEpisodeStatus();
  const del = useDeleteEpisode();

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
    if (!confirm("Delete this episode? Members' progress rows will be removed too.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Episode deleted");
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
            placeholder="Search episodes…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Episode
        </button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[3fr_1.5fr_1.5fr_120px_80px_140px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Title</span>
          <span>Series</span>
          <span>Category</span>
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
          <div className="p-8 text-center text-[#666] text-[12px]">No episodes yet.</div>
        )}
        {rows.map((ep) => (
          <div
            key={ep.id}
            className="grid grid-cols-[3fr_1.5fr_1.5fr_120px_80px_140px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="text-[13px] text-white font-medium truncate">{ep.title}</div>
              <div className="text-[10px] text-[#666] font-mono truncate">{ep.slug}</div>
            </div>
            <span className="text-[12px] text-[#a0a0a0] truncate">{ep.series?.title ?? "—"}</span>
            <span className="text-[12px] text-[#a0a0a0] truncate">{ep.category?.name ?? "—"}</span>
            <span
              className={
                "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold w-fit " +
                (ep.status === "active"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-white/5 text-[#888]")
              }
            >
              {ep.status}
            </span>
            <span>
              {ep.isFeatured && (
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
              )}
            </span>
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => onToggle(ep.id)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                title="Toggle status"
              >
                <Power size={13} />
              </button>
              <button
                onClick={() => setEditing(ep)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(ep.id)}
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
        <EpisodeForm
          initial={editing ?? undefined}
          categories={categories ?? []}
          series={series ?? []}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function EpisodeForm({
  initial,
  categories,
  series,
  onClose,
}: {
  initial?: PodcastEpisode;
  categories: PodcastCategory[];
  series: PodcastSeries[];
  onClose: () => void;
}) {
  const create = useCreateEpisode();
  const update = useUpdateEpisode();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [seriesId, setSeriesId] = useState(initial?.seriesId ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [audioUrl, setAudioUrl] = useState(initial?.audioUrl ?? "");
  const [durationSeconds, setDurationSeconds] = useState(initial?.durationSeconds ?? 0);
  const [speaker, setSpeaker] = useState(initial?.speaker ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const slugTouchedRef = useRef(isEdit);

  const coverUpload = useCoverUploader((url) => setCoverImage(url));
  const audioUpload = useAudioUploader((url, seconds) => {
    setAudioUrl(url);
    if (seconds && !durationSeconds) setDurationSeconds(seconds);
  });

  const submit = async () => {
    if (!title.trim() || !slug.trim() || !audioUrl.trim()) {
      toast.error("Title, slug and audio are required.");
      return;
    }
    const data = {
      title,
      slug,
      description: description || null,
      categoryId: categoryId || null,
      seriesId: seriesId || null,
      coverImage: coverImage || null,
      audioUrl,
      durationSeconds,
      speaker: speaker || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isFeatured,
      status,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Episode updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Episode created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Episode" : "New Episode"} wide>
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
      <div className="mt-3">
        <label className={labelCls}>Description</label>
        <textarea
          className={textareaCls}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
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
        <div>
          <label className={labelCls}>Series</label>
          <select
            className={inputCls}
            value={seriesId ?? ""}
            onChange={(e) => setSeriesId(e.target.value)}
          >
            <option value="">— none —</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Audio (MP3)</label>
        {audioUrl && (
          <div className="text-[11px] text-[#a0a0a0] mb-2 truncate">
            <span className="text-green-400">✓</span> {audioUrl}
          </div>
        )}
        {audioUpload.render}
      </div>
      <div className="mt-3">
        <label className={labelCls}>Cover Image</label>
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" className="w-32 h-32 object-cover rounded mb-2" />
        )}
        {coverUpload.render}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Duration (seconds)</label>
          <input
            type="number"
            className={inputCls}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={labelCls}>Speaker</label>
          <input className={inputCls} value={speaker ?? ""} onChange={(e) => setSpeaker(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Tags (comma-separated)</label>
        <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3 items-end">
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
      <ModalActions onClose={onClose} onSubmit={submit} busy={create.isPending || update.isPending} isEdit={isEdit} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────

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

// ── Upload helpers ────────────────────────────────────────────────

function useCoverUploader(onSet: (url: string) => void) {
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
        pathPrefix: "podcast/covers",
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type },
      });
      onSet(publicUrl);
      toast.success("Cover uploaded");
    } catch (err: any) {
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
        <span>{busy ? "Uploading…" : "Upload cover image (JPG/PNG/WebP)"}</span>
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

function useAudioUploader(onSet: (url: string, durationSeconds?: number) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const presign = useGetPresignedUrl();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setProgress(0);
    try {
      const { uploadUrl, publicUrl } = await presign.mutateAsync({
        filename: f.name,
        contentType: f.type,
        bucket: "site-assets",
        pathPrefix: "podcast/audio",
      });
      // Fetch-with-progress via XHR since fetch() has no progress event.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", f.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(f);
      });
      const seconds = await detectAudioDuration(f);
      onSet(publicUrl, seconds);
      toast.success("Audio uploaded");
    } catch (err: any) {
      toast.error("Audio upload failed");
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
          <span>{busy ? `Uploading… ${progress}%` : "Upload audio (MP3/M4A)"}</span>
        </div>
        {busy && (
          <div className="w-full bg-[#0a0a0a] h-1 rounded overflow-hidden">
            <div className="bg-[#dc2626] h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    ),
  };
}

function detectAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const url = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(audio.duration || 0));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}
