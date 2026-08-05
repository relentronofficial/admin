import apiClient from "../client";
import type {
  ApiResponse,
  ContinueListeningItem,
  PodcastCategory,
  PodcastEpisode,
  PodcastProgress,
  PodcastSeries,
} from "@/types";

export interface EpisodeListParams {
  page?: number;
  limit?: number;
  category?: string;
  series?: string;
  featured?: boolean;
  search?: string;
}

export const podcastsService = {
  listCategories: () =>
    apiClient.get<never, ApiResponse<PodcastCategory[]>>("/api/podcasts/categories"),

  listEpisodes: (params: EpisodeListParams = {}) => {
    const query: Record<string, string | number> = {};
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    if (params.category) query.category = params.category;
    if (params.series) query.series = params.series;
    if (params.featured) query.featured = "true";
    if (params.search) query.search = params.search;
    return apiClient.get<never, ApiResponse<PodcastEpisode[]>>(
      "/api/podcasts/episodes",
      { params: query },
    );
  },

  getEpisode: (id: string) =>
    apiClient.get<never, ApiResponse<PodcastEpisode>>(`/api/podcasts/episodes/${id}`),

  listFeaturedSeries: () =>
    apiClient.get<never, ApiResponse<PodcastSeries[]>>("/api/podcasts/series"),

  getSeries: (id: string) =>
    apiClient.get<never, ApiResponse<{ series: PodcastSeries; episodes: PodcastEpisode[] }>>(
      `/api/podcasts/series/${id}`,
    ),

  continueListening: () =>
    apiClient.get<never, ApiResponse<ContinueListeningItem[]>>(
      "/api/podcasts/continue-listening",
    ),

  submitProgress: (payload: {
    episodeId: string;
    currentPositionSeconds: number;
    totalDurationSeconds: number;
    completed?: boolean;
  }) =>
    apiClient.post<never, ApiResponse<PodcastProgress>>("/api/podcasts/progress", {
      ...payload,
      completed: payload.completed ?? false,
    }),

  markCompleted: (episodeId: string) =>
    apiClient.post<never, ApiResponse<PodcastProgress>>("/api/podcasts/mark-completed", {
      episodeId,
    }),
};
