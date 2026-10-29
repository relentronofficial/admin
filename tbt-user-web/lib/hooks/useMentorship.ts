"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorshipService } from "@/lib/api/services/mentorship.service";
import { useUserSupportQuota } from "./useUser";
import { weeklyGraphQueryKey } from "./useBatchProgram";

export { useUserSupportQuota };

export const useMentorshipStats = () =>
  useQuery({
    queryKey: ["user", "mentorship-stats"],
    queryFn: async () => {
      const res = await mentorshipService.getStats();
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

export const useMentorshipRevenue = () =>
  useQuery({
    queryKey: ["user", "mentorship-revenue"],
    queryFn: async () => {
      const res = await mentorshipService.getRevenue();
      return res.data ?? null;
    },
    staleTime: 300_000,
  });

// Fetched only when the chart shows a longer period. The key sits under
// ["user", "mentorship-revenue"], so saving revenue refreshes it too.
export const useMentorshipRevenueHistory = (enabled: boolean) =>
  useQuery({
    queryKey: ["user", "mentorship-revenue", "history"],
    queryFn: async () => {
      const res = await mentorshipService.getRevenueHistory();
      return res.data ?? null;
    },
    enabled,
    staleTime: 300_000,
  });

export const useUpsertMentorshipRevenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.upsertRevenue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", "mentorship-revenue"] });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] });
      // Revenue milestones on the Weekly Activity Graph are computed from these figures.
      qc.invalidateQueries({ queryKey: weeklyGraphQueryKey });
    },
  });
};

export const useMentorshipSocial = () =>
  useQuery({
    queryKey: ["user", "mentorship-social"],
    queryFn: async () => {
      const res = await mentorshipService.getSocial();
      return res.data ?? null;
    },
    staleTime: 300_000,
  });

export const useUpsertMentorshipSocial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.upsertSocial,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", "mentorship-social"] });
    },
  });
};

// ── Mentorship module selection (server is the source of truth) ─────────────
export const mentorshipModulesKey = ["user", "mentorship-modules"] as const;

export const useMentorshipModules = (enabled = true) =>
  useQuery({
    queryKey: mentorshipModulesKey,
    queryFn: async () => {
      const res = await mentorshipService.getModules();
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });

export const useUpdateMentorshipModules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modules: string[]) => {
      const res = await mentorshipService.updateModules(modules);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(mentorshipModulesKey, data);
      // Catalog and course detail are filtered/gated server-side by the selection.
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};
