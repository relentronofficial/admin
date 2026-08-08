"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import type { AdCampaign } from "@/types";

export interface VideoAdViewHandle {
  /** Playhead in seconds — the authoritative clock for skip gating on video
   *  ads, so buffering can never unlock skip early. */
  getCurrentTime(): number;
  getDuration(): number;
  pause(): void;
  play(): void;
  setMuted(muted: boolean): void;
}

interface VideoAdViewProps {
  campaign: AdCampaign;
  onLoaded: (duration: number) => void;
  onPlaybackStarted: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
  /** Autoplay was rejected and we fell back to muted — surfaces the unmute
   *  affordance in the overlay chrome. */
  onMutedFallback: () => void;
}

const objectFitStyle = (fit: AdCampaign["objectFit"]): "contain" | "cover" | "fill" =>
  fit === "cover" ? "cover" : fit === "fill" ? "fill" : "contain";

/**
 * Two-tier video, mirroring the course/workshop player contract (CLAUDE.md
 * pitfall #19): a real <video> element when we have an HLS URL, and the Bunny
 * iframe otherwise.
 *
 * The <video> path is strongly preferred for ads — the iframe cannot report a
 * reliable playhead synchronously, so percent-based skip gating degrades there.
 */
const VideoAdView = forwardRef<VideoAdViewHandle, VideoAdViewProps>(function VideoAdView(
  { campaign, onLoaded, onPlaybackStarted, onTimeUpdate, onEnded, onError, onMutedFallback },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const startedRef = useRef(false);
  const hlsCleanupRef = useRef<(() => void) | null>(null);
  const [hlsFailed, setHlsFailed] = useState(false);

  const useIframe = campaign.videoType === "iframe" || hlsFailed || !campaign.mediaUrl;

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => {
      const d = videoRef.current?.duration;
      return d && Number.isFinite(d) ? d : (campaign.durationSeconds ?? 0);
    },
    pause() {
      try {
        videoRef.current?.pause();
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ context: "player.js", method: "pause" }),
          "https://iframe.mediadelivery.net",
        );
      } catch {
        /* teardown must never throw */
      }
    },
    play() {
      try {
        void videoRef.current?.play().catch(() => {});
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ context: "player.js", method: "play" }),
          "https://iframe.mediadelivery.net",
        );
      } catch {
        /* ignore */
      }
    },
    setMuted(muted: boolean) {
      if (videoRef.current) videoRef.current.muted = muted;
    },
  }));

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const duration = Number.isFinite(el.duration) ? el.duration : (campaign.durationSeconds ?? 0);
    onLoaded(duration);

    if (!campaign.autoplay) return;

    // Try with the admin's chosen sound setting first. Browsers reject
    // unmuted autoplay without a user gesture — fall back to muted rather
    // than letting the campaign flow break (speckit §9).
    el.muted = campaign.muted;
    el.play().catch(() => {
      el.muted = true;
      onMutedFallback();
      el.play().catch(() => {
        // Even muted autoplay was refused. Not fatal: the overlay still shows
        // its controls and the skip clock runs off elapsed visible time.
      });
    });
  }, [campaign.autoplay, campaign.muted, campaign.durationSeconds, onLoaded, onMutedFallback]);

  // HLS attach. hls.js is dynamically imported so it stays out of the initial
  // bundle — the vast majority of sessions never see an ad.
  useEffect(() => {
    if (useIframe) return;
    const el = videoRef.current;
    const url = campaign.mediaUrl;
    if (!el || !url) return;

    let disposed = false;

    // Safari plays HLS natively; everything else needs hls.js.
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = url;
      return;
    }

    (async () => {
      try {
        const Hls = (await import("hls.js")).default;
        if (disposed) return;
        if (!Hls.isSupported()) {
          el.src = url;
          return;
        }
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(el);
        hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal) setHlsFailed(true);
        });
        hlsCleanupRef.current = () => hls.destroy();
      } catch {
        setHlsFailed(true);
      }
    })();

    return () => {
      disposed = true;
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;
    };
  }, [campaign.mediaUrl, useIframe]);

  if (useIframe) {
    if (!campaign.bunnyVideoId) return <FailedMedia onMount={onError} />;
    return (
      <iframe
        ref={iframeRef}
        src={`https://iframe.mediadelivery.net/embed/${campaign.bunnyVideoId}?autoplay=${
          campaign.autoplay ? "true" : "false"
        }&muted=${campaign.muted ? "true" : "false"}&preload=true`}
        className="h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => onLoaded(campaign.durationSeconds ?? 0)}
        title={campaign.name}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full"
      style={{ objectFit: objectFitStyle(campaign.objectFit) }}
      poster={campaign.thumbnailUrl ?? undefined}
      loop={campaign.loop}
      playsInline
      preload="auto"
      onLoadedMetadata={handleLoadedMetadata}
      onPlay={() => {
        if (startedRef.current) return;
        startedRef.current = true;
        onPlaybackStarted();
      }}
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        const d = Number.isFinite(el.duration) ? el.duration : (campaign.durationSeconds ?? 0);
        onTimeUpdate(el.currentTime, d);
      }}
      onEnded={() => {
        // A looping ad never "ends" — the overlay closes it on its own clock.
        if (!campaign.loop) onEnded();
      }}
      onError={onError}
    />
  );
});

function FailedMedia({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}

export default VideoAdView;
