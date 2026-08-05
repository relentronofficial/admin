"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { podcastsService, type EpisodeListParams } from "@/lib/api/services/podcasts.service";

export const podcastKeys = {
  categories: ["podcasts", "categories"] as const,
  episodes: (params: EpisodeListParams) => ["podcasts", "episodes", params] as const,
  episode: (id: string) => ["podcasts", "episode", id] as const,
  featuredSeries: ["podcasts", "series", "featured"] as const,
  series: (id: string) => ["podcasts", "series", id] as const,
  continueListening: ["podcasts", "continue-listening"] as const,
};

export function usePodcastCategories() {
  return useQuery({
    queryKey: podcastKeys.categories,
    queryFn: async () => (await podcastsService.listCategories()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function usePodcastEpisodes(params: EpisodeListParams = {}) {
  return useQuery({
    queryKey: podcastKeys.episodes(params),
    queryFn: async () => {
      const res = await podcastsService.listEpisodes(params);
      return { episodes: res.data ?? [], total: res.meta?.total ?? 0 };
    },
    staleTime: 60 * 1000,
  });
}

export function usePodcastEpisode(id: string) {
  return useQuery({
    queryKey: podcastKeys.episode(id),
    queryFn: async () => (await podcastsService.getEpisode(id)).data,
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useFeaturedPodcastSeries() {
  return useQuery({
    queryKey: podcastKeys.featuredSeries,
    queryFn: async () => (await podcastsService.listFeaturedSeries()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function usePodcastSeries(id: string) {
  return useQuery({
    queryKey: podcastKeys.series(id),
    queryFn: async () => (await podcastsService.getSeries(id)).data,
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useContinueListening() {
  return useQuery({
    queryKey: podcastKeys.continueListening,
    queryFn: async () => (await podcastsService.continueListening()).data ?? [],
    staleTime: 30 * 1000,
  });
}

export function useSubmitPodcastProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      episodeId: string;
      currentPositionSeconds: number;
      totalDurationSeconds: number;
      completed?: boolean;
    }) => podcastsService.submitProgress(payload),
    onSuccess: (_r, payload) => {
      qc.invalidateQueries({ queryKey: podcastKeys.episode(payload.episodeId) });
      qc.invalidateQueries({ queryKey: podcastKeys.continueListening });
    },
  });
}

export function useMarkPodcastCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: string) => podcastsService.markCompleted(episodeId),
    onSuccess: (_r, episodeId) => {
      qc.invalidateQueries({ queryKey: podcastKeys.episode(episodeId) });
      qc.invalidateQueries({ queryKey: podcastKeys.continueListening });
    },
  });
}

// ── Formatting helpers ─────────────────────────────────────────────────────

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDurationCompact(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0 min";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
