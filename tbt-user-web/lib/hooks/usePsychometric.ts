"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { psychometricService } from "@/lib/api/services/psychometric.service";

export const psychometricKeys = {
  settings: ["psychometric", "settings"] as const,
  result: ["psychometric", "result"] as const,
  retest: ["psychometric", "retest"] as const,
};

export const usePsychometricSettings = () =>
  useQuery({
    queryKey: psychometricKeys.settings,
    queryFn: async () => (await psychometricService.settings()).data,
    staleTime: 5 * 60 * 1000,
  });

/** The member's latest result, or null when they haven't completed the assessment (404). */
export const usePsychometricResult = () =>
  useQuery({
    queryKey: psychometricKeys.result,
    queryFn: async () => {
      try {
        return await psychometricService.result();
      } catch (e) {
        if ((e as Error).message === "No result found.") return null;
        throw e;
      }
    },
  });

export const usePsychometricRetest = () =>
  useQuery({
    queryKey: psychometricKeys.retest,
    queryFn: async () => (await psychometricService.myRetest()).retest,
  });

export const useRequestPsychometricRetest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => psychometricService.requestRetest(reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: psychometricKeys.result });
      qc.invalidateQueries({ queryKey: psychometricKeys.retest });
    },
  });
};
