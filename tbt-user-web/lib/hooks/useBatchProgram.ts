"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";

export type TaskSubmissionProof = { value?: string; url?: string; type: string };

export const useMyBatchProgram = () =>
  useQuery({
    queryKey: ["my-batch"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user-batch");
      return res.data as {
        batch: any;
        days: any[];
        progress: any[];
        attendance?: any[];
        breaks?: any[];
        totalDays?: number;
        programName?: string | null;
        programTasks?: {
          id: string;
          dayNumber: number;
          title: string;
          description?: string | null;
          deliverables?: string | null;
          contentUrl?: string | null;
          basePoints: number;
          bonusPoints: number;
          proofType: string;
          estimatedMinutes: number;
          timerSeconds?: number | null;
          isMilestone: boolean;
          milestoneLabel?: string | null;
          sortOrder: number;
        }[];
        mySubmissions?: {
          id: string;
          taskId: string;
          dayNumber: number;
          status: string;
          responseValue?: string | null;
          proofUrl?: string | null;
          proofType?: string | null;
        }[];
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
      taskSubmissions,
    }: {
      dayNumber: number;
      journalEntry?: string;
      journalFileUrl?: string;
      completedTaskIds?: string[];
      taskSubmissions?: Record<string, TaskSubmissionProof>;
    }) => {
      const res: any = await apiClient.put(`/api/user-batch/${dayNumber}`, {
        journalEntry,
        journalFileUrl,
        completedTaskIds,
        taskSubmissions,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-batch"] }),
  });
};

export const useUploadTaskProof = () => {
  const upload = async (file: File, batchId: string, dayNumber: number): Promise<string> => {
    const res: any = await apiClient.post('/api/upload/presigned-url', {
      filename: file.name,
      contentType: file.type,
      bucket: 'batch-proofs',
      pathPrefix: `${batchId}/day-${dayNumber}`,
    });
    const { uploadUrl, publicUrl } = res.data;
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  };
  return { upload };
};

export const useSubmitBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dayNumber: number) => {
      const res: any = await apiClient.post(`/api/user-batch/${dayNumber}/submit`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-batch"] }),
  });
};

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dayNumber: number; notes?: string }) =>
      apiClient.post('/api/user-batch/attendance', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-batch'] }),
  });
};

export const useRequestBreak = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { startDay: number; endDay: number; reason?: string }) =>
      apiClient.post('/api/user-batch/break', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-batch'] }),
  });
};

export const useSpendCoins = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const res: any = await apiClient.post('/api/user-batch/spend-coins', { amount });
      return res.data as { remainingCoins: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user", "me"] }),
  });
};

export const useDownloadBatchCertificate = () => {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get('/api/user-batch/certificate', { responseType: 'blob' } as any);
      const blob = new Blob([(res as any).data ?? res as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'batch-certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
};
