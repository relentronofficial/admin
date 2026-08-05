"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FastForward,
  Loader2,
  Mic,
  Pause,
  Play,
  Rewind,
} from "lucide-react";

import {
  formatDuration,
  useMarkPodcastCompleted,
  usePodcastEpisode,
} from "@/lib/hooks/usePodcasts";
import { usePodcastPlayer, PODCAST_SPEEDS, type PodcastSpeed } from "@/lib/stores/usePodcastPlayer";

export default function PodcastEpisodePage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";
  const { data: episode, isLoading, isError } = usePodcastEpisode(episodeId);

  const currentId = usePodcastPlayer((s) => s.episode?.id);
  const isPlaying = usePodcastPlayer((s) => s.isPlaying);
  const position = usePodcastPlayer((s) => s.position);
  const duration = usePodcastPlayer((s) => s.duration);
  const speed = usePodcastPlayer((s) => s.speed);
  const playEpisode = usePodcastPlayer((s) => s.playEpisode);
  const togglePlay = usePodcastPlayer((s) => s.togglePlay);
  const skip = usePodcastPlayer((s) => s.skip);
  const seekTo = usePodcastPlayer((s) => s.seekTo);
  const setSpeed = usePodcastPlayer((s) => s.setSpeed);
  const markCompleted = useMarkPodcastCompleted();

  const isCurrent = !!episode && currentId === episode.id;

  // Auto-load the episode into the store when the page opens, but don't
  // autoplay — user must hit play (satisfies browser autoplay rules).
  useEffect(() => {
    if (!episode) return;
    if (currentId === episode.id) return;
    playEpisode(episode, { autoplay: false });
  }, [episode, currentId, playEpisode]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading episode…
      </div>
    );
  }

  if (isError || !episode) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Could not open this episode.</p>
        <Link
          href="/podcasts"
          className="inline-block mt-4 px-4 py-2 rounded-xl text-xs font-bold text-foreground"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          Back to podcasts
        </Link>
      </div>
    );
  }

  const total = isCurrent ? (duration || episode.durationSeconds) : episode.durationSeconds;
  const pos = isCurrent ? position : episode.progress?.currentPositionSeconds ?? 0;
  const pct = total > 0 ? Math.min(100, (pos / total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto pb-40 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/podcasts"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <span className="text-xs text-muted-foreground">Podcasts / Episode</span>
      </div>

      {/* Cover + title */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden flex-shrink-0"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {episode.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={episode.coverImage}
              alt={episode.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Mic size={64} className="text-muted-foreground opacity-30" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          {episode.series && (
            <Link
              href={`/podcasts/series/${episode.series.id}`}
              className="text-[11px] font-bold uppercase tracking-widest hover:underline"
              style={{ color: "var(--color-accent)" }}
            >
              {episode.series.title}
            </Link>
          )}
          <h1 className="text-2xl font-bold text-foreground leading-tight max-w-lg">
            {episode.title}
          </h1>
          {episode.speaker && (
            <p className="text-sm text-muted-foreground">{episode.speaker}</p>
          )}
        </div>
      </div>

      {/* Scrubber */}
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(1, total)}
          step={1}
          value={Math.min(total || 0, pos)}
          onChange={(e) => {
            if (!isCurrent) playEpisode(episode, { startAt: Number(e.target.value), autoplay: false });
            else seekTo(Number(e.target.value));
          }}
          className="w-full accent-[var(--color-accent)]"
          aria-label="Seek"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{formatDuration(pos)}</span>
          <span>{formatDuration(total)}</span>
        </div>
        <div className="text-[11px] text-muted-foreground text-center">{Math.round(pct)}%</div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => {
            if (!isCurrent) playEpisode(episode, { startAt: Math.max(0, pos - 15), autoplay: false });
            else skip(-15);
          }}
          className="p-3 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Rewind 15 seconds"
        >
          <Rewind size={24} />
        </button>
        <button
          onClick={() => {
            if (!isCurrent) playEpisode(episode);
            else togglePlay();
          }}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white"
          style={{ background: "var(--color-accent)" }}
          aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
        >
          {isCurrent && isPlaying ? (
            <Pause size={22} fill="#fff" />
          ) : (
            <Play size={22} fill="#fff" />
          )}
        </button>
        <button
          onClick={() => {
            if (!isCurrent) playEpisode(episode, { startAt: pos + 15, autoplay: false });
            else skip(15);
          }}
          className="p-3 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Forward 15 seconds"
        >
          <FastForward size={24} />
        </button>
      </div>

      {/* Speed + mark completed */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <div
          className="inline-flex rounded-full p-1"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {PODCAST_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as PodcastSpeed)}
              className="px-3 py-1 rounded-full text-[11px] font-bold"
              style={{
                color: speed === s ? "#fff" : "var(--color-text-secondary)",
                background: speed === s ? "var(--color-accent)" : "transparent",
              }}
            >
              {s}×
            </button>
          ))}
        </div>
        <button
          onClick={() => markCompleted.mutate(episode.id)}
          disabled={markCompleted.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold disabled:opacity-60"
          style={{
            color: "var(--color-text-secondary)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <CheckCircle2 size={13} /> Mark as complete
        </button>
      </div>

      {/* Metadata */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl text-xs text-muted-foreground"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {episode.category && (
          <span>
            <span className="opacity-70">Category · </span>
            <span className="text-foreground font-semibold">{episode.category.name}</span>
          </span>
        )}
        <span>
          <span className="opacity-70">Length · </span>
          <span className="text-foreground font-semibold">
            {formatDuration(episode.durationSeconds)}
          </span>
        </span>
        {episode.publishDate && (
          <span>
            <span className="opacity-70">Published · </span>
            <span className="text-foreground font-semibold">
              {new Date(episode.publishDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </span>
        )}
      </div>

      {/* Description */}
      {episode.description && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">About this episode</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {episode.description}
          </p>
        </section>
      )}

      {/* Tags */}
      {episode.tags.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {episode.tags.map((t) => (
              <span
                key={t}
                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
