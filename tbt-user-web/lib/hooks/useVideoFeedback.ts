"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";

export interface FeedbackQuestion {
  id: string;
  questionText: string;
  questionType: "rating" | "yes_no";
  sortOrder: number;
}

export interface FeedbackResponse {
  questionId: string;
  ratingValue?: number;
  yesNoValue?: boolean;
}

export const useVideoFeedbackQuestions = (episodeId: string | null, episodeType = "course") =>
  useQuery<FeedbackQuestion[]>({
    queryKey: ["video-feedback", episodeId, episodeType],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/video-feedback/episodes/${episodeId}/questions`, {
        params: { episodeType },
      });
      return res.data ?? [];
    },
    enabled: !!episodeId,
    staleTime: 0,
  });

export const useSubmitVideoFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      episodeId,
      episodeType = "course",
      responses,
    }: {
      episodeId: string;
      episodeType?: string;
      responses: FeedbackResponse[];
    }) => {
      await apiClient.post(`/api/video-feedback/episodes/${episodeId}/responses`, {
        episodeType,
        responses,
      });
    },
    onSuccess: (_data, vars) => {
      // Invalidate so if the modal is re-opened it won't show again
      qc.invalidateQueries({ queryKey: ["video-feedback", vars.episodeId, vars.episodeType ?? "course"] });
    },
  });
};
