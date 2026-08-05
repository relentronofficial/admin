"use client";

import Link from "next/link";
import { ChevronUp, Mic, Pause, Play, Rewind, X, FastForward } from "lucide-react";

import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { formatDuration } from "@/lib/hooks/usePodcasts";

/**
 * Persistent audio player pinned to the bottom of every platform page.
 * Only renders when an episode is loaded in the store.
 */
export function MiniPlayer() {
  const episode = usePodcastPlayer((s) => s.episode);
  const isPlaying = usePodcastPlayer((s) => s.isPlaying);
  const position = usePodcastPlayer((s) => s.position);
  const duration = usePodcastPlayer((s) => s.duration);
  const togglePlay = usePodcastPlayer((s) => s.togglePlay);
  const skip = usePodcastPlayer((s) => s.skip);
  const seekTo = usePodcastPlayer((s) => s.seekTo);
  const clear = usePodcastPlayer((s) => s.clear);

  if (!episode) return null;

  const total = duration || episode.durationSeconds || 0;
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-4xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Progress line */}
        <div className="h-1 relative" style={{ background: "var(--color-surface-overlay)" }}>
          <input
            type="range"
            min={0}
            max={Math.max(1, total)}
            step={1}
            value={Math.min(total || 0, position)}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Seek"
          />
          <div
            className="h-full pointer-events-none"
            style={{ width: `${pct}%`, background: "var(--color-accent)" }}
          />
        </div>

        {/* Body */}
        <div className="flex items-center gap-3 p-2.5">
          {/* Cover */}
          <Link
            href={`/podcasts/episode/${episode.id}`}
            className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0"
            style={{ background: "var(--color-surface-overlay)" }}
          >
            {episode.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={episode.coverImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Mic size={16} className="text-muted-foreground" />
              </div>
            )}
          </Link>

          {/* Title */}
          <Link
            href={`/podcasts/episode/${episode.id}`}
            className="flex-1 min-w-0"
          >
            <div className="text-xs font-bold text-foreground truncate">{episode.title}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {episode.speaker ? `${episode.speaker} · ` : ""}
              {formatDuration(position)} / {formatDuration(total)}
            </div>
          </Link>

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => skip(-15)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Rewind 15 seconds"
            >
              <Rewind size={16} />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: "var(--color-accent)" }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
            </button>
            <button
              onClick={() => skip(15)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Forward 15 seconds"
            >
              <FastForward size={16} />
            </button>
            <Link
              href={`/podcasts/episode/${episode.id}`}
              className="hidden sm:inline-flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Open full player"
            >
              <ChevronUp size={16} />
            </Link>
            <button
              onClick={clear}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Close player"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
