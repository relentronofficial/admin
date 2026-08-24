"use client";

import { useQuery } from "@tanstack/react-query";
import { ritualsService } from "@/lib/api/services/rituals.service";

export const useRitualHabits = () =>
  useQuery({
    queryKey: ["rituals", "habits"],
    queryFn: async () => {
      const res = await ritualsService.listHabits();
      return res.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

export const useRitualsButtonsConfig = () =>
  useQuery({
    queryKey: ["rituals", "buttons"],
    queryFn: async () => {
      const res = await ritualsService.getButtonsConfig();
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });
