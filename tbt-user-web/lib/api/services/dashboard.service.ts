import apiClient from "../client";
import type { ApiResponse, DashboardStats, ContinueLearningItem, WatchHistoryItem, Notification, Message, DeviceSession } from "@/types";

export const dashboardService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<DashboardStats>>("/api/user/dashboard/stats"),

  getContinueLearning: () =>
    apiClient.get<never, ApiResponse<ContinueLearningItem[]>>("/api/user/dashboard/continue-learning"),

  getWatchHistory: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<WatchHistoryItem[]>>("/api/user/dashboard/watch-history", { params }),

  getNotifications: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<never, ApiResponse<Notification[]>>("/api/user/notifications", { params }),

  markNotificationRead: (id: string) =>
    apiClient.patch<never, ApiResponse<Notification>>(`/api/user/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    apiClient.post<never, ApiResponse<{ updated: number }>>("/api/user/notifications/read-all"),

  getMessages: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<never, ApiResponse<Message[]>>("/api/user/messages", { params }),

  markMessageRead: (id: string) =>
    apiClient.patch<never, ApiResponse<Message>>(`/api/user/messages/${id}/read`),

  markAllMessagesRead: () =>
    apiClient.post<never, ApiResponse<{ updated: number }>>("/api/user/messages/read-all"),

  getConversations: () =>
    apiClient.get("/api/user/conversations"),

  getConversationMessages: (id: string) =>
    apiClient.get(`/api/user/conversations/${id}/messages`),

  startConversation: (data: { subject: string; body: string }) =>
    apiClient.post("/api/user/conversations", data),

  sendChatMessage: (id: string, body: string) =>
    apiClient.post(`/api/user/conversations/${id}/messages`, { body }),

  getMyDevices: () =>
    apiClient.get<never, ApiResponse<DeviceSession[]>>("/api/user/my-devices"),
};
