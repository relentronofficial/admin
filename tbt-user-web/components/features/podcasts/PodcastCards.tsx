"use client";

import Link from "next/link";
import { Headphones, Mic, Pause, Play } from "lucide-react";

import { formatDurationCompact, formatDuration } from "@/lib/hooks/usePodcasts";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import type { PodcastEpisode, PodcastSeries } from "@/types";
import { cn } from "@/lib/utils/cn";

// ── Episode row ─────────────────────────────────────────────────────────────

export function EpisodeRow({
  episode,
  variant = "row",
}: {
  episode: PodcastEpisode;
  variant?: "row" | "card";
}) {
  const currentId = usePodcastPlayer((s) => s.episode?.id);
  const isPlaying = usePodcastPlayer((s) => s.isPlaying);
  const playEpisode = usePodcastPlayer((s) => s.playEpisode);
  const togglePlay = usePodcastPlayer((s) => s.togglePlay);

  const isCurrent = currentId === episode.id;
  const showPause = isCurrent && isPlaying;

  const progressPct = episode.progress?.totalDurationSeconds
    ? Math.min(
        100,
        (episode.progress.currentPositionSeconds / episode.progress.totalDurationSeconds) * 100,
      )
    : 0;

  function onPlayClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) togglePlay();
    else playEpisode(episode);
  }

  if (variant === "card") {
    return (
      <Link
        href={`/podcasts/episode/${episode.id}`}
        className="flex-shrink-0 w-52 sm:w-60 space-y-2 group"
      >
        <div
          className="relative aspect-square rounded-2xl overflow-hidden"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {episode.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={episode.coverImage}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Mic size={40} className="text-muted-foreground opacity-30" />
            </div>
          )}
          <button
            onClick={onPlayClick}
            className="absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-105"
            style={{ background: "var(--color-accent)" }}
            aria-label={showPause ? "Pause" : "Play"}
          >
            {showPause ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />}
          </button>
        </div>
        <div>
          <div className="text-sm font-bold text-foreground line-clamp-2 leading-tight">
            {episode.title}
          </div>
          {episode.speaker && (
            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {episode.speaker}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1">
            {formatDurationCompact(episode.durationSeconds)}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/podcasts/episode/${episode.id}`}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-colors group",
        "hover:bg-[var(--color-surface-overlay)]",
        isCurrent && "ring-1",
      )}
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        ...(isCurrent ? { boxShadow: "0 0 0 1px var(--color-accent)" } : {}),
      }}
    >
      <div
        className="relative w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden"
        style={{ background: "var(--color-surface-overlay)" }}
      >
        {episode.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={episode.coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic size={18} className="text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground truncate">{episode.title}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {episode.speaker ? `${episode.speaker} · ` : ""}
          {formatDurationCompact(episode.durationSeconds)}
        </div>
        {progressPct > 0 && progressPct < 100 && (
          <div
            className="mt-1.5 h-1 rounded-full overflow-hidden"
            style={{ background: "var(--color-surface-overlay)" }}
          >
            <div
              className="h-full"
              style={{ width: `${progressPct}%`, background: "var(--color-accent)" }}
            />
          </div>
        )}
      </div>
      <button
        onClick={onPlayClick}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
        style={{ background: "var(--color-accent)" }}
        aria-label={showPause ? "Pause" : "Play"}
      >
        {showPause ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
      </button>
    </Link>
  );
}

// ── Continue listening card ────────────────────────────────────────────────

export function ContinueListeningCard({
  episode,
  currentPositionSeconds,
  totalDurationSeconds,
}: {
  episode: PodcastEpisode;
  currentPositionSeconds: number;
  totalDurationSeconds: number;
}) {
  const remaining = Math.max(0, totalDurationSeconds - currentPositionSeconds);
  const pct = totalDurationSeconds > 0
    ? Math.min(100, (currentPositionSeconds / totalDurationSeconds) * 100)
    : 0;
  const playEpisode = usePodcastPlayer((s) => s.playEpisode);

  return (
    <Link
      href={`/podcasts/episode/${episode.id}`}
      onClick={() => playEpisode(episode, { startAt: currentPositionSeconds })}
      className="flex-shrink-0 w-72 space-y-2 group"
    >
      <div
        className="relative aspect-[16/9] rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {episode.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={episode.coverImage}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic size={30} className="text-muted-foreground opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white"
            style={{ background: "var(--color-accent)" }}
          >
            <Play size={20} fill="#fff" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="overlay-text text-sm font-bold line-clamp-2 leading-tight">
            {episode.title}
          </div>
          <div className="overlay-meta text-[10px] mt-1 flex items-center gap-1">
            <Headphones size={10} /> {formatDurationCompact(remaining)} left
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
        </div>
      </div>
    </Link>
  );
}

// ── Series card ────────────────────────────────────────────────────────────

export function SeriesCard({ series }: { series: PodcastSeries }) {
  return (
    <Link
      href={`/podcasts/series/${series.id}`}
      className="flex-shrink-0 w-40 sm:w-48 space-y-2"
    >
      <div
        className="relative aspect-square rounded-2xl overflow-hidden group"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {series.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={series.coverImage}
            alt={series.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic size={30} className="text-muted-foreground opacity-30" />
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-bold text-foreground line-clamp-2 leading-tight">
          {series.title}
        </div>
        {series.episodesCount != null && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {series.episodesCount} episode{series.episodesCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Section row wrapper ────────────────────────────────────────────────────

export function PodcastRow({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-bold text-foreground">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-[11px] font-bold tracking-wider"
            style={{ color: "var(--color-accent)" }}
          >
            VIEW ALL →
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">{children}</div>
    </section>
  );
}

// Re-export for callers importing from this file
export { formatDuration };
