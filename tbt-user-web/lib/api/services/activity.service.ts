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

export const activityService = {
  // Daily Time Spent — the server decides whether the minute counts and uses
  // its own clock; see backend lib/memberActivity.ts.
  heartbeat: (data: ActivityHeartbeat) =>
    apiClient.post<never, ApiResponse<{ recorded: boolean }>>("/api/user/activity/heartbeat", data),
};
