import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** The six Expert Support Call categories (backend support_usage types). */
export type SupportCallCategory =
  | "sales_support"
  | "tech_support"
  | "content_support"
  | "ad_support"
  | "one_to_one"
  | "group_call";

export interface SupportCallQuota {
  allocated: number;
  used: number;
  reserved: number;
  remaining: number;
}

export interface SupportCallSession {
  id: string;
  title: string;
  description: string | null;
  hostName: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  seatsLeft: number;
  myBooking: {
    id: string;
    status: "booked" | "attended" | "no_show";
    canCancel: boolean;
    canJoin: boolean;
    joinMessage: string | null;
  } | null;
}

export interface SupportCallHistoryItem {
  bookingId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: "booked" | "attended" | "no_show" | "cancelled" | "session_cancelled";
}

export interface SupportCallsView {
  category: SupportCallCategory;
  quota: SupportCallQuota;
  sessions: SupportCallSession[];
  history: SupportCallHistoryItem[];
}

export const supportCallsService = {
  list: (category: SupportCallCategory) =>
    apiClient.get<never, ApiResponse<SupportCallsView>>("/api/user/support-calls", {
      params: { category },
    }),

  book: (sessionId: string) =>
    apiClient.post<never, ApiResponse<{ id: string; status: string }>>(
      `/api/user/support-calls/sessions/${sessionId}/book`,
    ),

  cancel: (bookingId: string) =>
    apiClient.post<never, ApiResponse<{ id: string; status: string }>>(
      `/api/user/support-calls/bookings/${bookingId}/cancel`,
    ),

  join: (bookingId: string) =>
    apiClient.get<never, ApiResponse<{ meetingUrl: string }>>(
      `/api/user/support-calls/bookings/${bookingId}/join`,
    ),
};
