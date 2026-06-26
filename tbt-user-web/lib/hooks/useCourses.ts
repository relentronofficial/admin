"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesService, type ListCoursesParams } from "@/lib/api/services/courses.service";

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
    mutationFn: ({ lessonId, watchedSeconds, deltaSeconds, isCompleted }: { lessonId: string; watchedSeconds?: number; deltaSeconds?: number; isCompleted?: boolean }) =>
      coursesService.markLessonComplete(courseId, lessonId, watchedSeconds, deltaSeconds, isCompleted),
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
        queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
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
