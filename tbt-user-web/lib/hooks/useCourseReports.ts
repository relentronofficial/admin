"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { courseReportsService, type SubmitEpisodeFeedbackBody, type SubmitFeedbackBody } from "@/lib/api/services/courseReports.service";

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
