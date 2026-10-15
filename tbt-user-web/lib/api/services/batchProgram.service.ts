import apiClient from "../client";
import type { ApiResponse } from "@/types";

// Mirrors backend src/lib/weeklyGraphLogic.ts (GET /api/user-batch/weekly-graph).
export type WeeklyGraphActivityStatus =
  | "completed"
  | "submitted"
  | "needs_revision"
  | "in_progress"
  | "not_started"
  | "upcoming";

export interface WeeklyGraphActivity {
  taskId: string;
  title: string;
  dayNumber: number;
  isRequired: boolean;
  status: WeeklyGraphActivityStatus;
  completed: boolean;
}

export interface WeeklyGraphWeek {
  weekNumber: number;
  startDay: number;
  endDay: number;
  isCurrent: boolean;
  activities: WeeklyGraphActivity[];
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  /** null when the week has no assigned activities — nothing is plotted for it */
  completionPercent: number | null;
}

export interface WeeklyGraph {
  totalDays: number;
  currentDay: number;
  currentWeek: number;
  hasActivities: boolean;
  weeks: WeeklyGraphWeek[];
  summary: { total: number; completed: number; completionPercent: number | null };
}

export const batchProgramService = {
  /** null when the member is not in a batch */
  getMyWeeklyGraph: () =>
    apiClient.get<never, ApiResponse<WeeklyGraph | null>>("/api/user-batch/weekly-graph"),
};
