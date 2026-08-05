import { create } from "zustand";
import type { PodcastEpisode } from "@/types";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const PODCAST_SPEEDS = SPEED_OPTIONS;
export type PodcastSpeed = (typeof SPEED_OPTIONS)[number];

interface PodcastPlayerState {
  episode: PodcastEpisode | null;
  isPlaying: boolean;
  position: number; // seconds
  duration: number; // seconds — falls back to episode.durationSeconds
  speed: PodcastSpeed;

  /** Ticks up when the player receives an explicit seek request from a UI
   *  control. The AudioController watches this and moves the audio.currentTime
   *  when it changes; without a signal we can't tell a state-driven position
   *  bump apart from routine <audio> timeupdate events. */
  seekSignal: number;
  seekTarget: number;

  playEpisode: (ep: PodcastEpisode, opts?: { startAt?: number; autoplay?: boolean }) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setSpeed: (speed: PodcastSpeed) => void;
  seekTo: (position: number) => void;
  skip: (deltaSeconds: number) => void;
  clear: () => void;
}

export const usePodcastPlayer = create<PodcastPlayerState>((set, get) => ({
  episode: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  speed: 1,
  seekSignal: 0,
  seekTarget: 0,

  playEpisode: (ep, opts) => {
    const startAt = opts?.startAt ?? ep.progress?.currentPositionSeconds ?? 0;
    const autoplay = opts?.autoplay ?? true;
    set({
      episode: ep,
      position: startAt,
      duration: Math.max(ep.durationSeconds, ep.progress?.totalDurationSeconds ?? 0),
      isPlaying: autoplay,
      seekSignal: get().seekSignal + 1,
      seekTarget: startAt,
    });
  },

  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setSpeed: (speed) => set({ speed }),

  seekTo: (position) => {
    const dur = get().duration || Infinity;
    const clamped = Math.max(0, Math.min(dur, position));
    set((s) => ({
      position: clamped,
      seekTarget: clamped,
      seekSignal: s.seekSignal + 1,
    }));
  },

  skip: (deltaSeconds) => {
    const { position, duration } = get();
    const target = Math.max(0, Math.min(duration || Infinity, position + deltaSeconds));
    set((s) => ({
      position: target,
      seekTarget: target,
      seekSignal: s.seekSignal + 1,
    }));
  },

  clear: () =>
    set({
      episode: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      seekSignal: 0,
      seekTarget: 0,
    }),
}));
