import apiClient from "../client";
import type { ApiResponse } from "@/types";

export type LeaderboardPeriod = "week" | "month" | "all";

/** Row of GET /api/tbt/leaderboard — points summed from the tbt_activity_log ledger. */
export interface LeaderboardRow {
  rank: number;
  memberId: string;
  totalPoints: number;
  member: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
  isMe: boolean;
}

// The gamification module is mounted at /api/tbt (not /api/gamification).
export const gamificationService = {
  leaderboard: (params: { period?: LeaderboardPeriod; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<LeaderboardRow[]>>(
      "/api/tbt/leaderboard",
      { params },
    ),
};
