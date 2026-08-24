import apiClient from "../client";
import type { ApiResponse } from "@/types";
import type { Habit, RitualsButtonsConfig } from "@/types";

export const ritualsService = {
  listHabits: () =>
    apiClient.get<never, ApiResponse<Habit[]>>("/api/rituals/habits"),

  getButtonsConfig: () =>
    apiClient.get<never, ApiResponse<RitualsButtonsConfig>>("/api/rituals/buttons"),
};
