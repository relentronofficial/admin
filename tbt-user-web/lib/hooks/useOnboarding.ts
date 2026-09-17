"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingService } from "@/lib/api/services/onboarding.service";

export const useOnboardingState = () =>
  useQuery({
    queryKey: ["onboarding", "state"],
    queryFn: async () => {
      const res = await onboardingService.getState();
      return res.data;
    },
  });

export const useOnboardingContent = () =>
  useQuery({
    queryKey: ["onboarding", "content"],
    queryFn: async () => {
      const res = await onboardingService.getContent();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useSaveOnboardingProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingService.saveProgress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "state"] }),
  });
};

export const usePresignOnboardingDocument = () =>
  useMutation({ mutationFn: onboardingService.presignDocument });

export const useRegisterOnboardingDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingService.registerDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "state"] }),
  });
};

export const useUploadOnboardingDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      onboardingService.uploadDocument(file, documentType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "state"] }),
  });
};

export const useDeleteOnboardingDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingService.deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "state"] }),
  });
};

export const usePresignProfilePhoto = () =>
  useMutation({ mutationFn: onboardingService.presignProfilePhoto });

export const useSubmitOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingService.submit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding", "state"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};
