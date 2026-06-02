"use client";

import { useParams, useRouter } from "next/navigation";
import { useEpisodePlayback, usePostEpisodeProgress } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useState, useEffect } from "react";

export default function WatchPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const router = useRouter();
  const { data: playback, isLoading } = useEpisodePlayback(episodeId);
  const postProgress = usePostEpisodeProgress();
  const { uiStrings } = useSiteConfig();
  const [speed, setSpeed] = useState<string>("");
  const [quality, setQuality] = useState<string>("");

  // Initialise from API data once loaded
  useEffect(() => {
    if (playback && !speed) setSpeed(playback.defaultSpeed);
    if (playback && !quality) setQuality(playback.defaultQuality);
  }, [playback?.id]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{uiStrings?.loading}</p>
      </div>
    );

  if (!playback)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{uiStrings?.errorGeneric}</p>
      </div>
    );

  const hasQualityChoice = playback.qualityOptions.length > 1;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-bg-primary)" }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          {playback.playerLabels.backLabel}
        </button>

        <h1 className="flex-1 text-sm font-semibold text-foreground truncate">
          {playback.title}
        </h1>

        {/* Speed selector — options from API */}
        <select
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none flex-shrink-0"
        >
          {playback.speedOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Quality selector — only when multiple options (HLS mode) */}
        {hasQualityChoice && (
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none flex-shrink-0"
          >
            {playback.qualityOptions.map((q) => (
              <option key={q} value={q}>
                {q === "auto" ? playback.playerLabels.autoLabel : q}
              </option>
            ))}
          </select>
        )}

        {/* Complete button — label from API */}
        <button
          onClick={() =>
            postProgress.mutate({
              episodeId,
              watchedSeconds: playback.durationSeconds ?? undefined,
              isCompleted: true,
            })
          }
          disabled={postProgress.isPending}
          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium flex-shrink-0 disabled:opacity-60"
          style={{ background: "var(--color-success)" }}
        >
          {playback.playerLabels.completeLabel}
        </button>
      </div>

      {/* Player */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {playback.videoUrl ? (
          <iframe
            src={playback.videoUrl}
            className="w-full max-w-5xl aspect-video rounded-xl border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={playback.title}
          />
        ) : (
          <div className="w-full max-w-5xl aspect-video rounded-xl bg-black flex items-center justify-center">
            <p className="text-muted-foreground text-sm">{uiStrings?.errorGeneric}</p>
          </div>
        )}

        {/* Description — from API, shown if present */}
        {playback.description && (
          <p className="w-full max-w-5xl text-sm text-muted-foreground leading-relaxed">
            {playback.description}
          </p>
        )}
      </div>
    </div>
  );
}
