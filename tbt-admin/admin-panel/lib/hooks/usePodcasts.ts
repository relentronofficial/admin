import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

/**
 * Admin hooks for the podcast module (/api/podcasts/admin/*).
 * Response envelope is unwrapped by the axios interceptor — hooks
 * receive { success, data, meta?, error } directly. Access lists as
 * res.data, single rows as res.data.
 */

export interface PodcastCategory {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface PodcastSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  status: string;
  sortOrder: number;
}
export interface PodcastEpisode {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  seriesId: string | null;
  coverImage: string | null;
  audioUrl: string;
  durationSeconds: number;
  speaker: string | null;
  tags: string[];
  isFeatured: boolean;
  status: string;
  publishDate: string;
  sortOrder: number;
  category?: { id: string; name: string; slug: string } | null;
  series?: { id: string; title: string; slug: string } | null;
}
export interface PodcastDashboard {
  totalEpisodes: number;
  activeEpisodes: number;
  inactiveEpisodes: number;
  categories: number;
  series: number;
  totalListens: number;
}

// ── Dashboard ─────────────────────────────────────────────────────
export const usePodcastDashboard = () =>
  useQuery({
    queryKey: ["podcasts", "dashboard"],
    queryFn: async (): Promise<PodcastDashboard> => {
      const res: any = await apiClient.get("/api/podcasts/admin/dashboard");
      return res?.data;
    },
    staleTime: 30_000,
  });

// ── Categories ────────────────────────────────────────────────────
export const useListCategories = () =>
  useQuery({
    queryKey: ["podcasts", "categories"],
    queryFn: async (): Promise<PodcastCategory[]> => {
      const res: any = await apiClient.get("/api/podcasts/admin/categories");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PodcastCategory>) => {
      const res: any = await apiClient.post("/api/podcasts/admin/categories", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PodcastCategory> }) => {
      const res: any = await apiClient.put(`/api/podcasts/admin/categories/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/podcasts/admin/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

// ── Series ────────────────────────────────────────────────────────
export const useListSeries = () =>
  useQuery({
    queryKey: ["podcasts", "series"],
    queryFn: async (): Promise<PodcastSeries[]> => {
      const res: any = await apiClient.get("/api/podcasts/admin/series");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PodcastSeries>) => {
      const res: any = await apiClient.post("/api/podcasts/admin/series", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useUpdateSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PodcastSeries> }) => {
      const res: any = await apiClient.put(`/api/podcasts/admin/series/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useDeleteSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/podcasts/admin/series/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

// ── Episodes ──────────────────────────────────────────────────────
export const useListEpisodes = (params: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  seriesId?: string;
  status?: string;
} = {}) =>
  useQuery({
    queryKey: ["podcasts", "episodes", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.search) q.set("search", params.search);
      if (params.categoryId) q.set("categoryId", params.categoryId);
      if (params.seriesId) q.set("seriesId", params.seriesId);
      if (params.status) q.set("status", params.status);
      const res: any = await apiClient.get(`/api/podcasts/admin/episodes?${q.toString()}`);
      return res as { data: PodcastEpisode[]; meta: { total: number; page: number; limit: number } };
    },
    placeholderData: (prev) => prev,
  });

export const useCreateEpisode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PodcastEpisode>) => {
      const res: any = await apiClient.post("/api/podcasts/admin/episodes", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useUpdateEpisode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PodcastEpisode> }) => {
      const res: any = await apiClient.put(`/api/podcasts/admin/episodes/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useToggleEpisodeStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.put(`/api/podcasts/admin/episodes/${id}/toggle-status`);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};

export const useDeleteEpisode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/podcasts/admin/episodes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts"] }),
  });
};
