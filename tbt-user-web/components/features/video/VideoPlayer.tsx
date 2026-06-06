"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { usePlayerStore } from "@/lib/stores/usePlayerStore";
import { VideoWatermark } from "./VideoWatermark";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  lessonId: string;
  resumeAtSeconds?: number;
  onProgress?: (seconds: number) => void;
  onHeartbeat?: (currentTime: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export function VideoPlayer({ src, poster, lessonId, resumeAtSeconds = 0, onProgress, onHeartbeat, onEnded, autoPlay = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hasResumed = useRef(false);

  const { setCurrentLesson, setIsPlaying, setWatchedSeconds } = usePlayerStore();

  useEffect(() => {
    setCurrentLesson(lessonId);
    hasResumed.current = false; // Reset resume flag for new lesson
    const cleanup = () => {
      setCurrentLesson(null);
      clearInterval(heartbeatTimer.current);
    };
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration);
      if (!hasResumed.current && resumeAtSeconds > 0 && resumeAtSeconds < v.duration) {
        v.currentTime = resumeAtSeconds;
        hasResumed.current = true;
      }
    }
  };

  useEffect(() => {
    if (playing && onHeartbeat) {
      heartbeatTimer.current = setInterval(() => {
        if (videoRef.current) {
          onHeartbeat(videoRef.current.currentTime);
        }
      }, 15000);
    } else {
      clearInterval(heartbeatTimer.current);
    }
    return () => clearInterval(heartbeatTimer.current);
  }, [playing, onHeartbeat]);

  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
      setIsPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
      setIsPlaying(false);
    }
    resetHideTimer();
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    setWatchedSeconds(Math.floor(v.currentTime));
    onProgress?.(Math.floor(v.currentTime));
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <VideoWatermark
      className="video-player group cursor-pointer select-none"
      containerId="video-player-root"
    >
      <div
        ref={containerRef}
        className="w-full h-full relative"
        onMouseMove={resetHideTimer}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setPlaying(false);
            setIsPlaying(false);
            onEnded?.();
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Controls overlay */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-end transition-opacity duration-300 pointer-events-none",
            showControls ? "opacity-100" : "opacity-0",
            "bg-gradient-to-t from-black/80 via-transparent to-transparent"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div
            className="mx-4 mb-2 h-1 bg-white/30 rounded-full cursor-pointer pointer-events-auto relative"
            onClick={seek}
          >
            <div
              className="h-full bg-brand-600 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Bottom controls */}
          <div className="flex items-center gap-3 px-4 pb-4 pointer-events-auto">
            <button
              onClick={togglePlay}
              className="text-white hover:text-brand-400 transition-colors"
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <button
              onClick={() => {
                setMuted((m) => !m);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
              className="text-white hover:text-brand-400 transition-colors"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <span className="text-white text-xs font-mono ml-1">
              {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) v.currentTime = 0;
              }}
              className="text-white hover:text-brand-400 transition-colors"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => containerRef.current?.parentElement?.requestFullscreen()}
              className="text-white hover:text-brand-400 transition-colors"
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>

        {/* Play indicator */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={28} className="text-white ml-1" fill="white" />
            </div>
          </div>
        )}
      </div>
    </VideoWatermark>
  );
}
