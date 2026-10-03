import apiClient from "../client";
import type { ApiResponse } from "@/types";

export type MentorshipStats = {
  dailyTimeSpentHrs: number;
  dailyTimeGoalHrs: number;
  weeklyReportSubmitted: boolean;
  streakDays: number;
  totalEpisodes: number;
  completedEpisodes: number;
  tasksCompleted: number;
  tasksTotal: number;
  leaderboardRank: number | null;
  daysElapsed: number;
  totalDays: number;
  programName: string | null;
};

export type MentorshipRevenue = {
  weekNumber: number;
  year: number;
  revenueGenerated: number | null;
  revenuePrev: number | null;
  numberOfOrders: number | null;
  ordersPrev: number | null;
  adBudgetSpent: number | null;
  roas: number | null;
  customerAcqCost: number | null;
  organicLeads: number | null;
  leadsPrev: number | null;
  avgOrderValue: number | null;
  updatedAt: string | null;
};

export type UpsertRevenueBody = Partial<Omit<MentorshipRevenue, "weekNumber" | "year" | "updatedAt">>;

export const mentorshipService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<MentorshipStats>>("/api/user/mentorship/stats"),

  getRevenue: () =>
    apiClient.get<never, ApiResponse<MentorshipRevenue | null>>("/api/user/mentorship/revenue"),

  upsertRevenue: (data: UpsertRevenueBody) =>
    apiClient.put<never, ApiResponse<MentorshipRevenue>>("/api/user/mentorship/revenue", data),
};
