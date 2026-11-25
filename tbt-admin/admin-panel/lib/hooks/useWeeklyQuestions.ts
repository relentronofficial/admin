import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

export type QuestionType = "short_text" | "long_text" | "number" | "rating" | "yes_no" | "single_choice" | "multi_choice" | "date";

export interface WeeklyQuestion {
  id: string;
  question: string;
  help: string;
  type: QuestionType;
  required: boolean;
  options: string[];
}

export interface WeekForm { week: number; version: number; questions: WeeklyQuestion[] }
export interface BatchWeek { id: string; name: string; startsAt: string; members: number; week: number }

export interface WeeklyAnswerRow {
  id: string;
  weekNumber: number;
  submittedAt: string;
  memberId: string;
  memberName: string;
  phone: string | null;
  batchName: string | null;
  answers: Array<{ id: string; question: string; type: QuestionType; value: string | number | string[] | null }>;
}

const KEY = ["weekly-questions"];
const BASE = "/api/course-reports/admin";

export const useWeeklyQuestions = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => ((await apiClient.get(`${BASE}/questions`)) as any).data as { weeks: WeekForm[]; batches: BatchWeek[] },
  });

export function useSaveWeeklyQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ week, version, questions }: WeekForm) =>
      ((await apiClient.put(`${BASE}/questions/${week}`, { version, questions })) as any).data as WeekForm,
    onSuccess: (saved) =>
      qc.setQueryData(KEY, (old: any) => old && { ...old, weeks: old.weeks.map((w: WeekForm) => (w.week === saved.week ? saved : w)) }),
  });
}

export const useWeeklyAnswers = (params: { week?: number; batchId?: string; page: number }) =>
  useQuery({
    queryKey: ["weekly-answers", params],
    queryFn: async () => {
      const res: any = await apiClient.get(`${BASE}/answers`, { params });
      return { rows: res.data as WeeklyAnswerRow[], total: res.meta.total as number, limit: res.meta.limit as number };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
