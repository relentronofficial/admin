import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

export interface Habit {
  id: string;
  icon: string;
  rawQuestion: string;
  highlightWord: string;
  subtitle: string;
  sortOrder: number;
  status: string;
}

export interface ButtonsConfig {
  id: string;
  yesLabel: string;
  notYetLabel: string;
}

// ── Habits ──────────────────────────────────────────────────────
export const useListHabits = () =>
  useQuery({
    queryKey: ["rituals", "habits"],
    queryFn: async (): Promise<Habit[]> => {
      const res: any = await apiClient.get("/api/rituals/admin/habits");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateHabit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Habit>) => {
      const res: any = await apiClient.post("/api/rituals/admin/habits", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rituals"] }),
  });
};

export const useUpdateHabit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Habit> }) => {
      const res: any = await apiClient.put(`/api/rituals/admin/habits/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rituals"] }),
  });
};

export const useDeleteHabit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/rituals/admin/habits/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rituals"] }),
  });
};

// ── Buttons config (singleton) ──────────────────────────────────
export const useGetButtonsConfig = () =>
  useQuery({
    queryKey: ["rituals", "buttons"],
    queryFn: async (): Promise<ButtonsConfig> => {
      const res: any = await apiClient.get("/api/rituals/admin/buttons");
      return res?.data;
    },
  });

export const useUpdateButtonsConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ButtonsConfig>) => {
      const res: any = await apiClient.put("/api/rituals/admin/buttons", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rituals"] }),
  });
};
