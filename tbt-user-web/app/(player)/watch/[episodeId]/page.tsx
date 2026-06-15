"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useEpisodePlayback, usePostEpisodeProgress, useCompleteWorkshopEpisode } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import { PlyrPlayer } from "@/components/features/video/PlyrPlayer";
import type { PlyrPlayerHandle } from "@/components/features/video/PlyrPlayer";
import toast from "react-hot-toast";

export default function WatchPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: playback, isLoading } = useEpisodePlayback(episodeId);
  const postProgress = usePostEpisodeProgress();
  const completeEp = useCompleteWorkshopEpisode();
  const { uiStrings } = useSiteConfig();
  const [liveRealDuration, setLiveRealDuration] = useState(0);
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const [liveCurrentTime, setLiveCurrentTime] = useState(0);

  const playerRef = useRef<PlyrPlayerHandle | null>(null);
  const completedRef = useRef(false);
  const realDurationRef = useRef(0);

  // 1-second tick: read exact currentTime from player for Complete button gating
  useEffect(() => {
    if (!playback) return;
    setLiveCurrentTime(0);
    const id = setInterval(() => {
      if (!document.hidden) setLiveCurrentTime(playerRef.current?.currentTime ?? 0);
    }, 1000);
    return () => clearInterval(id);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5s heartbeat — watchedSeconds from actual player currentTime (no clock estimation needed)
  useEffect(() => {
    if (!playback) return;
    completedRef.current = false;
    realDurationRef.current = 0;
    setLiveRealDuration(0);
    const id = setInterval(() => {
      if (completedRef.current) return;
      const watchedSeconds = Math.floor(playerRef.current?.currentTime ?? playback.resumeAtSeconds);
      postProgress.mutate({ episodeId, watchedSeconds, deltaSeconds: 5, isCompleted: false, reportedDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
    }, 5_000);
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

  const effectiveDuration = liveRealDuration || (playback as any).durationSeconds || 0;
  // canComplete: exact player currentTime vs 85% of duration; always true for iframe fallback
  const canComplete = !(playback as any).hlsUrl || !effectiveDuration || liveCurrentTime >= effectiveDuration * 0.85;
  const iframeFallbackSrc = !(playback as any).hlsUrl
    ? withResumeTime(normalizeBunnyUrl(playback.videoUrl ?? ""), playback.resumeAtSeconds)
    : null;

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
          {(playback as any).hlsUrl ? (
            <PlyrPlayer
              ref={playerRef}
              key={episodeId}
              hlsUrl={(playback as any).hlsUrl}
              startAt={playback.resumeAtSeconds}
              autoplay={true}
              className="absolute inset-0 w-full h-full bg-black"
              onReady={(duration) => { realDurationRef.current = duration; setLiveRealDuration(duration); }}
            />
          ) : iframeFallbackSrc ? (
            <iframe
              src={iframeFallbackSrc}
              className="absolute inset-x-0 top-0 w-full border-0"
              style={{ height: 'calc(100% + 56px)' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media"
              title={playback.title}
            />
          ) : null}
        </VideoWatermark>

        {/* Controls bar: complete button (speed/quality now inside Plyr's gear) */}
        <div className="w-full max-w-5xl flex items-center">
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
                completeEp.mutate({ episodeId }, {
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
              disabled={completeEp.isPending || !canComplete}
              title={!canComplete ? "Watch at least 85% of the video to complete" : undefined}
              className="ml-auto inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
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
