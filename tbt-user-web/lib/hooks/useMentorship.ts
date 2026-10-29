"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorshipService } from "@/lib/api/services/mentorship.service";
import type { InstagramStatus } from "@/lib/api/services/mentorship.service";
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

// ── Instagram integration ──────────────────────────────────────────────────

export const instagramStatusKey = ["user", "instagram-status"] as const;

export const useInstagramStatus = () =>
  useQuery<InstagramStatus>({
    queryKey: instagramStatusKey,
    queryFn: async () => {
      const res = await mentorshipService.getInstagramStatus();
      return res.data ?? { connected: false };
    },
    staleTime: 60_000,
  });

export const useInstagramConnect = () => {
  return useMutation({
    mutationFn: async () => {
      const res = await mentorshipService.getInstagramAuthUrl();
      return res.data?.url;
    },
    onSuccess: (url) => {
      if (url) window.location.href = url;
    },
  });
};

export const useInstagramDisconnect = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.disconnectInstagram,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramStatusKey });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-social"] });
    },
  });
};

export const useInstagramSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.syncInstagram,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instagramStatusKey });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-social"] });
    },
  });
};
