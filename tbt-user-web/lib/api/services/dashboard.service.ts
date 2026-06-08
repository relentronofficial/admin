import apiClient from "../client";
import type { ApiResponse, DashboardStats, ContinueLearningItem, WatchHistoryItem, Notification, Message, DeviceSession } from "@/types";

export const dashboardService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<DashboardStats>>("/api/user/dashboard/stats"),

  getContinueLearning: () =>
    apiClient.get<never, ApiResponse<ContinueLearningItem[]>>("/api/user/dashboard/continue-learning"),

  getWatchHistory: (params: { page?: number; limit?: number; filter?: 'all' | 'in_progress' | 'completed' } = {}) =>
    apiClient.get<never, ApiResponse<WatchHistoryItem[]>>("/api/user/dashboard/watch-history", { params }),

  removeFromHistory: (episodeId: string) =>
    apiClient.delete<never, ApiResponse<{ removed: boolean }>>(`/api/user/dashboard/watch-history/${episodeId}`),

  getNotificationUnreadCount: () =>
    apiClient.get<never, ApiResponse<{ count: number }>>("/api/user/notifications/unread-count"),

  getNotifications: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<never, ApiResponse<Notification[]>>("/api/user/notifications", { params }),

  markNotificationRead: (id: string) =>
    apiClient.patch<never, ApiResponse<Notification>>(`/api/user/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    apiClient.post<never, ApiResponse<{ updated: number }>>("/api/user/notifications/read-all"),

  dismissNotification: (id: string) =>
    apiClient.delete<never, ApiResponse<{ dismissed: boolean }>>(`/api/user/notifications/${id}`),

  clearReadNotifications: () =>
    apiClient.delete<never, ApiResponse<{ cleared: number }>>("/api/user/notifications"),

  getMessages: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<never, ApiResponse<Message[]>>("/api/user/messages", { params }),

  markMessageRead: (id: string) =>
    apiClient.patch<never, ApiResponse<Message>>(`/api/user/messages/${id}/read`),

  markAllMessagesRead: () =>
    apiClient.post<never, ApiResponse<{ updated: number }>>("/api/user/messages/read-all"),

  getConversationUnreadCount: () =>
    apiClient.get<never, { data: { count: number } }>("/api/user/conversations/unread-count"),

  getConversations: () =>
    apiClient.get("/api/user/conversations"),

  getConversationMessages: (id: string, params: { page?: number; limit?: number } = {}) =>
    apiClient.get(`/api/user/conversations/${id}/messages`, { params }),

  startConversation: (data: { subject: string; body: string }) =>
    apiClient.post("/api/user/conversations", data),

  sendChatMessage: (id: string, body: string) =>
    apiClient.post(`/api/user/conversations/${id}/messages`, { body }),

  archiveConversation: (id: string, hidden: boolean) =>
    apiClient.patch(`/api/user/conversations/${id}/archive`, { hidden }),

  getMyDevices: () =>
    apiClient.get<never, ApiResponse<DeviceSession[]>>("/api/user/my-devices"),

  revokeDevice: (id: string) =>
    apiClient.delete<never, ApiResponse<{ revoked: boolean }>>(`/api/user/my-devices/${id}`),
};
