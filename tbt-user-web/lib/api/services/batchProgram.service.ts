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
  /**
   * Point height on the milestone axis, from approved work only: 0 = baseline,
   * 1 = Ads, 2 = Website, 3 = Funnels (task progress never reaches the revenue
   * milestones). null for weeks that have not started — nothing is plotted.
   */
  progressLevel: number | null;
  /** graph_weeks.id, or null for a built-in default week (optional for older backends) */
  weekId?: string | null;
  /** Display label, e.g. "W1" or an admin-configured name */
  label?: string;
}

export interface WeeklyGraph {
  totalDays: number;
  currentDay: number;
  currentWeek: number;
  hasActivities: boolean;
  weeks: WeeklyGraphWeek[];
  summary: { total: number; completed: number; completionPercent: number | null };
  /** Y axis, bottom → top (progressLevel n = milestones[n - 1]); from the program's admin config or the defaults */
  config?: { source: "program" | "default"; milestones: WeeklyGraphMilestone[] };
}

export interface WeeklyGraphMilestone {
  id: string | null;
  label: string;
  kind: "activity" | "revenue";
  /** Explicit evidence only: an admin-approved linked task, or an admin/mentor-recorded achievement (optional for older backends). */
  reached?: boolean;
  /** Batch-program day of the linked task; null when none is linked, always null for revenue milestones. */
  dayNumber?: number | null;
}

export const batchProgramService = {
  /** null when the member is not in a batch */
  getMyWeeklyGraph: () =>
    apiClient.get<never, ApiResponse<WeeklyGraph | null>>("/api/user-batch/weekly-graph"),
};
