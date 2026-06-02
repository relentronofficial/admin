import apiClient from "../client";
import type { ApiResponse, Event, Webinar } from "@/types";

export const eventsService = {
  listEvents: (params: { page?: number; limit?: number; search?: string } = {}) =>
    apiClient.get<never, ApiResponse<Event[]>>("/api/user/events", { params }),

  getEvent: (id: string) =>
    apiClient.get<never, ApiResponse<Event>>(`/api/user/events/${id}`),

  registerForEvent: (id: string) =>
    apiClient.post<never, ApiResponse<{ registered: boolean }>>(`/api/user/events/${id}/register`),

  listWebinars: (params: { page?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<never, ApiResponse<Webinar[]>>("/api/user/webinars", { params }),

  getWebinar: (id: string) =>
    apiClient.get<never, ApiResponse<Webinar>>(`/api/user/webinars/${id}`),

  getWebinarToken: (id: string) =>
    apiClient.post<never, ApiResponse<{ token: string; channel: string }>>(`/api/user/webinars/${id}/token`),
};
