"use client";

import { useQuery } from "@tanstack/react-query";
import { activityService, type ActivityHistory } from "@/lib/api/services/activity.service";

export const activityHistoryQueryKey = ["user", "activity-history"] as const;

/** The member's own date-wise Daily Time Spent (fetched when the popup opens). */
export const useActivityHistory = (enabled: boolean) =>
  useQuery<ActivityHistory>({
    queryKey: activityHistoryQueryKey,
    queryFn: async () => {
      const res = await activityService.history();
      if (!res?.success || !res.data) throw new Error(res?.error?.message ?? "Could not load your time spent history");
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
