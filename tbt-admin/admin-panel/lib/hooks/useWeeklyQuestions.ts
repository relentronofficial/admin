import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
