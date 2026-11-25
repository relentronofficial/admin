import apiClient from "../client";
import type { ApiResponse } from "@/types";

export interface CourseWeeklyReport {
  id: string;
  memberId: string;
  courseId: string;
  weekNumber: number;
  progressPercentage: number;
  completedLessons: number;
  totalLessons: number;
  completedTitles: string[] | null;
  pendingTitles: string[] | null;
  remarks: string | null;
  status: "draft" | "sent" | "failed";
  whatsappStatus: "sent" | "failed" | "skipped" | null;
  whatsappSentAt: string | null;
  createdAt: string;
  course?: { id: string; title: string; slug: string };
}

export interface CourseWeeklyFeedback {
  id: string;
  memberId: string;
  courseId: string;
  weekNumber: number;
  feedback: string;
  remarks: string | null;
  status: "new" | "reviewed";
  whatsappStatus: "sent" | "failed" | "skipped" | null;
  submittedAt: string;
  course?: { id: string; title: string; slug: string };
}

export interface SubmitFeedbackBody {
  courseId: string;
  feedback: string;
  remarks?: string;
}

export type WeeklyAnswer = string | number | string[];

export interface WeeklyQuestion {
  id: string;
  question: string;
  help: string;
  type: "short_text" | "long_text" | "number" | "rating" | "yes_no" | "single_choice" | "multi_choice" | "date";
  required: boolean;
  options: string[];
}

/** This batch week's admin-written questions. `null` = free-text report. */
export interface WeeklyForm {
  week: number;
  totalWeeks: number;
  version: number;
  questions: WeeklyQuestion[];
  submitted: boolean;
  answers: Record<string, WeeklyAnswer>;
}

export interface SubmitWeeklyAnswersBody {
  courseId: string;
  week: number;
  version: number;
  answers: Record<string, WeeklyAnswer>;
}

export interface CourseEpisodeFeedback {
  id: string;
  memberId: string;
  courseId: string;
  episodeId: string;
  feedback: string;
  rating: number | null;
  liked: boolean | null;
  status: "new" | "reviewed";
  whatsappStatus: "sent" | "failed" | "skipped" | null;
  submittedAt: string;
}

export interface SubmitEpisodeFeedbackBody {
  courseId: string;
  episodeId: string;
  feedback?: string;
  rating?: number;
  liked?: boolean;
}

/** Mandatory weekly report state — see backend lib/weeklyReportGate.ts. */
export interface WeeklyReportStatus {
  required: boolean;
  submittedThisWeek: boolean;
  showReminder: boolean;
  locked: boolean;
  weekStart: string;
  deadline: string;
}

export const courseReportsService = {
  getWeeklyStatus: () =>
    apiClient.get<never, ApiResponse<WeeklyReportStatus>>("/api/course-reports/weekly-status"),

  getWeeklyForm: () =>
    apiClient.get<never, ApiResponse<WeeklyForm | null>>("/api/course-reports/weekly-form"),

  submitWeeklyAnswers: (body: SubmitWeeklyAnswersBody) =>
    apiClient.post<never, ApiResponse<{ status: string; feedbackId: string }>>(
      "/api/course-reports/weekly-answers",
      body,
    ),

  getCurrentReport: (courseId: string) =>
    apiClient.get<never, ApiResponse<CourseWeeklyReport>>("/api/course-reports/current", {
      params: { courseId },
    }),

  getReportHistory: (courseId: string) =>
    apiClient.get<never, ApiResponse<CourseWeeklyReport[]>>("/api/course-reports/mine", {
      params: { courseId },
    }),

  submitFeedback: (body: SubmitFeedbackBody) =>
    apiClient.post<never, ApiResponse<{ status: string; feedbackId: string }>>(
      "/api/course-reports/feedback",
      body,
    ),

  getFeedbackHistory: (courseId: string) =>
    apiClient.get<never, ApiResponse<CourseWeeklyFeedback[]>>("/api/course-reports/feedback/mine", {
      params: { courseId },
    }),

  submitEpisodeFeedback: (body: SubmitEpisodeFeedbackBody) =>
    apiClient.post<never, ApiResponse<{ status: string; feedbackId: string }>>(
      "/api/course-reports/episode-feedback",
      body,
    ),

  getMyEpisodeFeedback: (episodeId: string) =>
    apiClient.get<never, ApiResponse<CourseEpisodeFeedback | null>>("/api/course-reports/episode-feedback/mine", {
      params: { episodeId },
    }),
};
