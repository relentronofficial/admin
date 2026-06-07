"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Clock, Play, X, ArrowRight } from "lucide-react";
import { useWatchHistory, useRemoveFromHistory } from "@/lib/hooks/useDashboard";
import { cn } from "@/lib/utils/cn";
import type { WatchHistoryItem } from "@/types";

type HistoryFilter = "all" | "in_progress" | "completed";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface WorkshopGroup {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  items: WatchHistoryItem[];
  allCompleted: boolean;
  progressPercent: number;
}

function groupByWorkshop(items: WatchHistoryItem[]): WorkshopGroup[] {
  const map = new Map<string, WorkshopGroup>();
  for (const item of items) {
    if (!map.has(item.workshopSlug)) {
      map.set(item.workshopSlug, {
        slug: item.workshopSlug,
        title: item.workshopTitle,
        thumbnailUrl: item.thumbnailUrl,
        items: [],
        allCompleted: true,
        progressPercent: 0,
      });
    }
    const g = map.get(item.workshopSlug)!;
    g.items.push(item);
    if (!item.isCompleted) g.allCompleted = false;
  }
  for (const g of map.values()) {
    const sum = g.items.reduce((a, i) => a + i.progressPercent, 0);
    g.progressPercent = Math.round(sum / g.items.length);
  }
  return Array.from(map.values());
}

function EpisodeRow({
  item,
  onRemove,
}: {
  item: WatchHistoryItem;
  onRemove: (id: string) => void;
}) {
  const href = `/workshop/${item.workshopSlug}?ep=${item.episodeId}`;
  const isCompleted = item.isCompleted;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200",
        isCompleted
          ? "border-border opacity-70 hover:opacity-90"
          : "border-border hover:border-[rgba(255,255,255,0.15)] hover:bg-white/[0.03]"
      )}
      style={isCompleted ? { borderLeftColor: "#22c55e", borderLeftWidth: 2 } : {}}
    >
      {/* Thumbnail */}
      <Link href={href} className="relative w-20 h-13 flex-shrink-0 rounded-lg overflow-hidden block" style={{ height: "52px", width: "80px" }}>
        {item.thumbnailUrl ? (
          <Image src={item.thumbnailUrl} alt={item.workshopTitle} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <Clock size={16} className="text-muted-foreground" />
          </div>
        )}
        {isCompleted ? (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={18} className="text-white" fill="white" />
          </div>
        )}
      </Link>

      {/* Info */}
      <Link href={href} className="flex-1 min-w-0 block">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {item.challengeTitle && (
              <p className="text-[10px] font-bold uppercase tracking-widest truncate font-rajdhani" style={{ color: "var(--color-accent)" }}>
                {item.challengeTitle}
              </p>
            )}
            <p className="text-sm font-semibold text-foreground truncate leading-tight mt-0.5">
              {item.episodeTitle}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ep {item.episodeOrder} of {item.episodeCount}
              {item.durationSeconds > 0 && !isCompleted && (
                <span className="ml-2 tabular-nums">
                  {fmtSecs(item.lastWatchedSecs)} / {fmtSecs(item.durationSeconds)}
                </span>
              )}
              <span className="ml-2">{relativeTime(item.updatedAt)}</span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${isCompleted ? 100 : item.progressPercent}%`,
                background: isCompleted ? "#22c55e" : "var(--color-accent)",
              }}
            />
          </div>
          {isCompleted ? (
            <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: "#22c55e" }}>
              Completed
            </span>
          ) : (
            <span className="text-[10px] font-bold whitespace-nowrap tabular-nums" style={{ color: "var(--color-accent)" }}>
              {item.progressPercent}%
            </span>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <button
          onClick={() => onRemove(item.episodeId)}
          className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
          title="Remove from history"
        >
          <X size={14} />
        </button>
        <Link
          href={href}
          className="text-xs font-bold px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
          style={{
            background: isCompleted ? "rgba(255,255,255,0.07)" : "color-mix(in srgb, var(--color-accent) 15%, transparent)",
            color: isCompleted ? "#a0a0a0" : "var(--color-accent)",
          }}
        >
          {isCompleted ? "Rewatch" : "Continue"}
        </Link>
      </div>
    </div>
  );
}

const LIMIT = 30;
const FILTER_TABS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);
  const removeFromHistory = useRemoveFromHistory();

  const { data: resp, isLoading } = useWatchHistory({
    page,
    limit: LIMIT,
    filter,
  });

  const items: WatchHistoryItem[] = Array.isArray(resp?.data) ? resp.data : [];
  const total = resp?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const groups = groupByWorkshop(items);

  const handleFilterChange = (f: HistoryFilter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tbt" className="p-2 rounded-lg transition-colors hover:bg-white/[0.05]">
          <ArrowLeft size={18} className="text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Watch History</h1>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">{total} episode{total !== 1 ? "s" : ""} watched</p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border w-fit">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className="text-xs font-bold px-4 py-2 transition-colors"
            style={{
              background: filter === key ? "var(--color-accent)" : "transparent",
              color: filter === key ? "#fff" : "#a0a0a0",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-4 rounded-xl border border-dashed border-border">
          <Clock size={40} className="text-muted-foreground opacity-30" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">No watch history</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter !== "all" ? "Try a different filter" : "Start watching to see your history here"}
            </p>
          </div>
          {filter === "all" && (
            <Link
              href="/tbt"
              className="text-sm font-bold px-5 py-2 rounded-lg transition-colors"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              Browse Content
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <div key={group.slug} className="space-y-2">
              {/* Workshop group header */}
              <div className="flex items-center justify-between gap-3 pb-1 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {group.thumbnailUrl && (
                    <div className="relative w-8 h-8 rounded-md overflow-hidden flex-shrink-0">
                      <Image src={group.thumbnailUrl} alt={group.title} fill className="object-cover" />
                    </div>
                  )}
                  <Link
                    href={`/workshop/${group.slug}`}
                    className="text-sm font-bold text-foreground truncate hover:underline"
                  >
                    {group.title}
                  </Link>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: group.allCompleted
                        ? "rgba(34,197,94,0.15)"
                        : "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                      color: group.allCompleted ? "#22c55e" : "var(--color-accent)",
                    }}
                  >
                    {group.allCompleted ? "✓ Done" : `${group.progressPercent}%`}
                  </span>
                  {group.allCompleted && (
                    <Link
                      href={`/workshop/${group.slug}`}
                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors"
                      style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                      Watch Next <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </div>

              {/* Episode rows */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <EpisodeRow
                    key={item.episodeId}
                    item={item}
                    onRemove={(id) => removeFromHistory.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-border transition-colors disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-border transition-colors disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
