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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
    },
  });
};
