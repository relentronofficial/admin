"use client";

import { useState } from "react";
import { Eye, Download, LayoutList, LayoutGrid } from "lucide-react";
import { useUserResources } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { cn } from "@/lib/utils/cn";
import type { Resource } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FileTypeIcon({ resource, large = false }: { resource: Resource; large?: boolean }) {
  const sz = large ? "w-12 h-12" : "w-6 h-6";
  if (resource.fileTypeIconUrl) {
    return (
      <img src={resource.fileTypeIconUrl} alt={resource.fileType} className={`${sz} object-contain`} />
    );
  }
  return (
    <span className={cn("font-bold text-foreground", large ? "text-lg" : "text-xs")}>
      {resource.fileType.toUpperCase().slice(0, 3)}
    </span>
  );
}

function resolveHoverIcon(iconType: string) {
  switch (iconType.toLowerCase()) {
    case "eye":
    case "preview":
      return <Eye size={14} />;
    case "download":
    default:
      return <Download size={14} />;
  }
}

// ─── List row ─────────────────────────────────────────────────────────────────

function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-accent/50 transition-colors group">
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-bg-surface)" }}
      >
        <FileTypeIcon resource={resource} />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{resource.title}</p>
          {resource.fileCount > 1 && (
            <span
              className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {resource.fileCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {resource.author && (
            <p className="text-xs text-muted-foreground">{resource.author}</p>
          )}
          {resource.author && resource.date && (
            <span className="text-muted-foreground/40 text-xs">·</span>
          )}
          {resource.date && (
            <p className="text-xs text-muted-foreground/60">{resource.date}</p>
          )}
        </div>
      </div>

      {/* Hover actions — icon buttons appear on hover */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {resource.hoverActions.map((action) => (
          <a
            key={action.type}
            href={
              action.type === "download"
                ? resource.fileUrl
                : (resource.previewUrl ?? resource.fileUrl)
            }
            target="_blank"
            rel="noopener noreferrer"
            download={action.type === "download" || undefined}
            title={action.label}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-opacity hover:opacity-80"
            style={{
              background:
                action.type === "preview"
                  ? "var(--color-bg-surface)"
                  : "var(--color-accent)",
            }}
          >
            {resolveHoverIcon(action.iconType)}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function ResourceGridCard({ resource }: { resource: Resource }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 group hover:border-accent/50 transition-colors">
      {/* Large icon tile */}
      <div
        className="w-full aspect-square rounded-lg flex items-center justify-center"
        style={{ background: "var(--color-bg-surface)" }}
      >
        <FileTypeIcon resource={resource} large />
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start gap-1.5">
          <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">{resource.title}</p>
          {resource.fileCount > 1 && (
            <span
              className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white mt-0.5"
              style={{ background: "var(--color-accent)" }}
            >
              {resource.fileCount}
            </span>
          )}
        </div>
        {resource.author && (
          <p className="text-xs text-muted-foreground">{resource.author}</p>
        )}
        {resource.date && (
          <p className="text-xs text-muted-foreground/60">{resource.date}</p>
        )}
      </div>

      {/* Actions — always visible on grid (no hover-only) */}
      <div className="flex gap-2">
        {resource.hoverActions.map((action) => (
          <a
            key={action.type}
            href={
              action.type === "download"
                ? resource.fileUrl
                : (resource.previewUrl ?? resource.fileUrl)
            }
            target="_blank"
            rel="noopener noreferrer"
            download={action.type === "download" || undefined}
            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--color-accent)" }}
          >
            {resolveHoverIcon(action.iconType)}
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ResourcesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-36 rounded animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
      <div className="h-10 rounded-lg animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
      <div className="h-5 w-48 rounded animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUserResources(search, view, page);
  const { uiStrings } = useSiteConfig();

  const resources: Resource[] = data?.resources ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const limit: number = data?.pagination?.limit ?? 20;

  if (isLoading) return <ResourcesSkeleton />;

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <h1 className="text-2xl font-bold text-foreground">
        {data?.pageTitle ?? "Resources"}
      </h1>

      {/* Search bar — full width */}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={data?.searchPlaceholder ?? ""}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent transition-colors"
      />

      {/* Metadata row: count + view toggle — same row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total} ${data?.totalLabel ?? "resources"}` : ""}
        </p>
        <div className="flex items-center gap-1">
          {(data?.viewOptions ?? ["list", "grid"]).map((v: string) => (
            <button
              key={v}
              onClick={() => setView(v as "list" | "grid")}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={
                view === v
                  ? { background: "var(--color-accent)", color: "#fff" }
                  : { color: "var(--color-fg, currentColor)" }
              }
              aria-label={v === "list" ? "List view" : "Grid view"}
            >
              {v === "list" ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {resources.length === 0 ? (
        <p className="text-muted-foreground text-sm py-10 text-center">
          {uiStrings?.noResources}
        </p>
      ) : view === "list" ? (
        <div className="space-y-2">
          {resources.map((r) => (
            <ResourceRow key={r.id} resource={r} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {resources.map((r) => (
            <ResourceGridCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-accent/5 transition-colors"
          >
            {uiStrings?.paginationPrevLabel}
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
            className="px-4 py-2 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-accent/5 transition-colors"
          >
            {uiStrings?.paginationNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}
