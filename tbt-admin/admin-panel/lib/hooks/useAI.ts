import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

/**
 * Admin moderation hooks for the AI Content Buddy.
 *
 * These are the /api/ai/admin/* endpoints — Clerk-gated, member-scoped
 * only for filtering (admins can see any conversation). The member-
 * facing hooks live in tbt-user-web / tbt_app, not here.
 */

export interface AIConversationAdmin {
  id: string;
  memberId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  _count?: { messages: number };
}

export interface AIMessage {
  id: string;
  conversationId: string;
  sender: "user" | "assistant";
  message: string;
  inputType: "text" | "voice" | "image";
  imageUrl: string | null;
  contentType: string | null;
  language: string | null;
  tone: string | null;
  createdAt: string;
}

export interface AIStats {
  conversations: number;
  messages: number;
  savedContent: number;
  activeMembers: number;
  limits: { dailyPerMember: number; perMinutePerMember: number };
}

export const useAIStats = () =>
  useQuery({
    queryKey: ["ai", "admin", "stats"],
    queryFn: async (): Promise<AIStats> => {
      const res: any = await apiClient.get("/api/ai/admin/stats");
      return res?.data;
    },
    staleTime: 30_000,
  });

export const useAIConversations = (params: {
  page?: number;
  limit?: number;
  search?: string;
}) =>
  useQuery({
    queryKey: ["ai", "admin", "conversations", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.search) q.set("search", params.search);
      const res: any = await apiClient.get(`/api/ai/admin/conversations?${q.toString()}`);
      return res as { data: AIConversationAdmin[]; meta: { total: number; page: number; limit: number } };
    },
    placeholderData: (prev) => prev,
  });

export const useAIConversationDetail = (id: string | null) =>
  useQuery({
    queryKey: ["ai", "admin", "conversation", id],
    queryFn: async (): Promise<{ conversation: AIConversationAdmin; messages: AIMessage[] }> => {
      const res: any = await apiClient.get(`/api/ai/admin/conversations/${id}/messages`);
      return res?.data;
    },
    enabled: !!id,
  });

export const useDeleteAIConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ai/admin/conversations/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "admin"] });
    },
  });
};
