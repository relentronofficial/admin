import apiClient from "../client";
import type { ApiResponse, DashboardStats, ContinueLearningItem, Notification } from "@/types";

export const dashboardService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<DashboardStats>>("/api/user/dashboard/stats"),

  getContinueLearning: () =>
    apiClient.get<never, ApiResponse<ContinueLearningItem[]>>("/api/user/dashboard/continue-learning"),

  getNotifications: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<never, ApiResponse<Notification[]>>("/api/user/notifications", { params }),

  markNotificationRead: (id: string) =>
    apiClient.patch<never, ApiResponse<Notification>>(`/api/user/notifications/${id}/read`),

  markAllNotificationsRead: () =>
    apiClient.post<never, ApiResponse<{ updated: number }>>("/api/user/notifications/read-all"),
};
