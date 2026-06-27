"use client";

import "./plyr-theme.css";
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";

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
  autoplay?: boolean;
  className?: string;
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onSpeedChange?: (speed: number) => void;
  onError?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PlyrPlayer = forwardRef<PlyrPlayerHandle, PlyrPlayerProps>(function PlyrPlayer(
  { hlsUrl, startAt = 0, speed = 1, autoplay = false, className, onReady, onTimeUpdate, onPlay, onPause, onEnded, onSpeedChange, onError },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [seekHint, setSeekHint] = useState<{ dir: "left" | "right"; key: number } | null>(null);

  // Callback refs — keep callbacks current without re-running the init effect
  const cbReady = useRef(onReady);
  const cbTimeUpdate = useRef(onTimeUpdate);
  const cbPlay = useRef(onPlay);
  const cbPause = useRef(onPause);
  const cbEnded = useRef(onEnded);
  const cbSpeedChange = useRef(onSpeedChange);
  const cbError = useRef(onError);
  cbReady.current = onReady;
  cbTimeUpdate.current = onTimeUpdate;
  cbPlay.current = onPlay;
  cbPause.current = onPause;
  cbEnded.current = onEnded;
  cbSpeedChange.current = onSpeedChange;
  cbError.current = onError;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hls: InstanceType<typeof Hls> | null = null;
      let qualityOptions: number[] = [0]; // 0 = Auto

      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, startLevel: -1 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(el);

        // Wait for quality levels before initialising Plyr so the quality menu is populated
        let fatalDuringInit = false;
        await new Promise<void>(resolve => {
          const fallback = setTimeout(resolve, 3000);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hls!.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
            clearTimeout(fallback);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const heights = (data.levels as any[])
              .map((l: any) => l.height as number)
              .filter(h => h > 0);
            const unique = [...new Set<number>(heights)].sort((a, b) => b - a);
            if (unique.length > 0) qualityOptions = [0, ...unique];
            resolve();
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hls!.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) { clearTimeout(fallback); fatalDuringInit = true; resolve(); }
          });
        });

        if (fatalDuringInit) { cbError.current?.(); return; }
        if (destroyed) return;
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        el.src = hlsUrl;
      }

      const player = new Plyr(el, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "pip", "settings", "fullscreen"],
        settings: ["speed", "quality"],
        speed: { selected: speed ?? 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        quality: {
          default: 0,
          options: qualityOptions,
          forced: true,
          onChange: (quality: number) => {
            if (!hls) return;
            if (quality === 0) {
              hls.currentLevel = -1; // ABR auto
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const idx = hls.levels.findIndex((l: any) => l.height === quality);
              if (idx >= 0) hls.currentLevel = idx;
            }
          },
        },
        fullscreen: { enabled: false }, // VideoWatermark handles fullscreen to keep watermark layers in frame
        keyboard: { focused: true },    // arrow keys / space / f work when player is focused
        tooltips: { controls: true, seek: true },
        invertTime: false,
      });
      playerRef.current = player;

      // Fatal HLS errors during playback (e.g. stream not found, network error)
      if (hls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) cbError.current?.();
        });
      }

      // Native video events — more reliable than Plyr's own event system for timeupdate
      const onLoadedMetadata = () => {
        if (!startSet && startAt > 0) {
          el.currentTime = startAt;
          startSet = true;
        }
        if (el.duration > 0) cbReady.current?.(el.duration);
        if (autoplay) player.play().catch(() => {});
      };
      const handleTimeUpdate = () => cbTimeUpdate.current?.(el.currentTime);
      const handlePlay  = () => cbPlay.current?.();
      const handlePause = () => cbPause.current?.();
      const handleEnded = () => cbEnded.current?.();
      const handleRateChange = () => cbSpeedChange.current?.(el.playbackRate);

      // Double-tap seek on mobile (±10 s)
      let lastTap = 0;
      const handleTouchEnd = (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        const rect  = el.getBoundingClientRect();
        // Ignore taps in the bottom 20% (Plyr controls area)
        if ((touch.clientY - rect.top) / rect.height > 0.8) return;
        const now = Date.now();
        const gap = now - lastTap;
        lastTap   = now;
        if (gap > 0 && gap < 300) {
          lastTap = 0; // reset to prevent triple-tap double-seeking
          const dir = (touch.clientX - rect.left) / rect.width < 0.5 ? "left" as const : "right" as const;
          el.currentTime = dir === "left"
            ? Math.max(0, el.currentTime - 10)
            : Math.min(el.duration || 0, el.currentTime + 10);
          clearTimeout(hintTimerRef.current);
          setSeekHint({ dir, key: Date.now() });
          hintTimerRef.current = setTimeout(() => setSeekHint(null), 900);
        }
      };

      // Register ALL listeners before the manual readyState call below.
      // player.play() (called inside onLoadedMetadata) can fire the 'play' event synchronously
      // in some browsers — if handlePlay isn't registered yet it's missed and the timer never starts.
      el.addEventListener("loadedmetadata", onLoadedMetadata);
      el.addEventListener("timeupdate",     handleTimeUpdate);
      el.addEventListener("play",           handlePlay);
      el.addEventListener("pause",          handlePause);
      el.addEventListener("ended",          handleEnded);
      el.addEventListener("ratechange",     handleRateChange);
      el.addEventListener("touchend",       handleTouchEnd);
      // If loadedmetadata already fired before our listener was registered (e.g. manifest cached,
      // fired during MANIFEST_PARSED await), call it now so onReady + autoplay are not skipped.
      if (el.readyState >= 1) onLoadedMetadata();

      cleanupRef.current = () => {
        el.removeEventListener("loadedmetadata", onLoadedMetadata);
        el.removeEventListener("timeupdate",     handleTimeUpdate);
        el.removeEventListener("play",           handlePlay);
        el.removeEventListener("pause",          handlePause);
        el.removeEventListener("ended",          handleEnded);
        el.removeEventListener("ratechange",     handleRateChange);
        el.removeEventListener("touchend",       handleTouchEnd);
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
  }, [hlsUrl, autoplay]); // eslint-disable-line react-hooks/exhaustive-deps
  // startAt is intentionally excluded — the key prop (plyr-${ep.id}-${forceStartFrom}) handles
  // episode switches and rewatch-from-beginning. Including startAt causes PlyrPlayer to
  // destroy+recreate every heartbeat cycle (ep.lastWatchedSecs updates → startAt changes → effect
  // reruns → 3-second MANIFEST_PARSED wait → tracking breaks). The initial seek is done once
  // in onLoadedMetadata when the component first mounts.

  // Apply speed changes without reinitialising the player
  useEffect(() => {
    try { if (playerRef.current) playerRef.current.speed = speed; } catch {}
  }, [speed]);

  return (
    <div className={className ?? "relative w-full h-full bg-black"}>
      <video ref={videoRef} className="w-full h-full" playsInline crossOrigin="anonymous" />

      {/* Double-tap seek feedback overlay */}
      {seekHint && (
        <div
          key={seekHint.key}
          style={{
            position: "absolute",
            top: "50%",
            [seekHint.dir === "left" ? "left" : "right"]: "12%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            zIndex: 70,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            animation: "plyr-hint-fade 0.9s ease forwards",
          }}
        >
          <div style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#fff",
          }}>
            {seekHint.dir === "left" ? "«" : "»"}
          </div>
          <span style={{
            color: "#fff",
            fontSize: 11,
            fontFamily: "monospace",
            fontWeight: 700,
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          }}>
            {seekHint.dir === "left" ? "−10s" : "+10s"}
          </span>
        </div>
      )}
    </div>
  );
});

export { PlyrPlayer };
