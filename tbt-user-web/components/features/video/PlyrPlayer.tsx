"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

// ─── Public handle exposed to parent via ref ──────────────────────────────────

export interface PlyrPlayerHandle {
  readonly currentTime: number;
  readonly duration: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlyrPlayerProps {
  hlsUrl: string;
  startAt?: number;
  speed?: number;
  className?: string;
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PlyrPlayer = forwardRef<PlyrPlayerHandle, PlyrPlayerProps>(function PlyrPlayer(
  { hlsUrl, startAt = 0, speed = 1, className, onReady, onTimeUpdate, onPlay, onPause, onEnded },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Callback refs — keep callbacks current without re-running the init effect
  const cbReady = useRef(onReady);
  const cbTimeUpdate = useRef(onTimeUpdate);
  const cbPlay = useRef(onPlay);
  const cbPause = useRef(onPause);
  const cbEnded = useRef(onEnded);
  cbReady.current = onReady;
  cbTimeUpdate.current = onTimeUpdate;
  cbPlay.current = onPlay;
  cbPause.current = onPause;
  cbEnded.current = onEnded;

  useImperativeHandle(ref, () => ({
    get currentTime() { return videoRef.current?.currentTime ?? 0; },
    get duration() { return videoRef.current?.duration ?? 0; },
  }));

  // Main init — dynamic imports keep hls.js + Plyr out of the SSR bundle
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    let destroyed = false;
    let startSet = false;

    async function init(el: HTMLVideoElement) {
      // Plyr uses export= style — normalise to a constructor regardless of bundler
      const [PlyrModule, { default: Hls }] = await Promise.all([
        import("plyr"),
        import("hls.js"),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Plyr: any = (PlyrModule as any).default ?? PlyrModule;

      if (destroyed) return;

      // Attach HLS stream
      let hls: InstanceType<typeof Hls> | null = null;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, startLevel: -1 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(el);
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        el.src = hlsUrl;
      }

      // Init Plyr — fullscreen disabled; VideoWatermark handles it to keep watermark layers in frame
      const player = new Plyr(el, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "settings", "fullscreen"],
        settings: ["speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        fullscreen: { enabled: false },
        keyboard: { global: false },
        tooltips: { controls: true, seek: true },
        invertTime: false,
      });
      playerRef.current = player;

      // Native video events — more reliable than Plyr's own event system for timeupdate
      const onLoadedMetadata = () => {
        if (!startSet && startAt > 0) {
          el.currentTime = startAt;
          startSet = true;
        }
        if (el.duration > 0) cbReady.current?.(el.duration);
      };
      const onTimeUpdate = () => cbTimeUpdate.current?.(el.currentTime);
      const onPlay = () => cbPlay.current?.();
      const onPause = () => cbPause.current?.();
      const onEnded = () => cbEnded.current?.();

      el.addEventListener("loadedmetadata", onLoadedMetadata);
      el.addEventListener("timeupdate", onTimeUpdate);
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("ended", onEnded);

      cleanupRef.current = () => {
        el.removeEventListener("loadedmetadata", onLoadedMetadata);
        el.removeEventListener("timeupdate", onTimeUpdate);
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("ended", onEnded);
        try { player.destroy(); } catch {}
        try { hls?.destroy(); } catch {}
        playerRef.current = null;
      };
    }

    init(video);

    return () => {
      destroyed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [hlsUrl, startAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply speed changes without reinitialising the player
  useEffect(() => {
    try { if (playerRef.current) playerRef.current.speed = speed; } catch {}
  }, [speed]);

  return (
    <div className={className ?? "w-full h-full bg-black"}>
      <video ref={videoRef} className="w-full h-full" playsInline crossOrigin="anonymous" />
    </div>
  );
});

export { PlyrPlayer };
