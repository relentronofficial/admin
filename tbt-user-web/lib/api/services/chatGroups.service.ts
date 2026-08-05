import apiClient from "../client";
import type { ApiResponse } from "@/types";

export interface ChatGroupMemberRef {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  businessName?: string | null;
  role?: string;
  joinedAt?: string;
}

export interface ChatGroupSummary {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessage?: {
    body: string;
    createdAt: string;
    senderName: string | null;
  } | null;
}

export interface ChatGroupDetail {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  members: ChatGroupMemberRef[];
}

export interface ChatGroupMessage {
  id: string;
  groupId: string;
  senderMemberId: string | null;
  senderAdminId: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  replyToId: string | null;
  isSystem: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedForEveryone: boolean;
  sender: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
  reactions: Array<{ emoji: string; memberId: string }>;
  readByCount: number;
}

export const chatGroupsService = {
  listMine: () =>
    apiClient.get<never, ApiResponse<ChatGroupSummary[]>>("/api/chat-groups/mine"),

  getGroup: (id: string) =>
    apiClient.get<never, ApiResponse<ChatGroupDetail>>(`/api/chat-groups/${id}`),

  listMessages: (id: string, params: { before?: string; limit?: number } = {}) => {
    const q: Record<string, string | number> = {};
    if (params.before) q.before = params.before;
    if (params.limit) q.limit = params.limit;
    return apiClient.get<never, ApiResponse<ChatGroupMessage[]>>(
      `/api/chat-groups/${id}/messages`,
      { params: q },
    );
  },

  sendMessage: (
    id: string,
    body: { body?: string; mediaUrl?: string; mediaType?: string; replyToId?: string },
  ) => apiClient.post<never, ApiResponse<ChatGroupMessage>>(`/api/chat-groups/${id}/messages`, body),

  editMessage: (id: string, messageId: string, body: string) =>
    apiClient.put<never, ApiResponse<ChatGroupMessage>>(
      `/api/chat-groups/${id}/messages/${messageId}`,
      { body },
    ),

  deleteMessage: (id: string, messageId: string, forEveryone: boolean) =>
    apiClient.delete<never, ApiResponse<{ deleted: boolean; forEveryone: boolean }>>(
      `/api/chat-groups/${id}/messages/${messageId}`,
      { params: { forEveryone: forEveryone ? "true" : "false" } },
    ),

  toggleReaction: (id: string, messageId: string, emoji: string) =>
    apiClient.post<never, ApiResponse<{ added: boolean; emoji: string }>>(
      `/api/chat-groups/${id}/messages/${messageId}/react`,
      { emoji },
    ),

  markRead: (id: string, messageId: string) =>
    apiClient.post<never, ApiResponse<{ marked: boolean }>>(
      `/api/chat-groups/${id}/read`,
      { messageId },
    ),

  search: (id: string, q: string, limit = 20) =>
    apiClient.get<never, ApiResponse<ChatGroupMessage[]>>(
      `/api/chat-groups/${id}/search`,
      { params: { q, limit } },
    ),

  leave: (id: string) =>
    apiClient.post<never, ApiResponse<{ left: boolean }>>(`/api/chat-groups/${id}/leave`),
};
