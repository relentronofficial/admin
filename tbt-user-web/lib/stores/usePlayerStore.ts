import { create } from "zustand";

interface PlayerState {
  currentLessonId: string | null;
  isPlaying: boolean;
  watchedSeconds: number;
  setCurrentLesson: (lessonId: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setWatchedSeconds: (seconds: number) => void;
  resetPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentLessonId: null,
  isPlaying: false,
  watchedSeconds: 0,
  setCurrentLesson: (lessonId) => set({ currentLessonId: lessonId, watchedSeconds: 0 }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setWatchedSeconds: (seconds) => set({ watchedSeconds: seconds }),
  resetPlayer: () => set({ currentLessonId: null, isPlaying: false, watchedSeconds: 0 }),
}));
