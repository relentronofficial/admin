"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useEpisodePlayback, usePostEpisodeProgress, useCompleteWorkshopEpisode } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import toast from "react-hot-toast";

export default function WatchPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: playback, isLoading } = useEpisodePlayback(episodeId);
  const postProgress = usePostEpisodeProgress();
  const completeEp = useCompleteWorkshopEpisode();
  const { uiStrings } = useSiteConfig();
  const [speed, setSpeed] = useState<string>("");
  const [quality, setQuality] = useState<string>("");
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Track when playback started so we can compute watched seconds for periodic posts
  const startRef = useRef<number>(Date.now());
  // Prevent posting isCompleted:false after the user already clicked Complete
  const completedRef = useRef(false);

  useEffect(() => {
    if (playback && !speed) setSpeed(playback.defaultSpeed);
    if (playback && !quality) setQuality(playback.defaultQuality);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!speed) return;
    const numericSpeed = parseFloat(speed.replace("x", ""));
    if (isNaN(numericSpeed)) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ context: "player.js", method: "setPlaybackSpeed", value: numericSpeed }),
      "*"
    );
  }, [speed]);

  // Post partial progress every 15 s so resumeAtSeconds stays fresh server-side
  useEffect(() => {
    if (!playback) return;
    startRef.current = Date.now();
    completedRef.current = false;

    const id = setInterval(() => {
      if (completedRef.current) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const watchedSeconds = playback.resumeAtSeconds + elapsed;
      postProgress.mutate({ episodeId, watchedSeconds, deltaSeconds: 15, isCompleted: false });
    }, 15_000);

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
          onClick={() => router.back()}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const hasQualityChoice = playback.qualityOptions.length > 1;
  const videoSrc = withResumeTime(normalizeBunnyUrl(playback.videoUrl), playback.resumeAtSeconds);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000" }}>
      {/* Header bar: back arrow + episode title */}
      <header className="flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button
          onClick={() => router.back()}
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

      {/* Video — centered, full width */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 gap-4">
        <VideoWatermark
          className="w-full max-w-5xl aspect-video relative"
          containerId="watch-video-root"
          showFullscreenButton={true}
        >
          <iframe
            ref={iframeRef}
            src={videoSrc}
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media"
            title={playback.title}
          />
        </VideoWatermark>

        {/* Controls bar: speed / quality / complete */}
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

          {/* Complete button */}
          {isMarkedComplete ? (
            <span
              className="ml-auto inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium"
              style={{ background: "var(--color-success)" }}
            >
              <CheckCircle2 size={13} />
              {playback.playerLabels.completeLabel}
            </span>
          ) : (
            <button
              onClick={() => {
                completedRef.current = true;
                completeEp.mutate(episodeId, {
                  onSuccess: () => {
                    setIsMarkedComplete(true);
                    qc.invalidateQueries({ queryKey: ["user", "dashboard", "continue-learning"] });
                  },
                  onError: (err) => {
                    completedRef.current = false;
                    toast.error(
                      (err as Error).message ||
                      uiStrings?.errorGeneric ||
                      "Watch more of the video first."
                    );
                  },
                });
              }}
              disabled={completeEp.isPending}
              className="ml-auto inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-opacity"
              style={{ background: "var(--color-success)" }}
            >
              {completeEp.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <CheckCircle2 size={13} />
              }
              {playback.playerLabels.completeLabel}
            </button>
          )}
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
