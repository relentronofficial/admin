"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "@/lib/api/services/dashboard.service";

export const useDashboardStats = () =>
  useQuery({
    queryKey: ["user", "dashboard", "stats"],
    queryFn: async () => {
      const res = await dashboardService.getStats();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const useContinueLearning = () =>
  useQuery({
    queryKey: ["user", "dashboard", "continue-learning"],
    queryFn: async () => {
      const res = await dashboardService.getContinueLearning();
      return res.data;
    },
    staleTime: 30 * 1000,
  });

export const useNotifications = (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
  useQuery({
    queryKey: ["user", "notifications", params],
    queryFn: async () => {
      const res = await dashboardService.getNotifications(params);
      return res;
    },
    staleTime: 30 * 1000,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
    },
  });
};
