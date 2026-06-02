import apiClient from "../client";
import type { ApiResponse, Member } from "@/types";

export const userService = {
  getMe: () =>
    apiClient.get<never, ApiResponse<Member>>("/api/user/me"),

  updateProfile: (data: Partial<Pick<Member, "firstName" | "lastName" | "phone" | "city" | "state" | "businessName">>) =>
    apiClient.patch<never, ApiResponse<Member>>("/api/user/me", data),

  updateProfilePhoto: (formData: FormData) =>
    apiClient.post<never, ApiResponse<{ profilePhotoUrl: string }>>("/api/user/me/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};
