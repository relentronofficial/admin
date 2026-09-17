"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/lib/api/services/user.service";
import apiClient from "@/lib/api/client";

export const useMe = () =>
  useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await userService.getMe();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};

export const useGetAvatarPresignUrl = () =>
  useMutation({
    mutationFn: userService.getAvatarPresignUrl,
  });

export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.updateAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};

export const useNotificationPrefs = () =>
  useQuery({
    queryKey: ["user", "notification-prefs"],
    queryFn: async () => {
      const res = await userService.getNotificationPrefs();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useUpdateNotificationPrefs = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.updateNotificationPrefs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "notification-prefs"] });
    },
  });
};

// ── MG-01: Support Quota ──────────────────────────────────────────────────────

export type SupportQuota = {
  plan: string;
  techSupport:  { allocated: number; used: number; remaining: number };
  adSupport:    { allocated: number; used: number; remaining: number };
  groupCall:    { allocated: number; used: number; remaining: number };
  callCredits:  { allocated: number; used: number; remaining: number };
  oneToOne:     boolean;
  lifelines:    { total: number; used: number; remaining: number };
};

export const useUserSupportQuota = () =>
  useQuery({
    queryKey: ["user", "support-quota"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/support-quota");
      return res.data as SupportQuota;
    },
    staleTime: 60_000,
  });

// ── MG-05: Buy Extra Credits ──────────────────────────────────────────────────

export type CreditPricingItem = {
  credit_type: string;
  price_inr: number;
  label: string;
  description: string;
};

export type CreditPurchase = {
  id: string;
  credit_type: string;
  quantity: number;
  amount_inr: number;
  status: string;
  payment_ref?: string;
  admin_note?: string;
  created_at: string;
  reviewed_at?: string;
};

export const useCreditPricing = () =>
  useQuery({
    queryKey: ["user", "credit-pricing"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/credits/pricing");
      return res.data as CreditPricingItem[];
    },
    staleTime: 300_000,
  });

export const usePurchaseCredit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { creditType: string; quantity?: number; paymentRef?: string }) => {
      const res: any = await apiClient.post("/api/user/credits/purchase", body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user", "my-credit-purchases"] }),
  });
};

export const useMyCreditPurchases = () =>
  useQuery({
    queryKey: ["user", "my-credit-purchases"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/credits/purchases");
      return res.data as CreditPurchase[];
    },
    staleTime: 30_000,
  });
