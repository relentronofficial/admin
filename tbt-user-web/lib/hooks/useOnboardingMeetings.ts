"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { onboardingMeetingsService } from "@/lib/api/services/onboardingMeetings.service";

export const useMyOnboardingMeetings = () =>
  useQuery({
    queryKey: ["onboarding-meetings", "mine"],
    queryFn: async () => {
      const res = await onboardingMeetingsService.list();
      return res.data;
    },
  });

export const useJoinOnboardingMeeting = () =>
  useMutation({
    mutationFn: (id: string) => onboardingMeetingsService.join(id),
  });

export const useLeaveOnboardingMeeting = () =>
  useMutation({
    mutationFn: (id: string) => onboardingMeetingsService.leave(id),
  });
