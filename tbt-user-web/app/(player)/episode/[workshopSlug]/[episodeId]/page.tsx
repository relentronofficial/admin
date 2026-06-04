"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useEpisodePlayback, usePostEpisodeProgress } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";

export default function LearningPlayerPage() {
  const { workshopSlug, episodeId } = useParams<{ workshopSlug: string; episodeId: string }>();
  const router = useRouter();
  const { data: playback, isLoading } = useEpisodePlayback(episodeId);
  const postProgress = usePostEpisodeProgress();
  const { uiStrings } = useSiteConfig();
  const [speed, setSpeed] = useState<string>("");
  const [quality, setQuality] = useState<string>("");

  const startRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    if (playback && !speed) setSpeed(playback.defaultSpeed);
    if (playback && !quality) setQuality(playback.defaultQuality);
  }, [playback?.id]);

  useEffect(() => {
    if (!playback) return;
    startRef.current = Date.now();
    completedRef.current = false;

    const id = setInterval(() => {
      if (completedRef.current) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const watchedSeconds = playback.resumeAtSeconds + elapsed;
      postProgress.mutate({ episodeId, watchedSeconds, isCompleted: false });
    }, 30_000);

    return () => clearInterval(id);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <Loader2 size={36} className="animate-spin text-white/50" />
      </div>
    );
  }

  if (!playback?.videoUrl) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "#000" }}>
        <p className="text-sm text-white/50">{uiStrings?.errorGeneric}</p>
        <button
          onClick={() => router.push(`/workshop/${workshopSlug}`)}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ← {playback?.playerLabels?.backLabel ?? "Back to workshop"}
        </button>
      </div>
    );
  }

  const hasQualityChoice = playback.qualityOptions.length > 1;
  const videoSrc = withResumeTime(normalizeBunnyUrl(playback.videoUrl), playback.resumeAtSeconds);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000" }}>
      <header className="flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button
          onClick={() => router.push(`/workshop/${workshopSlug}`)}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors flex-shrink-0"
          aria-label={playback.playerLabels.backLabel}
        >
          <ChevronLeft size={20} />
          <span className="text-sm hidden sm:inline">{playback.playerLabels.backLabel}</span>
        </button>

        <h1 className="flex-1 text-sm font-semibold text-white truncate">
          {playback.title}
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 gap-4">
        <iframe
          src={videoSrc}
          className="w-full max-w-5xl aspect-video border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={playback.title}
        />

        <div className="w-full max-w-5xl flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none border"
              style={{
                background: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              {playback.speedOptions.map((s: string) => (
                <option key={s} value={s} style={{ background: "#111" }}>{s}</option>
              ))}
            </select>

            {hasQualityChoice && (
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="text-xs rounded-lg px-2.5 py-1.5 outline-none border"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "#fff",
                }}
              >
                {playback.qualityOptions.map((q: string) => (
                  <option key={q} value={q} style={{ background: "#111" }}>
                    {q === "auto" ? playback.playerLabels.autoLabel : q}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => {
              completedRef.current = true;
              postProgress.mutate(
                {
                  episodeId,
                  watchedSeconds: playback.durationSeconds ?? undefined,
                  isCompleted: true,
                },
                {
                  onSuccess: () => router.push(`/workshop/${workshopSlug}`),
                }
              );
            }}
            disabled={postProgress.isPending}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-opacity"
            style={{ background: "var(--color-success)" }}
          >
            <CheckCircle2 size={13} />
            {playback.playerLabels.completeLabel}
          </button>
        </div>

        {playback.description && (
          <p className="w-full max-w-5xl text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            {playback.description}
          </p>
        )}
      </div>
    </div>
  );
}
