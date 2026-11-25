"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { courseReportsService, type SubmitEpisodeFeedbackBody, type SubmitFeedbackBody, type SubmitWeeklyAnswersBody } from "@/lib/api/services/courseReports.service";

/** Current week's report for a course. Resolves to `null` (not an error)
 * when the week's report hasn't been generated yet — that's an expected
 * state, not a failure, since generation happens at the end of each week. */
export function useMyCurrentCourseReport(courseId: string) {
  return useQuery({
    queryKey: ["course-reports", "current", courseId],
    queryFn: async () => {
      try {
        const res = await courseReportsService.getCurrentReport(courseId);
        return res.data ?? null;
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!courseId,
  });
}

export function useMyCourseReportHistory(courseId: string) {
  return useQuery({
    queryKey: ["course-reports", "history", courseId],
    queryFn: async () => {
      const res = await courseReportsService.getReportHistory(courseId);
      return res.data ?? [];
    },
    enabled: !!courseId,
  });
}

export function useSubmitCourseFeedback(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SubmitFeedbackBody, "courseId">) =>
      courseReportsService.submitFeedback({ ...body, courseId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-reports", "feedback", courseId] });
    },
  });
}

export function useMyCourseFeedbackHistory(courseId: string) {
  return useQuery({
    queryKey: ["course-reports", "feedback", courseId],
    queryFn: async () => {
      const res = await courseReportsService.getFeedbackHistory(courseId);
      return res.data ?? [];
    },
    enabled: !!courseId,
  });
}

/** The member's own feedback for one video/episode, if any — `null` (not an
 * error) when they haven't submitted feedback for this episode yet. */
export function useMyEpisodeFeedback(episodeId: string | null) {
  return useQuery({
    queryKey: ["course-reports", "episode-feedback", episodeId],
    queryFn: async () => {
      const res = await courseReportsService.getMyEpisodeFeedback(episodeId!);
      return res.data ?? null;
    },
    enabled: !!episodeId,
  });
}

export function useSubmitEpisodeFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitEpisodeFeedbackBody) => courseReportsService.submitEpisodeFeedback(body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["course-reports", "episode-feedback", vars.episodeId] });
    },
  });
}

/** General-purpose weekly report submit — courseId supplied at call time. */
export function useSubmitWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitFeedbackBody | SubmitWeeklyAnswersBody) =>
      "answers" in body ? courseReportsService.submitWeeklyAnswers(body) : courseReportsService.submitFeedback(body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["course-reports", "feedback", vars.courseId] });
      // Unlocks course videos (the course detail carries the playable URLs) and the
      // dashboard's "Weekly Report Submitted" tick.
      qc.invalidateQueries({ queryKey: ["course-reports", "weekly-status"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] });
    },
  });
}

/** This week's admin-written questions (`null` = free-text report). Read fresh each time the
 *  form opens, and left alone while the member is answering. */
export function useWeeklyForm() {
  return useQuery({
    queryKey: ["course-reports", "weekly-form"],
    queryFn: async () => (await courseReportsService.getWeeklyForm()).data ?? null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Mandatory weekly report status: Fri/Sat reminder + Saturday 18:00 video lock. Always
 *  refetched on mount/focus — the global QueryClient defaults to refetchOnMount: false. */
export function useWeeklyReportStatus(enabled = true) {
  return useQuery({
    queryKey: ["course-reports", "weekly-status"],
    queryFn: async () => (await courseReportsService.getWeeklyStatus()).data ?? null,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });
}
