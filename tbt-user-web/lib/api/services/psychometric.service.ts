import apiClient from "../client";
import type { AssessmentSection, SubmitEntry } from "@/lib/psychometric/assessmentFlow";

// Psychometric assessment (members take it with their TBT login). Backend:
// tbt-admin/backend/src/modules/psychometric-platform (memberRoutes.ts).
const BASE = "/api/user/psychometric-assessment";

export interface PsychometricResult {
  _id: string;
  userId: { _id: string; name: string; email: string | null; sharedCode: string | null; sharedUserID: { _id: string; label: string } | string | null } | null;
  attemptNumber: number;
  totalMarks: number;
  maxScore: number;
  percentage: number;
  level: "Excellent" | "Good" | "Average" | "Needs Improvement";
  categoryPercentages: Record<string, number>;
  dimensionPercentages?: Record<string, number>;
  explanation: string;
  improvementAreas: { category: string; score: number; suggestion: string }[];
  recommendedBusiness: string[];
  recommendations: { business: string; explanation: string }[];
  strongDimensions: string[];
  weakDimensions: string[];
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  aptitudeScore?: number;
  personalityScore?: number;
  businessMindsetScore?: number;
  financialAwarenessScore?: number;
  createdAt: string;
}

export interface RetestState {
  status: "none" | "pending" | "approved" | "rejected" | "used" | "expired";
  rejectionNote?: string;
  canRequest: boolean;
}

export interface ResultResponse {
  success: boolean;
  data: PsychometricResult;
  attemptNumber: number;
  history: { _id: string; attemptNumber: number; percentage: number; level: string; createdAt: string }[];
  retest: RetestState;
}

export interface QuestionsResponse {
  success: boolean;
  data: AssessmentSection[];
  remainingSeconds: number;
  session: { sessionId: string; expiresAt: string } | null;
}

/** One question of the member's submitted attempt, with what they answered (GET /answers). */
export interface ReviewQuestion {
  _id: string;
  text: string;
  order: number;
  questionType: string;
  language: "en" | "ta";
  timeLimitSeconds: number | null;
  instructionText: string;
  imageUrl: string;
  options: { _id: string; optionText: string; optionImageUrl: string; order: number }[];
  answer: { status: "answered" | "skipped" | "timeout"; selectedOptionIds: string[]; timeTakenSeconds: number | null } | null;
}

export interface AnswersReview {
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  durationMinutes: number | null;
  sections: { typeId: string; typeName: string; typeIcon?: string; typeColor?: string; questions: ReviewQuestion[] }[];
}

export interface StartResponse {
  success: boolean;
  sessionId: string;
  expiresAt: string;
  attemptNumber: number;
  resumed?: boolean;
}

export const psychometricService = {
  settings: () => apiClient.get<never, { success: boolean; data: { assessment_duration_minutes: number } }>(`${BASE}/settings`),
  questions: () => apiClient.get<never, QuestionsResponse>(`${BASE}/questions`),
  start: () => apiClient.post<never, StartResponse>(`${BASE}/start`, {}),
  submit: (sessionId: string, answers: SubmitEntry[]) =>
    apiClient.post<never, { success: boolean; resultId: string }>(`${BASE}/submit`, { sessionId, answers }),
  result: () => apiClient.get<never, ResultResponse>(`${BASE}/result`),
  answers: () => apiClient.get<never, { success: boolean; data: AnswersReview }>(`${BASE}/answers`),
  myRetest: () => apiClient.get<never, { success: boolean; retest: RetestState }>(`${BASE}/retest/my-request`),
  requestRetest: (reason?: string) =>
    apiClient.post<never, { success: boolean; message: string }>(`${BASE}/retest/request`, reason ? { reason } : {}),
  /** Cached neural mp3 for a question ("audio") or its spoken explanation ("explanation-audio"). */
  audio: (questionId: string, kind: "audio" | "explanation-audio") =>
    apiClient.get<never, Blob>(`${BASE}/questions/${questionId}/${kind}`, { responseType: "blob" }),
};
