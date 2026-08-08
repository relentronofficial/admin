"use client";

import { useEffect, useRef } from "react";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { useSubmitPodcastProgress } from "@/lib/hooks/usePodcasts";
import { useRegisterMedia } from "@/lib/ads/useRegisterMedia";

const PROGRESS_INTERVAL_MS = 15_000;

/**
 * Mounts a single hidden HTML5 <audio> element and syncs it to
 * usePodcastPlayer state. Handles autoplay, position/seek, speed, and
 * periodic progress POSTs while playing.
 */
export function AudioController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const episode = usePodcastPlayer((s) => s.episode);
  const isPlaying = usePodcastPlayer((s) => s.isPlaying);
  const speed = usePodcastPlayer((s) => s.speed);
  const seekSignal = usePodcastPlayer((s) => s.seekSignal);
  const seekTarget = usePodcastPlayer((s) => s.seekTarget);

  const setPlaying = usePodcastPlayer((s) => s.setPlaying);
  const setPosition = usePodcastPlayer((s) => s.setPosition);
  const setDuration = usePodcastPlayer((s) => s.setDuration);

  const submitProgress = useSubmitPodcastProgress();
  const lastPostedPositionRef = useRef(0);
  const lastPostedAtRef = useRef(0);

  // Load a new src whenever the episode changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !episode) return;
    if (audio.src === episode.audioUrl) return;
    audio.src = episode.audioUrl;
    audio.load();
  }, [episode]);

  // Autoplay toggle.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !episode) return;
    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay was probably blocked by the browser. Reset the store
        // so the UI shows paused; the user can hit play manually.
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, episode, setPlaying]);

  // Playback speed.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  // Let the ad system pause/resume podcast audio (TBT_ADS_SPECKIT.md §7).
  //
  // Drives the STORE rather than the element directly: the `isPlaying` effect
  // above owns the element, so pausing the element alone would be immediately
  // undone on the next render. Position comes from the element because the
  // store's `position` lags by up to one timeupdate tick.
  useRegisterMedia("podcast-audio", "audio", {
    isPlaying: () => isPlaying && !!episode,
    getPosition: () => audioRef.current?.currentTime ?? 0,
    pause: () => setPlaying(false),
    resume: () => setPlaying(true),
    seek: (seconds: number) => {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = seconds;
        } catch {
          /* not seekable yet — the store position below still holds */
        }
      }
    },
  });

  // Seek target — moves audio.currentTime whenever seekSignal ticks.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(seekTarget)) return;
    // Wait for the audio to be seekable — otherwise setting currentTime
    // silently no-ops before metadata loads.
    const applySeek = () => {
      if (Math.abs(audio.currentTime - seekTarget) > 0.5) {
        try {
          audio.currentTime = seekTarget;
        } catch {
          /* ignore — browser rejects seek before metadata is ready */
        }
      }
    };
    if (audio.readyState >= 1) applySeek();
    else audio.addEventListener("loadedmetadata", applySeek, { once: true });
  }, [seekSignal, seekTarget]);

  return (
    <audio
      ref={audioRef}
      className="hidden"
      preload="metadata"
      onLoadedMetadata={(e) => {
        const el = e.currentTarget;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          setDuration(el.duration);
        }
      }}
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        setPosition(el.currentTime);

        // Post progress at most every PROGRESS_INTERVAL_MS while playing.
        if (!episode) return;
        const now = Date.now();
        const delta = Math.abs(el.currentTime - lastPostedPositionRef.current);
        if (
          now - lastPostedAtRef.current > PROGRESS_INTERVAL_MS ||
          delta > 30
        ) {
          lastPostedAtRef.current = now;
          lastPostedPositionRef.current = el.currentTime;
          const totalDurationSeconds =
            Number.isFinite(el.duration) && el.duration > 0
              ? Math.floor(el.duration)
              : episode.durationSeconds;
          submitProgress.mutate({
            episodeId: episode.id,
            currentPositionSeconds: Math.floor(el.currentTime),
            totalDurationSeconds,
            completed: false,
          });
        }
      }}
      onEnded={() => {
        setPlaying(false);
        if (!episode) return;
        submitProgress.mutate({
          episodeId: episode.id,
          currentPositionSeconds: episode.durationSeconds,
          totalDurationSeconds: episode.durationSeconds,
          completed: true,
        });
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
    />
  );
}
