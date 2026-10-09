"use client";

import { useQuery } from "@tanstack/react-query";
import {
  gamificationService,
  type LeaderboardPeriod,
} from "@/lib/api/services/gamification.service";

export type {
  LeaderboardRow,
  LeaderboardPeriod,
} from "@/lib/api/services/gamification.service";

export const useLeaderboard = (
  period: LeaderboardPeriod = "month",
  limit = 5,
) =>
  useQuery({
    queryKey: ["tbt", "leaderboard", period, limit],
    queryFn: async () => {
      const res = await gamificationService.leaderboard({ period, limit });
      return res.data ?? [];
    },
    // Backend caches this for 60 s; no need to refetch more often.
    staleTime: 60 * 1000,
  });
