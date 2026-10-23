"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "@/lib/api/services/dashboard.service";
import { chatGroupKeys } from "./useChatGroups";

export const useDashboardStats = () =>
  useQuery({
    queryKey: ["user", "dashboard", "stats"],
    queryFn: async () => {
      const res = await dashboardService.getStats();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const useMyStreak = () =>
  useQuery({
    queryKey: ["user", "streak"],
    queryFn: async () => {
      const res = await dashboardService.getStreak();
      return res.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

export const useContinueLearning = () =>
  useQuery({
    queryKey: ["user", "dashboard", "continue-learning"],
    queryFn: async () => {
      const res = await dashboardService.getContinueLearning();
      return res.data;
    },
    staleTime: 60 * 1000,
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

export const useSavedVideos = (params: { limit?: number } = {}) =>
  useQuery({
    queryKey: ["user", "saved-videos", params],
    queryFn: async () => {
      const res = await dashboardService.getSavedVideos(params);
      return res;
    },
    staleTime: 30 * 1000,
  });

export const useSaveVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, episodeType }: { episodeId: string; episodeType: 'course' | 'workshop' }) =>
      dashboardService.saveVideo(episodeId, episodeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "saved-videos"] });
    },
  });
};

export const useUnsaveVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: string) => dashboardService.unsaveVideo(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "saved-videos"] });
    },
  });
};

export const useNotificationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "notifications", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getNotificationUnreadCount();
      return res.data?.count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
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

export const useDismissNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardService.dismissNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
    },
  });
};

export const useClearReadNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.clearReadNotifications(),
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

export const useConversationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "conversations", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getConversationUnreadCount();
      return (res as any).data?.count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

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
    mutationFn: ({
      conversationId,
      body,
      mediaUrl,
      mediaType,
      replyToId,
    }: {
      conversationId: string;
      body: string;
      mediaUrl?: string;
      mediaType?: string;
      replyToId?: string;
    }) =>
      dashboardService.sendChatMessage(conversationId, body, {
        mediaUrl,
        mediaType,
        replyToId,
      }),
  });

// Message actions on the member's own conversations. The thread is refetched
// only after the server confirms the change.
const useConversationMessageAction = <V extends { conversationId: string }>(
  fn: (v: V) => Promise<unknown>,
  alsoRefresh?: (v: V) => string[],
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Returning the refetch keeps the mutation pending until the thread shows the change.
    onSuccess: (_d, v) =>
      Promise.all([
        ...[v.conversationId, ...(alsoRefresh?.(v) ?? [])].map((id) =>
          queryClient.invalidateQueries({ queryKey: ["user", "conversations", id, "messages"] })),
        queryClient.invalidateQueries({ queryKey: ["user", "conversations"], exact: true }),
      ]),
  });
};

export const useEditChatMessage = () =>
  useConversationMessageAction((v: { conversationId: string; messageId: string; body: string }) =>
    dashboardService.editChatMessage(v.conversationId, v.messageId, v.body));

export const useDeleteChatMessage = () =>
  useConversationMessageAction((v: { conversationId: string; messageId: string; forEveryone: boolean }) =>
    dashboardService.deleteChatMessage(v.conversationId, v.messageId, v.forEveryone));

export const useReactChatMessage = () =>
  useConversationMessageAction((v: { conversationId: string; messageId: string; emoji: string }) =>
    dashboardService.reactChatMessage(v.conversationId, v.messageId, v.emoji));

export const useForwardChatMessage = () => {
  const queryClient = useQueryClient();
  const forward = useConversationMessageAction(
    (v: { conversationId: string; messageId: string; toConversationIds: string[]; toGroupIds?: string[] }) =>
      dashboardService.forwardChatMessage(v.conversationId, v.messageId, v.toConversationIds, v.toGroupIds ?? []),
    (v) => v.toConversationIds,
  );
  // Group targets: refresh those threads and the group list (last message / order).
  return {
    ...forward,
    mutate: (v: Parameters<typeof forward.mutate>[0], opts?: Parameters<typeof forward.mutate>[1]) =>
      forward.mutate(v, {
        ...opts,
        onSuccess: (...args) => {
          for (const gid of v.toGroupIds ?? []) queryClient.invalidateQueries({ queryKey: chatGroupKeys.messages(gid) });
          if (v.toGroupIds?.length) queryClient.invalidateQueries({ queryKey: chatGroupKeys.mine });
          opts?.onSuccess?.(...args);
        },
      }),
  };
};

export const useArchiveConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      dashboardService.archiveConversation(id, hidden),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["user", "conversations"] }),
  });
};

export const useMyDevices = () =>
  useQuery({
    queryKey: ["user", "my-devices"],
    queryFn: async () => {
      const res = await dashboardService.getMyDevices();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const useRevokeDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardService.revokeDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "my-devices"] }),
  });
};
