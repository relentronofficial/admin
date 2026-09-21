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
  moduleTitle?: string;
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

  markLessonComplete: (courseId: string, lessonId: string, watchedSeconds?: number, deltaSeconds?: number, isCompleted?: boolean, videoDuration?: number, timerStartedAt?: number, timerSeconds?: number) =>
    apiClient.post<never, ApiResponse<LessonProgress>>(`/api/user/enrollments/${courseId}/progress/${lessonId}`, {
      watchedSeconds,
      deltaSeconds,
      isCompleted,
      videoDuration,
      timerStartedAt,
      timerSeconds,
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

  saveLessonFeedback: (courseId: string, lessonId: string, body: { rating: number; feedbackText?: string; liked?: boolean }) =>
    apiClient.put<never, ApiResponse<{ saved: boolean }>>(`/api/user/courses/${courseId}/lesson-feedback/${lessonId}`, body),

  getLessonFeedback: (courseId: string) =>
    apiClient.get<never, ApiResponse<Array<{ lessonId: string; rating: number; feedbackText: string | null; liked: boolean | null; updatedAt: string }>>>(`/api/user/courses/${courseId}/lesson-feedback`),

  getCategories: () =>
    apiClient.get<never, ApiResponse<Array<{ id: string; name: string }>>>("/api/user/courses/categories"),

  getModuleTabs: () =>
    apiClient.get<never, ApiResponse<Array<{ title: string }>>>("/api/user/courses/module-tabs"),

  getEpisodeResources: (episodeId: string) =>
    apiClient.get<never, ApiResponse<EpisodeResource[]>>(`/api/user/episodes/${episodeId}/resources`),

  getEpisodeTasks: (episodeId: string) =>
    apiClient.get<never, ApiResponse<EpisodeTask[]>>(`/api/user/episodes/${episodeId}/tasks`),

  submitEpisodeTask: (episodeId: string, taskId: string, body: { responseValue?: string; proofUrl?: string; proofType?: string }) =>
    apiClient.post<never, ApiResponse<EpisodeTaskSubmissionResult>>(`/api/user/episodes/${episodeId}/tasks/${taskId}/submit`, body),

  uploadTaskProofFile: (queryParams: string, file: File) =>
    apiClient.post<never, ApiResponse<{ publicUrl: string }>>(`/api/upload/image?${queryParams}`, file, {
      headers: { "Content-Type": file.type },
    }),

  getStreakPoints: () =>
    apiClient.get<never, ApiResponse<StreakPointsSummary>>("/api/user/streak-points"),

  startEpisodeTimer: (episodeId: string, durationSeconds: number) =>
    apiClient.post<never, ApiResponse<EpisodeTimerSession>>(`/api/user/episodes/${episodeId}/timer/start`, { durationSeconds }),

  getEpisodeTimerSession: (episodeId: string) =>
    apiClient.get<never, ApiResponse<EpisodeTimerSession | null>>(`/api/user/episodes/${episodeId}/timer/session`),

  heartbeatEpisodeTimer: (episodeId: string, completed?: boolean) =>
    apiClient.post<never, ApiResponse<{ status: string; remainingSeconds: number }>>(`/api/user/episodes/${episodeId}/timer/heartbeat`, { completed }),

  getEpisodeLifelines: (episodeId: string) =>
    apiClient.get<never, ApiResponse<EpisodeLifelineState>>(`/api/user/episodes/${episodeId}/lifelines`),

  useEpisodeLifeline: (episodeId: string, type: 'free' | 'coin') =>
    apiClient.post<never, ApiResponse<{ freeRemaining: number; totalUsed: number; coinsDeducted?: number; remainingCoins?: number }>>(`/api/user/episodes/${episodeId}/lifelines/use`, { type }),
};

export interface StreakPointsHistoryEntry {
  type: "video" | "task";
  title: string;
  points: number;
  createdAt: string;
}

export interface StreakPointsSummary {
  total: number;
  videoTotal: number;
  taskTotal: number;
  history: StreakPointsHistoryEntry[];
}

export interface EpisodeResource {
  id: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileTypeIconUrl?: string | null;
  downloadLabel?: string | null;
}

export type TaskCompletionMode = "SELF_ASSESSMENT" | "ADMIN_CHECK";
export type TaskSubmissionStatus = "pending" | "approved" | "rejected" | "resubmission_required";

export interface EpisodeTaskSubmission {
  id: string;
  status: TaskSubmissionStatus;
  feedback?: string | null;
  responseValue?: string | null;
  proofUrl?: string | null;
  proofType?: string | null;
  createdAt?: string;
}

export interface EpisodeTaskSubmissionResult {
  id: string;
  status: TaskSubmissionStatus;
  feedback?: string | null;
  completionMode?: TaskCompletionMode;
}

export interface EpisodeTimerSession {
  id?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  durationSeconds?: number;
  startedAt?: string;
  expiresAt?: string;
  completedAt?: string | null;
  remainingSeconds: number;
}

export interface EpisodeLifelineState {
  lifelineEnabled: boolean;
  lifelineCount: number;
  lifelineCoinCost: number;
  maxPurchasedLifelines: number;
  freeUsed: number;
  purchasedUsed: number;
  totalUsed: number;
  freeRemaining: number;
}

export interface EpisodeTask {
  id: string;
  title: string;
  description?: string | null;
  deliverables?: string | null;
  estimatedMinutes?: number | null;
  basePoints?: number | null;
  proofType?: string | null;
  completionMode: TaskCompletionMode;
  submission: EpisodeTaskSubmission | null;
}
