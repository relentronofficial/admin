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
