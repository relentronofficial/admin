"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";
import type { HelpdeskTicket } from "@/lib/hooks/useHelpdesk";

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
  /** True when only members with role='admin' can send. */
  announcementOnly?: boolean;
}

export interface AdminChatGroupMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  businessName: string | null;
  /** `'admin' | 'member'` — set at membership row level. */
  role: string;
  joinedAt: string;
}

export interface AdminChatGroupDetail extends AdminChatGroup {
  members: AdminChatGroupMember[];
}

export interface AdminChatGroupMessage {
  id: string;
  groupId: string;
  senderMemberId: string | null;
  senderAdminId: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isSystem: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedForEveryone: boolean;
  sender: { id: string; firstName: string | null; lastName: string | null; profilePhotoUrl: string | null } | null;
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
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] });
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id] });
    },
  });
}

/**
 * Admin-only fetch of a single group + roster. Backed by
 * `GET /api/chat-groups/admin/:id` which returns the group metadata
 * plus every non-left member row with their per-group role.
 */
export function useAdminGetGroup(id: string | undefined | null) {
  return useQuery({
    queryKey: ["admin", "chat-group", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/chat-groups/admin/${id}`);
      return (res as unknown as { data: AdminChatGroupDetail }).data;
    },
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

/** Toggle broadcast mode. `PATCH /admin/:id/announcement-only`. */
export function useAdminSetAnnouncementOnly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, announcementOnly }: { id: string; announcementOnly: boolean }) => {
      const res = await apiClient.patch(
        `/api/chat-groups/admin/${id}/announcement-only`,
        { announcementOnly },
      );
      return res;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "chat-groups"] });
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id] });
    },
  });
}

/** Pin a message in a group. `POST /admin/:id/messages/:messageId/pin`. */
export function useAdminPinGroupMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, messageId }: { id: string; messageId: string }) => {
      const res = await apiClient.post(
        `/api/chat-groups/admin/${id}/messages/${messageId}/pin`,
      );
      return res;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id] });
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id, "messages"] });
    },
  });
}

/** Remove a pin. `DELETE /admin/:id/messages/:messageId/pin`. */
export function useAdminUnpinGroupMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, messageId }: { id: string; messageId: string }) => {
      const res = await apiClient.delete(
        `/api/chat-groups/admin/${id}/messages/${messageId}/pin`,
      );
      return res;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id] });
      qc.invalidateQueries({ queryKey: ["admin", "chat-group", vars.id, "messages"] });
    },
  });
}

/**
 * Admin-only recent-messages reader for a group — powers the "Messages"
 * modal used to raise a ticket from a message. Read-only; not a full
 * chat viewer (see GroupMessagesModal.tsx).
 */
export function useAdminListGroupMessages(groupId: string | null) {
  return useQuery({
    queryKey: ["admin", "chat-group", groupId, "messages"],
    queryFn: async () => {
      const res = await apiClient.get(`/api/chat-groups/admin/${groupId}/messages`, {
        params: { limit: 50 },
      });
      return (res as unknown as { data: AdminChatGroupMessage[] }).data ?? [];
    },
    enabled: !!groupId,
    staleTime: 15 * 1000,
  });
}

/**
 * Admin raises a ticket from a group-chat message. Reuses the existing
 * HelpdeskTicket infra — the created ticket shows up in the normal
 * /support Tickets tab. `POST /admin/:id/messages/:messageId/raise-ticket`.
 */
export function useAdminRaiseTicketFromMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      messageId,
      subject,
      message,
      priority,
    }: {
      groupId: string;
      messageId: string;
      subject: string;
      message: string;
      priority?: "low" | "medium" | "high";
    }) => {
      const res = await apiClient.post(
        `/api/chat-groups/admin/${groupId}/messages/${messageId}/raise-ticket`,
        { subject, message, priority },
      );
      return (res as unknown as { data: HelpdeskTicket }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
}

// ── Scheduled messages (one-time, daily, weekly or monthly; IST) ─────────────────────────────

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

export type ScheduledMessageStatus = "active" | "paused" | "completed" | "missed" | "cancelled";

export interface ScheduledGroupMessage {
  id: string;
  groupId: string;
  body: string;
  scheduleType: ScheduleFrequency;
  /** IST date — the send date (once) or the start date (repeating). */
  date: string | null;
  /** IST time, HH:MM. */
  time: string | null;
  endDate: string | null;
  sendAt: string | null;
  nextRunAt: string | null;
  status: ScheduledMessageStatus;
  sentCount: number;
  lastSentAt: string | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ScheduledMessageInput {
  scheduleType: ScheduleFrequency;
  body: string;
  date: string;
  time: string;
  endDate?: string | null;
}

const scheduledKey = (groupId: string) => ["admin", "chat-groups", groupId, "scheduled"];

export function useAdminScheduledMessages(groupId: string | null) {
  return useQuery({
    queryKey: scheduledKey(groupId ?? ""),
    enabled: !!groupId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await apiClient.get(`/api/chat-groups/admin/${groupId}/scheduled-messages`);
      return (res as unknown as { data: ScheduledGroupMessage[] }).data ?? [];
    },
  });
}

export function useAdminSaveScheduledMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ScheduledMessageInput & { id?: string }) => {
      const res = id
        ? await apiClient.put(`/api/chat-groups/admin/${groupId}/scheduled-messages/${id}`, body)
        : await apiClient.post(`/api/chat-groups/admin/${groupId}/scheduled-messages`, body);
      return (res as unknown as { data: ScheduledGroupMessage }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduledKey(groupId) }),
  });
}

export function useAdminSetScheduledStatus(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const res = await apiClient.patch(
        `/api/chat-groups/admin/${groupId}/scheduled-messages/${id}/status`,
        { status },
      );
      return (res as unknown as { data: ScheduledGroupMessage }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduledKey(groupId) }),
  });
}

export function useAdminDeleteScheduledMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/chat-groups/admin/${groupId}/scheduled-messages/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduledKey(groupId) }),
  });
}
