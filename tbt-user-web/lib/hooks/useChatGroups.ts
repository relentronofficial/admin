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
  starred: ["chat-groups", "starred"] as const,
  pinned: (id: string) => ["chat-groups", "pinned", id] as const,
};

// LocalStorage-only mute state. The backend supports the `POST /:id/mute`
// endpoint, but for the UI-level "Muted" chip and preset picker we also
// keep a mirror in localStorage so the sidebar tiles can render an icon
// without an extra round-trip. Value = ISO string or 'always' or null.
const MUTE_STORAGE_KEY = "tbt_chat_mute";

export function getLocalMuteState(): Record<string, string | "always" | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MUTE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalMuteState(groupId: string, value: string | "always" | null) {
  if (typeof window === "undefined") return;
  const state = getLocalMuteState();
  if (value === null) {
    delete state[groupId];
  } else {
    state[groupId] = value;
  }
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

export function isLocallyMuted(groupId: string): boolean {
  const state = getLocalMuteState();
  const v = state[groupId];
  if (!v) return false;
  if (v === "always") return true;
  try {
    return new Date(v).getTime() > Date.now();
  } catch {
    return false;
  }
}

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
    mutationFn: (body: {
      body?: string;
      mediaUrl?: string;
      mediaType?: string;
      replyToId?: string;
      mentionedMemberIds?: string[];
    }) => chatGroupsService.sendMessage(id, body),
    onSuccess: () => {
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

export function useChatGroupPresence(id: string) {
  return useQuery({
    queryKey: ["chat-groups", "presence", id],
    queryFn: async () => (await chatGroupsService.getPresence(id)).data ?? [],
    enabled: !!id,
    // Presence is pushed via socket after the initial fetch; this stays
    // fresh enough for the header + info sheet without over-fetching.
    staleTime: 30 * 1000,
  });
}

export function useChatGroupSearch(id: string, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["chat-groups", "search", id, trimmed],
    queryFn: async () => (await chatGroupsService.search(id, trimmed)).data ?? [],
    enabled: !!id && trimmed.length >= 2,
    staleTime: 15 * 1000,
  });
}

// ── Forward / Star / Mute / Pinned hooks ──────────────────────────────────

export function useForwardChatGroupMessage(id: string) {
  return useMutation({
    mutationFn: ({ messageId, toGroupIds }: { messageId: string; toGroupIds: string[] }) =>
      chatGroupsService.forwardMessage(id, messageId, toGroupIds),
  });
}

export function useToggleChatGroupStar(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, starred }: { messageId: string; starred: boolean }) => {
      if (starred) return chatGroupsService.unstarMessage(id, messageId);
      return chatGroupsService.starMessage(id, messageId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatGroupKeys.starred });
    },
  });
}

export function useStarredMessages() {
  return useQuery({
    queryKey: chatGroupKeys.starred,
    queryFn: async () => (await chatGroupsService.listStarred()).data ?? [],
    staleTime: 30 * 1000,
  });
}

export function useMuteChatGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (until: string | null) => chatGroupsService.muteGroup(id, until),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatGroupKeys.group(id) });
      qc.invalidateQueries({ queryKey: chatGroupKeys.mine });
    },
  });
}

export function usePinnedMessages(id: string) {
  return useQuery({
    queryKey: chatGroupKeys.pinned(id),
    queryFn: async () => (await chatGroupsService.getPinnedMessages(id)).data ?? [],
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
