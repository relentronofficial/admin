import apiClient from "../client";
import type { ApiResponse } from "@/types";

export interface OnboardingMeeting {
  id: string;
  memberId: string;
  hostAdminId: string | null;
  title: string;
  description: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  scheduledAt: string;
  durationMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  recordingUrl: string | null;
  createdAt: string;
  member: { id: string; firstName: string; lastName: string | null; memberId: string; phone: string };
  hostAdmin: { id: string; fullName: string } | null;
  _count: { participants: number };
}

export interface OnboardingMeetingJoinCreds {
  token: string;
  wsUrl: string;
  roomName: string;
  status: string;
  title: string;
  /** Authoritative meeting start time from the backend — null before the meeting has actually started. */
  startedAt: string | null;
}

export const onboardingMeetingsService = {
  list: () => apiClient.get<never, ApiResponse<OnboardingMeeting[]>>("/api/onboarding-meetings"),

  join: (id: string) =>
    apiClient.post<never, ApiResponse<OnboardingMeetingJoinCreds>>(`/api/onboarding-meetings/${id}/token`, {}),

  leave: (id: string) => apiClient.post<never, ApiResponse<null>>(`/api/onboarding-meetings/${id}/leave`, {}),
};
