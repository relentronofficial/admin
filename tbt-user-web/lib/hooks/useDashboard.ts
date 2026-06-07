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
    staleTime: 10 * 1000,
  });

export const useWatchHistory = (params: { page?: number; limit?: number; filter?: 'all' | 'in_progress' | 'completed' } = {}) =>
  useQuery({
    queryKey: ["user", "dashboard", "watch-history", params],
    queryFn: async () => {
      const res = await dashboardService.getWatchHistory(params);
      return res;
    },
    staleTime: 30 * 1000,
  });

export const useRemoveFromHistory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: string) => dashboardService.removeFromHistory(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "dashboard", "watch-history"] });
    },
  });
};

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

export const useMessages = (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
  useQuery({
    queryKey: ["user", "messages", params],
    queryFn: async () => {
      const res = await dashboardService.getMessages(params);
      return res;
    },
    staleTime: 30 * 1000,
  });

export const useMarkMessageRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardService.markMessageRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "messages"] });
    },
  });
};

export const useMarkAllMessagesRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.markAllMessagesRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "messages"] });
    },
  });
};

export const useConversations = () =>
  useQuery({
    queryKey: ["user", "conversations"],
    queryFn: () => dashboardService.getConversations(),
    staleTime: 60_000,
  });

export const useConversationMessages = (id: string | null) =>
  useQuery({
    queryKey: ["user", "conversations", id, "messages"],
    queryFn: () => dashboardService.getConversationMessages(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

export const useStartConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      dashboardService.startConversation(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["user", "conversations"] }),
  });
};

export const useSendChatMessage = () =>
  useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      dashboardService.sendChatMessage(conversationId, body),
  });

export const useMyDevices = () =>
  useQuery({
    queryKey: ["user", "my-devices"],
    queryFn: async () => {
      const res = await dashboardService.getMyDevices();
      return res.data;
    },
    staleTime: 60 * 1000,
  });
