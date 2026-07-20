import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

// ── Types ─────────────────────────────────────────────────────────
export interface TbtLevel {
  id: string;
  levelNumber: number;
  name: string;
  description: string | null;
  requiredPoints: number;
  reward: string | null;
  sortOrder: number;
}
export interface TbtTask {
  id: string;
  taskOrder: number;
  title: string;
  description: string | null;
  requiredAction: string | null;
  rewardPoints: number;
  status: string;
  sortOrder: number;
  _count?: { completions: number };
}
export interface LeaderboardRow {
  rank: number;
  memberId: string;
  totalPoints: number;
  member: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profilePhotoUrl?: string | null;
  } | null;
}
export interface TbtDashboard {
  levels: number;
  tasks: number;
  completions: number;
  totalPointsAwarded: number;
  activeMembers: number;
}

// ── Dashboard ─────────────────────────────────────────────────────
export const useTbtDashboard = () =>
  useQuery({
    queryKey: ["tbt", "dashboard"],
    queryFn: async (): Promise<TbtDashboard> => {
      const res: any = await apiClient.get("/api/tbt/admin/dashboard");
      return res?.data;
    },
    staleTime: 30_000,
  });

// ── Levels ────────────────────────────────────────────────────────
export const useListTbtLevels = () =>
  useQuery({
    queryKey: ["tbt", "levels"],
    queryFn: async (): Promise<TbtLevel[]> => {
      const res: any = await apiClient.get("/api/tbt/admin/levels");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });
export const useCreateTbtLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TbtLevel>) => {
      const res: any = await apiClient.post("/api/tbt/admin/levels", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};
export const useUpdateTbtLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TbtLevel> }) => {
      const res: any = await apiClient.put(`/api/tbt/admin/levels/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};
export const useDeleteTbtLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/tbt/admin/levels/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};

// ── Tasks ─────────────────────────────────────────────────────────
export const useListTbtTasks = () =>
  useQuery({
    queryKey: ["tbt", "tasks"],
    queryFn: async (): Promise<TbtTask[]> => {
      const res: any = await apiClient.get("/api/tbt/admin/tasks");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });
export const useCreateTbtTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TbtTask>) => {
      const res: any = await apiClient.post("/api/tbt/admin/tasks", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};
export const useUpdateTbtTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TbtTask> }) => {
      const res: any = await apiClient.put(`/api/tbt/admin/tasks/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};
export const useDeleteTbtTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/tbt/admin/tasks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};

// ── Leaderboard + Grant ───────────────────────────────────────────
export const useTbtLeaderboard = (limit = 50) =>
  useQuery({
    queryKey: ["tbt", "leaderboard", limit],
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const res: any = await apiClient.get(`/api/tbt/admin/leaderboard?limit=${limit}`);
      return res?.data ?? [];
    },
    staleTime: 30_000,
  });

export const useGrantPoints = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { memberId: string; points: number; source?: string }) => {
      const res: any = await apiClient.post("/api/tbt/admin/grant", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tbt"] }),
  });
};
