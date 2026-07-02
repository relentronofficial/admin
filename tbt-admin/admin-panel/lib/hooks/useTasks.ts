import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface TaskInitiativeInput {
  programId: string;
  stepId?: string;
  dayNumber: number;
  title: string;
  description?: string;
  deliverables?: string;
  contentUrl?: string;
  basePoints?: number;
  proofType?: string;
  estimatedMinutes?: number;
  isMilestone?: boolean;
  milestoneLabel?: string;
  bonusPoints?: number;
  sortOrder?: number;
}

export const useCreateTaskInitiative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TaskInitiativeInput) => {
      const res: any = await apiClient.post('/api/tasks/initiative', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useListTasks = (params?: { programId?: string; stepId?: string }) => {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/tasks', { params });
      return res.data || res;
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskInitiativeInput> }) => {
      const res: any = await apiClient.put(`/api/tasks/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/tasks/${id}`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
  });
};

// ── Inline batch task hooks (tasks table with batchId, no programId) ──────────

export const useListBatchTasks = (batchId: string, dayNumber?: number) => {
  return useQuery({
    queryKey: ['batch-tasks', batchId, dayNumber],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/batches/${batchId}/tasks`, {
        params: dayNumber != null ? { dayNumber } : undefined,
      });
      return (res.data ?? res) as any[];
    },
    enabled: !!batchId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateBatchTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, data }: { batchId: string; data: Omit<TaskInitiativeInput, 'programId'> }) => {
      const res: any = await apiClient.post(`/api/batches/${batchId}/tasks`, data);
      return res.data ?? res;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['batch-tasks', vars.batchId] });
    },
  });
};

export const useUpdateBatchTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, taskId, data }: { batchId: string; taskId: string; data: Partial<TaskInitiativeInput> }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/tasks/${taskId}`, data);
      return res.data ?? res;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['batch-tasks', vars.batchId] });
    },
  });
};

export const useDeleteBatchTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, taskId }: { batchId: string; taskId: string }) => {
      await apiClient.delete(`/api/batches/${batchId}/tasks/${taskId}`);
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['batch-tasks', vars.batchId] });
    },
  });
};

export const useReorderBatchTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, ids }: { batchId: string; ids: string[] }) => {
      await apiClient.put(`/api/batches/${batchId}/tasks/reorder`, { ids });
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['batch-tasks', vars.batchId] });
    },
  });
};

export const useMigrateJsonTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const res: any = await apiClient.post(`/api/batches/${batchId}/tasks/migrate-json`);
      return res.data ?? res;
    },
    onSuccess: (_r, batchId) => {
      queryClient.invalidateQueries({ queryKey: ['batch-tasks', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-days', batchId] });
    },
  });
};

export const useGetBatchSubmissions = (
  batchId: string,
  params?: { dayNumber?: number; memberId?: string; status?: string; page?: number; limit?: number },
) => {
  return useQuery({
    queryKey: ['batch-submissions', batchId, params],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/batches/${batchId}/submissions`, { params });
      return res ?? {};
    },
    enabled: !!batchId,
    staleTime: 1000 * 60 * 2,
  });
};

export const useReviewTaskSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subId,
      action,
      feedback,
    }: {
      subId: string;
      action: 'approve' | 'reject';
      feedback?: string;
    }) => {
      const res: any = await apiClient.put(`/api/tasks/submissions/${subId}/review`, { action, feedback });
      return res.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-submissions'] });
    },
  });
};
