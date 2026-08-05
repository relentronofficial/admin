"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

export interface AdminChatGroup {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  memberCount?: number;
  messageCount?: number;
}

interface CreateGroupBody {
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  memberIds: string[];
}

export function useAdminListGroups() {
  return useQuery({
    queryKey: ["admin", "chat-groups"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: AdminChatGroup[] }>(
        "/api/chat-groups/admin",
      );
      // Response interceptor unwraps to { success, data } directly.
      return (res as unknown as { data: AdminChatGroup[] }).data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function useAdminCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateGroupBody) => {
      const res = await apiClient.post("/api/chat-groups/admin", body);
      return (res as unknown as { data: AdminChatGroup }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] }),
  });
}

export function useAdminUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; avatarUrl?: string | null; description?: string | null }) => {
      const res = await apiClient.put(`/api/chat-groups/admin/${id}`, body);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] }),
  });
}

export function useAdminDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/api/chat-groups/admin/${id}`);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] }),
  });
}

export function useAdminAddGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, memberIds }: { id: string; memberIds: string[] }) => {
      const res = await apiClient.post(`/api/chat-groups/admin/${id}/members`, { memberIds });
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] }),
  });
}

export function useAdminRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, memberId }: { id: string; memberId: string }) => {
      const res = await apiClient.delete(`/api/chat-groups/admin/${id}/members/${memberId}`);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] }),
  });
}
