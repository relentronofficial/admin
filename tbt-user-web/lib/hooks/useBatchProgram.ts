"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";

export const useMyBatchProgram = () =>
  useQuery({
    queryKey: ["my-batch-program"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user-batch");
      return res.data as {
        batch: any;
        days: any[];
        progress: any[];
      } | null;
    },
    staleTime: 30_000,
  });

export const useSaveBatchDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dayNumber,
      journalEntry,
      journalFileUrl,
      completedTaskIds,
    }: {
      dayNumber: number;
      journalEntry?: string;
      journalFileUrl?: string;
      completedTaskIds?: string[];
    }) => {
      const res: any = await apiClient.put(`/api/user-batch/${dayNumber}`, {
        journalEntry,
        journalFileUrl,
        completedTaskIds,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-batch-program"] }),
  });
};

export const useSubmitBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dayNumber: number) => {
      const res: any = await apiClient.post(`/api/user-batch/${dayNumber}/submit`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-batch-program"] }),
  });
};
