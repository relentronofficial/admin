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

export const courseReportsService = {
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
};
