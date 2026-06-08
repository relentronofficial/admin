import apiClient from "../client";
import type { ApiResponse, MemberProfile } from "@/types";

export const userService = {
  getMe: () =>
    apiClient.get<never, ApiResponse<MemberProfile>>("/api/user/me"),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dob?: string | null;
    city?: string | null;
    state?: string | null;
    businessName?: string | null;
  }) =>
    apiClient.patch<never, ApiResponse<Partial<MemberProfile>>>("/api/user/me", data),

  getAvatarPresignUrl: (data: { filename: string; contentType: string }) =>
    apiClient.post<never, ApiResponse<{ uploadUrl: string; publicUrl: string }>>("/api/user/me/avatar-presign", data),

  updateAvatar: (avatarUrl: string) =>
    apiClient.patch<never, ApiResponse<{ avatarUrl: string }>>("/api/user/me/avatar", { avatarUrl }),

  getNotificationPrefs: () =>
    apiClient.get<never, ApiResponse<{ email: boolean; push: boolean; sms: boolean }>>("/api/user/notifications/preferences"),

  updateNotificationPrefs: (prefs: { email?: boolean; push?: boolean; sms?: boolean }) =>
    apiClient.patch<never, ApiResponse<{ email: boolean; push: boolean; sms: boolean }>>("/api/user/notifications/preferences", prefs),
};
