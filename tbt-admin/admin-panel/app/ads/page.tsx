"use client";

/**
 * Ad Campaigns admin — TBT_ADS_SPECKIT.md §8.
 *
 * Monolithic multi-tab page, matching workshops/ and courses/ — no route split
 * per resource. Four tabs:
 *
 *   Campaigns  list + filters + row actions
 *   Editor     sectioned create/edit form (Basic → Tracking)
 *   Preview    the campaign rendered in four device frames, live gating
 *   Analytics  cross-campaign rollup + per-campaign breakdowns
 *
 * The form mirrors the backend Zod rules in `modules/ads/schema.ts` for fast
 * feedback only. The backend is authoritative — in particular the activation
 * gate, which re-validates the whole campaign when status flips to `active`.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getAdminSocket } from "@/lib/socket/client";
import {
  useListAdCampaigns,
  useGetAdCampaign,
  useCreateAdCampaign,
  useUpdateAdCampaign,
  useUpdateAdCampaignStatus,
  useDuplicateAdCampaign,
  useDeleteAdCampaign,
  useAdCampaignAnalytics,
  useAdAnalyticsOverview,
  useListBatches,
  type AdCampaignStatus,
} from "@/lib/hooks/useTbt";
import { useUploadImage, useCreateBunnyVideo } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";
import {
  Megaphone, Plus, Search, Edit2, Copy, Trash2, Play, Pause, Archive,
  BarChart2, Monitor, Loader2, X, Upload, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";

// ── Shared styles (CLAUDE.md design system) ───────────────────────────────────

const labelCls =
  "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const textareaCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm min-h-[80px]";
const btnPrimary =
  "flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg transition-colors";
const btnGhost =
  "flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] text-[#ccc] text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg transition-colors";

// ── Vocabularies (kept in sync with backend schema.ts) ────────────────────────

const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "archived"] as const;
const MEDIA_TYPES = ["image", "video"] as const;
const OBJECT_FITS = ["contain", "cover", "fill"] as const;
const PLATFORMS = ["web", "mobile"] as const;
const OS_LIST = ["android", "ios", "web"] as const;

/**
 * Trigger types the clients actually emit today. `content_playback` and
 * `action` are accepted by the API so campaigns can be authored ahead of client
 * support (§2), but offering them here would let an admin build a campaign that
 * silently never fires — so they are labelled, not hidden.
 */
const TRIGGER_TYPES: { id: string; label: string; ready: boolean }[] = [
  { id: "app_launch", label: "App launch", ready: true },
  { id: "route_enter", label: "Route enter", ready: true },
  { id: "timed_interval", label: "Timed interval", ready: true },
  { id: "content_playback", label: "Content playback (not yet emitted)", ready: false },
  { id: "action", label: "Action (not yet emitted)", ready: false },
];

/** Must match `placementForRoute()` in tbt-user-web/lib/hooks/useAds.ts. */
const PLACEMENTS = [
  "app_launch", "home", "course", "workshop", "podcast",
  "ebook", "community", "video", "profile", "global",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Mirror of `KNOWN_ROUTE_PREFIXES` in the backend schema (§13). A CTA pointing
 * somewhere neither client can route to is a dead end the admin would only hear
 * about from a member — catching it in the form is the whole point of mirroring.
 * Adding a member-facing section means adding it in both places.
 */
const KNOWN_ROUTE_PREFIXES = [
  "/dashboard", "/tbt", "/courses", "/learning", "/workshops", "/workshop",
  "/events", "/programs", "/batch-program", "/podcasts", "/ebooks",
  "/community", "/messages", "/notifications", "/search", "/history",
  "/support", "/ai-content", "/Products", "/Resources", "/profile",
];

/** Named so the admin is told which scheme was rejected, not just "invalid". */
const DANGEROUS_URL_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"];

const TIMEZONES = [
  "Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore",
  "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#666",
  scheduled: "#3b82f6",
  active: "#22c55e",
  paused: "#f59e0b",
  completed: "#8b5cf6",
  archived: "#444",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const toCode = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** "" → undefined, so an untouched optional numeric field is omitted rather
 *  than sent as 0 (which means something entirely different for a cap). */
const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const lines = (v: string): string[] =>
  v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

/** `datetime-local` speaks local wall-clock with no zone; the API speaks ISO. */
const toIso = (local: string): string => new Date(local).toISOString();

const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
};

const apiError = (err: any, fallback: string) =>
  err?.response?.data?.error?.message ?? err?.message ?? fallback;

/**
 * When the skip control unlocks, in seconds from playback start. Mirrors
 * `skipAvailableAfterSeconds()` in the backend eligibility engine — the server
 * value is authoritative at runtime; this is the preview's local copy.
 */
function skipUnlockSeconds(
  skip: { enabled?: boolean; type?: string; value?: number } | null | undefined,
  duration: number | null,
): number | null {
  if (!skip?.enabled) return null;
  switch (skip.type) {
    case "immediate": return 0;
    case "seconds": return typeof skip.value === "number" ? Math.max(0, skip.value) : 0;
    case "percent":
      if (!duration || typeof skip.value !== "number") return null;
      return Math.round((duration * Math.min(100, Math.max(0, skip.value))) / 100);
    default: return null; // after_end
  }
}

// ── Small presentational pieces ───────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">{label}</div>
      <div className="text-lg font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#666";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest font-rajdhani"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}44` }}
    >
      {status}
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 mb-4">
      <div className="mb-4">
        <h3 className="text-[13px] font-bold text-white uppercase tracking-widest font-rajdhani">{title}</h3>
        {hint && <p className="text-[11px] text-[#777] mt-1">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Check({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#dc2626]"
      />
      <span className="text-[12px] text-[#ccc]">{label}</span>
    </label>
  );
}

/** Multi-select as checkboxes, per §8.2 — never a dropdown. */
function CheckGroup({
  options, values, onChange,
}: {
  options: { id: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => (
        <Check
          key={o.id}
          label={o.label}
          checked={values.includes(o.id)}
          onChange={(on) => onChange(on ? [...values, o.id] : values.filter((v) => v !== o.id))}
        />
      ))}
    </div>
  );
}

/** Horizontal CSS bar — the admin has no charting library and §8.2 says not to
 *  add one for this page. */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 shrink-0 text-[11px] text-[#999] truncate">{label}</span>
      <div className="flex-1 h-2 bg-[#1a1a1a] rounded overflow-hidden">
        <div className="h-full bg-[#dc2626] rounded" style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] text-white font-bold">{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Page shell
// ══════════════════════════════════════════════════════════════════════════════

type Tab = "campaigns" | "editor" | "preview" | "analytics";

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("campaigns");
  /** null = creating. Drives the editor, preview and analytics tabs. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: overview } = useAdAnalyticsOverview();
  const o = overview?.data;
  const queryClient = useQueryClient();

  // Realtime (§12). Two admins editing campaigns at once is the normal case
  // here, and so is a campaign flipping itself to `completed` when it hits its
  // impression cap — neither is visible without this, and a stale list is how
  // one admin re-activates a campaign the other just paused.
  useEffect(() => {
    let mounted = true;
    const onUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["ad-campaign"] });
      queryClient.invalidateQueries({ queryKey: ["ad-analytics-overview"] });
    };
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on("admin:ad_campaign_updated", onUpdated);
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off("admin:ad_campaign_updated", onUpdated));
    };
  }, [queryClient]);

  const openEditor = (id: string | null) => { setSelectedId(id); setTab("editor"); };
  const openPreview = (id: string) => { setSelectedId(id); setTab("preview"); };
  const openAnalytics = (id: string) => { setSelectedId(id); setTab("analytics"); };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "campaigns", label: "Campaigns", icon: Megaphone },
    { id: "editor", label: selectedId ? "Edit" : "Create", icon: Edit2 },
    { id: "preview", label: "Preview", icon: Monitor },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <Megaphone className="text-[#dc2626]" size={24} /> Ad Campaigns
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Fullscreen advertisement campaigns for the member web app and mobile app.
            </p>
          </div>
          <button onClick={() => openEditor(null)} className={btnPrimary}>
            <Plus size={12} /> New Campaign
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          <StatChip label="Campaigns" value={o?.totalCampaigns ?? "—"} />
          <StatChip label="Active" value={o?.activeCampaigns ?? "—"} />
          <StatChip label="Impressions" value={o?.totalImpressions ?? "—"} />
          <StatChip label="CTA Clicks" value={o?.totalClicks ?? "—"} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors " +
                  (active ? "border-[#dc2626] text-white" : "border-transparent text-[#888] hover:text-white")
                }
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "campaigns" && (
          <CampaignsTab
            onEdit={openEditor}
            onPreview={openPreview}
            onAnalytics={openAnalytics}
          />
        )}
        {tab === "editor" && (
          <CampaignEditor
            key={selectedId ?? "new"}
            campaignId={selectedId}
            onSaved={(id) => { setSelectedId(id); setTab("campaigns"); }}
            onPreview={() => setTab("preview")}
            onCancel={() => setTab("campaigns")}
          />
        )}
        {tab === "preview" && <PreviewTab campaignId={selectedId} />}
        {tab === "analytics" && (
          <AnalyticsTab campaignId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Campaigns tab
// ══════════════════════════════════════════════════════════════════════════════

function CampaignsTab({
  onEdit, onPreview, onAnalytics,
}: {
  onEdit: (id: string | null) => void;
  onPreview: (id: string) => void;
  onAnalytics: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [mediaType, setMediaType] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [placement, setPlacement] = useState<string>("");
  const [triggerType, setTriggerType] = useState<string>("");
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const limit = 20;
  const params = useMemo(
    () => ({
      page, limit,
      ...(includeDeleted ? { includeDeleted: true } : {}),
      ...(search ? { search } : {}),
      ...(status ? { status: status as AdCampaignStatus } : {}),
      ...(mediaType ? { mediaType: mediaType as "image" | "video" } : {}),
      ...(platform ? { platform: platform as "web" | "mobile" } : {}),
      ...(placement ? { placement } : {}),
      ...(triggerType ? { triggerType } : {}),
      ...(startFrom ? { startFrom: toIso(`${startFrom}T00:00`) } : {}),
      ...(startTo ? { startTo: toIso(`${startTo}T23:59`) } : {}),
    }),
    [page, search, status, mediaType, platform, placement, triggerType, startFrom, startTo, includeDeleted],
  );

  const { data, isLoading } = useListAdCampaigns(params);
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const statusMut = useUpdateAdCampaignStatus();
  const duplicate = useDuplicateAdCampaign();
  const del = useDeleteAdCampaign();

  // Any filter change invalidates the current page number.
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  const changeStatus = async (id: string, next: AdCampaignStatus) => {
    try {
      await statusMut.mutateAsync({ id, status: next });
      toast.success(`Campaign ${next}`);
    } catch (err: any) {
      // NOT_ACTIVATABLE carries the specific reason (missing media, end date in
      // the past, skip longer than the creative). Show it verbatim — a generic
      // "failed" here forces the admin to guess which of eleven fields is wrong.
      toast.error(apiError(err, "Status change failed"));
    }
  };

  const onDuplicate = async (id: string) => {
    try {
      const res: any = await duplicate.mutateAsync(id);
      toast.success(`Duplicated as ${res?.data?.campaignCode ?? "copy"}`);
    } catch (err: any) {
      toast.error(apiError(err, "Duplicate failed"));
    }
  };

  /** Soft delete — the default. The row keeps its impressions and events and can
   *  be found again with "Show deleted". */
  const onDelete = async (row: any) => {
    if (!confirm(`Delete "${row.name}"? It stops serving immediately. Impressions and analytics are kept, and you can find it again with "Show deleted".`)) return;
    try {
      await del.mutateAsync({ id: row.id, hard: false });
      toast.success("Campaign deleted");
    } catch (err: any) {
      toast.error(apiError(err, "Delete failed"));
    }
  };

  /**
   * Hard delete. Only offered on already-soft-deleted rows, because it is
   * irreversible in a way the rest of this page is not: impressions and events
   * cascade away with the campaign, and the Bunny creative is reaped unless a
   * duplicate still points at it. Two steps, not one, on purpose.
   */
  const onPurge = async (row: any) => {
    if (!confirm(`Permanently delete "${row.name}"?\n\nThis also deletes its impressions and events, and cannot be undone.`)) return;
    try {
      const res: any = await del.mutateAsync({ id: row.id, hard: true });
      // The backend reports what happened to the Bunny creative rather than
      // swallowing it: "still_referenced" is a normal outcome (a duplicate
      // shares the video), "delete_failed" means an orphaned asset someone has
      // to reap by hand — neither should look like a silent success.
      const media = res?.data?.media;
      if (media?.reason === "still_referenced") {
        toast.success("Campaign purged — video kept, another campaign still uses it");
      } else if (media?.reason === "delete_failed") {
        toast("Campaign purged, but the Bunny video could not be deleted — remove it manually", { icon: "⚠️" });
      } else {
        toast.success("Campaign purged");
      }
    } catch (err: any) {
      toast.error(apiError(err, "Permanent delete failed"));
    }
  };

  return (
    <>
      {/* Filters */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input
              value={search}
              onChange={(e) => setFilter(() => setSearch(e.target.value))}
              placeholder="Search name or code"
              className={inputCls + " pl-9"}
            />
          </div>
          <select value={status} onChange={(e) => setFilter(() => setStatus(e.target.value))} className={inputCls}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={mediaType} onChange={(e) => setFilter(() => setMediaType(e.target.value))} className={inputCls}>
            <option value="">All media</option>
            {MEDIA_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={platform} onChange={(e) => setFilter(() => setPlatform(e.target.value))} className={inputCls}>
            <option value="">All platforms</option>
            {PLATFORMS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={placement} onChange={(e) => setFilter(() => setPlacement(e.target.value))} className={inputCls}>
            <option value="">All placements</option>
            {PLACEMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={triggerType} onChange={(e) => setFilter(() => setTriggerType(e.target.value))} className={inputCls}>
            <option value="">All triggers</option>
            {TRIGGER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-widest font-rajdhani">Starts from</span>
            <input type="date" value={startFrom} onChange={(e) => setFilter(() => setStartFrom(e.target.value))} className={inputCls} />
          </div>
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-widest font-rajdhani">Starts before</span>
            <input type="date" value={startTo} onChange={(e) => setFilter(() => setStartTo(e.target.value))} className={inputCls} />
          </div>
        </div>
        <div className="mt-3">
          <Check label="Show deleted" checked={includeDeleted}
            onChange={(v) => setFilter(() => setIncludeDeleted(v))} />
        </div>
        {(platform || placement) && (
          <p className="text-[10px] text-[#777] mt-3">
            Platform and placement live inside JSON columns, so the backend filters them within the
            current page — page counts stay whole-result counts.
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(180px,2fr)_90px_90px_110px_100px_100px_70px_90px_1fr] gap-2 px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Campaign</span>
          <span>Media</span>
          <span>Status</span>
          <span>Window</span>
          <span>Platforms</span>
          <span>Placements</span>
          <span>Priority</span>
          <span>Impressions</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading && (
          <div className="px-4 py-10 text-center text-[#666] text-sm">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading campaigns…
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-[#666] text-sm">
            No campaigns match these filters.
          </div>
        )}

        {rows.map((c) => {
          const platforms: string[] = Array.isArray(c.targetPlatforms) ? c.targetPlatforms : [];
          const places: string[] = Array.isArray(c.placements) ? c.placements : [];
          const cap = c.maxTotalImpressions;
          return (
            <div
              key={c.id}
              className="grid grid-cols-[minmax(180px,2fr)_90px_90px_110px_100px_100px_70px_90px_1fr] gap-2 px-4 py-3 border-b border-[#222] items-center hover:bg-[#1c1c1c] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] text-white font-semibold truncate">
                  {c.name}
                  {c.deletedAt && (
                    <span className="ml-2 text-[9px] text-[#dc2626] uppercase tracking-widest font-rajdhani">deleted</span>
                  )}
                </div>
                <div className="text-[10px] text-[#666] font-mono truncate">{c.campaignCode}</div>
              </div>
              <span className="text-[11px] text-[#aaa]">{c.mediaType}</span>
              <StatusPill status={c.status} />
              <div className="text-[10px] text-[#999] leading-tight">
                {fmtDate(c.startAt)}<br />{fmtDate(c.endAt)}
              </div>
              <span className="text-[10px] text-[#999] truncate">{platforms.join(", ") || "—"}</span>
              <span className="text-[10px] text-[#999] truncate" title={places.join(", ")}>
                {places.length > 1 ? `${places[0]} +${places.length - 1}` : places[0] ?? "—"}
              </span>
              <span className="text-[11px] text-[#aaa]">{c.priority}</span>
              <span className="text-[11px] text-white">
                {c.currentImpressionCount ?? 0}
                {cap ? <span className="text-[#666]"> / {cap}</span> : null}
              </span>
              <div className="flex items-center justify-end gap-1">
                <IconBtn title="Preview" onClick={() => onPreview(c.id)}><Eye size={13} /></IconBtn>
                <IconBtn title="Analytics" onClick={() => onAnalytics(c.id)}><BarChart2 size={13} /></IconBtn>
                <IconBtn title="Edit" onClick={() => onEdit(c.id)}><Edit2 size={13} /></IconBtn>
                <IconBtn title="Duplicate" onClick={() => onDuplicate(c.id)}><Copy size={13} /></IconBtn>
                {c.status === "active" ? (
                  <IconBtn title="Pause" onClick={() => changeStatus(c.id, "paused")}><Pause size={13} /></IconBtn>
                ) : (
                  <IconBtn title="Activate" onClick={() => changeStatus(c.id, "active")}><Play size={13} /></IconBtn>
                )}
                <IconBtn title="Archive" onClick={() => changeStatus(c.id, "archived")}><Archive size={13} /></IconBtn>
                {c.deletedAt ? (
                  <IconBtn title="Delete permanently" danger onClick={() => onPurge(c)}><Trash2 size={13} /></IconBtn>
                ) : (
                  <IconBtn title="Delete" danger onClick={() => onDelete(c)}><Trash2 size={13} /></IconBtn>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-[#888]">
          {total} campaign{total === 1 ? "" : "s"} · page {page} of {pages}
        </span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btnGhost + " disabled:opacity-40"}>
            <ChevronLeft size={12} /> Prev
          </button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={btnGhost + " disabled:opacity-40"}>
            Next <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </>
  );
}

function IconBtn({
  children, title, onClick, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        "p-1.5 rounded border border-[#2a2a2a] transition-colors " +
        (danger ? "text-[#dc2626] hover:bg-[#dc2626]/10 hover:border-[#dc2626]" : "text-[#999] hover:text-white hover:border-[#444]")
      }
    >
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Editor
// ══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM = {
  campaignCode: "", name: "", description: "", priority: "0",

  mediaType: "image" as "image" | "video",
  mediaUrl: "", bunnyVideoId: "", thumbnailUrl: "", fallbackMediaUrl: "",
  mediaDurationSeconds: "", objectFit: "contain", backgroundColor: "#000000",
  autoplay: true, muted: true, loop: false,

  startAt: "", endAt: "", timezone: "Asia/Kolkata",
  dailyStartTime: "", dailyEndTime: "", activeDays: [] as number[],

  targetPlatforms: ["web", "mobile"] as string[],
  targetOs: [] as string[],
  placements: ["app_launch"] as string[],
  targetRoutes: "",
  batchIds: [] as string[],

  audienceScope: "all", audienceRoles: "", audiencePlans: "",
  audienceMemberIds: "", audienceRegions: "",

  triggerType: "app_launch",
  delaySeconds: "", afterNLaunches: "", repeatIntervalSeconds: "",

  freqMode: "unlimited", maxPerUser: "", maxPerSession: "", maxPerDay: "", minIntervalSeconds: "",
  maxTotalImpressions: "",

  skipEnabled: true, skipType: "seconds", skipValue: "5",
  closeEnabled: false, autoClose: false, autoCloseSeconds: "10",

  ctaEnabled: false, ctaText: "", ctaType: "internal_route", ctaTarget: "",
  ctaShowAfterSeconds: "", ctaOpenInNewTab: true,

  trackImpressions: true, trackPlaybackStart: true, trackSkip: true,
  trackCompletion: true, trackClick: true, trackClose: true, trackErrors: true,
};

type FormState = typeof EMPTY_FORM;

function defaultWindow(): { startAt: string; endAt: string } {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  return { startAt: toLocalInput(now.toISOString()), endAt: toLocalInput(later.toISOString()) };
}

function CampaignEditor({
  campaignId, onSaved, onPreview, onCancel,
}: {
  campaignId: string | null;
  onSaved: (id: string) => void;
  onPreview: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!campaignId;
  const { data: existing, isLoading } = useGetAdCampaign(campaignId ?? "");
  const { data: batchesRes } = useListBatches();
  const batches: any[] = batchesRes?.data ?? [];

  const create = useCreateAdCampaign();
  const update = useUpdateAdCampaign();

  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_FORM, ...defaultWindow() }));
  /** Once the admin edits the code by hand, stop deriving it from the name.
   *  Never auto-derive in edit mode at all (pitfall #4) — the code is the
   *  campaign's stable identifier and other records reference it. */
  const [codeManual, setCodeManual] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Hydrate from the server row in edit mode.
  useEffect(() => {
    const c = existing?.data;
    if (!c) return;
    const skip = c.skipConfig ?? {};
    const close = c.closeConfig ?? {};
    const cta = c.ctaConfig ?? {};
    const freq = c.frequencyConfig ?? {};
    const trig = c.triggerConfig ?? {};
    const aud = c.audienceConfig ?? {};
    const track = c.analyticsConfig ?? {};
    setCodeManual(true);
    setForm({
      campaignCode: c.campaignCode ?? "",
      name: c.name ?? "",
      description: c.description ?? "",
      priority: String(c.priority ?? 0),

      mediaType: (c.mediaType ?? "image") as "image" | "video",
      mediaUrl: c.mediaUrl ?? "",
      bunnyVideoId: c.bunnyVideoId ?? "",
      thumbnailUrl: c.thumbnailUrl ?? "",
      fallbackMediaUrl: c.fallbackMediaUrl ?? "",
      mediaDurationSeconds: c.mediaDurationSeconds != null ? String(c.mediaDurationSeconds) : "",
      objectFit: c.objectFit ?? "contain",
      backgroundColor: c.backgroundColor ?? "#000000",
      autoplay: c.autoplay ?? true,
      muted: c.muted ?? true,
      loop: c.loop ?? false,

      startAt: toLocalInput(c.startAt),
      endAt: toLocalInput(c.endAt),
      timezone: c.timezone ?? "Asia/Kolkata",
      dailyStartTime: c.dailyStartTime ?? "",
      dailyEndTime: c.dailyEndTime ?? "",
      activeDays: Array.isArray(c.activeDays) ? c.activeDays : [],

      targetPlatforms: Array.isArray(c.targetPlatforms) ? c.targetPlatforms : [],
      targetOs: Array.isArray(c.targetOs) ? c.targetOs : [],
      placements: Array.isArray(c.placements) ? c.placements : [],
      targetRoutes: Array.isArray(c.targetRoutes) ? c.targetRoutes.join("\n") : "",
      batchIds: Array.isArray(c.batchIds) ? c.batchIds : [],

      audienceScope: aud.scope ?? "all",
      audienceRoles: (aud.roles ?? []).join(", "),
      audiencePlans: (aud.plans ?? []).join(", "),
      audienceMemberIds: (aud.memberIds ?? []).join("\n"),
      audienceRegions: (aud.regions ?? []).join(", "),

      triggerType: c.triggerType ?? "app_launch",
      delaySeconds: trig.delaySeconds != null ? String(trig.delaySeconds) : "",
      afterNLaunches: trig.afterNLaunches != null ? String(trig.afterNLaunches) : "",
      repeatIntervalSeconds: trig.repeatIntervalSeconds != null ? String(trig.repeatIntervalSeconds) : "",

      freqMode: freq.mode ?? "unlimited",
      maxPerUser: freq.maxPerUser != null ? String(freq.maxPerUser) : "",
      maxPerSession: freq.maxPerSession != null ? String(freq.maxPerSession) : "",
      maxPerDay: freq.maxPerDay != null ? String(freq.maxPerDay) : "",
      minIntervalSeconds: freq.minIntervalSeconds != null ? String(freq.minIntervalSeconds) : "",
      maxTotalImpressions: c.maxTotalImpressions != null ? String(c.maxTotalImpressions) : "",

      skipEnabled: skip.enabled ?? false,
      skipType: skip.type ?? "seconds",
      skipValue: skip.value != null ? String(skip.value) : "",
      closeEnabled: close.enabled ?? false,
      autoClose: close.autoClose ?? false,
      autoCloseSeconds: close.autoCloseSeconds != null ? String(close.autoCloseSeconds) : "10",

      ctaEnabled: cta.enabled ?? false,
      ctaText: cta.text ?? "",
      ctaType: cta.type ?? "internal_route",
      ctaTarget: cta.target ?? "",
      ctaShowAfterSeconds: cta.showAfterSeconds != null ? String(cta.showAfterSeconds) : "",
      ctaOpenInNewTab: cta.openInNewTab ?? true,

      trackImpressions: track.trackImpressions ?? true,
      trackPlaybackStart: track.trackPlaybackStart ?? true,
      trackSkip: track.trackSkip ?? true,
      trackCompletion: track.trackCompletion ?? true,
      trackClick: track.trackClick ?? true,
      trackClose: track.trackClose ?? true,
      trackErrors: track.trackErrors ?? true,
    });
  }, [existing]);

  // ── Uploads (R2 for images, Bunny Stream for video) ─────────────────────────

  const uploadImage = useUploadImage();
  const createBunnyVideo = useCreateBunnyVideo();

  const detectDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(video.duration)); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });

  const uploadTo = async (file: File, key: string, prefix: string, field: keyof FormState) => {
    try {
      setUploading(key);
      const { publicUrl } = await uploadImage.mutateAsync({ file, pathPrefix: prefix });
      set(field, publicUrl as any);
      toast.success("Uploaded");
    } catch (err: any) {
      toast.error(apiError(err, "Upload failed"));
    } finally {
      setUploading(null);
    }
  };

  const uploadVideo = async (file: File) => {
    try {
      setUploading("video");
      setUploadPct(0);
      // Detected client-side so skip-seconds can be validated against the real
      // creative length without a round-trip (§8.2).
      const secs = await detectDuration(file);
      if (secs > 0) set("mediaDurationSeconds", String(secs));

      const { videoId, tusUploadUrl, tusHeaders, embedUrl } =
        await createBunnyVideo.mutateAsync({ title: form.name || file.name });
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
          metadata: { filetype: file.type, title: form.name || file.name },
          onProgress(sent: number, totalBytes: number) { setUploadPct(Math.round((sent / totalBytes) * 100)); },
          onSuccess() { resolve(); },
          onError(err: any) { reject(err); },
        });
        upload.start();
      });
      // hlsUrl is derived server-side from bunnyVideoId — do not build it here.
      setForm((f) => ({ ...f, mediaUrl: embedUrl, bunnyVideoId: videoId }));
      toast.success("Video uploaded to Bunny Stream");
    } catch (err: any) {
      toast.error(apiError(err, "Upload failed"));
    } finally {
      setUploading(null);
      setUploadPct(0);
    }
  };

  // ── Payload ─────────────────────────────────────────────────────────────────

  const buildPayload = () => {
    const routes = lines(form.targetRoutes);
    const os = form.targetOs;
    const audience: any = { scope: form.audienceScope };
    const roles = lines(form.audienceRoles);
    const plans = lines(form.audiencePlans);
    const memberIds = lines(form.audienceMemberIds);
    const regions = lines(form.audienceRegions);
    if (roles.length) audience.roles = roles;
    if (plans.length) audience.plans = plans;
    if (memberIds.length) audience.memberIds = memberIds;
    if (regions.length) audience.regions = regions;

    const trigger: any = {};
    if (num(form.delaySeconds) !== undefined) trigger.delaySeconds = num(form.delaySeconds);
    if (num(form.afterNLaunches) !== undefined) trigger.afterNLaunches = num(form.afterNLaunches);
    if (num(form.repeatIntervalSeconds) !== undefined) trigger.repeatIntervalSeconds = num(form.repeatIntervalSeconds);

    const frequency: any = { mode: form.freqMode };
    if (num(form.maxPerUser) !== undefined) frequency.maxPerUser = num(form.maxPerUser);
    if (num(form.maxPerSession) !== undefined) frequency.maxPerSession = num(form.maxPerSession);
    if (num(form.maxPerDay) !== undefined) frequency.maxPerDay = num(form.maxPerDay);
    if (num(form.minIntervalSeconds) !== undefined) frequency.minIntervalSeconds = num(form.minIntervalSeconds);

    return {
      campaignCode: form.campaignCode.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      priority: num(form.priority) ?? 0,

      mediaType: form.mediaType,
      mediaUrl: form.mediaUrl.trim() || null,
      bunnyVideoId: form.bunnyVideoId.trim() || null,
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      fallbackMediaUrl: form.fallbackMediaUrl.trim() || null,
      mediaDurationSeconds: num(form.mediaDurationSeconds) ?? null,
      objectFit: form.objectFit,
      backgroundColor: form.backgroundColor || null,
      autoplay: form.autoplay,
      muted: form.muted,
      loop: form.loop,

      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
      timezone: form.timezone,
      dailyStartTime: form.dailyStartTime || null,
      dailyEndTime: form.dailyEndTime || null,
      // null means "every day"; an empty array would mean "no day", which
      // silently disables the campaign.
      activeDays: form.activeDays.length ? form.activeDays : null,

      targetPlatforms: form.targetPlatforms,
      targetOs: os.length ? os : null,
      placements: form.placements,
      targetRoutes: routes.length ? routes : null,
      batchIds: form.batchIds.length ? form.batchIds : null,
      audienceConfig: audience,

      triggerType: form.triggerType,
      triggerConfig: trigger,
      frequencyConfig: frequency,
      skipConfig: {
        enabled: form.skipEnabled,
        type: form.skipType,
        ...(num(form.skipValue) !== undefined ? { value: num(form.skipValue) } : {}),
      },
      closeConfig: {
        enabled: form.closeEnabled,
        autoClose: form.autoClose,
        ...(form.autoClose && num(form.autoCloseSeconds) !== undefined
          ? { autoCloseSeconds: num(form.autoCloseSeconds) }
          : {}),
      },
      ctaConfig: form.ctaEnabled
        ? {
            enabled: true,
            text: form.ctaText.trim(),
            type: form.ctaType,
            target: form.ctaTarget.trim(),
            ...(num(form.ctaShowAfterSeconds) !== undefined
              ? { showAfterSeconds: num(form.ctaShowAfterSeconds) }
              : {}),
            openInNewTab: form.ctaOpenInNewTab,
          }
        : { enabled: false },
      analyticsConfig: {
        trackImpressions: form.trackImpressions,
        trackPlaybackStart: form.trackPlaybackStart,
        trackSkip: form.trackSkip,
        trackCompletion: form.trackCompletion,
        trackClick: form.trackClick,
        trackClose: form.trackClose,
        trackErrors: form.trackErrors,
      },
      maxTotalImpressions: num(form.maxTotalImpressions) ?? null,
    };
  };

  /** Local mirror of the backend's cross-field rules — fast feedback only. */
  const localIssues = (): string[] => {
    const issues: string[] = [];
    if (!form.name.trim()) issues.push("Name is required");
    if (!/^[a-z0-9-]+$/.test(form.campaignCode.trim())) {
      issues.push("Campaign code must be lowercase letters, digits or hyphens");
    }
    if (!form.startAt || !form.endAt) issues.push("Start and end date are required");
    else if (new Date(form.endAt) <= new Date(form.startAt)) issues.push("End date must be after start date");
    if (form.dailyStartTime && form.dailyEndTime && form.dailyStartTime === form.dailyEndTime) {
      issues.push("Daily start and end time cannot be identical");
    }
    if (!form.targetPlatforms.length) issues.push("Pick at least one platform");
    if (!form.placements.length) issues.push("Pick at least one placement");

    const dur = num(form.mediaDurationSeconds);
    if (form.mediaType === "image") {
      if (!form.mediaUrl.trim()) issues.push("Image campaigns need a creative");
      if (!dur) issues.push("Image campaigns need a display duration");
    } else if (!form.mediaUrl.trim() && !form.bunnyVideoId.trim()) {
      issues.push("Video campaigns need an uploaded video or a Bunny video id");
    }

    if (form.skipEnabled && form.skipType === "seconds") {
      const v = num(form.skipValue);
      if (v === undefined) issues.push("Skip seconds is required");
      else if (dur && v > dur) issues.push("Skip seconds cannot exceed the media duration");
    }
    if (form.skipEnabled && form.skipType === "percent") {
      const v = num(form.skipValue);
      if (v === undefined || v < 0 || v > 100) issues.push("Skip percentage must be 0–100");
    }
    const priority = num(form.priority);
    if (priority === undefined || priority < 0 || priority > 1000) {
      issues.push("Priority must be between 0 and 1000");
    }
    const cap = num(form.maxTotalImpressions);
    if (cap !== undefined && cap < 0) issues.push("Impression cap cannot be negative");

    // The backend validates the timezone by asking Intl to use it; the browser
    // has the same Intl, so the same check works here without shipping a list
    // that would go stale.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: form.timezone });
    } catch {
      issues.push(`"${form.timezone}" is not a valid IANA timezone`);
    }

    if (form.ctaEnabled) {
      const target = form.ctaTarget.trim();
      if (!form.ctaText.trim()) issues.push("CTA text is required");
      if (!target) issues.push("CTA target is required");
      else if (form.ctaType === "external_url") {
        const lowered = target.toLowerCase();
        const dangerous = DANGEROUS_URL_SCHEMES.find((s) => lowered.startsWith(s));
        if (dangerous) issues.push(`"${dangerous}" URLs are not allowed — use http:// or https://`);
        else if (!/^https?:\/\//i.test(target)) {
          issues.push("External CTA must be an http:// or https:// URL");
        }
      } else if (!target.startsWith("/") || target.startsWith("//")) {
        issues.push('Internal CTA must start with "/" and cannot start with "//"');
      } else {
        // Query and fragment are legitimate on a CTA target; match on path only.
        const path = target.split(/[?#]/)[0];
        const known = KNOWN_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
        if (!known) issues.push(`"${path}" is not a known app route`);
      }
    }
    return issues;
  };

  const save = async () => {
    const issues = localIssues();
    if (issues.length) { toast.error(issues[0]); return; }
    const payload = buildPayload();
    try {
      if (isEdit && campaignId) {
        await update.mutateAsync({ id: campaignId, ...payload });
        toast.success("Campaign updated");
        onSaved(campaignId);
      } else {
        const res: any = await create.mutateAsync(payload);
        const id = res?.data?.id;
        toast.success("Campaign created as draft — activate it from the list when ready");
        if (id) onSaved(id);
      }
    } catch (err: any) {
      toast.error(apiError(err, "Save failed"));
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="px-4 py-10 text-center text-[#666] text-sm">
        <Loader2 className="animate-spin inline mr-2" size={16} /> Loading campaign…
      </div>
    );
  }

  const saving = create.isPending || update.isPending;
  const issues = localIssues();

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px] text-[#888]">
          {isEdit ? (
            <>Editing <span className="text-white font-semibold">{form.name || "campaign"}</span></>
          ) : (
            <>New campaign — created as a <span className="text-white">draft</span>; activation runs a full validation pass.</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className={btnGhost}>Cancel</button>
          <button onClick={onPreview} className={btnGhost}><Monitor size={12} /> Preview</button>
          <button onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="bg-[#dc2626]/10 border border-[#dc2626]/40 rounded-lg px-4 py-3 mb-4">
          <div className="text-[11px] font-bold text-[#dc2626] uppercase tracking-widest font-rajdhani mb-1">
            {issues.length} thing{issues.length === 1 ? "" : "s"} to fix before this can go live
          </div>
          <ul className="text-[11px] text-[#e5a0a0] list-disc pl-4 space-y-0.5">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      )}

      {/* ── Basic ── */}
      <Section title="Basic">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  // Create mode only, and only until the admin touches the code.
                  campaignCode: !isEdit && !codeManual ? toCode(name) : f.campaignCode,
                }));
              }}
              placeholder="Diwali Promo"
            />
          </div>
          <div>
            <label className={labelCls}>Campaign code</label>
            <input
              className={inputCls + " font-mono"}
              value={form.campaignCode}
              onChange={(e) => { setCodeManual(true); set("campaignCode", toCode(e.target.value)); }}
              placeholder="diwali-promo"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              className={textareaCls}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Internal note — not shown to members."
            />
          </div>
          <div>
            <label className={labelCls}>Priority (higher wins)</label>
            <input type="number" min={0} max={1000} className={inputCls}
              value={form.priority} onChange={(e) => set("priority", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Max total impressions (blank = uncapped)</label>
            <input type="number" min={0} className={inputCls}
              value={form.maxTotalImpressions} onChange={(e) => set("maxTotalImpressions", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* ── Media ── */}
      <Section
        title="Media"
        hint="Images upload to R2 and are converted to WebP. Video uploads to Bunny Stream; the HLS URL is derived server-side."
      >
        <div className="flex gap-6 mb-4">
          {MEDIA_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={form.mediaType === t} onChange={() => set("mediaType", t)}
                className="accent-[#dc2626]" />
              <span className="text-[12px] text-[#ccc] capitalize">{t}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.mediaType === "image" ? (
            <UploadField
              label="Creative (image)"
              value={form.mediaUrl}
              accept="image/*"
              busy={uploading === "media"}
              onPick={(f) => uploadTo(f, "media", "ads/creatives", "mediaUrl")}
              onClear={() => set("mediaUrl", "")}
            />
          ) : (
            <div>
              <label className={labelCls}>Creative (video)</label>
              <div className="flex items-center gap-2">
                <FilePicker accept="video/*" busy={uploading === "video"} onPick={uploadVideo} />
                {uploading === "video" && (
                  <span className="text-[11px] text-[#888]">{uploadPct}%</span>
                )}
              </div>
              {form.bunnyVideoId && (
                <p className="text-[10px] text-[#666] mt-2 font-mono truncate">
                  bunny: {form.bunnyVideoId}
                </p>
              )}
            </div>
          )}

          <UploadField
            label="Thumbnail / poster"
            value={form.thumbnailUrl}
            accept="image/*"
            busy={uploading === "thumb"}
            onPick={(f) => uploadTo(f, "thumb", "ads/thumbnails", "thumbnailUrl")}
            onClear={() => set("thumbnailUrl", "")}
          />

          <UploadField
            label="Fallback image (shown if the creative fails to load)"
            value={form.fallbackMediaUrl}
            accept="image/*"
            busy={uploading === "fallback"}
            onPick={(f) => uploadTo(f, "fallback", "ads/fallbacks", "fallbackMediaUrl")}
            onClear={() => set("fallbackMediaUrl", "")}
          />

          <div>
            <label className={labelCls}>
              Duration in seconds {form.mediaType === "image" ? "(required)" : "(auto-detected)"}
            </label>
            <input type="number" min={0} className={inputCls}
              value={form.mediaDurationSeconds} onChange={(e) => set("mediaDurationSeconds", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Media URL</label>
            <input className={inputCls} value={form.mediaUrl}
              onChange={(e) => set("mediaUrl", e.target.value)}
              placeholder="https://…" />
          </div>

          <div>
            <label className={labelCls}>Object fit</label>
            <select className={inputCls} value={form.objectFit} onChange={(e) => set("objectFit", e.target.value)}>
              {OBJECT_FITS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Background colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.backgroundColor || "#000000"}
                onChange={(e) => set("backgroundColor", e.target.value)}
                className="h-11 w-14 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" />
              <input className={inputCls} value={form.backgroundColor}
                onChange={(e) => set("backgroundColor", e.target.value)} />
            </div>
          </div>

          <div className="flex items-end gap-6 pb-1">
            <Check label="Autoplay" checked={form.autoplay} onChange={(v) => set("autoplay", v)} />
            <Check label="Muted" checked={form.muted} onChange={(v) => set("muted", v)} />
            <Check label="Loop" checked={form.loop} onChange={(v) => set("loop", v)} />
          </div>
        </div>
      </Section>

      {/* ── Schedule ── */}
      <Section
        title="Schedule"
        hint="Start and end are absolute instants. The daily window and active days are wall-clock rules evaluated in the campaign timezone."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Starts</label>
            <input type="datetime-local" className={inputCls} value={form.startAt}
              onChange={(e) => set("startAt", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Ends</label>
            <input type="datetime-local" className={inputCls} value={form.endAt}
              onChange={(e) => set("endAt", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Timezone</label>
            <input className={inputCls} list="ad-timezones" value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)} />
            <datalist id="ad-timezones">
              {TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Daily window start (HH:mm)</label>
            <input type="time" className={inputCls} value={form.dailyStartTime}
              onChange={(e) => set("dailyStartTime", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Daily window end (HH:mm)</label>
            <input type="time" className={inputCls} value={form.dailyEndTime}
              onChange={(e) => set("dailyEndTime", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Active days (none selected = every day)</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {DAY_LABELS.map((d, i) => (
                <Check
                  key={d}
                  label={d}
                  checked={form.activeDays.includes(i)}
                  onChange={(on) =>
                    set("activeDays", on
                      ? [...form.activeDays, i].sort((a, b) => a - b)
                      : form.activeDays.filter((x) => x !== i))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Platforms ── */}
      <Section title="Platforms">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Platforms (at least one)</label>
            <CheckGroup
              options={PLATFORMS.map((p) => ({ id: p, label: p }))}
              values={form.targetPlatforms}
              onChange={(v) => set("targetPlatforms", v)}
            />
          </div>
          <div>
            <label className={labelCls}>Operating systems (none = all)</label>
            <CheckGroup
              options={OS_LIST.map((p) => ({ id: p, label: p }))}
              values={form.targetOs}
              onChange={(v) => set("targetOs", v)}
            />
          </div>
        </div>
      </Section>

      {/* ── Placement ── */}
      <Section title="Placement" hint="Placement is where the ad may appear; routes narrow it further within that placement.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Placements (at least one)</label>
            <CheckGroup
              options={PLACEMENTS.map((p) => ({ id: p, label: p }))}
              values={form.placements}
              onChange={(v) => set("placements", v)}
            />
          </div>
          <div>
            <label className={labelCls}>Target routes — one per line, `/prefix/*` allowed (blank = any)</label>
            <textarea className={textareaCls} value={form.targetRoutes}
              onChange={(e) => set("targetRoutes", e.target.value)}
              placeholder={"/dashboard\n/courses/*"} />
          </div>
        </div>
      </Section>

      {/* ── Trigger ── */}
      <Section title="Trigger">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Trigger type</label>
            <select className={inputCls} value={form.triggerType} onChange={(e) => set("triggerType", e.target.value)}>
              {TRIGGER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Delay (seconds into session)</label>
            <input type="number" min={0} className={inputCls} value={form.delaySeconds}
              onChange={(e) => set("delaySeconds", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>After N launches</label>
            <input type="number" min={1} className={inputCls} value={form.afterNLaunches}
              onChange={(e) => set("afterNLaunches", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Repeat interval (seconds)</label>
            <input type="number" min={0} className={inputCls} value={form.repeatIntervalSeconds}
              onChange={(e) => set("repeatIntervalSeconds", e.target.value)} />
          </div>
        </div>
        {!TRIGGER_TYPES.find((t) => t.id === form.triggerType)?.ready && (
          <p className="text-[11px] text-[#f59e0b] mt-3">
            No client emits this trigger yet — the campaign will save and validate, but never fire.
          </p>
        )}
      </Section>

      {/* ── Audience ── */}
      <Section title="Audience" hint="Any narrowing rule below implies a signed-in member; guests can never match one.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Scope</label>
            <select className={inputCls} value={form.audienceScope} onChange={(e) => set("audienceScope", e.target.value)}>
              <option value="all">Everyone</option>
              <option value="guests">Guests only</option>
              <option value="authenticated">Signed-in members only</option>
            </select>
            {/* Confirmed product decision (speckit §17.3): the default reaches
                everyone, and narrowing is the admin's job per campaign. Said out
                loud here because "Everyone" quietly including the people who pay
                to avoid ads is the expensive way to find that out. */}
            {form.audienceScope === "all" && !form.audiencePlans.trim() && (
              <p className="text-[11px] text-[#f59e0b] mt-2">
                Includes paying members. Set Plans below to target free members only.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Plans (comma separated)</label>
            <input className={inputCls} value={form.audiencePlans}
              onChange={(e) => set("audiencePlans", e.target.value)} placeholder="premium, gold" />
          </div>
          <div>
            <label className={labelCls}>Roles (comma separated)</label>
            <input className={inputCls} value={form.audienceRoles}
              onChange={(e) => set("audienceRoles", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Regions — city or state (comma separated)</label>
            <input className={inputCls} value={form.audienceRegions}
              onChange={(e) => set("audienceRegions", e.target.value)} placeholder="Chennai, Tamil Nadu" />
          </div>
          <div>
            <label className={labelCls}>Member IDs (one per line)</label>
            <textarea className={textareaCls} value={form.audienceMemberIds}
              onChange={(e) => set("audienceMemberIds", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Batches (none = all batches)</label>
            <div className="max-h-[132px] overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
              {batches.length === 0 && <span className="text-[11px] text-[#666]">No batches</span>}
              {batches.map((b: any) => (
                <Check
                  key={b.id}
                  label={b.name ?? b.id}
                  checked={form.batchIds.includes(b.id)}
                  onChange={(on) =>
                    set("batchIds", on
                      ? [...form.batchIds, b.id]
                      : form.batchIds.filter((x) => x !== b.id))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Frequency ── */}
      <Section title="Frequency" hint="Enforced server-side against confirmed impressions. Day buckets roll over at midnight in the campaign timezone.">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className={labelCls}>Mode</label>
            <select className={inputCls} value={form.freqMode} onChange={(e) => set("freqMode", e.target.value)}>
              <option value="unlimited">Unlimited</option>
              <option value="once_per_session">Once per session</option>
              <option value="once_per_day">Once per day</option>
              <option value="once_per_user">Once per user</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Max per session</label>
            <input type="number" min={0} className={inputCls} value={form.maxPerSession}
              onChange={(e) => set("maxPerSession", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Max per day</label>
            <input type="number" min={0} className={inputCls} value={form.maxPerDay}
              onChange={(e) => set("maxPerDay", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Max per user</label>
            <input type="number" min={0} className={inputCls} value={form.maxPerUser}
              onChange={(e) => set("maxPerUser", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Min gap (seconds)</label>
            <input type="number" min={0} className={inputCls} value={form.minIntervalSeconds}
              onChange={(e) => set("minIntervalSeconds", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* ── Skip & Close ── */}
      <Section title="Skip & Close">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Check label="Skippable" checked={form.skipEnabled} onChange={(v) => set("skipEnabled", v)} />
            <div className="mt-3">
              <label className={labelCls}>Skip unlocks</label>
              <select className={inputCls} value={form.skipType} onChange={(e) => set("skipType", e.target.value)}
                disabled={!form.skipEnabled}>
                <option value="seconds">After N seconds</option>
                <option value="percent">After N% watched</option>
                <option value="immediate">Immediately</option>
                <option value="after_end">Only after it ends</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {form.skipType === "percent" ? "Percent watched" : "Seconds"}
            </label>
            <input type="number" min={0} className={inputCls} value={form.skipValue}
              onChange={(e) => set("skipValue", e.target.value)}
              disabled={!form.skipEnabled || form.skipType === "immediate" || form.skipType === "after_end"} />
          </div>
          <div>
            <Check label="Closable (X button)" checked={form.closeEnabled} onChange={(v) => set("closeEnabled", v)} />
            <div className="mt-3 space-y-3">
              <Check label="Auto-close" checked={form.autoClose} onChange={(v) => set("autoClose", v)} />
              <div>
                <label className={labelCls}>Auto-close after (seconds)</label>
                <input type="number" min={1} max={600} className={inputCls} value={form.autoCloseSeconds}
                  onChange={(e) => set("autoCloseSeconds", e.target.value)} disabled={!form.autoClose} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section title="Call to action">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-4">
            <Check label="Show a CTA button" checked={form.ctaEnabled} onChange={(v) => set("ctaEnabled", v)} />
          </div>
          <div>
            <label className={labelCls}>Button text</label>
            <input className={inputCls} value={form.ctaText} onChange={(e) => set("ctaText", e.target.value)}
              disabled={!form.ctaEnabled} placeholder="Learn More" />
          </div>
          <div>
            <label className={labelCls}>Target type</label>
            <select className={inputCls} value={form.ctaType} onChange={(e) => set("ctaType", e.target.value)}
              disabled={!form.ctaEnabled}>
              <option value="internal_route">Internal route</option>
              <option value="external_url">External URL</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Target</label>
            <input className={inputCls} value={form.ctaTarget} onChange={(e) => set("ctaTarget", e.target.value)}
              disabled={!form.ctaEnabled}
              list={form.ctaType === "internal_route" ? "ad-known-routes" : undefined}
              placeholder={form.ctaType === "internal_route" ? "/courses/abc" : "https://example.com"} />
            {form.ctaType === "internal_route" && (
              <datalist id="ad-known-routes">
                {KNOWN_ROUTE_PREFIXES.map((r) => <option key={r} value={r} />)}
              </datalist>
            )}
          </div>
          <div>
            <label className={labelCls}>Show after (seconds)</label>
            <input type="number" min={0} className={inputCls} value={form.ctaShowAfterSeconds}
              onChange={(e) => set("ctaShowAfterSeconds", e.target.value)} disabled={!form.ctaEnabled} />
            <div className="mt-3">
              <Check label="Open in new tab" checked={form.ctaOpenInNewTab}
                onChange={(v) => set("ctaOpenInNewTab", v)} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Tracking ── */}
      <Section title="Tracking" hint="Turning an event off stops the client emitting it; impressions are always recorded for cap enforcement.">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Check label="Impressions" checked={form.trackImpressions} onChange={(v) => set("trackImpressions", v)} />
          <Check label="Playback start" checked={form.trackPlaybackStart} onChange={(v) => set("trackPlaybackStart", v)} />
          <Check label="Skips" checked={form.trackSkip} onChange={(v) => set("trackSkip", v)} />
          <Check label="Completions" checked={form.trackCompletion} onChange={(v) => set("trackCompletion", v)} />
          <Check label="CTA clicks" checked={form.trackClick} onChange={(v) => set("trackClick", v)} />
          <Check label="Closes" checked={form.trackClose} onChange={(v) => set("trackClose", v)} />
          <Check label="Errors" checked={form.trackErrors} onChange={(v) => set("trackErrors", v)} />
        </div>
      </Section>

      <div className="flex items-center justify-end gap-2 pb-8">
        <button onClick={onCancel} className={btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create campaign"}
        </button>
      </div>
    </>
  );
}

function FilePicker({
  accept, busy, onPick,
}: { accept: string; busy: boolean; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={btnGhost}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {busy ? "Uploading" : "Upload"}
      </button>
    </>
  );
}

function UploadField({
  label, value, accept, busy, onPick, onClear,
}: {
  label: string; value: string; accept: string; busy: boolean;
  onPick: (f: File) => void; onClear: () => void;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <FilePicker accept={accept} busy={busy} onPick={onPick} />
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-11 w-16 object-cover rounded border border-[#2a2a2a]" />
            <button onClick={onClear} className="text-[#666] hover:text-[#dc2626]" title="Remove">
              <X size={14} />
            </button>
          </>
        ) : (
          <span className="text-[11px] text-[#666]">Nothing uploaded</span>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Preview
// ══════════════════════════════════════════════════════════════════════════════

const FRAMES: { id: string; label: string; w: number; h: number }[] = [
  { id: "mobile-portrait", label: "Mobile portrait", w: 375, h: 812 },
  { id: "mobile-landscape", label: "Mobile landscape", w: 812, h: 375 },
  { id: "tablet", label: "Tablet", w: 768, h: 1024 },
  { id: "desktop", label: "Desktop", w: 1280, h: 800 },
];

function PreviewTab({ campaignId }: { campaignId: string | null }) {
  const { data, isLoading } = useGetAdCampaign(campaignId ?? "");
  const campaign = data?.data;
  const [frame, setFrame] = useState(FRAMES[0].id);
  const [runId, setRunId] = useState(0); // bump to replay

  if (!campaignId) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-6 py-10 text-center text-[#888] text-sm">
        Pick a campaign from the list (or save the one you are editing) to preview it.
      </div>
    );
  }
  if (isLoading || !campaign) {
    return (
      <div className="px-4 py-10 text-center text-[#666] text-sm">
        <Loader2 className="animate-spin inline mr-2" size={16} /> Loading campaign…
      </div>
    );
  }

  const f = FRAMES.find((x) => x.id === frame)!;
  // Scale the frame down to fit the admin viewport without changing the
  // overlay's own layout maths — the ad still lays itself out at device size.
  const scale = Math.min(1, 560 / f.h, 900 / f.w);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {FRAMES.map((x) => (
            <button
              key={x.id}
              onClick={() => setFrame(x.id)}
              className={
                "px-3 py-2 text-[11px] font-bold uppercase tracking-widest font-rajdhani rounded-lg transition-colors " +
                (frame === x.id ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#999] hover:text-white")
              }
            >
              {x.label}
            </button>
          ))}
        </div>
        <button onClick={() => setRunId((n) => n + 1)} className={btnGhost}>Replay</button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 flex justify-center">
        <div
          className="relative overflow-hidden rounded-[20px] border-2 border-[#333] shadow-2xl shrink-0"
          style={{
            width: f.w, height: f.h,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            marginBottom: f.h * scale - f.h,
          }}
        >
          <AdPreviewSurface key={`${frame}-${runId}`} campaign={campaign} />
        </div>
      </div>

      <p className="text-[11px] text-[#777] mt-4 max-w-3xl">
        Skip, close, auto-close and CTA gating run the same rules the clients do, driven by the
        campaign&apos;s stored config. Tracking is stubbed — nothing here records an impression, and no
        frequency cap is consumed. The member clients use their own overlay component with the real
        HLS player; this preview renders the Bunny embed directly, so playback quality here is not a
        signal about playback there.
      </p>
    </>
  );
}

/**
 * The ad as a member would see it, at device size.
 *
 * The speckit asks for the user-web overlay component itself, parameterised by
 * a `preview` flag. That is not reachable from here: the overlay lives in the
 * separate `tbt-user-web` npm project and pulls in that app's API client,
 * SiteConfig strings and Plyr player. Importing across the two projects would
 * mean extracting a shared package and changing both builds. What is duplicated
 * instead is deliberately only the *gating arithmetic*, which is small and
 * mirrors `skipAvailableAfterSeconds` in the backend engine — the source of
 * truth both clients already defer to.
 */
function AdPreviewSurface({ campaign }: { campaign: any }) {
  const [elapsed, setElapsed] = useState(0);
  const [closed, setClosed] = useState<string | null>(null);

  const duration: number | null = campaign.mediaDurationSeconds ?? null;
  const skipUnlock = skipUnlockSeconds(campaign.skipConfig, duration);
  const closeCfg = campaign.closeConfig ?? {};
  const cta = campaign.ctaConfig ?? {};
  const autoCloseAt = closeCfg.autoClose ? closeCfg.autoCloseSeconds ?? null : null;

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (closed) return;
    if (autoCloseAt !== null && elapsed >= autoCloseAt) setClosed("auto-closed");
    else if (duration && !campaign.loop && elapsed >= duration) setClosed("completed");
  }, [elapsed, autoCloseAt, duration, campaign.loop, closed]);

  const skipReady = skipUnlock !== null && elapsed >= skipUnlock;
  const ctaReady = cta.enabled && elapsed >= (cta.showAfterSeconds ?? 0);

  const isBunnyEmbed = typeof campaign.mediaUrl === "string" &&
    campaign.mediaUrl.includes("mediadelivery.net");

  if (closed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-center gap-2">
        <span className="text-[#666] text-[11px] uppercase tracking-widest font-rajdhani">Ad {closed}</span>
        <span className="text-[#444] text-[11px]">Interrupted media would resume here.</span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative"
      style={{ background: campaign.backgroundColor || "#000000" }}
    >
      {campaign.mediaType === "video" ? (
        isBunnyEmbed ? (
          <iframe
            src={`${campaign.mediaUrl}${campaign.mediaUrl.includes("?") ? "&" : "?"}autoplay=${campaign.autoplay ? 1 : 0}&muted=${campaign.muted ? 1 : 0}&loop=${campaign.loop ? 1 : 0}`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video
            src={campaign.mediaUrl ?? undefined}
            poster={campaign.thumbnailUrl ?? undefined}
            autoPlay={campaign.autoplay}
            muted={campaign.muted}
            loop={campaign.loop}
            playsInline
            className="w-full h-full"
            style={{ objectFit: campaign.objectFit as any }}
          />
        )
      ) : campaign.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.mediaUrl}
          alt=""
          className="w-full h-full"
          style={{ objectFit: campaign.objectFit as any }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#555] text-sm">
          No creative uploaded
        </div>
      )}

      {/* Skip control */}
      {campaign.skipConfig?.enabled && (
        <div className="absolute top-4 right-4">
          {skipReady ? (
            <button
              onClick={() => setClosed("skipped")}
              className="bg-black/70 border border-white/30 text-white text-[12px] px-3 py-1.5 rounded-md"
            >
              Skip Ad ›
            </button>
          ) : (
            <span className="bg-black/70 text-white/80 text-[12px] px-3 py-1.5 rounded-md">
              {skipUnlock === null
                ? "Skip after the ad ends"
                : `Skip in ${Math.max(0, Math.ceil(skipUnlock - elapsed))}s`}
            </span>
          )}
        </div>
      )}

      {/* Close control */}
      {closeCfg.enabled && (
        <button
          onClick={() => setClosed("closed")}
          className="absolute top-4 left-4 bg-black/70 border border-white/30 text-white rounded-full p-1.5"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      )}

      {/* CTA */}
      {ctaReady && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <span className="bg-[#dc2626] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg shadow-lg">
            {cta.text || "Learn More"}
          </span>
        </div>
      )}

      {/* Elapsed / duration readout — preview affordance, not part of the real ad */}
      <div className="absolute bottom-2 right-3 text-[10px] text-white/50 font-mono">
        {elapsed}s{duration ? ` / ${duration}s` : ""}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Analytics
// ══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({
  campaignId, onSelect,
}: { campaignId: string | null; onSelect: (id: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(
    () => ({
      ...(from ? { from: toIso(`${from}T00:00`) } : {}),
      ...(to ? { to: toIso(`${to}T23:59`) } : {}),
    }),
    [from, to],
  );

  const { data: overviewRes } = useAdAnalyticsOverview();
  const overview = overviewRes?.data;
  const campaigns: any[] = overview?.campaigns ?? [];

  const { data: detailRes, isLoading } = useAdCampaignAnalytics(campaignId ?? "", range);
  const d = detailRes?.data;

  const maxImpressions = Math.max(1, ...campaigns.map((c: any) => c.impressions ?? 0));

  return (
    <>
      {/* Cross-campaign rollup */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 mb-4">
        <h3 className="text-[13px] font-bold text-white uppercase tracking-widest font-rajdhani mb-4">
          All campaigns
        </h3>
        {campaigns.length === 0 && <p className="text-[12px] text-[#666]">No impressions recorded yet.</p>}
        {campaigns.map((c: any) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={
              "w-full text-left px-2 py-1 rounded transition-colors " +
              (campaignId === c.id ? "bg-[#dc2626]/10" : "hover:bg-[#1c1c1c]")
            }
          >
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-[11px] text-white truncate">{c.name}</span>
              <div className="flex-1 h-2 bg-[#1a1a1a] rounded overflow-hidden">
                <div className="h-full bg-[#dc2626]" style={{ width: `${(c.impressions / maxImpressions) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-[11px] text-white">{c.impressions}</span>
              <span className="w-20 text-right text-[11px] text-[#888]">{c.clickThroughRate}% CTR</span>
            </div>
          </button>
        ))}
      </div>

      {/* Per-campaign detail */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-bold text-white uppercase tracking-widest font-rajdhani">
            {d?.campaignName ?? "Campaign detail"}
          </h3>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + " w-auto"} />
            <span className="text-[#666] text-xs">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + " w-auto"} />
          </div>
        </div>

        {!campaignId && <p className="text-[12px] text-[#666]">Select a campaign above.</p>}
        {campaignId && isLoading && (
          <p className="text-[12px] text-[#666]"><Loader2 className="animate-spin inline mr-2" size={14} /> Loading…</p>
        )}

        {campaignId && d && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
              <StatChip label="Impressions" value={d.totalImpressions} />
              <StatChip label="Unique reach" value={d.uniqueUsersReached} />
              <StatChip label="Playback starts" value={d.playbackStarts} />
              <StatChip label="Completions" value={`${d.completions} (${d.completionRate}%)`} />
              <StatChip label="Skips" value={`${d.skips} (${d.skipRate}%)`} />
              <StatChip label="CTA clicks" value={`${d.ctaClicks} (${d.clickThroughRate}%)`} />
              <StatChip label="Closes" value={d.closes} />
              <StatChip label="Playback errors" value={d.playbackErrors} />
              <StatChip label="Avg watched" value={`${d.averageWatchedSeconds}s`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Breakdown title="By day" data={d.impressionsByDay} />
              <Breakdown title="By platform" data={d.impressionsByPlatform} />
              <Breakdown title="By placement" data={d.impressionsByPlacement} />
            </div>

            <p className="text-[10px] text-[#666] mt-4">
              Impressions count only ads the client confirmed as rendered — a selection that never
              reached the screen is not counted here.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Breakdown({ title, data }: { title: string; data?: Record<string, number> }) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div>
      <h4 className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani mb-2">{title}</h4>
      {entries.length === 0 && <p className="text-[11px] text-[#666]">No data</p>}
      {entries.map(([k, v]) => <BarRow key={k} label={k} value={v} max={max} />)}
    </div>
  );
}
