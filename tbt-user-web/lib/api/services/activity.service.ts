import apiClient from "../client";
import type { ApiResponse } from "@/types";

export interface ActivityHeartbeat {
  /** Tab is in the foreground (document.visibilityState === "visible"). */
  visible: boolean;
  /** The member clicked, typed, scrolled or touched within the idle window. */
  interacted: boolean;
  /** A video or audio element on the page is playing. */
  media: boolean;
}

/** GET /api/user/activity/history — the member's own date-wise Daily Time Spent. */
export interface ActivityHistory {
  timezone: string;
  memberName: string | null;
  /** YYYY-MM-DD (program timezone, IST); null when unknown. */
  onboardingDate: string | null;
  /** Which date onboardingDate is: admin approval, onboarding submission, or account creation. */
  onboardingSource: "approved" | "submitted" | "joined";
  rangeStart: string;
  /** First tracked day; days from rangeStart before it were never tracked (unknown, not 0). null = none tracked. */
  trackedFrom: string | null;
  trackingStartDate: string | null;
  today: string;
  /** Newest first; zero-use days included. */
  days: Array<{ date: string; activeMinutes: number; mediaMinutes: number }>;
  totalMinutes: number;
  averageDailyMinutes: number;
  activeDays: number;
  trackedDays: number;
  truncated: boolean;
}

export const activityService = {
  // Daily Time Spent — the server decides whether the minute counts and uses
  // its own clock; see backend lib/memberActivity.ts.
  heartbeat: (data: ActivityHeartbeat) =>
    apiClient.post<never, ApiResponse<{ recorded: boolean }>>("/api/user/activity/heartbeat", data),
  history: () => apiClient.get<never, ApiResponse<ActivityHistory>>("/api/user/activity/history"),
};
