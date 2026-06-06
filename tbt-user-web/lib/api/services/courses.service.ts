import apiClient from "../client";
import type { ApiResponse, Course, CourseEnrollment, Lesson, LessonProgress } from "@/types";

export interface ListCoursesParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  enrolled?: boolean;
}

export const coursesService = {
  list: (params: ListCoursesParams = {}) =>
    apiClient.get<never, ApiResponse<Course[]>>("/api/user/courses", { params }),

  getById: (id: string) =>
    apiClient.get<never, ApiResponse<Course & { lessons: Lesson[] }>>(`/api/user/courses/${id}`),

  getEnrollments: () =>
    apiClient.get<never, ApiResponse<CourseEnrollment[]>>("/api/user/enrollments"),

  enroll: (courseId: string) =>
    apiClient.post<never, ApiResponse<CourseEnrollment>>(`/api/user/courses/${courseId}/enroll`),

  getLessonProgress: (courseId: string) =>
    apiClient.get<never, ApiResponse<LessonProgress[]>>(`/api/user/enrollments/${courseId}/progress`),

  markLessonComplete: (courseId: string, lessonId: string, watchedSeconds?: number, deltaSeconds?: number, isCompleted?: boolean) =>
    apiClient.post<never, ApiResponse<LessonProgress>>(`/api/user/enrollments/${courseId}/progress/${lessonId}`, {
      watchedSeconds,
      deltaSeconds,
      isCompleted,
    }),
};
