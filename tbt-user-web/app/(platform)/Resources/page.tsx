"use client";

import { useState } from "react";
import { useUserResources } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Resource } from "@/types";

function FileTypeIcon({ resource }: { resource: Resource }) {
  if (resource.fileTypeIconUrl) {
    return (
      <img
        src={resource.fileTypeIconUrl}
        alt={resource.fileType}
        className="w-6 h-6 object-contain"
      />
    );
  }
  return (
    <span className="text-xs font-bold text-foreground">
      {resource.fileType.toUpperCase().slice(0, 3)}
    </span>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-accent/50 transition-colors group">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-bg-surface)" }}
      >
        <FileTypeIcon resource={resource} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{resource.title}</p>
        <div className="flex items-center gap-2">
          {resource.author && (
            <p className="text-xs text-muted-foreground">{resource.author}</p>
          )}
          {resource.date && (
            <p className="text-xs text-muted-foreground/60">{resource.date}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {resource.hoverActions.map((action) => (
          <a
            key={action.type}
            href={action.type === "download" ? resource.fileUrl : (resource.previewUrl ?? resource.fileUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download={action.type === "download" || undefined}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
            style={{ background: action.type === "preview" ? "var(--color-bg-surface)" : "var(--color-accent)" }}
          >
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ResourceGridCard({ resource }: { resource: Resource }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-bg-surface)" }}
      >
        <FileTypeIcon resource={resource} />
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-2">{resource.title}</p>
      {resource.author && (
        <p className="text-xs text-muted-foreground">{resource.author}</p>
      )}
      {resource.date && (
        <p className="text-xs text-muted-foreground/60">{resource.date}</p>
      )}
      <div className="flex flex-wrap gap-3 mt-auto pt-1">
        {resource.hoverActions.map((action) => (
          <a
            key={action.type}
            href={action.type === "download" ? resource.fileUrl : (resource.previewUrl ?? resource.fileUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download={action.type === "download" || undefined}
            className="text-xs font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUserResources(search, view, page);
  const { uiStrings } = useSiteConfig();

  const resources: Resource[] = data?.resources ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const limit: number = data?.pagination?.limit ?? 20;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{data?.pageTitle ?? uiStrings?.loading}</h1>

      {/* Search + view toggle */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={data?.searchPlaceholder ?? ""}
          className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
        />
        {(data?.viewOptions ?? ["list", "grid"]).map((v: string) => (
          <button
            key={v}
            onClick={() => setView(v as "list" | "grid")}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-border"
            style={view === v ? { background: "var(--color-accent)", color: "white", borderColor: "var(--color-accent)" } : {}}
          >
            {v === "list" ? "≡" : "⊞"}
          </button>
        ))}
      </div>

      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          {total} {data?.totalLabel}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{uiStrings?.loading}</p>
      ) : resources.length === 0 ? (
        <p className="text-muted-foreground text-sm">{uiStrings?.noResources}</p>
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
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm border border-border disabled:opacity-40"
          >
            {uiStrings?.paginationPrevLabel}
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
            className="px-4 py-2 rounded-lg text-sm border border-border disabled:opacity-40"
          >
            {uiStrings?.paginationNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}
