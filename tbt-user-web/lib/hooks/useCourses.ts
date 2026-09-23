"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesService, type ListCoursesParams } from "@/lib/api/services/courses.service";
export type { EpisodeResource, EpisodeTask, EpisodeTaskSubmission, TaskCompletionMode, TaskSubmissionStatus, StreakPointsSummary, StreakPointsHistoryEntry, EpisodeTimerSession, EpisodeLifelineState, RazorpayOrderResult } from "@/lib/api/services/courses.service";

export const useCourses = (params: ListCoursesParams = {}) =>
  useQuery({
    queryKey: ["courses", params],
    queryFn: async () => {
      const res = await coursesService.list(params);
      return res;
    },
    staleTime: 60 * 1000,
  });

export const useCourse = (id: string) =>
  useQuery({
    queryKey: ["courses", id],
    queryFn: async () => {
      const res = await coursesService.getById(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });

export const useMyEnrollments = () =>
  useQuery({
    queryKey: ["user", "enrollments"],
    queryFn: async () => {
      const res = await coursesService.getEnrollments();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

export const useEnrollCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => coursesService.enroll(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "enrollments"] });
    },
  });
};

export const useLessonProgress = (courseId: string) =>
  useQuery({
    queryKey: ["user", "progress", courseId],
    queryFn: async () => {
      const res = await coursesService.getLessonProgress(courseId);
      return res.data;
    },
    enabled: !!courseId,
  });

export const useMarkLessonComplete = (courseId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, watchedSeconds, deltaSeconds, isCompleted, videoDuration, timerStartedAt, timerSeconds }: { lessonId: string; watchedSeconds?: number; deltaSeconds?: number; isCompleted?: boolean; videoDuration?: number; timerStartedAt?: number; timerSeconds?: number }) =>
      coursesService.markLessonComplete(courseId, lessonId, watchedSeconds, deltaSeconds, isCompleted, videoDuration, timerStartedAt, timerSeconds),
    onMutate: async ({ lessonId, isCompleted }) => {
      if (!isCompleted) return;
      await queryClient.cancelQueries({ queryKey: ["user", "progress", courseId] });
      const previous = queryClient.getQueryData(["user", "progress", courseId]);
      queryClient.setQueryData(["user", "progress", courseId], (old: any) => {
        if (!Array.isArray(old)) return old;
        const exists = old.some((p: any) => p.lessonId === lessonId);
        if (exists) return old.map((p: any) => p.lessonId === lessonId ? { ...p, completed: true } : p);
        return [...old, { lessonId, completed: true, completedAt: new Date().toISOString() }];
      });
      return { previous };
    },
    onError: (_err, { isCompleted }, context: any) => {
      if (isCompleted && context?.previous !== undefined) {
        queryClient.setQueryData(["user", "progress", courseId], context.previous);
      }
    },
    onSuccess: (_data, { isCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ["user", "progress", courseId] });
      if (isCompleted) {
        // Invalidate course data so the `locked` field on subsequent lessons
        // refreshes immediately (sequential-unlock UI update).
        queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
        queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["user", "enrollments"] });
        queryClient.invalidateQueries({ queryKey: ["course-xp", courseId] });
        queryClient.invalidateQueries({ queryKey: ["course-leaderboard", courseId] });
        queryClient.invalidateQueries({ queryKey: ["certificate-eligibility", courseId] });
      }
    },
  });
};

export const useSubmitCourseQuiz = (courseId: string, episodeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: Record<string, string>) => coursesService.submitQuiz(courseId, episodeId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-xp", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-leaderboard", courseId] });
    },
  });
};

export const useCourseXp = (courseId: string) =>
  useQuery({
    queryKey: ["course-xp", courseId],
    queryFn: async () => {
      const res = await coursesService.getCourseXp(courseId);
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 30 * 1000,
  });

export const useCourseLeaderboard = (courseId: string) =>
  useQuery({
    queryKey: ["course-leaderboard", courseId],
    queryFn: async () => {
      const res = await coursesService.getCourseLeaderboard(courseId);
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 60 * 1000,
  });

export const useUserBadges = () =>
  useQuery({
    queryKey: ["user", "badges"],
    queryFn: async () => {
      const res = await coursesService.getUserBadges();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCertificateEligibility = (courseId: string) =>
  useQuery({
    queryKey: ["certificate-eligibility", courseId],
    queryFn: async () => {
      const res = await coursesService.getCertificateEligibility(courseId);
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 30 * 1000,
  });

export const useRequestCourseAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => coursesService.requestAccess(courseId),
    onSuccess: (_data, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
    },
  });
};

export const useCreateRazorpayOrder = () =>
  useMutation({
    mutationFn: (courseId: string) => coursesService.createRazorpayOrder(courseId),
  });

export const useVerifyRazorpayPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      courseId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      paymentRecordId: string;
    }) => coursesService.verifyRazorpayPayment(params),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};

export const useCourseCategories = () =>
  useQuery({
    queryKey: ["course-categories"],
    queryFn: async () => {
      const res = await coursesService.getCategories();
      return res.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

export const useCourseModuleTabs = () =>
  useQuery({
    queryKey: ["course-module-tabs"],
    queryFn: async () => {
      const res = await coursesService.getModuleTabs();
      return res.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

export const useReflections = (courseId: string) =>
  useQuery({
    queryKey: ["course-reflections", courseId],
    queryFn: async () => {
      const res = await coursesService.getReflections(courseId);
      return res.data ?? [];
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

export const useSaveReflection = (courseId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, text }: { lessonId: string; text: string }) =>
      coursesService.saveReflection(courseId, lessonId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-reflections", courseId] });
    },
  });
};

export const useLessonFeedback = (courseId: string) =>
  useQuery({
    queryKey: ["lesson-feedback", courseId],
    queryFn: async () => {
      const res = await coursesService.getLessonFeedback(courseId);
      return res.data ?? [];
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

export const useSaveLessonFeedback = (courseId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, rating, feedbackText, liked }: { lessonId: string; rating: number; feedbackText?: string; liked?: boolean }) =>
      coursesService.saveLessonFeedback(courseId, lessonId, { rating, feedbackText, liked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-feedback", courseId] });
    },
  });
};

export const useEpisodeResources = (episodeId: string | null | undefined) =>
  useQuery({
    queryKey: ["episode-resources", episodeId],
    queryFn: async () => {
      const res = await coursesService.getEpisodeResources(episodeId!);
      return res.data ?? [];
    },
    enabled: !!episodeId,
    staleTime: 5 * 60 * 1000,
  });

export const useEpisodeTasks = (episodeId: string | null | undefined) =>
  useQuery({
    queryKey: ["episode-tasks", episodeId],
    queryFn: async () => {
      const res = await coursesService.getEpisodeTasks(episodeId!);
      return res.data ?? [];
    },
    enabled: !!episodeId,
    staleTime: 5 * 60 * 1000,
  });

export const useSubmitEpisodeTask = (episodeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { taskId: string; responseValue?: string; proofUrl?: string; proofType?: string }) =>
      coursesService.submitEpisodeTask(episodeId!, body.taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-tasks", episodeId] });
    },
  });
};

export const useMyStreakPoints = () =>
  useQuery({
    queryKey: ["user", "streak-points"],
    queryFn: async () => {
      const res = await coursesService.getStreakPoints();
      return res.data;
    },
    staleTime: 30 * 1000,
  });

export const useUploadEpisodeTaskProof = (episodeId: string | null | undefined) => {
  return async (file: File, taskId: string): Promise<string> => {
    // Route through the backend upload endpoint to avoid CORS issues with direct R2 PUT.
    const params = new URLSearchParams({
      pathPrefix: `task-proofs/${episodeId}/${taskId}`,
      filename: file.name,
    }).toString();
    const res = await coursesService.uploadTaskProofFile(params, file);
    const publicUrl = (res as any)?.data?.publicUrl ?? (res as any)?.publicUrl;
    if (!publicUrl) throw new Error('Upload failed: no public URL returned');
    return publicUrl;
  };
};

export const useEpisodeTimerSession = (episodeId: string | null | undefined) =>
  useQuery({
    queryKey: ["episode-timer-session", episodeId],
    queryFn: async () => {
      const res = await coursesService.getEpisodeTimerSession(episodeId!);
      return res.data ?? null;
    },
    enabled: !!episodeId,
    staleTime: 0,
    gcTime: 0,
  });

export const useStartEpisodeTimer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, durationSeconds }: { episodeId: string; durationSeconds: number }) =>
      coursesService.startEpisodeTimer(episodeId, durationSeconds),
    onSuccess: (_, { episodeId }) => {
      queryClient.invalidateQueries({ queryKey: ["episode-timer-session", episodeId] });
    },
  });
};

export const useHeartbeatEpisodeTimer = () =>
  useMutation({
    mutationFn: ({ episodeId, completed }: { episodeId: string; completed?: boolean }) =>
      coursesService.heartbeatEpisodeTimer(episodeId, completed),
  });

export const useEpisodeLifelines = (episodeId: string | null | undefined) =>
  useQuery({
    queryKey: ["episode-lifelines", episodeId],
    queryFn: async () => {
      const res = await coursesService.getEpisodeLifelines(episodeId!);
      return res.data ?? null;
    },
    enabled: !!episodeId,
    staleTime: 30 * 1000,
  });

export const useUseEpisodeLifeline = (episodeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: 'free' | 'coin') =>
      coursesService.useEpisodeLifeline(episodeId!, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-lifelines", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
};
