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
  const [liveRealDuration, setLiveRealDuration] = useState(0);
  const [quality, setQuality] = useState<string>("");
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const liveElapsedRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Track when playback started so we can compute watched seconds for periodic posts
  const startRef = useRef<number>(Date.now());
  // Prevent posting isCompleted:false after the user already clicked Complete
  const completedRef = useRef(false);
  // Speed ref — avoids stale closure inside the 15s interval
  const speedRef = useRef(1);
  // Real duration reported by the Bunny player (overrides potentially-wrong DB value)
  const realDurationRef = useRef(0);
  // Track milliseconds the tab was hidden so they don't count toward elapsed
  const hiddenMsRef = useRef(0);
  const hiddenStartRef = useRef(0);

  useEffect(() => {
    if (playback && !speed) setSpeed(playback.defaultSpeed);
    if (playback && !quality) setQuality(playback.defaultQuality);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gap 5: 1-second tick to estimate playhead position for Complete button gating
  useEffect(() => {
    if (!playback) return;
    liveElapsedRef.current = 0;
    setLiveElapsed(0);
    const id = setInterval(() => {
      if (document.hidden) return;
      liveElapsedRef.current += 1;
      setLiveElapsed(liveElapsedRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!speed) return;
    const numericSpeed = parseFloat(speed.replace("x", ""));
    if (isNaN(numericSpeed)) return;
    speedRef.current = numericSpeed;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ context: "player.js", method: "setPlaybackSpeed", value: numericSpeed }),
      "*"
    );
  }, [speed]);

  // Listen to Bunny player events to capture real video duration
  useEffect(() => {
    if (!playback) return;
    realDurationRef.current = 0;
    setLiveRealDuration(0);
    const handler = (e: MessageEvent) => {
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg?.context !== 'player.js') return;
        const evt = (msg.event || '').toLowerCase();
        // Player signals it's ready — now safe to request duration
        if (evt === 'ready') {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ context: 'player.js', method: 'getDuration' }), '*'
          );
        }
        // getDuration response — set both ref (for heartbeat) and state (for re-render)
        if (evt === 'getduration' && typeof msg.value === 'number' && msg.value > 0) {
          realDurationRef.current = msg.value;
          setLiveRealDuration(msg.value);
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [playback?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Post partial progress every 15 s so resumeAtSeconds stays fresh server-side
  useEffect(() => {
    if (!playback) return;
    startRef.current = Date.now();
    completedRef.current = false;
    hiddenMsRef.current = 0;
    hiddenStartRef.current = 0;

    // Gap 3: track time the tab was hidden so it doesn't count toward elapsed
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenStartRef.current = Date.now();
      } else if (hiddenStartRef.current > 0) {
        hiddenMsRef.current += Date.now() - hiddenStartRef.current;
        hiddenStartRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const id = setInterval(() => {
      if (completedRef.current) return;
      // Gap 3: subtract hidden time; Gap 4: multiply by playback speed for video seconds
      const currentHiddenMs = hiddenStartRef.current > 0
        ? hiddenMsRef.current + (Date.now() - hiddenStartRef.current)
        : hiddenMsRef.current;
      const elapsed = Math.floor((Date.now() - startRef.current - currentHiddenMs) / 1000);
      const watchedSeconds = playback.resumeAtSeconds + Math.floor(elapsed * speedRef.current);
      postProgress.mutate({ episodeId, watchedSeconds, deltaSeconds: 5, isCompleted: false, reportedDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
    }, 5_000);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
  // Gap 5: disable Complete button until estimated playhead reaches 85% of duration
  const estimatedPlayhead = (playback.resumeAtSeconds ?? 0) + liveElapsed * speedRef.current;
  const effectiveDuration = liveRealDuration || (playback as any).durationSeconds || 0;
  const canComplete = !effectiveDuration || estimatedPlayhead >= effectiveDuration * 0.85;
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
            className="absolute inset-x-0 top-0 w-full border-0"
            style={{ height: 'calc(100% + 56px)' }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media"
            title={playback.title}
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ context: "player.js", method: "addEventListener", value: "ready" }), "*"
              );
            }}
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
