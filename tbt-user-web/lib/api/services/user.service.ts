import apiClient from "../client";
import type { ApiResponse, MemberProfile } from "@/types";

export const userService = {
  getMe: () =>
    apiClient.get<never, ApiResponse<MemberProfile>>("/api/user/me"),

  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; dob?: string | null }) =>
    apiClient.patch<never, ApiResponse<Partial<MemberProfile>>>("/api/user/me", data),
};
