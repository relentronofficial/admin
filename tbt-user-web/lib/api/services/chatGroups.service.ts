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

export interface ChatGroupMessageReplyPreview {
  id: string;
  body: string | null;
  mediaType: string | null;
  senderName: string | null;
  deletedForEveryone: boolean;
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
  replyTo: ChatGroupMessageReplyPreview | null;
  isSystem: boolean;
  mentionedMemberIds: string[];
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
  readByMemberIds: string[];
}

export interface ChatGroupPresenceEntry {
  memberId: string;
  online: boolean;
  lastSeenAt: string | null;
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
    body: {
      body?: string;
      mediaUrl?: string;
      mediaType?: string;
      replyToId?: string;
      mentionedMemberIds?: string[];
    },
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

  getPresence: (id: string) =>
    apiClient.get<never, ApiResponse<ChatGroupPresenceEntry[]>>(`/api/chat-groups/${id}/presence`),
};

/**
 * Upload a chat attachment through /api/upload/image (Bunny-first, R2 fallback).
 * Accepts image/video/document/audio — same endpoint the community feed
 * uses for its post media. Returns the public URL + a mediaType hint
 * derived from the file MIME.
 */
export async function uploadChatMedia(
  file: File,
): Promise<{ publicUrl: string; mediaType: "image" | "video" | "document" | "audio" } | null> {
  try {
    const contentType = file.type || "application/octet-stream";
    const buffer = await file.arrayBuffer();
    const res = await apiClient.post<never, ApiResponse<{ publicUrl: string }>>(
      "/api/upload/image",
      buffer,
      {
        params: { pathPrefix: "chat", filename: file.name },
        headers: { "Content-Type": contentType },
        transformRequest: [(data) => data],
      },
    );
    const publicUrl = res.data?.publicUrl;
    if (!publicUrl) return null;
    let mediaType: "image" | "video" | "document" | "audio" = "document";
    if (contentType.startsWith("image/")) mediaType = "image";
    else if (contentType.startsWith("video/")) mediaType = "video";
    else if (contentType.startsWith("audio/")) mediaType = "audio";
    return { publicUrl, mediaType };
  } catch {
    return null;
  }
}
