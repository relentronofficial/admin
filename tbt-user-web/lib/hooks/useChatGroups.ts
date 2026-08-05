"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  chatGroupsService,
  type ChatGroupMessage,
} from "@/lib/api/services/chatGroups.service";

export const chatGroupKeys = {
  mine: ["chat-groups", "mine"] as const,
  group: (id: string) => ["chat-groups", "group", id] as const,
  messages: (id: string) => ["chat-groups", "messages", id] as const,
};

export function useMyChatGroups() {
  return useQuery({
    queryKey: chatGroupKeys.mine,
    queryFn: async () => (await chatGroupsService.listMine()).data ?? [],
    staleTime: 15 * 1000,
  });
}

export function useChatGroup(id: string) {
  return useQuery({
    queryKey: chatGroupKeys.group(id),
    queryFn: async () => (await chatGroupsService.getGroup(id)).data,
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Infinite scroll of messages. Each page fetches messages OLDER than
 * the earliest message we already have (`before` cursor), returning up
 * to `limit` items. Pages come back oldest-first per page so client
 * concatenation is straightforward.
 */
export function useChatGroupMessages(id: string) {
  return useInfiniteQuery<ChatGroupMessage[]>({
    queryKey: chatGroupKeys.messages(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await chatGroupsService.listMessages(id, {
        before: pageParam as string | undefined,
        limit: 50,
      });
      return res.data ?? [];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < 50) return undefined;
      // The `before` cursor is the createdAt of the oldest message we
      // have so far — first item in the oldest-first page.
      return lastPage[0]?.createdAt;
    },
    enabled: !!id,
    staleTime: 10 * 1000,
  });
}

export function useSendChatGroupMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body?: string; mediaUrl?: string; mediaType?: string; replyToId?: string }) =>
      chatGroupsService.sendMessage(id, body),
    onSuccess: () => {
      // Server will also push via socket, but invalidating covers the
      // race where the socket event arrives before this mutation resolves.
      qc.invalidateQueries({ queryKey: chatGroupKeys.mine });
    },
  });
}

export function useEditChatGroupMessage(id: string) {
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      chatGroupsService.editMessage(id, messageId, body),
  });
}

export function useDeleteChatGroupMessage(id: string) {
  return useMutation({
    mutationFn: ({ messageId, forEveryone }: { messageId: string; forEveryone: boolean }) =>
      chatGroupsService.deleteMessage(id, messageId, forEveryone),
  });
}

export function useToggleChatGroupReaction(id: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatGroupsService.toggleReaction(id, messageId, emoji),
  });
}

export function useMarkChatGroupRead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => chatGroupsService.markRead(id, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatGroupKeys.mine }),
  });
}

export function useLeaveChatGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chatGroupsService.leave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatGroupKeys.mine }),
  });
}
