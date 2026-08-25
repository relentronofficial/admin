import apiClient from "../client";
import type { ApiResponse, Course, CourseEnrollment, Lesson, LessonProgress } from "@/types";

export interface ListCoursesParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  enrolled?: boolean;
  sort?: "newest" | "popular";
  category?: string;
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

  markLessonComplete: (courseId: string, lessonId: string, watchedSeconds?: number, deltaSeconds?: number, isCompleted?: boolean, videoDuration?: number) =>
    apiClient.post<never, ApiResponse<LessonProgress>>(`/api/user/enrollments/${courseId}/progress/${lessonId}`, {
      watchedSeconds,
      deltaSeconds,
      isCompleted,
      videoDuration,
    }),

  submitQuiz: (courseId: string, episodeId: string, answers: Record<string, string>) =>
    apiClient.post<never, ApiResponse<any>>(`/api/user/courses/${courseId}/episodes/${episodeId}/quiz`, { answers }),

  getCourseXp: (courseId: string) =>
    apiClient.get<never, ApiResponse<any>>(`/api/user/courses/${courseId}/xp`),

  getCourseLeaderboard: (courseId: string) =>
    apiClient.get<never, ApiResponse<any>>(`/api/user/courses/${courseId}/leaderboard`),

  getUserBadges: () =>
    apiClient.get<never, ApiResponse<any[]>>("/api/user/badges"),

  getCertificateEligibility: (courseId: string) =>
    apiClient.get<never, ApiResponse<any>>(`/api/user/courses/${courseId}/certificate-eligibility`),

  requestAccess: (courseId: string) =>
    apiClient.post<never, ApiResponse<{ paymentId: string; paymentUrl: string }>>(`/api/user/courses/${courseId}/request-access`),

  saveReflection: (courseId: string, lessonId: string, text: string) =>
    apiClient.put<never, ApiResponse<{ saved: boolean }>>(`/api/user/courses/${courseId}/reflections/${lessonId}`, { text }),

  getReflections: (courseId: string) =>
    apiClient.get<never, ApiResponse<Array<{ lessonId: string; text: string; savedAt: string }>>>(`/api/user/courses/${courseId}/reflections`),
};
