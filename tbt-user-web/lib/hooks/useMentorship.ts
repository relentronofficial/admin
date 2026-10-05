"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorshipService } from "@/lib/api/services/mentorship.service";
import { useUserSupportQuota } from "./useUser";

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

export const useUpsertMentorshipRevenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.upsertRevenue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", "mentorship-revenue"] });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] });
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
