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
  /** Tier Access: distinct qualifying active days in the program window (≤ totalDays). */
  activeDays?: number;
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
  rtoReturnsPercent: number | null;
  conversionRate: number | null;
  platformBadge: string | null;
  dailyRevenue: (number | null)[] | null;
  dailyOrders: (number | null)[] | null;
  updatedAt: string | null;
};

export type MentorshipSocial = {
  weekNumber: number;
  year: number;
  totalFollowers: number | null;
  followersPrev: number | null;
  videoViews: number | null;
  videoViewsPrev: number | null;
  contentUploads: number | null;
  contentUploadTarget: number;
  interactions: number | null;
  interactionsPrev: number | null;
  dmLeads: number | null;
  bioLinkClicks: number | null;
  bioLinkClicksPrev: number | null;
  updatedAt: string | null;
};

export type MentorshipModuleOption = {
  moduleName: string;
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  accentColor: string | null;
};

/** GET/PUT /api/user/mentorship/modules — the member's own onboarding choice. */
export type MentorshipModules = {
  /** null = never chosen. */
  selection: string[] | null;
  /** Modules the member currently sees (selection ∩ available). */
  effective: string[];
  /** True when the member has nothing usable selected and should choose. */
  selectionRequired: boolean;
  /** Modules the member may choose from. */
  options: MentorshipModuleOption[];
};

export type UpsertRevenueBody = Partial<Omit<MentorshipRevenue, "weekNumber" | "year" | "updatedAt">>;
export type UpsertSocialBody = Partial<Omit<MentorshipSocial, "weekNumber" | "year" | "updatedAt">>;

export const mentorshipService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<MentorshipStats>>("/api/user/mentorship/stats"),

  getRevenue: () =>
    apiClient.get<never, ApiResponse<MentorshipRevenue | null>>("/api/user/mentorship/revenue"),

  upsertRevenue: (data: UpsertRevenueBody) =>
    apiClient.put<never, ApiResponse<MentorshipRevenue>>("/api/user/mentorship/revenue", data),

  getSocial: () =>
    apiClient.get<never, ApiResponse<MentorshipSocial | null>>("/api/user/mentorship/social"),

  upsertSocial: (data: UpsertSocialBody) =>
    apiClient.put<never, ApiResponse<MentorshipSocial>>("/api/user/mentorship/social", data),

  getModules: () =>
    apiClient.get<never, ApiResponse<MentorshipModules>>("/api/user/mentorship/modules"),

  updateModules: (modules: string[]) =>
    apiClient.put<never, ApiResponse<MentorshipModules>>("/api/user/mentorship/modules", { modules }),
};
