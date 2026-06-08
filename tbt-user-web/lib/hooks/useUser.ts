"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/lib/api/services/user.service";

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
