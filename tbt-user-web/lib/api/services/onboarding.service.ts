import apiClient from "../client";
import type { ApiResponse } from "@/types";

export interface OnboardingDocument {
  id: string;
  documentType: string;
  documentUrl: string;
  status: string;
}

export interface OnboardingState {
  status: string;
  verificationStatus: "awaiting_kyc" | "under_review" | "verified" | "rejected" | "changes_requested";
  onboardingCompleted: boolean;
  onboardingSubmittedAt: string | null;
  onboardingReviewNote: string | null;
  profile: Record<string, unknown>;
  documents: OnboardingDocument[];
}

export interface OnboardingContentStep {
  id: string;
  stepKey: string;
  title: string;
  textBody: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  sortOrder: number;
}

export const onboardingService = {
  getState: () => apiClient.get<never, ApiResponse<OnboardingState>>("/api/onboarding"),

  saveProgress: (data: Record<string, unknown>) =>
    apiClient.patch<never, ApiResponse<Record<string, unknown>>>("/api/onboarding", data),

  getContent: () => apiClient.get<never, ApiResponse<OnboardingContentStep[]>>("/api/onboarding/content"),

  presignDocument: (data: { filename: string; contentType: string; documentType?: string }) =>
    apiClient.post<never, ApiResponse<{ uploadUrl: string; publicUrl: string }>>("/api/onboarding/documents/presign", data),

  registerDocument: (data: { documentType: string; documentUrl: string }) =>
    apiClient.post<never, ApiResponse<OnboardingDocument>>("/api/onboarding/documents", data),

  deleteDocument: (id: string) => apiClient.delete<never, ApiResponse<null>>(`/api/onboarding/documents/${id}`),

  submit: () => apiClient.post<never, ApiResponse<{ verificationStatus: string; onboardingSubmittedAt: string }>>("/api/onboarding/submit", {}),

  presignProfilePhoto: (data: { filename: string; contentType: string }) =>
    apiClient.post<never, ApiResponse<{ uploadUrl: string; publicUrl: string }>>("/api/onboarding/photo/presign", data),
};
